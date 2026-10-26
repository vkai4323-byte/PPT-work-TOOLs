import fs from 'node:fs';
import crypto from 'node:crypto';
import {parseFragment} from 'parse5';
import {projectRoot,safePath,projectLock,writeAtomic,snapshotUnderLock,digest} from './project-state.mjs';
const ID=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const tags=new Set(['h1','h2','h3','p','div','img','table','ul','ol','li','x-shape','x-line','svg']);
function parsed(source) {
  const found=[],ids=new Set();
  const walk=node=>{
    const id=node.attrs?.find(a=>a.name==='data-ppt-id')?.value;
    if(id!==undefined) {
      if(!ID.test(id)||ids.has(id))throw new Error('data-ppt-id 无效或重复：'+id);
      if(!tags.has(node.tagName))throw new Error('此元素不支持稳定标识：'+node.tagName);
      if(!node.sourceCodeLocation)throw new Error('无法定位元素源代码。');ids.add(id);
    }
    if(tags.has(node.tagName)&&node.sourceCodeLocation)found.push({node,id});
    for(const child of node.childNodes||[])walk(child);
  };
  walk(parseFragment(source,{sourceCodeLocationInfo:true}));return found;
}
export function validateElements(source) {parsed(source);}
function slideFile(manifestPath,slideId) {
  const root=projectRoot(manifestPath),m=JSON.parse(fs.readFileSync(safePath(root,'super-adc-deck.json'),'utf8'));
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(slideId)||!m.order?.includes(slideId))throw new Error('页面不存在。');
  return {root,relative:'slides/'+slideId+'.html',file:safePath(root,'slides/'+slideId+'.html')};
}
const textOf=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(textOf).join('');
export function listElements(manifestPath,slideId) {
  const {file}=slideFile(manifestPath,slideId),source=fs.readFileSync(file,'utf8');
  return {ok:true,slideId,sourceHash:digest(source),elements:parsed(source).map(({node,id})=>{
    const {startOffset,endOffset}=node.sourceCodeLocation,fragment=source.slice(startOffset,endOffset);
    return {elementId:id||null,reference:id?slideId+'#'+id:null,tag:node.tagName,text:textOf(node).slice(0,240),elementHash:digest(fragment),source:fragment.length<=6000?fragment:undefined,sourceTruncated:fragment.length>6000};
  }),modelImageInputs:0};
}
export function identifyElements(manifestPath,slideId) {
  const {root,file,relative}=slideFile(manifestPath,slideId),unlock=projectLock(root);
  try {
    let source=fs.readFileSync(file,'utf8');const nodes=parsed(source).filter(n=>!n.id);
    if(!nodes.length)return {...listElements(manifestPath,slideId),added:0};
    const snapshot=snapshotUnderLock(root,'为 '+slideId+' 添加稳定标识前');
    const edits=nodes.map(({node})=>({offset:node.sourceCodeLocation.startTag.startOffset+1+node.tagName.length,id:'el-'+crypto.randomBytes(6).toString('hex')})).sort((a,b)=>b.offset-a.offset);
    for(const e of edits)source=source.slice(0,e.offset)+' data-ppt-id="'+e.id+'"'+source.slice(e.offset);
    validateElements(source);writeAtomic(root,relative,source);
    return {...listElements(manifestPath,slideId),added:edits.length,snapshotId:snapshot.id,needsCheck:true};
  }finally{unlock();}
}
export function editElement(manifestPath,slideId,elementId,oldText,newText,expectedElementHash) {
  const {root,file,relative}=slideFile(manifestPath,slideId),unlock=projectLock(root);
  try {
    const source=fs.readFileSync(file,'utf8'),item=parsed(source).find(x=>x.id===elementId);
    if(!item)throw new Error('稳定标识不存在：'+elementId);
    const {startOffset,endOffset}=item.node.sourceCodeLocation,fragment=source.slice(startOffset,endOffset);
    if(expectedElementHash!==digest(fragment))throw new Error('元素已变化，请重新读取该元素。');
    if(typeof oldText!=='string'||!oldText||typeof newText!=='string'||fragment.split(oldText).length!==2)throw new Error('原文必须在目标元素内精确匹配一次。');
    const next=source.slice(0,startOffset)+fragment.replace(oldText,newText)+source.slice(endOffset);
    if(/<(script|iframe|object|embed|link|style)\b/i.test(next)||/\son\w+\s*=/i.test(next))throw new Error('不支持脚本或嵌入标签。');
    if(!parsed(next).some(x=>x.id===elementId))throw new Error('元素编辑必须保留稳定标识。');
    const snapshot=snapshotUnderLock(root,'修改 '+slideId+'#'+elementId+' 前');
    writeAtomic(root,relative,next);
    return {ok:true,slideId,elementId,snapshotId:snapshot.id,needsCheck:true};
  }finally{unlock();}
}
