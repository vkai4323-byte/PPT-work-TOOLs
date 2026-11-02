"""Offline-only planning entry; does not load a provider, credentials or networking."""
import argparse,json
from pathlib import Path
from slot_jobs import validate
p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
try:
    plan=json.loads(a.input.read_text(encoding='utf-8-sig'));result={'state':'planned_not_approved','plan_hash':validate(plan),'payment_approved':False,'network_requests':0,'credential_reads':0,'live_proposal_generation':'not_verified','non_square_submission':'documented_2048x1152_customer_trial_only','reference_edit':'unverified_not_enabled','image_review':'pending','group_review':'pending'}
except Exception as error:result={'state':'blocked','reason':str(error),'network_requests':0,'credential_reads':0}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result));raise SystemExit(0 if result['state']=='planned_not_approved' else 2)
