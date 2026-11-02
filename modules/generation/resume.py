"""Offline task checkpoint readback. Never loads a live provider."""
import argparse,json
from pathlib import Path
from slot_jobs import Jobs
p=argparse.ArgumentParser();p.add_argument('--plan',type=Path,required=True);p.add_argument('--jobs-root',type=Path,required=True);a=p.parse_args()
print(json.dumps(Jobs(a.jobs_root).resume(json.loads(a.plan.read_text(encoding='utf-8-sig')))))
