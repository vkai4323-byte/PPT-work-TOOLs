import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {digest,projectRoot,projectSourceHash,safePath,writeAtomic,projectLock} from './project-state.mjs';
import {resumePptx} from './native-pptx.mjs';

// The ledger records caller-observed evidence. It never claims to have looked at an image.
export async function placementPlan({targetPath,plan,expectedSourceHash}){
  if(!path.isAbsolute(targetPath))throw new Error('需要项目清单绝对路径。');
  let root,sourceHash,slideIds,backend;
  if(path.basename(targetPath)==='super-adc-deck.json'){
    root=projectRoot(targetPath);sourceHash=projectSourceHash(root);slideIds=JSON.parse(fs.readFileSync(targetPath,'utf8')).order;backend='deck';
  }else{
    const state=await resumePptx({projectPath:targetPath});if(!state.currentFileMatches)throw new Error('当前稿已外部改变，先接管最新版。');
    root=path.dirname(targetPath);sourceHash=state.current.hash;slideIds=state.slides.map(p=>p.slideId);backend='native_pptx';
  }
  const release=projectLock(root);
  try{
    const file=safePath(root,'notes/placement-plan.json');
    if(plan){
      if(expectedSourceHash!==sourceHash)throw new Error('布图计划基于旧版本，请重新读取。');
      if(!Array.isArray(plan.assets)||!Array.isArray(plan.placements))throw new Error('计划需要 assets 和 placements。');
      const ids=new Set(),assets=plan.assets.map(a=>{
        if(!a.id||ids.has(a.id))throw new Error('素材 ID 缺失或重复。');ids.add(a.id);
        if(!['identity','evidence','concept','brand','decoration'].includes(a.role))throw new Error('素材 role 无效。');
        if(!['user','official','creator-work','generated','other'].includes(a.origin)||!a.source||!a.purpose)throw new Error('素材需要来源类型、来源和用途。');
        if(!path.isAbsolute(a.file))throw new Error('素材 file 需要绝对路径。');
        const bytes=fs.readFileSync(a.file);if(a.expectedHash!==digest(bytes))throw new Error('素材指纹不匹配，请 inspect_asset 后核对。');
        return {...a,hash:digest(bytes),bytes:bytes.length};
      });
      for(const p of plan.placements){
        if(!slideIds.includes(p.slideId)||!ids.has(p.assetId))throw new Error('布图引用了未知页面或素材。');
        if(!['cover','contain','preserve-existing'].includes(p.fit)||!p.purpose)throw new Error('放置需要 fit 和用途。');
        if(p.frame&&(!['px','emu','cm'].includes(p.frame.unit)||['x','y','width','height'].some(k=>!Number.isFinite(p.frame[k]))||p.frame.width<=0||p.frame.height<=0))throw new Error('放置框尺寸/单位无效。');
      }
      const saved={v:1,backend,sourceHash,assets,placements:plan.placements,notes:plan.notes||'',createdAt:new Date().toISOString(),reviewEvidence:'caller-reported'};
      if(fs.existsSync(file))writeAtomic(root,'notes/placement-history/'+Date.now()+'-'+crypto.randomUUID()+'.json',fs.readFileSync(file));
      writeAtomic(root,'notes/placement-plan.json',JSON.stringify(saved,null,2)+'\n');
    }
    const saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
    return {ok:true,backend,sourceHash,slideIds,plan:saved,planMatchesSource:saved?.sourceHash===sourceHash,assets:saved?.assets.map(a=>({id:a.id,current:fs.existsSync(a.file)&&digest(fs.readFileSync(a.file))===a.hash}))||[],modelImageInputs:0};
  }finally{release();}
}
export function inspectAsset({file}){if(!path.isAbsolute(file))throw new Error('需要素材绝对路径。');const bytes=fs.readFileSync(file);return {ok:true,file,hash:digest(bytes),bytes:bytes.length,visualReview:'not-performed',modelImageInputs:0};}
