import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const encode=x=>JSON.stringify(x,null,2)+'\n';
const MANIFEST='super-adc-deck.json';
const SID=/^[0-9]{13}-[a-f0-9]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
const managed=name=>name===MANIFEST||['progress.md','handoff.md'].includes(name)||/^(slides|assets|notes)\/.+/.test(name);

export function projectRoot(manifestPath) {
  if(!path.isAbsolute(manifestPath)||path.basename(manifestPath)!==MANIFEST) throw new Error('请提供 super-adc-deck.json 的绝对路径。');
  const root=fs.realpathSync(path.dirname(manifestPath));
  if(!fs.statSync(safePath(root,MANIFEST)).isFile())throw new Error('项目清单不存在。');safePath(root,'.ppt-workbench');
  return root;
}
export function safePath(root,relative) {
  if(typeof relative!=='string'||!relative||relative.includes('\\')||relative.includes(':')||relative.split('/').some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p))) throw new Error('无效的项目相对路径。');
  let current=root;
  for(const part of relative.split('/')) {
    current=path.join(current,part);
    try {if(fs.lstatSync(current).isSymbolicLink())throw new Error('项目状态操作不支持符号链接：'+relative);}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  const rel=path.relative(root,current);
  if(rel.startsWith('..')||path.isAbsolute(rel)) throw new Error('路径超出项目目录。');
  return current;
}
export function writeAtomic(root,relative,data) {
  const file=safePath(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=file+'.'+crypto.randomUUID()+'.tmp';
  try {fs.writeFileSync(temp,data,{flag:'wx'});fs.renameSync(temp,file);}
  finally {if(fs.existsSync(temp)) fs.unlinkSync(temp);}
}
export function projectLock(root) {
  const file=safePath(root,'.ppt-workbench/write.lock');fs.mkdirSync(path.dirname(file),{recursive:true});
  try {fs.writeFileSync(file,encode({pid:process.pid,createdAt:new Date().toISOString()}),{flag:'wx'});}
  catch(e) {if(e.code==='EEXIST')throw new Error('项目正在修改；若进程已退出，请核对 .ppt-workbench/write.lock。');throw e;}
  return ()=>fs.unlinkSync(file);
}
function inventory(root) {
  const entries=[];
  function visit(name) {
    const file=safePath(root,name);if(!fs.existsSync(file))return;
    const stat=fs.statSync(file);
    if(stat.isDirectory()) {for(const child of fs.readdirSync(file).sort())visit(name+'/'+child);}
    else if(stat.isFile()) {const data=fs.readFileSync(file);entries.push({path:name,hash:digest(data),bytes:data.length});}
    else throw new Error('不支持的项目文件：'+name);
  }
  for(const name of [MANIFEST,'slides','assets','notes','progress.md','handoff.md'])visit(name);
  return entries.sort((a,b)=>a.path.localeCompare(b.path));
}
const treeHash=entries=>digest(JSON.stringify(entries));
export function projectSourceHash(root) {return treeHash(inventory(root).filter(f=>f.path===MANIFEST||/^(slides|assets)\//.test(f.path)));}
export function snapshotUnderLock(root,label='修改前') {
  const files=inventory(root),id=Date.now()+'-'+crypto.randomBytes(6).toString('hex');
  for(const f of files) {
    const data=fs.readFileSync(safePath(root,f.path));if(digest(data)!==f.hash)throw new Error('快照期间源文件变化，请重试。');
    const dest=safePath(root,'.ppt-workbench/objects/'+f.hash);
    if(fs.existsSync(dest)) {if(digest(fs.readFileSync(dest))!==f.hash)throw new Error('快照对象损坏：'+f.hash);}
    else writeAtomic(root,'.ppt-workbench/objects/'+f.hash,data);
  }
  if(treeHash(inventory(root))!==treeHash(files))throw new Error('快照期间项目变化，请重试。');
  const snapshot={schema:1,id,label,createdAt:new Date().toISOString(),treeHash:treeHash(files),files};
  writeAtomic(root,'.ppt-workbench/snapshots/'+id+'.json',encode(snapshot));
  return {ok:true,id,label,files:files.length,treeHash:snapshot.treeHash};
}
export function snapshotProject(manifestPath,label) {
  const root=projectRoot(manifestPath),unlock=projectLock(root);
  try{return snapshotUnderLock(root,label);}finally{unlock();}
}
function readSnapshot(root,id) {
  if(!SID.test(id))throw new Error('快照 ID 无效。');
  const s=JSON.parse(fs.readFileSync(safePath(root,'.ppt-workbench/snapshots/'+id+'.json'),'utf8'));
  if(s.schema!==1||s.id!==id||!Array.isArray(s.files)||s.files.length>50000||s.treeHash!==treeHash(s.files))throw new Error('快照清单损坏。');
  const names=new Set();
  for(const f of s.files) {
    safePath(root,f.path);const key=f.path.toLowerCase();
    if(!managed(f.path)||!HASH.test(f.hash)||!Number.isSafeInteger(f.bytes)||f.bytes<0||names.has(key))throw new Error('快照条目无效。');
    names.add(key);
  }
  if(!names.has(MANIFEST))throw new Error('快照缺少项目清单。');
  // Reject file/directory collisions before any restore mutation.
  for(const name of names) {const p=name.split('/');p.pop();while(p.length){if(names.has(p.join('/')))throw new Error('快照路径冲突。');p.pop();}}
  return s;
}
export function listSnapshots(manifestPath) {
  const root=projectRoot(manifestPath),dir=safePath(root,'.ppt-workbench/snapshots');
  const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>SID.test(x.slice(0,-5))&&x.endsWith('.json')).sort().reverse():[];
  return {ok:true,snapshots:files.map(n=>{const s=readSnapshot(root,n.slice(0,-5));return {id:s.id,label:s.label,createdAt:s.createdAt,files:s.files.length,treeHash:s.treeHash};})};
}
function verifiedObjects(root,s) {
  const result=new Map();
  for(const f of s.files) {
    const data=fs.readFileSync(safePath(root,'.ppt-workbench/objects/'+f.hash));
    if(data.length!==f.bytes||digest(data)!==f.hash)throw new Error('快照对象损坏，未恢复：'+f.path);
    result.set(f.path,data);
  }
  return result;
}
function changes(current,target) {
  const from=new Map(current.map(f=>[f.path,f.hash])),to=new Map(target.map(f=>[f.path,f.hash]));
  return {added:target.filter(f=>!from.has(f.path)).map(f=>f.path),modified:target.filter(f=>from.has(f.path)&&from.get(f.path)!==f.hash).map(f=>f.path),removed:current.filter(f=>!to.has(f.path)).map(f=>f.path)};
}
function applyFiles(root,files,data) {
  const current=inventory(root),desired=new Set(files.map(f=>f.path));
  // Every target is in the exact managed source scope; exports are untouched.
  for(const f of current)if(!desired.has(f.path))fs.unlinkSync(safePath(root,f.path));
  for(const f of files)writeAtomic(root,f.path,data.get(f.path));
}
export function restoreProject(manifestPath,snapshotId,{apply=false,expectedCurrentHash}={}) {
  const root=projectRoot(manifestPath),unlock=projectLock(root);
  try {
    const target=readSnapshot(root,snapshotId),data=verifiedObjects(root,target),current=inventory(root),currentHash=treeHash(current),diff=changes(current,target.files);
    if(!apply)return {ok:true,applied:false,snapshotId,currentHash,...diff};
    if(!expectedCurrentHash||expectedCurrentHash!==currentHash)throw new Error('当前项目与恢复预览不一致，请重新预览恢复。');
    // Fail before writes if a target cannot be represented without deleting directories.
    for(const f of target.files) {
      const dest=safePath(root,f.path);if(fs.existsSync(dest)&&fs.statSync(dest).isDirectory())throw new Error('恢复目标与现有目录冲突：'+f.path);
      let parent=path.dirname(dest);while(parent!==root){if(fs.existsSync(parent)&&!fs.statSync(parent).isDirectory())throw new Error('恢复目标父目录冲突：'+f.path);parent=path.dirname(parent);}
    }
    const safety=snapshotUnderLock(root,'恢复 '+snapshotId+' 前');
    if(safety.treeHash!==currentHash)throw new Error('恢复前源文件发生变化，请重试。');
    try {applyFiles(root,target.files,data);}
    catch(error) {
      try {const previous=readSnapshot(root,safety.id);applyFiles(root,previous.files,verifiedObjects(root,previous));}
      catch(rollback){throw new Error('恢复及自动回滚失败；安全快照 '+safety.id+'；'+rollback.message);}
      throw new Error('恢复失败，已回滚：'+error.message);
    }
    return {ok:true,applied:true,snapshotId,safetySnapshot:safety.id,...diff,needsCheck:true,exportsPreserved:true};
  } finally {unlock();}
}

function readRecord(root,name,fallback) {
  const file=safePath(root,'notes/'+name);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
}
export function projectContext(manifestPath,patch) {
  const root=projectRoot(manifestPath);
  const defaults={schema:1,focus:[],requirements:[],references:[],confirmed:[],pending:[],decisions:[]};
  if(!patch)return {ok:true,context:readRecord(root,'project.json',defaults)};
  const allowed=new Set(['focus','requirements','references','confirmed','pending','decisions']);
  if(Object.keys(patch).some(k=>!allowed.has(k)))throw new Error('未知项目记录字段。');
  for(const [key,value]of Object.entries(patch)) {
    if(!Array.isArray(value))throw new Error(key+' 必须是数组。');
    if(key!=='references'&&value.some(s=>typeof s!=='string'))throw new Error(key+' 必须是文字数组。');
    if(key==='references'&&value.some(r=>!r||typeof r.source!=='string'||!['content','layout','visual','template'].includes(r.role)||typeof r.notes!=='string'))throw new Error('参考资料需要 source、role 和 notes。');
  }
  const unlock=projectLock(root);
  try {
    const snapshot=snapshotUnderLock(root,'更新项目决定前');
    const next={...readRecord(root,'project.json',defaults),...patch,updatedAt:new Date().toISOString()};
    writeAtomic(root,'notes/project.json',encode(next));return {ok:true,context:next,snapshotId:snapshot.id};
  }finally{unlock();}
}
export function mediaRecord(manifestPath,{file,action='status',summary,sourceUrl,purpose,slideIds=[],expectedHash}={}) {
  const root=projectRoot(manifestPath);
  if(!file)throw new Error('需要项目内文件相对路径。');
  if(!/^(assets|notes|\.ppt-workbench\/previews)\//.test(file))throw new Error('素材记录仅支持 assets、notes 或本地预览目录。');
  const actual=safePath(root,file),hash=digest(fs.readFileSync(actual));
  const records=readRecord(root,'media.json',{schema:1,records:[]});
  const previous=records.records.filter(r=>r.file===file).at(-1),same=records.records.filter(r=>r.hash===hash).at(-1);
  if(action==='status')return {ok:true,file,hash,reviewedCurrent:!!same,sameContentAt:same?.file,previous,review:same,modelImageInputs:0,note:'记录表示此前由调用方声明已查看，不表示本工具看过图片，也不清理模型历史。'};
  if(action!=='review'||typeof summary!=='string'||!summary.trim())throw new Error('review 需要实际查阅后的文字摘要。');
  if(expectedHash!==hash)throw new Error('素材与查阅时的指纹不一致，请重新核对。');
  const unlock=projectLock(root);
  try {
    if(digest(fs.readFileSync(actual))!==hash)throw new Error('素材已变化。');
    const state=readRecord(root,'media.json',{schema:1,records:[]});
    const snapshot=snapshotUnderLock(root,'记录素材查阅前');
    const entry={file,hash,summary,sourceUrl,purpose,slideIds,reviewedAt:new Date().toISOString(),basis:'caller-reported'};
    state.records.push(entry);writeAtomic(root,'notes/media.json',encode(state));return {ok:true,entry,snapshotId:snapshot.id,modelImageInputs:0};
  }finally{unlock();}
}
export function resumeProject(manifestPath) {
  const root=projectRoot(manifestPath),context=projectContext(manifestPath).context;
  const manifest=JSON.parse(fs.readFileSync(safePath(root,MANIFEST),'utf8'));
  const media=readRecord(root,'media.json',{records:[]}).records;
  const latestFile=safePath(root,'.ppt-workbench/latest-export.json');
  const latest=fs.existsSync(latestFile)?JSON.parse(fs.readFileSync(latestFile,'utf8')):null;
  const currentSourceHash=projectSourceHash(root);
  const reviews=media.map(r=>{const f=safePath(root,r.file);return {...r,current:fs.existsSync(f)&&digest(fs.readFileSync(f))===r.hash};});
  const notes={};for(const name of ['style.md','decisions.md']){const f=safePath(root,'notes/'+name);if(fs.existsSync(f))notes[name]=fs.readFileSync(f,'utf8');}
  return {ok:true,title:manifest.title,order:manifest.order,context,notes,media:reviews,latestExport:latest?{path:latest.path,current:latest.contentHash===currentSourceHash,legacyUnverified:!latest.contentHash}:null,snapshots:listSnapshots(manifestPath).snapshots.slice(0,10),modelImageInputs:0,note:'资料与历史决定仅是项目上下文；用户本轮要求优先。没有固定阶段顺序，图片查阅记录不代表模型仍能看到原图。'};
}
