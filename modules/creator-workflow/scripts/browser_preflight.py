"""Report safe browser onboarding states without navigating or changing services."""
import argparse,json,subprocess
from pathlib import Path

def classify(status,expected='2.0.24'):
    if not status.get('running'):return {'state':'technical_failed','reason':'daemon_not_running','next':'codex_start_daemon'}
    if str(status.get('version','')).lstrip('v')!=expected:
        return {'state':'engineering_pending','reason':'running_daemon_version_mismatch','next':'codex_plan_shared_service_update_without_losing_tasks'}
    if not status.get('extension_connected'):
        return {'state':'customer_action_required','reason':'extension_not_connected','next':'codex_open_official_extension_authorization'}
    if str(status.get('extension_version','')).lstrip('v').split('.')[:2]!=expected.split('.')[:2]:
        return {'state':'engineering_pending','reason':'extension_protocol_version_mismatch','next':'codex_resolve_version_pairing'}
    return {'state':'ready','validation':'daemon_and_extension_status_only','business_sample':'not_run'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--binary',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    try:
        r=subprocess.run([str(a.binary),'status'],capture_output=True,timeout=15)
        status=json.loads(r.stdout.decode('utf-8-sig'));result=classify(status)
        result['observed']={k:status.get(k) for k in ['running','version','extension_connected','extension_version','port','addr']}
    except Exception:result={'state':'technical_failed','reason':'daemon_status_unreadable','next':'codex_inspect_installation'}
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result))
