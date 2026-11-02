"""Provider-neutral image job ledger. No credentials or network during planning."""
import contextlib,hashlib,io,json,os,re,uuid,time,urllib.error
from pathlib import Path
from PIL import Image

def read_retry(call,attempts=3):
    for attempt in range(attempts):
        try:return call()
        except urllib.error.HTTPError as error:
            if error.code not in (429,502,503,504) or attempt==attempts-1:raise
        except (TimeoutError,ConnectionError,urllib.error.URLError):
            if attempt==attempts-1:raise
        time.sleep(.2*(attempt+1))

def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()

def validate(plan):
    for key in ('job_id','slot_id','slide_id'):
        if not isinstance(plan.get(key),str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',plan[key]):raise ValueError('invalid_'+key)
    if plan.get('generation_rules_version')!=4:raise ValueError('generation_rules_v4_required')
    for key in ('prompt','prompt_version','creative_intent','visible_moment','pose_action','shot','camera','composition','safe_area','title_policy','identity_mode'):
        if not isinstance(plan.get(key),str) or not plan[key].strip():raise ValueError('missing_'+key)
    ratio=plan.get('aspect_ratio')
    if ratio not in ('16:9','4:3','3:4','9:16') and not plan.get('ratio_exception_reason'):raise ValueError('ratio_exception_reason_required')
    width,height=plan.get('target_width_px'),plan.get('target_height_px')
    if type(width)is not int or type(height)is not int or min(width,height)<=0:raise ValueError('target_pixels_required')
    try:a,b=map(int,ratio.split(':'))
    except Exception:raise ValueError('invalid_ratio') from None
    if width*b!=height*a:raise ValueError('target_ratio_mismatch')
    box=plan.get('placement_box',{})
    if plan.get('placement_unit') not in ('px','emu','cm') or any(type(box.get(k)) not in (int,float) for k in ('x','y','width','height')) or min(box['width'],box['height'])<=0:raise ValueError('placement_box_required')
    if abs(box['width']/box['height']-a/b)>.01 and not plan.get('size_fallback'):raise ValueError('placement_ratio_requires_explicit_fallback')
    if plan.get('realism')!='real_photo' and not (plan.get('gameplay_display_reason') or plan.get('style_exception_reason')):raise ValueError('real_photo_default_requires_exception')
    if plan['identity_mode']=='specified_creator' and not plan.get('reference_reviews'):raise ValueError('creator_reference_required')
    if plan.get('same_page_group') and not (plan.get('differentiation') or plan.get('comparison_reason')):raise ValueError('same_page_difference_required')
    if plan.get('preflight_review')!='passed':raise ValueError('caller_preflight_review_required')
    params=plan.get('provider_params',{})
    expected={'model','prompt','size','n','quality','output_format','background'}
    if set(params)!=expected or params['prompt']!=plan['prompt'] or params['n']!=1 or params['output_format']!='png' or params['background']!='opaque':raise ValueError('only_single_opaque_text_to_image_enabled')
    if params['model']!='gpt-image-2' or params['quality']!='medium':raise ValueError('unvalidated_model_or_quality')
    requested=(plan.get('requested_width_px'),plan.get('requested_height_px'))
    if any(type(v)is not int or v<=0 for v in requested) or params['size']!=f'{requested[0]}x{requested[1]}':raise ValueError('request_pixels_mismatch')
    if requested!=(width,height) and not plan.get('size_fallback'):raise ValueError('size_fallback_required')
    if plan.get('reference_paths') or plan.get('transparent'):raise ValueError('reference_edit_and_transparency_unverified')
    return digest(plan)

def atomic_json(path,value):
    tmp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    with open(tmp,'x',encoding='utf-8') as stream:
        json.dump(value,stream,ensure_ascii=False,indent=2);stream.flush();os.fsync(stream.fileno())
    os.replace(tmp,path)

@contextlib.contextmanager
def locked(directory):
    directory.mkdir(parents=True,exist_ok=True);file=directory/'writer.lock'
    fd=os.open(file,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    os.write(fd,json.dumps({'pid':os.getpid(),'created_at':time.time()}).encode());os.fsync(fd)
    try:yield
    finally:os.close(fd);file.unlink()

def authorize_submission(plan,approval):
    request_hash=validate(plan)
    size=plan['provider_params']['size']
    if size!='1024x1024':
        if size!='2048x1152' or plan.get('aspect_ratio')!='16:9' or plan.get('provider_size_evidence')!='documented_customer_handoff_2026-11-02':raise ValueError('non_square_size_requires_documented_trial_mapping')
    if approval.get('approved_by_user')is not True or request_hash not in approval.get('authorized_plan_hashes',[]) or not approval.get('authorization_id') or approval.get('billing_pool')!='personal' or approval.get('validation_trial')is not True:raise ValueError('matching_trial_payment_authorization_required')
    hashes=approval['authorized_plan_hashes']
    if not isinstance(hashes,list) or any(not isinstance(h,str) or not re.fullmatch('[0-9a-f]{64}',h) for h in hashes) or len(set(hashes))!=len(hashes):raise ValueError('distinct_valid_plan_hashes_required')
    count=len(hashes)
    if count!=1:
        if count!=6 or approval.get('scope')!='customer_acceptance_six_covers' or not approval.get('customer_confirmation') or approval.get('fee_policy')!='confirmed_with_customer_before_execution':raise ValueError('six_cover_customer_payment_confirmation_required')
    return request_hash

class Jobs:
    def __init__(self,root):self.root=Path(root)
    def directory(self,plan):validate(plan);return self.root/plan['job_id']
    def submit(self,plan,approval,transport):
        request_hash=authorize_submission(plan,approval)
        directory=self.directory(plan)
        with locked(directory):
            file=directory/'job.json'
            record={'job_id':plan['job_id'],'slot_id':plan['slot_id'],'slide_id':plan['slide_id'],'request_hash':request_hash,'authorization_id':approval['authorization_id'],'state':'submission_uncertain_do_not_resubmit','provider_task_id':None}
            with open(file,'x',encoding='utf-8') as stream:json.dump(record,stream);stream.flush();os.fsync(stream.fileno())
            # Record exists before the network write. Any error leaves a non-retriable submission.
            task=transport.submit(plan['provider_params'])
            if not isinstance(task,str) or not re.fullmatch(r'[A-Za-z0-9_:-]{1,128}',task):raise ValueError('invalid_task_id_no_resubmit')
            record.update(state='accepted',provider_task_id=task);atomic_json(file,record);return record
    def status(self,plan,transport):
        directory=self.directory(plan)
        with locked(directory):
            file=directory/'job.json';record=json.loads(file.read_text(encoding='utf-8'))
            if record['request_hash']!=validate(plan):raise ValueError('plan_changed')
            task=record.get('provider_task_id')
            if not task:raise ValueError('missing_confirmed_task_id_no_resubmit')
            result=read_retry(lambda:transport.status(task))
            if result.get('task_id')!=task:raise ValueError('task_identity_conflict')
            record['provider_status']=result;record['state']='result_available' if result.get('status')=='success' else 'pending_or_failed'
            usage=result.get('usage',{})
            record['usage']={'credits':usage.get('credits'),'status':usage.get('status'),'source':'provider_status_not_estimated'}
            atomic_json(file,record);return record
    def download(self,plan,transport):
        directory=self.directory(plan)
        with locked(directory):
            file=directory/'job.json';record=json.loads(file.read_text(encoding='utf-8'))
            if record['request_hash']!=validate(plan):raise ValueError('plan_changed')
            task=record.get('provider_status',{})
            if task.get('task_id')!=record.get('provider_task_id') or task.get('status')!='success':raise ValueError('confirmed_success_required')
            images=task.get('output',{}).get('images',[])
            if len(images)!=1 or not isinstance(images[0],str) or not re.fullmatch(r'static/image/[A-Za-z0-9_./-]+',images[0]) or '..' in images[0].split('/'):raise ValueError('invalid_result_location')
            output=directory/'result.png'
            recovering=output.exists()
            data=output.read_bytes() if recovering else read_retry(lambda:transport.download(images[0]))
            if not isinstance(data,bytes) or len(data)>=64*1024*1024:raise ValueError('invalid_or_oversize_result')
            with Image.open(io.BytesIO(data)) as image:
                if image.format!='PNG' or image.size!=(plan['requested_width_px'],plan['requested_height_px']):raise ValueError('returned_size_or_format_mismatch')
                image.verify()
            if not recovering:
                temp=directory/('download-'+uuid.uuid4().hex+'.partial')
                try:
                    with open(temp,'xb') as stream:stream.write(data);stream.flush();os.fsync(stream.fileno())
                    os.link(temp,output)  # Publish complete bytes without overwriting an existing result.
                finally:
                    if temp.exists():temp.unlink()
            elif record.get('sha256') and record['sha256']!=hashlib.sha256(data).hexdigest():raise ValueError('existing_output_hash_conflict')
            record.update(state='downloaded_not_visual_reviewed',file=str(output),sha256=hashlib.sha256(data).hexdigest(),actual_width_px=plan['requested_width_px'],actual_height_px=plan['requested_height_px'],image_review='pending',group_review='pending')
            atomic_json(file,record);return record
    def resume(self,plan):
        directory=self.directory(plan);file=directory/'job.json'
        if not file.exists():return {'state':'not_submitted','next':'validate_payment_authorization_before_submit'}
        record=json.loads(file.read_text(encoding='utf-8'))
        if record['request_hash']!=validate(plan):raise ValueError('plan_changed')
        if (directory/'writer.lock').exists():return {'state':'writer_lock_present','next':'inspect_owner_process_do_not_remove_automatically'}
        if not record.get('provider_task_id'):return {'state':'submission_uncertain_do_not_resubmit','next':'reconcile_provider_task_manually_no_guessed_id'}
        return {'state':record['state'],'next':'verify_existing_download' if (directory/'result.png').exists() else 'download' if record.get('provider_status',{}).get('status')=='success' else 'status','provider_task_id':record['provider_task_id'],'image_review':record.get('image_review','pending')}
