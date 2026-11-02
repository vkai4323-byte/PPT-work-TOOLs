"""Initialize a local Xingtu session through observed WebBridge capture."""
import argparse,importlib.util,json,time
from pathlib import Path
from creator_capture import Bridge,BridgeError

def load_module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def search_ref(snapshot):
    refs=set()
    def walk(node):
        if isinstance(node,dict):
            if node.get('name')=='搜索' and node.get('role')=='button' and node.get('ref'):refs.add(node['ref'])
            for child in node.values():walk(child)
        elif isinstance(node,list):
            for child in node:walk(child)
    walk(snapshot)
    if len(refs)!=1:raise BridgeError('search_button_ambiguous')
    return refs.pop()

def initialize(job,direct,importer,bridge):
    if direct.SESSION_PATH.exists():
        try:
            session=direct.load_session()
            direct.request_xingtu(session,'POST',direct.SEARCH_ENDPOINT,session['search_template'])
            return {'state':'ready','session':'reused','validation':'authenticated_search_passed'}
        except Exception:pass
    market='https://www.xingtu.cn/ad/creator/index'
    bridge.call('navigate',{'url':market,'newTab':True,'group_title':'星图首次启用'})
    page={}
    for _ in range(15):
        page=bridge.evaluate("(()=>JSON.stringify({ready:[...document.querySelectorAll('input')].some(e=>e.getBoundingClientRect().width>0&&/达人昵称/.test(e.placeholder||'')),login:[...document.querySelectorAll('a,button')].some(e=>e.getBoundingClientRect().width>0&&/^(登录|立即登录)$/.test((e.textContent||'').trim())),login_path:/login|passport|sso/.test(location.pathname)}))()")
        if page.get('ready') or page.get('login') or page.get('login_path'):break
        time.sleep(.8)
    if not page.get('ready'):
        if page.get('login') or page.get('login_path'):
            return {'state':'customer_action_required','reason':'xingtu_login_required','url':market,'action':'请在已打开的星图官方页面完成登录或扫码，然后由Codex重新执行本初始化命令。'}
        return {'state':'technical_failed','reason':'creator_market_not_ready'}
    bridge.call('network',{'cmd':'start'})
    try:
        bridge.call('fill',{'selector':'input[placeholder="输入达人昵称、抖音号或星图ID"]','value':job.get('probe_keyword','游戏')})
        bridge.call('click',{'selector':search_ref(bridge.call('snapshot'))})
        requests=[]
        for _ in range(15):
            data=bridge.call('network',{'cmd':'list','filter':'search_for_author_square'})
            requests=[r for r in data.get('requests',[]) if r.get('method')=='POST']
            if requests:break
            time.sleep(.8)
        if not requests:return {'state':'technical_failed','reason':'search_request_not_captured'}
        detail=bridge.call('network',{'cmd':'detail','requestId':requests[-1]['requestId']})
        body=detail.get('requestBody')
        if isinstance(body,str):body=json.loads(body)
        try:
            session=importer.normalize({'method':detail.get('method'),'url':detail.get('url'),'headers':detail.get('requestHeaders'),'body':body},direct)
        except (ValueError,TypeError):
            return {'state':'engineering_pending','reason':'captured_request_schema_or_auth_material_unavailable'}
        # Verify the captured credentials before replacing any persisted session.
        result=direct.request_xingtu(session,'POST',direct.SEARCH_ENDPOINT,session['search_template'])
        direct.save_session(session)
        stored=direct.load_session()
        direct.request_xingtu(stored,'POST',direct.SEARCH_ENDPOINT,stored['search_template'])
        return {'state':'ready','session':'initialized','storage':'windows_dpapi_current_user','validation':'captured_search_and_encrypted_roundtrip_passed','author_count':len(result.get('authors',[]))}
    finally:bridge.call('network',{'cmd':'stop'})

def main():
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--persist-authorized',action='store_true',required=True)
    p.add_argument('--isolated-session-dir',type=Path);a=p.parse_args()
    job=json.loads(a.input.read_text(encoding='utf-8-sig'))
    module=Path(job['module_root']).resolve()
    direct=load_module('xt_direct',module/'skills/douyin-xingtu/scripts/xingtu_direct.py')
    importer=load_module('xt_importer',module/'skills/douyin-xingtu/scripts/xingtu_import_capture.py')
    if a.isolated_session_dir:
        direct.SESSION_DIR=a.isolated_session_dir.resolve();direct.SESSION_PATH=direct.SESSION_DIR/'session.dpapi'
    checkpoint=Path(job['checkpoint_file']).resolve();checkpoint.parent.mkdir(parents=True,exist_ok=True)
    try:result=initialize(job,direct,importer,Bridge(job['session'],job.get('bridge_address'),job.get('bridge_binary')))
    except BridgeError as error:result={'state':error.state,'reason':error.code}
    except RuntimeError as error:
        result={'state':'customer_action_required','reason':'xingtu_login_expired'} if str(error).startswith('auth_required:') else {'state':'technical_failed','reason':'initialization_runtime_failed'}
    except Exception:result={'state':'technical_failed','reason':'initialization_failed_sensitive_details_suppressed'}
    checkpoint.write_text(json.dumps({'schema':1,'module':'xingtu','result':result},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True));return 0 if result['state']=='ready' else 2

if __name__=='__main__':raise SystemExit(main())
