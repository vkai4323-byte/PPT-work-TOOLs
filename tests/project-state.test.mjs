import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {initProject,Workbench,replaceText} from '../src/workbench.mjs';
import {snapshotProject,listSnapshots,restoreProject,projectContext,mediaRecord,resumeProject,digest} from '../src/project-state.mjs';
import {identifyElements,listElements,editElement} from '../src/elements.mjs';
const root=fs.mkdtempSync(path.resolve('tests','state-中文-'));
const make=name=>initProject(path.join(root,name),name,['cover','plan']).manifestPath;
const put=(m,name,data)=>fs.writeFileSync(path.join(path.dirname(m),name),data);
const read=(m,name)=>fs.readFileSync(path.join(path.dirname(m),name));

test('full restore recovers source, assets, notes, order and deletions; exports survive; safety snapshot is recoverable',()=>{
  const m=make('restore');put(m,'assets/photo.png',Buffer.from([1,2,3]));put(m,'notes/style.md','approved');
  const oldManifest=read(m,'super-adc-deck.json'),oldSlide=read(m,'slides/plan.html');
  const saved=snapshotProject(m,'before art');
  put(m,'slides/plan.html','changed');put(m,'assets/photo.png',Buffer.from([4]));put(m,'notes/style.md','new');put(m,'assets/new.png','new asset');put(m,'exports/keep.pptx','keep');
  const manifest=JSON.parse(oldManifest);manifest.order.reverse();put(m,'super-adc-deck.json',JSON.stringify(manifest));
  const preview=restoreProject(m,saved.id);assert.equal(preview.applied,false);assert.ok(preview.removed.includes('assets/new.png'));
  assert.equal(read(m,'slides/plan.html').toString(),'changed');
  const result=restoreProject(m,saved.id,{apply:true,expectedCurrentHash:preview.currentHash});
  assert.deepEqual(read(m,'super-adc-deck.json'),oldManifest);assert.deepEqual(read(m,'slides/plan.html'),oldSlide);assert.deepEqual(read(m,'assets/photo.png'),Buffer.from([1,2,3]));
  assert.equal(read(m,'notes/style.md').toString(),'approved');assert.ok(!fs.existsSync(path.join(path.dirname(m),'assets/new.png')));assert.equal(read(m,'exports/keep.pptx').toString(),'keep');
  const undo=restoreProject(m,result.safetySnapshot);restoreProject(m,result.safetySnapshot,{apply:true,expectedCurrentHash:undo.currentHash});assert.equal(read(m,'slides/plan.html').toString(),'changed');
});
test('stale restore plans and corrupted objects fail before source mutation',()=>{
  const m=make('corrupt'),saved=snapshotProject(m);const plan=restoreProject(m,saved.id);put(m,'notes/new.md','new');
  assert.throws(()=>restoreProject(m,saved.id,{apply:true,expectedCurrentHash:plan.currentHash}),/预览/);
  const meta=JSON.parse(read(m,'.ppt-workbench/snapshots/'+saved.id+'.json'));const blob=meta.files.find(f=>f.path==='slides/cover.html');
  put(m,'.ppt-workbench/objects/'+blob.hash,'damaged');const before=read(m,'slides/cover.html');
  assert.throws(()=>restoreProject(m,saved.id),/损坏/);assert.deepEqual(read(m,'slides/cover.html'),before);
});
test('content-addressed snapshots deduplicate assets and reject tampered paths',()=>{
  const m=make('dedup');put(m,'assets/large.bin',Buffer.alloc(100000,7));const one=snapshotProject(m),two=snapshotProject(m);
  const objects=fs.readdirSync(path.join(path.dirname(m),'.ppt-workbench/objects'));assert.equal(objects.filter(h=>h===digest(Buffer.alloc(100000,7))).length,1);
  const meta=JSON.parse(read(m,'.ppt-workbench/snapshots/'+two.id+'.json'));meta.files[0].path='../outside';meta.treeHash=digest(JSON.stringify(meta.files));put(m,'.ppt-workbench/snapshots/'+two.id+'.json',JSON.stringify(meta));
  assert.throws(()=>restoreProject(m,two.id),/路径/);assert.ok(one.id!==two.id);
});
test('stable IDs survive sibling insertion, scope duplicate text, and reject stale element hashes',async()=>{
  const m=make('elements');put(m,'slides/cover.html','<section id="cover" style="background:#fff;padding:128px;display:flex;flex-direction:column;gap:40px"><h1 style="font-size:60px">同一句</h1><p style="font-size:32px">同一句</p></section>');
  const identified=identifyElements(m,'cover');assert.equal(identified.added,2);assert.equal(identifyElements(m,'cover').added,0);
  const title=identified.elements.find(e=>e.tag==='h1');let html=read(m,'slides/cover.html').toString();html=html.replace('<h1','<p style="font-size:24px">插入</p><h1');put(m,'slides/cover.html',html);
  editElement(m,'cover',title.elementId,'同一句','只改标题',title.elementHash);
  const current=listElements(m,'cover');assert.equal(current.elements.find(e=>e.elementId===title.elementId).text,'只改标题');assert.ok(current.elements.some(e=>e.tag==='p'&&e.text==='同一句'));
  assert.throws(()=>editElement(m,'cover',title.elementId,'只改标题','陈旧修改',title.elementHash),/变化/);
  const bench=new Workbench();try {const report=await bench.check(m);assert.equal(report.ok,true,JSON.stringify(report.issues));const out=await bench.export(m);assert.equal(out.exported,true);const inspected=await bench.inspect(m,'cover');assert.ok(inspected.pages[0].elementRefs.some(e=>e.elementId===title.elementId));}finally{await bench.close();}
});
test('invalid duplicate stable IDs fail; old decks need no migration to check',async()=>{
  const m=make('duplicate');const bench=new Workbench();try{assert.equal((await bench.check(m)).ok,true);}finally{await bench.close();}
  put(m,'slides/cover.html','<section id="cover"><h1 data-ppt-id="same">a</h1><p data-ppt-id="same">b</p></section>');assert.throws(()=>identifyElements(m,'cover'),/重复/);
});
test('ordinary edits automatically snapshot complete source project',()=>{
  const m=make('automatic');put(m,'assets/material.bin','asset');const edited=replaceText(m,'cover','automatic','改后');
  const meta=JSON.parse(read(m,'.ppt-workbench/snapshots/'+edited.snapshotId+'.json'));assert.ok(meta.files.some(f=>f.path==='assets/material.bin'));assert.ok(meta.files.some(f=>f.path==='slides/plan.html'));
});
test('flexible context and media fingerprints resume without fixed phases or fictional image reviews',async()=>{
  const m=make('context');projectContext(m,{focus:['补素材','回头改文案'],confirmed:['第 2 页逻辑已确认'],references:[{source:'notes/brand.pdf',role:'template',notes:'标题位置固定'}]});
  projectContext(m,{focus:['美术升级']});assert.deepEqual(projectContext(m).context.confirmed,['第 2 页逻辑已确认']);
  put(m,'assets/ref.png','version-one');const status=mediaRecord(m,{file:'assets/ref.png'});assert.equal(status.reviewedCurrent,false);
  assert.throws(()=>mediaRecord(m,{file:'assets/ref.png',action:'review',summary:'blue',expectedHash:'stale'}),/指纹/);
  mediaRecord(m,{file:'assets/ref.png',action:'review',summary:'调用方看过，记录配色',expectedHash:status.hash});assert.equal(mediaRecord(m,{file:'assets/ref.png'}).reviewedCurrent,true);
  put(m,'assets/copy.png','version-one');assert.equal(mediaRecord(m,{file:'assets/copy.png'}).reviewedCurrent,true);
  put(m,'assets/ref.png','version-two');assert.equal(mediaRecord(m,{file:'assets/ref.png'}).reviewedCurrent,false);
  const resumed=resumeProject(m);assert.equal(resumed.media[0].current,false);assert.deepEqual(resumed.context.focus,['美术升级']);assert.equal(resumed.modelImageInputs,0);
  const bench=new Workbench();try {await bench.export(m);assert.equal(resumeProject(m).latestExport.current,true);replaceText(m,'cover','context','新内容');assert.equal(resumeProject(m).latestExport.current,false);}finally{await bench.close();}
});
test('symlinked source and state directories cannot be snapshotted or restored',()=>{
  const m=make('links'),outside=path.join(root,'external');fs.mkdirSync(outside);fs.symlinkSync(outside,path.join(path.dirname(m),'notes','link'),'junction');
  assert.throws(()=>snapshotProject(m),/符号链接/);
});
test('restore write failure rolls back source changes and removed assets',t=>{
  const m=make('rollback');put(m,'notes/style.md','old');const saved=snapshotProject(m);put(m,'notes/style.md','current');put(m,'assets/added.bin','keep this');
  const preview=restoreProject(m,saved.id),realRename=fs.renameSync;let injected=false;
  t.mock.method(fs,'renameSync',(from,to)=>{if(!injected&&to===path.join(path.dirname(m),'notes','style.md')){injected=true;throw new Error('injected disk write failure');}return realRename(from,to);});
  assert.throws(()=>restoreProject(m,saved.id,{apply:true,expectedCurrentHash:preview.currentHash}),/已回滚/);
  assert.equal(read(m,'notes/style.md').toString(),'current');assert.equal(read(m,'assets/added.bin').toString(),'keep this');assert.equal(injected,true);
});
