"""Import an authorized capture via stdin; never log request material."""
import argparse
import importlib.util
import json
import shlex
import sys
from pathlib import Path

def normalize(capture, direct):
    if capture.get('method') != 'POST': raise ValueError('search_post_required')
    headers=capture.get('headers')
    if not isinstance(headers,dict): raise ValueError('header_mapping_required')
    if not all(isinstance(k,str) and isinstance(v,str) and '\n' not in k+v and '\r' not in k+v for k,v in headers.items()):
        raise ValueError('invalid_headers')
    body=capture.get('body')
    if not isinstance(body,dict): raise ValueError('body_object_required')
    parts=['curl',str(capture.get('url',''))]
    for key,value in headers.items():
        # Existing parser expects canonical Cookie capitalization.
        parts+=['-H',f"{'Cookie' if key.lower()=='cookie' else key}: {value}"]
    parts+=['--data-raw',json.dumps(body,separators=(',',':'),ensure_ascii=False)]
    return direct.parse_curl(shlex.join(parts))

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--direct-script',type=Path,required=True)
    p.add_argument('--persist-authorized',action='store_true',required=True)
    args=p.parse_args()
    spec=importlib.util.spec_from_file_location('xingtu_direct',args.direct_script)
    direct=importlib.util.module_from_spec(spec);spec.loader.exec_module(direct)
    raw=sys.stdin.buffer.read(2*1024*1024+1)
    if len(raw)>2*1024*1024: raise ValueError('capture_too_large')
    session=normalize(json.loads(raw),direct)
    direct.save_session(session)
    print(json.dumps({'status':'stored_encrypted','validation':'self_test_required'}))

if __name__=='__main__':
    try: main()
    except Exception:
        # Parser errors may contain raw input, so never print the exception.
        print(json.dumps({'status':'failed','reason':'capture_rejected_or_storage_failed'}),file=sys.stderr)
        raise SystemExit(1)
