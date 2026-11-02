"""Explicit live action entry; offline plan/resume do not import this transport."""
import argparse,importlib.util,json
from pathlib import Path
from providers import inspect_binding
from slot_jobs import Jobs,validate,authorize_submission

def main():
    p=argparse.ArgumentParser();p.add_argument('action',choices=['submit','status','download']);p.add_argument('--plan',type=Path,required=True);p.add_argument('--jobs-root',type=Path,required=True);p.add_argument('--runtime-root',type=Path,required=True);p.add_argument('--approval',type=Path);p.add_argument('--execute-authorized',action='store_true');a=p.parse_args()
    if not a.execute_authorized:raise ValueError('explicit_live_execution_required')
    plan=json.loads(a.plan.read_text(encoding='utf-8-sig'));validate(plan);approval={}
    if a.action=='submit':
        if not a.approval:raise ValueError('payment_approval_required_before_transport_import')
        approval=json.loads(a.approval.read_text(encoding='utf-8-sig'));authorize_submission(plan,approval)
    else:
        # Check existing task identity/locks before a provider can read any credential.
        state=Jobs(a.jobs_root).resume(plan)
        if state['state'] in ('not_submitted','writer_lock_present','submission_uncertain_do_not_resubmit'):raise ValueError('confirmed_existing_task_required_before_transport_import')
    binding=json.loads((a.runtime_root/'provider-bindings/monet.json').read_text(encoding='utf-8'));inspect_binding(binding)
    spec=importlib.util.spec_from_file_location('workbench_private_provider',binding['adapter_file']);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    transport=getattr(module,binding['entry_class'])(binding['package_directory']);jobs=Jobs(a.jobs_root)
    result=jobs.submit(plan,approval,transport) if a.action=='submit' else getattr(jobs,a.action)(plan,transport)
    allowed=('state','job_id','slot_id','slide_id','provider_task_id','file','sha256','actual_width_px','actual_height_px','image_review','group_review','usage')
    print(json.dumps({key:result[key] for key in allowed if key in result},ensure_ascii=True));return 0

if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'state':'blocked_or_failed','error_type':type(error).__name__,'message':'Inspect local task state; never repeat an uncertain paid submission.'}));raise SystemExit(2)
