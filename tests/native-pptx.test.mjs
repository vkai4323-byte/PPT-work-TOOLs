import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import {inspectPptx,adoptPptx,resumePptx,preparePptx,reviewPptx,commitPptx,batchPptx} from '../src/native-pptx.mjs';
import {placementPlan,inspectAsset} from '../src/placement-plan.mjs';
import {initProject} from '../src/workbench.mjs';
const root=fs.mkdtempSync(path.resolve('tests','native-中文-'));
const P='http://schemas.openxmlformats.org/presentationml/2006/main',A='http://schemas.openxmlformats.org/drawingml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const rels=rs=>`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rs.map(([id,type,target])=>`<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
const shape=(id,text)=>`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="文本 ${id}"/></p:nvSpPr><p:spPr/><p:txBody><a:p><a:r><a:rPr sz="2000"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
async function fixture(name){
 const file=path.join(root,name+'.pptx'),z=new JSZip();
 z.file('ppt/presentation.xml',`<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="700" r:id="b"/><p:sldId id="500" r:id="a"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
 z.file('ppt/_rels/presentation.xml.rels',rels([['a','slide','slides/slide1.xml'],['b','slide','slides/slide2.xml']]));
 for(const i of [1,2]){z.file(`ppt/slides/slide${i}.xml`,`<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:cSld><p:spTree>${shape('2','确认文案'+i)}${shape('3','其他文案'+i)}</p:spTree></p:cSld></p:sld>`);z.file(`ppt/slides/_rels/slide${i}.xml.rels`,rels([['theme','theme','../theme/theme1.xml']]));}
 z.file('ppt/theme/theme1.xml',`<a:theme xmlns:a="${A}" name="original"/>`);
 fs.writeFileSync(file,await z.generateAsync({type:'nodebuffer'}));return file;
}
async function mutate(file,part,fn){const z=await JSZip.loadAsync(fs.readFileSync(file));z.file(part,fn(await z.file(part).async('string')));fs.writeFileSync(file,await z.generateAsync({type:'nodebuffer'}));}
async function setup(name){const file=await fixture(name),a=await adoptPptx({file,directory:path.join(root,name)});return {file,...a};}
const prep=(a,extra={})=>preparePptx({projectPath:a.projectPath,expectedCurrentHash:a.current.hash,scope:{kind:'element',slideIds:['700'],shapeIds:['2']},instruction:'只改强调色',...extra});

test('adoption follows presentation order, snapshots input, and reports precise IDs without rendering',async()=>{
 const a=await setup('adopt');assert.deepEqual(a.slides.map(s=>s.slideId),['700','500']);
 const saved=await resumePptx({projectPath:a.projectPath});assert.deepEqual(fs.readFileSync(a.file),fs.readFileSync(saved.authoritativeFile));
 const detail=await inspectPptx({file:saved.authoritativeFile,slideIds:['700']});assert.equal(detail.pages[0].objects[0].shapeId,'2');assert.equal(detail.modelImageInputs,0);
 await mutate(a.file,'ppt/slides/slide2.xml',s=>s.replace('确认文案2','用户手改'));
 assert.equal((await resumePptx({projectPath:a.projectPath})).currentFileMatches,true);
 const next=await adoptPptx({file:a.file,projectPath:a.projectPath,expectedCurrentHash:a.current.hash});assert.notEqual(next.current.hash,a.current.hash);
});
test('element color edit commits new native version without altering original or other slide',async()=>{
 const a=await setup('color'),original=fs.readFileSync(a.file),p=await prep(a);
 await mutate(p.workingFile,'ppt/slides/slide2.xml',s=>s.replace('FFFFFF','FFCC66'));
 const report=await reviewPptx({projectPath:a.projectPath,revisionId:p.revisionId});assert.equal(report.ok,true,JSON.stringify(report));assert.deepEqual(report.changedSlides,['700']);assert.equal(report.textChanges.length,0);
 const c=await commitPptx({projectPath:a.projectPath,revisionId:p.revisionId,expectedCandidateHash:report.candidateHash,validation:{structure:'测试夹具关系完整','visual':'机械颜色修改，本测试未运行视觉验收'}});assert.equal(c.ok,true);assert.deepEqual(fs.readFileSync(a.file),original);assert.notEqual(c.outputPath,p.workingFile);
});

test('commit updates context with version, preserves unspecified context, rejects invalid patch before saving',async()=>{
 const a=await setup('context-sync');
 await resumePptx({projectPath:a.projectPath,patch:{confirmed:['保留原文'],pending:['改色'],focus:['第1页']}});
 const p=await prep(a);await mutate(p.workingFile,'ppt/slides/slide2.xml',s=>s.replace('FFFFFF','FFCC66'));
 const r=await reviewPptx({projectPath:a.projectPath,revisionId:p.revisionId});
 const args={projectPath:a.projectPath,revisionId:p.revisionId,expectedCandidateHash:r.candidateHash,validation:{structure:'测试夹具','visual':'属性改色，未做视觉验收'}};
 await assert.rejects(commitPptx({...args,contextPatch:{pending:'invalid'}}),/记录字段/);
 assert.equal((await resumePptx({projectPath:a.projectPath})).current.hash,a.current.hash);
 await commitPptx({...args,contextPatch:{pending:['待用户查看'],focus:['本轮已改色']}});
 const next=await resumePptx({projectPath:a.projectPath});assert.deepEqual(next.context.confirmed,['保留原文']);assert.deepEqual(next.context.pending,['待用户查看']);assert.equal(next.lastRevision.versionHash,next.current.hash);assert.equal(next.lastRevision.contextUpdated,true);
 const ledger=await placementPlan({targetPath:a.projectPath,expectedSourceHash:next.current.hash,plan:{assets:[],placements:[],slots:[{id:'future-cover',slideId:'700',intent:'真实作品封面',outputKind:'work-evidence',status:'needed'}]}});
 assert.equal(ledger.progress.total,1);assert.equal(ledger.plan.slots[0].id,'future-cover');
});
test('blocks confirmed text changes, other objects, slide background and shared resources',async()=>{
 for(const [name,part,fn,code] of [
 ['text','ppt/slides/slide2.xml',s=>s.replace('确认文案2','意外改写'),'confirmed-text-changed'],
 ['other','ppt/slides/slide2.xml',s=>s.replace('其他文案2','别处变化'),'element-outside-scope'],
 ['background','ppt/slides/slide2.xml',s=>s.replace('<p:cSld>','<p:cSld><p:bg/>'),'slide-structure-outside-element-scope'],
 ['theme','ppt/theme/theme1.xml',s=>s.replace('original','changed'),'shared-or-unrelated-part-changed'],
 ['page','ppt/slides/slide1.xml',s=>s.replace('FFFFFF','FFCC66'),'slide-outside-scope']]){
 const a=await setup(name),p=await prep(a);await mutate(p.workingFile,part,fn);const r=await reviewPptx({projectPath:a.projectPath,revisionId:p.revisionId});assert.ok(r.errors.some(e=>e.code===code),JSON.stringify(r));}
});
test('whole-slide annotation may change unselected objects; text edits require explicit plan',async()=>{
 const a=await setup('slide'),p=await prep(a,{scope:{kind:'slide',slideIds:['700']},preserveText:false,instruction:'标题只定位，整页改文案与布局'});
 await mutate(p.workingFile,'ppt/slides/slide2.xml',s=>s.replace('其他文案2','本轮改写'));assert.equal((await reviewPptx({projectPath:a.projectPath,revisionId:p.revisionId})).ok,true);
});
test('stale annotations, authority and candidate hashes cannot silently overwrite new work',async()=>{
 const a=await setup('stale');await assert.rejects(prep(a,{annotation:{artifactHash:'old'}}),/批注/);const p=await prep(a);
 await assert.rejects(commitPptx({projectPath:a.projectPath,revisionId:p.revisionId,expectedCandidateHash:'old'}),/候选/);
 await mutate(a.file,'ppt/slides/slide2.xml',s=>s.replace('确认文案2','手改新稿'));await adoptPptx({file:a.file,projectPath:a.projectPath,expectedCurrentHash:a.current.hash});
 await assert.rejects(reviewPptx({projectPath:a.projectPath,revisionId:p.revisionId}),/更新/);
});
test('saved current file tampering requires re-adoption; state paths cannot escape project',async()=>{
 const a=await setup('tamper'),r=await resumePptx({projectPath:a.projectPath});await mutate(r.authoritativeFile,'ppt/slides/slide2.xml',s=>s.replace('确认文案2','外部改动'));
 assert.equal((await resumePptx({projectPath:a.projectPath})).currentFileMatches,false);await assert.rejects(prep(a),/外部修改/);
 const state=JSON.parse(fs.readFileSync(a.projectPath));state.current.file='../escape.pptx';fs.writeFileSync(a.projectPath,JSON.stringify(state));await assert.rejects(resumePptx({projectPath:a.projectPath}),/路径/);
});
test('batch rejects stale file and reports unavailable CLI without changing source',async()=>{
 const a=await setup('batch'),p=await prep(a),batchFile=path.join(root,'batch.json');fs.writeFileSync(batchFile,JSON.stringify([{command:'set',path:'/slide[1]/shape[@id=2]',props:{color:'FFCC66'}}]));
 await assert.rejects(batchPptx({projectPath:a.projectPath,revisionId:p.revisionId,batchFile,expectedWorkingHash:'old'}),/工作稿/);
 const r=await batchPptx({projectPath:a.projectPath,revisionId:p.revisionId,batchFile,expectedWorkingHash:a.current.hash,officecli:path.join(root,'missing.exe')});assert.equal(r.ok,false);assert.equal(r.workingHash,a.current.hash);
});
test('placement plans bind real slide IDs and asset hashes, tolerate deliberate bleed/reuse, detect stale assets',async()=>{
 const a=await setup('placements'),asset=path.join(root,'avatar.png');fs.writeFileSync(asset,'test-bytes');const info=inspectAsset({file:asset}),s=await placementPlan({targetPath:a.projectPath});
 const plan={assets:[{id:'avatar',file:asset,expectedHash:info.hash,role:'identity',origin:'user',source:'用户素材',purpose:'身份标识'}],placements:[{slideId:'700',assetId:'avatar',purpose:'头像',fit:'contain',allowBleed:true},{slideId:'500',assetId:'avatar',purpose:'重复身份',fit:'contain'}]};
 const saved=await placementPlan({targetPath:a.projectPath,expectedSourceHash:s.sourceHash,plan});assert.equal(saved.planMatchesSource,true);assert.equal(saved.assets[0].current,true);
 fs.writeFileSync(asset,'new');assert.equal((await placementPlan({targetPath:a.projectPath})).assets[0].current,false);
 await assert.rejects(placementPlan({targetPath:a.projectPath,expectedSourceHash:s.sourceHash,plan}),/指纹/);
 const {manifestPath}=initProject(path.join(root,'deck'),'布图');assert.equal((await placementPlan({targetPath:manifestPath})).backend,'deck');
});
