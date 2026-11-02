"""Offline receiver for an existing private handoff. No import, auth or network."""
import argparse,json
from pathlib import Path
from providers import file_hash,inspect_binding

# Generic wrapper only. Endpoints and authentication stay in the customer's package.
ADAPTER='''import importlib.util,sys
from pathlib import Path
class MonetTransport:
 def __init__(self,package):
  work=Path(package)/'work'
  sys.path.insert(0,str(work))
  spec=importlib.util.spec_from_file_location('workbench_monet_client',work/'dreammaker_background.py')
  self.client=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.client)
  self.config=self.client.configuration();self.credentials=None
  self.client.DIRECTORY=Path(__file__).resolve().parent/'provider-errors'
  self.client.DIRECTORY.mkdir(exist_ok=True)
 def auth(self):
  if self.credentials is None:
   access,secret,_=self.client.credential_pair(self.config)
   if not access or not secret:raise RuntimeError('official_credentials_required')
   self.credentials=(access,secret)
  return self.credentials
 def submit(self,params):
  response=self.client.request_json(self.config,*self.auth(),self.config['documented_paths']['submit'],'POST',{'sub_app_name':self.config['sub_app_name']},{'params':params})
  return response.get('data',{}).get('task_id')
 def status(self,task):
  response=self.client.request_json(self.config,*self.auth(),self.config['documented_paths']['status'],parameters={'sub_app_name':self.config['sub_app_name'],'task_id':task})
  return response['data']
 def download(self,image):
  data,_=self.client.request(self.config,*self.auth(),'/'+image)
  return data
'''

def setup(package,runtime):
    package=Path(package).resolve();runtime=Path(runtime).resolve()
    manifest=package/'FILE-SHA256.json'
    entries=json.loads(manifest.read_text(encoding='utf-8'))['files']
    required={'work/dreammaker_background.py','work/background_docs.py'}
    if not required.issubset({e['path'] for e in entries}):raise ValueError('supported_private_handoff_required')
    # Check the complete source before writing any runtime file. Never import it here.
    for entry in entries:
        path=(package/entry['path']).resolve()
        if not path.is_relative_to(package) or file_hash(path)!=entry['sha256']:raise ValueError('private_package_hash_mismatch')
    adapter=runtime/'private-providers/monet/transport.py'
    target=runtime/'provider-bindings/monet.json'
    if target.exists():
        existing=json.loads(target.read_text(encoding='utf-8'));report=inspect_binding(existing)
        if Path(existing['package_directory']).resolve()!=package:raise ValueError('existing_binding_retained_inspect_before_update')
        return dict(report,binding_reused=True)
    if adapter.exists() and adapter.read_text(encoding='utf-8')!=ADAPTER:raise ValueError('existing_adapter_retained_inspect_before_update')
    adapter.parent.mkdir(parents=True,exist_ok=True)
    if not adapter.exists():
        with open(adapter,'x',encoding='utf-8',newline='\n') as stream:stream.write(ADAPTER)
    binding={'provider_id':'monet','entry_class':'MonetTransport','adapter_file':str(adapter),'adapter_sha256':file_hash(adapter),'source_manifest':str(manifest),'source_manifest_sha256':file_hash(manifest),'package_directory':str(package)}
    report=inspect_binding(binding)
    target.parent.mkdir(parents=True,exist_ok=True)
    with open(target,'x',encoding='utf-8') as stream:json.dump(binding,stream,ensure_ascii=False,indent=2)
    return dict(report,binding_reused=False)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--package-directory',type=Path,required=True);parser.add_argument('--runtime-root',type=Path,required=True);args=parser.parse_args()
    try:print(json.dumps(setup(args.package_directory,args.runtime_root)))
    except Exception as error:
        print(json.dumps({'state':'engineering_pending','error_type':type(error).__name__,'credential_reads':0,'network_requests':0,'message':'Codex must inspect local handoff integrity and existing binding; no login retry required.'}));raise SystemExit(2)
