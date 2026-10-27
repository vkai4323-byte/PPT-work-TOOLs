import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import JSZip from 'jszip';
import {DOMParser} from '@xmldom/xmldom';
import {projectLock} from './project-state.mjs';

const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex');
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
function writeJSON(p,v){const tmp=p+'.'+stamp()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(v,null,2)+'\n');fs.renameSync(tmp,p);}
function absolute(p){if(typeof p!=='string'||!path.isAbsolute(p))throw new Error('需要绝对路径。');return path.resolve(p);}
function safe(root,rel){
  if(typeof rel!=='string'||path.isAbsolute(rel)||rel.split(/[\\/]/).includes('..'))throw new Error('项目路径无效。');
  const p=path.resolve(root,rel);if(!p.startsWith(root+path.sep))throw new Error('路径越出项目。');
  let current=root;for(const bit of path.relative(root,p).split(path.sep)){current=path.join(current,bit);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw new Error('项目状态不支持符号链接。');}return p;
}
function load(projectPath){absolute(projectPath);if(fs.lstatSync(path.dirname(projectPath)).isSymbolicLink()||fs.lstatSync(projectPath).isSymbolicLink())throw new Error('项目状态不支持符号链接。');const state=readJSON(projectPath);if(state.kind!=='ppt-workbench-native'||state.v!==1)throw new Error('不是原生 PPTX 项目。');return {state,root:path.dirname(projectPath)};}
function current(projectPath){const ctx=load(projectPath),file=safe(ctx.root,ctx.state.current.file);if(hash(fs.readFileSync(file))!==ctx.state.current.hash)throw new Error('项目当前稿已被外部修改，请先用 adopt 接管已保存的最新版。');return {...ctx,file};}
function nodes(el,name){return Array.from(el.getElementsByTagNameNS('*',name));}
function attr(el,name){return el?.getAttribute(name)||'';}
function textRuns(el){if(el.localName==='t')return el.textContent;if(el.localName==='br')return '\v';if(el.localName==='tab')return '\t';return Array.from(el.childNodes||[]).map(textRuns).join('');}
function xml(text){if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('不支持带实体声明的 XML。');return new DOMParser({onError:(_level,message)=>{throw new Error('XML 解析失败：'+message);}}).parseFromString(text,'application/xml');}
function canon(el){
  if(el.nodeType===3||el.nodeType===4)return el.parentNode?.localName==='t'||el.data.trim()?el.data:'';
  if(el.nodeType!==1&&el.nodeType!==9)return '';
  const children=Array.from(el.childNodes).map(canon).join('');if(el.nodeType===9)return children;
  const attrs=Array.from(el.attributes).filter(a=>a.namespaceURI!=='http://www.w3.org/2000/xmlns/').map(a=>[a.namespaceURI||'',a.localName,a.value]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify([el.namespaceURI||'',el.localName,attrs,children]);
}
const relFile=p=>path.posix.join(path.posix.dirname(p),'_rels',path.posix.basename(p)+'.rels');
function relTarget(part,target){const p=path.posix.normalize(path.posix.join(path.posix.dirname(part),decodeURI(target)));if(p.startsWith('../')||p.startsWith('/'))throw new Error('PPTX 内部关系路径无效。');return p;}
async function inspectBytes(bytes,file){
  const zip=await JSZip.loadAsync(bytes),parts={},docs=new Map(),relationships=new Map(),issues=[];
  for(const [name,entry] of Object.entries(zip.files)){
    if(entry.dir)continue;const data=await entry.async('nodebuffer');
    if(/\.(xml|rels)$/.test(name)){const doc=xml(data.toString('utf8'));docs.set(name,doc);parts[name]=hash(canon(doc));}else parts[name]=hash(data);
  }
  function rels(part){if(relationships.has(part))return relationships.get(part);const doc=docs.get(relFile(part));const r=doc?nodes(doc,'Relationship').map(n=>({id:attr(n,'Id'),type:attr(n,'Type'),external:attr(n,'TargetMode')==='External',target:attr(n,'TargetMode')==='External'?attr(n,'Target'):relTarget(part,attr(n,'Target'))})):[];relationships.set(part,r);return r;}
  const presentation=docs.get('ppt/presentation.xml');if(!presentation)throw new Error('文件缺少 ppt/presentation.xml。');
  const pRels=rels('ppt/presentation.xml'),owners={};
  function visit(part,id,seen=new Set()){
    if(seen.has(part))return;seen.add(part);if(!parts[part]){issues.push({code:'missing-part',part,slideId:id});return;}
    (owners[part]??=new Set()).add(id);if(parts[relFile(part)])(owners[relFile(part)]??=new Set()).add(id);
    for(const r of rels(part))if(!r.external)visit(r.target,id,seen);
  }
  const pages=[];
  for(const slide of nodes(presentation,'sldId')){
    const id=attr(slide,'id'),rid=slide.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    const part=pRels.find(r=>r.id===rid)?.target,doc=docs.get(part);if(!doc)throw new Error('找不到幻灯片关系：'+id);
    if(pages.some(p=>p.slideId===id))throw new Error('重复 slide ID：'+id);
    const objects=[];
    for(const n of nodes(doc,'*').filter(n=>['sp','pic','graphicFrame','cxnSp'].includes(n.localName))){
      const nv=nodes(n,'cNvPr')[0];if(!nv)continue;const shapeId=attr(nv,'id');if(objects.some(o=>o.shapeId===shapeId))throw new Error('重复 shape ID：'+id+'/'+shapeId);
      const text=nodes(n,'p').map(textRuns).join('\n');
      const transform=nodes(n,'xfrm')[0],off=transform&&nodes(transform,'off')[0],ext=transform&&nodes(transform,'ext')[0];
      const resources=nodes(n,'blip').map(b=>{const rid=b.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed');const r=rels(part).find(r=>r.id===rid);return r?{part:r.target,hash:parts[r.target]}:{missingRelationship:rid};});
      const fontSize=Math.max(0,...['rPr','defRPr','endParaRPr'].flatMap(tag=>nodes(n,tag).map(r=>Number(attr(r,'sz'))/100)));
      const isTitle=nodes(n,'ph').some(ph=>['title','ctrTitle'].includes(attr(ph,'type')));
      objects.push({shapeId,name:attr(nv,'name'),type:n.localName,text,fontSize,isTitle,hash:hash(canon(n)),geometry:off&&ext?{x:Number(attr(off,'x')),y:Number(attr(off,'y')),cx:Number(attr(ext,'cx')),cy:Number(attr(ext,'cy'))}:null,images:resources});
    }
    const skeleton=doc.cloneNode(true);for(const node of nodes(skeleton,'*').filter(n=>['sp','pic','graphicFrame','cxnSp'].includes(n.localName))){const replacement=skeleton.createElement('object-ref');replacement.setAttribute('id',attr(nodes(node,'cNvPr')[0],'id'));node.parentNode.replaceChild(replacement,node);}
    const titleObject=objects.find(o=>o.isTitle&&o.text)||objects.filter(o=>o.text&&!/^logo$/i.test(o.text.trim())).sort((a,b)=>b.fontSize-a.fontSize)[0];
    visit(part,id);pages.push({page:pages.length+1,slideId:id,part,title:titleObject?.text.split('\n')[0]||'',titleIsHeuristic:!titleObject?.isTitle,objects,hash:parts[part],structureHash:hash(canon(skeleton))});
  }
  const size=nodes(presentation,'sldSz')[0];
  return {ok:issues.length===0,file,hash:hash(bytes),bytes:bytes.length,size:{cx:Number(attr(size,'cx')),cy:Number(attr(size,'cy'))},pages,parts,owners:Object.fromEntries(Object.entries(owners).map(([k,v])=>[k,[...v]])),issues,modelImageInputs:0};
}
export async function inspectPptx({file,slideIds}){
  absolute(file);const r=await inspectBytes(fs.readFileSync(file),file);const {parts,owners,...result}=r;
  result.pages=slideIds?r.pages.filter(p=>slideIds.includes(p.slideId)):outline(r);return result;
}
function outline(index){return index.pages.map(p=>({page:p.page,slideId:p.slideId,title:p.title,objects:p.objects.length,images:p.objects.reduce((n,o)=>n+o.images.length,0)}));}
function saveVersion(root,bytes,index,label,origin){
  const id=stamp(),file='versions/'+id+'.pptx',indexFile='versions/'+id+'.json';fs.writeFileSync(safe(root,file),bytes,{flag:'wx'});writeJSON(safe(root,indexFile),index);
  return {id,file,indexFile,hash:hash(bytes),label,origin,createdAt:new Date().toISOString()};
}
async function adopt({file,directory,projectPath,expectedCurrentHash,label='接管最新版',previousDeck}){
  absolute(file);const bytes=fs.readFileSync(file),index=await inspectBytes(bytes,file);if(!index.ok)throw new Error('输入 PPTX 有缺失关系，请先修复。');
  let state,root;
  if(projectPath){({state,root}=load(projectPath));if(expectedCurrentHash!==state.current.hash)throw new Error('接管前请核对项目 current.hash。');}
  else {root=absolute(directory);if(fs.existsSync(root))throw new Error('新项目目录必须不存在。');if(previousDeck)absolute(previousDeck);fs.mkdirSync(path.dirname(root),{recursive:true});fs.mkdirSync(root);for(const sub of ['versions','work','plans'])fs.mkdirSync(path.join(root,sub));projectPath=path.join(root,'ppt-workbench-native.json');state={v:1,kind:'ppt-workbench-native',backend:'native_pptx',history:[],context:{focus:[],confirmed:[],pending:[]},previousDeck:previousDeck?{path:absolute(previousDeck),status:'historical-not-synchronized'}:null};}
  const saved=saveVersion(root,bytes,index,label,{file,hash:index.hash});state.history.push(saved);state.current=saved;writeJSON(projectPath,state);
  return {ok:true,projectPath,current:saved,slides:outline(index),sourceUnchanged:true,modelImageInputs:0};
}
async function resume({projectPath,patch}){
  const {state,root}=load(projectPath);const file=safe(root,state.current.file),actualHash=hash(fs.readFileSync(file));
  if(patch){for(const key of Object.keys(patch)){if(!['focus','confirmed','pending'].includes(key)||!Array.isArray(patch[key])||patch[key].some(x=>typeof x!=='string'))throw new Error('项目记录字段无效。');}state.context={...state.context,...patch};writeJSON(projectPath,state);}
  const index=readJSON(safe(root,state.current.indexFile));return {ok:true,projectPath,authoritativeFile:file,current:state.current,currentFileMatches:actualHash===state.current.hash,actualHash,slides:outline(index),context:state.context,previousDeck:state.previousDeck,history:state.history,modelImageInputs:0};
}
function validateScope(index,scope){
  if(!scope||!['element','slide','slides','deck'].includes(scope.kind))throw new Error('需要明确批注作用范围：element/slide/slides/deck。');
  if(scope.kind==='deck')return {kind:'deck',slideIds:index.pages.map(p=>p.slideId)};
  if(!Array.isArray(scope.slideIds)||!scope.slideIds.length||scope.slideIds.some(id=>!index.pages.some(p=>p.slideId===id)))throw new Error('需要当前 PPTX 的有效 slide ID，不能用预览 viewer ID。');
  if(['element','slide'].includes(scope.kind)&&scope.slideIds.length!==1)throw new Error('该范围应仅指定一页。');
  if(scope.kind==='element'&&(!scope.shapeIds?.length||scope.shapeIds.some(id=>!index.pages.find(p=>p.slideId===scope.slideIds[0]).objects.some(o=>o.shapeId===id))))throw new Error('需要该页有效 shape ID。');return scope;
}
async function prepare({projectPath,expectedCurrentHash,scope,instruction,preserveText=true,annotation}){
  const {state,root,file}=current(projectPath);if(expectedCurrentHash!==state.current.hash)throw new Error('修改计划基于旧版本，请重新读取当前稿。');
  if(!instruction?.trim())throw new Error('需要本轮修改目的。');const index=readJSON(safe(root,state.current.indexFile));scope=validateScope(index,scope);
  if(annotation?.artifactHash&&annotation.artifactHash!==state.current.hash)throw new Error('批注文件版本与当前稿不同。');
  const id=stamp(),workingFile='work/'+id+'.pptx',plan={v:1,id,base:state.current,scope,instruction,preserveText,annotation:annotation||null,workingFile};
  fs.copyFileSync(file,safe(root,workingFile),fs.constants.COPYFILE_EXCL);writeJSON(safe(root,'plans/'+id+'.json'),plan);
  return {ok:true,revisionId:id,workingFile:safe(root,workingFile),plan,modelImageInputs:0};
}
function planFor(root,id){if(!/^[A-Za-z0-9-]+$/.test(id))throw new Error('revision ID 无效。');return readJSON(safe(root,'plans/'+id+'.json'));}
function difference(before,after,plan){
  const errors=[...after.issues],changedSlides=[],textChanges=[],changedParts=[],allowed=new Set(plan.scope.slideIds);
  const orderChanged=JSON.stringify(before.pages.map(p=>p.slideId))!==JSON.stringify(after.pages.map(p=>p.slideId));
  if(orderChanged&&plan.scope.kind!=='deck')errors.push({code:'order-outside-scope'});
  for(const id of new Set([...before.pages,...after.pages].map(p=>p.slideId))){
    const a=before.pages.find(p=>p.slideId===id),b=after.pages.find(p=>p.slideId===id);
    if(a?.hash!==b?.hash){changedSlides.push(id);if(plan.scope.kind!=='deck'&&!allowed.has(id))errors.push({code:'slide-outside-scope',slideId:id});}
    const texts=p=>(p?.objects||[]).map(o=>o.text).filter(Boolean).sort();
    if(JSON.stringify(texts(a))!==JSON.stringify(texts(b))){textChanges.push({slideId:id,before:texts(a),after:texts(b)});if(plan.preserveText)errors.push({code:'confirmed-text-changed',slideId:id});}
    if(plan.scope.kind==='element'&&allowed.has(id)){
      if(a?.structureHash!==b?.structureHash)errors.push({code:'slide-structure-outside-element-scope',slideId:id});
      for(const sid of new Set([...(a?.objects||[]),...(b?.objects||[])].map(o=>o.shapeId)))if(!plan.scope.shapeIds.includes(sid)&&a?.objects.find(o=>o.shapeId===sid)?.hash!==b?.objects.find(o=>o.shapeId===sid)?.hash)errors.push({code:'element-outside-scope',slideId:id,shapeId:sid});
      for(const o of a?.objects||[])if(!plan.scope.shapeIds.includes(o.shapeId)&&JSON.stringify(o.images)!==JSON.stringify(b?.objects.find(n=>n.shapeId===o.shapeId)?.images))errors.push({code:'image-outside-element-scope',slideId:id,shapeId:o.shapeId});
      if(JSON.stringify(a?.objects.map(o=>o.shapeId))!==JSON.stringify(b?.objects.map(o=>o.shapeId)))errors.push({code:'object-order-or-membership-changed'});
    }
  }
  for(const part of new Set([...Object.keys(before.parts),...Object.keys(after.parts)])){
    if(before.parts[part]===after.parts[part])continue;const owners=[...new Set([...(before.owners[part]||[]),...(after.owners[part]||[])])];changedParts.push({part,owners});
    if(plan.scope.kind==='deck'||part.startsWith('docProps/'))continue;
    if(owners.length){if(owners.some(id=>!allowed.has(id)))errors.push({code:'shared-or-unrelated-part-changed',part,owners});}
    else if(part!=='[Content_Types].xml')errors.push({code:'package-part-outside-scope',part});
    if(plan.scope.kind==='element'&&owners.length){
      const slides=[...before.pages,...after.pages].filter(p=>allowed.has(p.slideId));
      const permitted=new Set(slides.flatMap(p=>[p.part,relFile(p.part),...p.objects.filter(o=>plan.scope.shapeIds.includes(o.shapeId)).flatMap(o=>o.images.map(i=>i.part))]));
      if(!permitted.has(part))errors.push({code:'resource-outside-element-scope',part});
    }
  }
  return {ok:errors.length===0,errors,changedSlides,textChanges,changedParts,orderChanged,visualReview:'not-performed',schemaValidation:'not-performed'};
}
async function review({projectPath,revisionId}){
  const {state,root}=current(projectPath),plan=planFor(root,revisionId);if(plan.base.hash!==state.current.hash)throw new Error('已有更新版本，旧修改计划不可继续交付。');
  const before=await inspectBytes(fs.readFileSync(safe(root,plan.base.file)),plan.base.file),candidate=safe(root,plan.workingFile),bytes=fs.readFileSync(candidate),after=await inspectBytes(bytes,candidate);
  const report={...difference(before,after,plan),projectPath,revisionId,baseHash:before.hash,candidateHash:after.hash,workingFile:candidate,modelImageInputs:0};writeJSON(safe(root,'plans/'+revisionId+'-review.json'),report);return report;
}
async function commit({projectPath,revisionId,expectedCandidateHash,validation}){
  const report=await review({projectPath,revisionId});if(!report.ok)return report;
  if(expectedCandidateHash!==report.candidateHash)throw new Error('候选稿已变化，请重新 review。');
  if(!validation?.structure?.trim()||!validation?.visual?.trim())throw new Error('记录实际结构检查与视觉检查结果；无需视觉检查时写明原因，不可伪称通过。');
  const {state,root}=current(projectPath),plan=planFor(root,revisionId),bytes=fs.readFileSync(safe(root,plan.workingFile));if(hash(bytes)!==expectedCandidateHash)throw new Error('保存前候选稿变化。');
  const index=await inspectBytes(bytes,plan.workingFile),saved=saveVersion(root,bytes,index,plan.instruction,{baseHash:plan.base.hash,revisionId,validation});state.history.push(saved);state.current=saved;writeJSON(projectPath,state);
  return {ok:true,projectPath,current:saved,outputPath:safe(root,saved.file),report,validationRecord:'caller-reported',modelImageInputs:0};
}
async function batch({projectPath,revisionId,batchFile,expectedWorkingHash,officecli='officecli'}){
  absolute(batchFile);const input=readJSON(batchFile);if(!Array.isArray(input)||!input.length||input.some(x=>!['set','add','remove','move','swap','get','query'].includes(x.command)))throw new Error('batch 必须是支持的对象命令数组。');
  if(fs.statSync(batchFile).size>48*1024)throw new Error('请按页/区域拆分 batch，单批不超过48KiB。');
  const {state,root}=current(projectPath),plan=planFor(root,revisionId);if(plan.base.hash!==state.current.hash)throw new Error('修改计划已过期。');const file=safe(root,plan.workingFile),bytes=fs.readFileSync(file);
  if(hash(bytes)!==expectedWorkingHash)throw new Error('工作稿变化，请重新 inspect。');
  if(fs.existsSync(path.join(path.dirname(file),'~$'+path.basename(file))))throw new Error('工作稿被 Office 锁定，请使用已保存副本。');
  const backup=safe(root,'work/'+revisionId+'-before-'+stamp()+'.pptx');fs.writeFileSync(backup,bytes,{flag:'wx'});
  const run=args=>{const r=spawnSync(officecli,args,{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:8*1024*1024,env:{...process.env,OFFICECLI_RESIDENT_FLUSH:'each',OFFICECLI_NO_AUTO_RESIDENT:'1'}});return {ok:!r.error&&r.status===0,exitCode:r.status,error:r.error?.message,stdout:r.stdout,stderr:r.stderr};};
  const result=run(['batch',file,'--input',batchFile,'--json']);return {ok:result.ok,workingFile:file,workingHash:hash(fs.readFileSync(file)),backup,result,next:'review candidate before commit; batch success is not visual validation',modelImageInputs:0};
}
async function locked(args,fn){if(!args.projectPath)return fn(args);const {root}=load(args.projectPath),release=projectLock(root);try{return await fn(args);}finally{release();}}
export const adoptPptx=args=>locked(args,adopt);
export const resumePptx=args=>locked(args,resume);
export const preparePptx=args=>locked(args,prepare);
export const reviewPptx=args=>locked(args,review);
export const commitPptx=args=>locked(args,commit);
export const batchPptx=args=>locked(args,batch);
