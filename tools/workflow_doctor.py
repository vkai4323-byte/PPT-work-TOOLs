"""Non-mutating checks. Does not query platforms or expose credential state."""
import argparse
import hashlib
import importlib.metadata
import json
import shutil
import subprocess
from pathlib import Path

def installation_ready(result):
    return (result['integrity']['status']=='ready' and
            all(dep.get('status')=='ready' for dep in result['dependencies'].values()))

def inspect(root,officecli_path=None):
    manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
    failures=[]
    for entry in manifest['files']:
        path=(root/entry['path']).resolve()
        if not path.is_relative_to(root.resolve()):
            failures.append('unsafe_manifest_path')
            continue
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=entry['sha256']:
            failures.append(entry['path'])
    deps={}
    for name,expected in [('bilibili-api-python','17.4.2'),('httpx','0.28.1'),('pillow','13.0.0')]:
        try:
            actual=importlib.metadata.version(name)
            deps[name]={'expected':expected,'actual':actual,'status':'ready' if actual==expected else 'version_mismatch'}
        except importlib.metadata.PackageNotFoundError:
            deps[name]={'status':'missing'}
    office=officecli_path or shutil.which('officecli')
    office_status='missing'
    if office:
        try:
            result=subprocess.run([office,'--version'],capture_output=True,timeout=15)
            office_status='executable' if result.returncode==0 else 'version_check_failed'
        except (OSError,subprocess.TimeoutExpired):
            office_status='version_check_failed'
    return {'integrity':{'status':'failed' if failures else 'ready','failures':failures},
            'dependencies':deps,'officecli':office_status,
            'webbridge':{'daemon':'not_probed','extension':'not_verified','login':'not_verified'},
            'xingtu':'not_queried','bilibili':'not_queried','monet':'private_baseline_received_live_proposal_not_verified',
            'customer_validation':'not_run'}

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('root',type=Path)
    p.add_argument('--officecli')
    a=p.parse_args(); result=inspect(a.root,a.officecli)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(0 if installation_ready(result) else 1)
