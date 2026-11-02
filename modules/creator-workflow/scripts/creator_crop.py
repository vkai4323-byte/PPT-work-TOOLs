"""Crop screenshot regions without overwriting original evidence."""
import argparse,hashlib,json,re
from pathlib import Path
from PIL import Image

def crop_job(job):
    source=Path(job['source_file']).resolve();digest=hashlib.sha256(source.read_bytes()).hexdigest()
    if digest!=job['expected_source_hash']: raise ValueError('source_changed_reinspect')
    output=Path(job['output_directory']).resolve();planned=[];seen=set()
    with Image.open(source) as image:
        for region in job['regions']:
            key=region['key'];box=region['box_px']
            if not isinstance(key,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',key) or key in seen: raise ValueError('invalid_region_key')
            seen.add(key)
            if not isinstance(box,list) or len(box)!=4 or any(type(v) is not int for v in box): raise ValueError('integer_pixel_box_required')
            x,y,w,h=box
            if x<0 or y<0 or w<=0 or h<=0 or x+w>image.width or y+h>image.height: raise ValueError('region_outside_source')
            if not region.get('intent'): raise ValueError('crop_intent_required')
            target=output/(key+'.png')
            if target==source or target.exists() or target.with_suffix('.json').exists(): raise ValueError('no_overwrite')
            planned.append((region,target,(x,y,x+w,y+h)))
        if not planned: raise ValueError('empty_regions')
        output.mkdir(parents=True,exist_ok=True);records=[]
        for region,target,box in planned:
            image.crop(box).save(target)
            record={'file':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source_file':str(source),'source_sha256':digest,'source_size_px':[image.width,image.height],'box_px':region['box_px'],'intent':region['intent'],'preserve':region.get('preserve',[]),'source_url':job.get('source_url'),'identity':job.get('identity'),'visual_review':'pending','status':'derived'}
            target.with_suffix('.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8');records.append(record)
        return records

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);a=p.parse_args()
    records=crop_job(json.loads(a.input.read_text(encoding='utf-8-sig')))
    print(json.dumps({'derived':len(records),'visual_review':'pending','files':[r['file'] for r in records]}))
