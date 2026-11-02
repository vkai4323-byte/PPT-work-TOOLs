"""Capture real creator profiles from a UTF-8 job file through WebBridge."""
import argparse
import datetime as dt
import hashlib
import json
import re
import sys
import time
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

def validate_job(job):
    if not isinstance(job.get('session'), str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',job['session']):
        raise ValueError('invalid_session')
    seen=set()
    for person in job.get('creators',[]):
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',str(person.get('key',''))): raise ValueError('invalid_key')
        if person['key'] in seen: raise ValueError('duplicate_key')
        seen.add(person['key'])
        if person.get('platform') not in ('douyin','bilibili'): raise ValueError('invalid_platform')
        if not isinstance(person.get('identity'),str) or not person['identity'].isdigit(): raise ValueError('identity_must_be_digit_string')
        if not isinstance(person.get('name'),str) or not person['name'].strip(): raise ValueError('missing_name')
    if not seen: raise ValueError('empty_creators')

class BridgeError(RuntimeError):
    def __init__(self,code,state='technical_failed'):
        super().__init__(code);self.code=code;self.state=state

def validated_address(address):
    parsed=urllib.parse.urlsplit(address)
    if parsed.scheme!='http' or parsed.hostname not in ('127.0.0.1','localhost') or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('','/'):
        raise ValueError('only_local_bridge_address_allowed')
    if not parsed.port or not 1<=parsed.port<=65535:raise ValueError('invalid_bridge_port')
    return 'http://127.0.0.1:'+str(parsed.port)

def discover_address(binary=None):
    binary=Path(binary) if binary else Path.home()/'.kimi-webbridge/bin/kimi-webbridge.exe'
    if binary.is_file():
        try:
            result=subprocess.run([str(binary),'status'],capture_output=True,timeout=15)
            status=json.loads(result.stdout.decode('utf-8-sig'))
            if status.get('running') and status.get('port'):return validated_address('http://127.0.0.1:'+str(status['port']))
            if status.get('addr'):return validated_address('http://'+status['addr'])
        except (ValueError,OSError,subprocess.TimeoutExpired):pass
    return 'http://127.0.0.1:10086'

class Bridge:
    def __init__(self,session,address=None,binary=None):
        self.session=session;self.address=validated_address(address) if address else discover_address(binary)
    def call(self,action,args=None):
        body=json.dumps({'action':action,'args':args or {},'session':self.session},ensure_ascii=False).encode('utf-8')
        request=urllib.request.Request(self.address+'/command',data=body,headers={'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(request,timeout=45) as response: result=json.load(response)
        except (urllib.error.URLError,TimeoutError,OSError):raise BridgeError('bridge_unreachable') from None
        except ValueError:raise BridgeError('bridge_protocol_mismatch') from None
        if not result.get('ok'):
            error=result.get('error');code=error.get('code','') if isinstance(error,dict) else ''
            if code in ('extension_not_connected','not_logged_in','login_required'):raise BridgeError(code,'customer_action_required')
            if code in ('unsupported_action','unknown_action','version_mismatch'):raise BridgeError(code,'engineering_pending')
            raise BridgeError('bridge_action_failed')
        return result['data']
    def evaluate(self,code):
        result=self.call('evaluate',{'code':code})
        value=result.get('value',result)
        return json.loads(value) if isinstance(value,str) else value

def exact_douyin_profile(links,identity):
    matches=set()
    for link in links:
        url=urllib.parse.urlsplit(link.get('url',''))
        if url.scheme!='https' or url.hostname!='www.douyin.com' or not re.fullmatch(r'/user/[A-Za-z0-9_-]+',url.path): continue
        params=urllib.parse.parse_qs(url.query)
        try: search=json.loads(params.get('extra_params',['{}'])[0]).get('search_params',{})
        except (ValueError,AttributeError): continue
        if search.get('search_result_id')==identity:
            matches.add('https://www.douyin.com'+url.path)
    if len(matches)!=1: raise ValueError('ambiguous_or_missing_exact_user_id')
    return matches.pop()

PAGE_SCRIPT="""(()=>JSON.stringify({url:location.href,text:document.body.innerText.slice(0,6500),
videos:[...document.querySelectorAll('a[href]')].filter(a=>/\\/video\\//.test(a.href)).slice(0,24).map(a=>({url:a.href,text:a.innerText.slice(0,150),loaded:[...a.querySelectorAll('img')].some(i=>i.complete&&i.naturalWidth>100)}))}))()"""

def page_ready(data,person):
    url=urllib.parse.urlsplit(data.get('url',''))
    correct=(url.hostname=='www.douyin.com' and url.path.startswith('/user/')) if person['platform']=='douyin' else (url.hostname=='space.bilibili.com' and url.path.startswith('/'+person['identity']+'/'))
    return correct and person['name'] in data.get('text','') and sum(v.get('loaded',False) for v in data.get('videos',[]))>=2

def capture(person,bridge,output):
    if person['platform']=='douyin':
        bridge.call('navigate',{'url':'https://www.douyin.com/search/'+urllib.parse.quote(person['name'])+'?type=user','newTab':True,'group_title':'达人素材采集'})
        url=None
        for _ in range(12):
            links=bridge.evaluate("(()=>JSON.stringify([...document.querySelectorAll('a[href]')].filter(a=>a.href.includes('/user/')).map(a=>({url:a.href}))))()")
            try: url=exact_douyin_profile(links,person['identity']);break
            except ValueError: time.sleep(.8)
        if not url: raise ValueError('identity_not_resolved')
    else:
        url='https://space.bilibili.com/'+person['identity']+'/upload/video'
    bridge.call('navigate',{'url':url,'newTab':person['platform']=='bilibili','group_title':'达人素材采集'})
    bridge.call('cdp',{'method':'Emulation.setDeviceMetricsOverride','params':{'width':1200,'height':900,'deviceScaleFactor':1,'mobile':False}})
    try:
        data={}
        for _ in range(15):
            data=bridge.evaluate(PAGE_SCRIPT)
            if page_ready(data,person): break
            time.sleep(.8)
        if not page_ready(data,person): raise ValueError('profile_images_not_ready')
        # Never overwrite evidence from an earlier attempt.
        stamp=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        file=output/(person['key']+'-'+stamp+'.png')
        bridge.call('screenshot',{'format':'png','path':str(file)})
        if not file.is_file(): raise ValueError('screenshot_not_saved')
        from PIL import Image
        with Image.open(file) as im: im.verify()
        record={'key':person['key'],'identity':person['identity'],'name':person['name'],'platform':person['platform'],'url':url,'observed_at':dt.datetime.now(dt.timezone.utc).isoformat(),'file':str(file),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'status':'sourced','visual_review':'pending','videos':data['videos']}
        file.with_suffix('.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
        return record
    finally:
        bridge.call('cdp',{'method':'Emulation.clearDeviceMetricsOverride','params':{}})

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True)
    args=parser.parse_args();job=json.loads(args.input.read_text(encoding='utf-8-sig'));validate_job(job)
    output=Path(job['output_directory']).resolve();output.mkdir(parents=True,exist_ok=True)
    bridge=Bridge(job['session'],job.get('bridge_address'),job.get('bridge_binary'));results=[]
    for person in job['creators']:
        try: results.append(capture(person,bridge,output))
        except BridgeError as error:
            results.append({'key':person['key'],'status':'blocked','state':error.state,'reason':error.code})
        except Exception:
            results.append({'key':person['key'],'status':'blocked','state':'technical_failed','reason':'capture_failed_inspect_browser_state'})
    (output/'capture-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'sourced':sum(r['status']=='sourced' for r in results),'blocked':sum(r['status']=='blocked' for r in results),'report':str(output/'capture-results.json')}))
    return 2 if any(r['status']=='blocked' for r in results) else 0

if __name__=='__main__': raise SystemExit(main())
