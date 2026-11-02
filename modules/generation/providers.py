"""Private provider registration. Offline validation never imports adapters or credentials."""
import argparse,hashlib,json,re
from pathlib import Path

def file_hash(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def inspect_binding(binding):
    if binding.get('provider_id')!='monet' or binding.get('entry_class')!='MonetTransport':raise ValueError('invalid_provider_binding')
    for filekey,hashkey in [('adapter_file','adapter_sha256'),('source_manifest','source_manifest_sha256')]:
        path=Path(binding[filekey])
        if not path.is_absolute() or not re.fullmatch('[0-9a-f]{64}',binding[hashkey]) or file_hash(path)!=binding[hashkey]:raise ValueError('provider_source_hash_mismatch')
    package=Path(binding['package_directory']).resolve()
    manifest=json.loads(Path(binding['source_manifest']).read_text(encoding='utf-8'))
    for entry in manifest['files']:
        file=(package/entry['path']).resolve()
        if not file.is_relative_to(package) or file_hash(file)!=entry['sha256']:raise ValueError('private_package_hash_mismatch')
    return {'state':'registered_private_baseline','credential_reads':0,'network_requests':0,'paid_submission_enabled':False,'live_proposal_generation':'not_verified','source_files':len(manifest['files'])}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--runtime-root',type=Path,required=True);args=parser.parse_args()
    binding=json.loads(args.input.read_text(encoding='utf-8-sig'));report=inspect_binding(binding)
    # Keep the registry narrow: no copied credentials, task metadata, or authorization flags.
    allowed={'provider_id','entry_class','adapter_file','adapter_sha256','source_manifest','source_manifest_sha256','package_directory'}
    if set(binding)!=allowed:raise ValueError('unknown_provider_configuration_fields')
    directory=args.runtime_root/'provider-bindings';directory.mkdir(parents=True,exist_ok=True);target=directory/'monet.json'
    if target.exists() and json.loads(target.read_text(encoding='utf-8'))!=binding:raise ValueError('existing_binding_retained_inspect_before_update')
    if not target.exists():
        with open(target,'x',encoding='utf-8') as file:json.dump(binding,file,ensure_ascii=False,indent=2)
    print(json.dumps(report))
