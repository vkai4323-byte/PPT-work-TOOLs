import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { Workbench,initProject,replaceText,doctor } from '../src/workbench.mjs';
import {identifyElements} from '../src/elements.mjs';

const root=fs.mkdtempSync(path.resolve('tests','run-'));
const bench=new Workbench();
const make=(name,ids=['cover'])=>initProject(path.join(root,name),name,ids).manifestPath;
const put=(manifest,id,body)=>fs.writeFileSync(path.join(path.dirname(manifest),'slides',id+'.html'),body);
const frame=(id,body)=>`<section id="${id}" style="background:#101820;color:#FFFFFF;padding:128px;display:flex;flex-direction:column;gap:32px">${body}</section>`;
const h=s=>`<h1 style="font-size:72px">${s}</h1>`;
test.after(async()=>{await bench.close();});

test('environment and Chinese font are ready',async()=>{assert.equal((await doctor()).ok,true);});
test('new projects export real editable text, table, shapes, image and SVG',async()=>{
  const manifest=make('production',['cover','table','visual']);
  put(manifest,'cover',frame('cover',h('从结构到精确排版')+'<p style="font-size:36px;line-height:1.5;width:1250px">中文长段落用于检查实际换行。<b>重点内容保持可编辑。</b>浏览器测量文字的真实尺寸，导出为原生文本框。</p>'));
  put(manifest,'table',frame('table',h('清晰的信息层级')+'<table style="width:1500px;font-size:36px"><tr><th style="padding:24px;background:#243447">阶段</th><th style="padding:24px;background:#243447">交付</th></tr><tr><td style="padding:24px">制作</td><td style="padding:24px">可编辑 PPTX</td></tr></table><x-shape kind="roundRect" style="width:600px;height:150px;background:#197A83;font-size:40px">文字与形状分层</x-shape>'));
  fs.writeFileSync(path.join(path.dirname(manifest),'assets','pixel.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6hV8AAAAASUVORK5CYII=','base64'));
  put(manifest,'visual',frame('visual',h('局部修改，逐页检查')+'<div style="display:flex;gap:48px"><svg width="500" height="280" viewBox="0 0 500 280"><rect x="0" y="0" width="160" height="240" fill="#33B7A0"></rect><path d="M200 240 L280 100 L400 170" stroke="#FFCC66" stroke-width="8" fill="none"></path></svg><img src="assets/pixel.png" style="width:300px;height:280px;object-fit:cover"></div>'));
  for(const id of ['cover','table','visual']) assert.ok(identifyElements(manifest,id).added>0);
  const first=await bench.check(manifest);
  assert.equal(first.ok,true,JSON.stringify(first.issues));assert.equal(first.measuredSlides,3);
  const second=await bench.check(manifest);assert.equal(second.cachedSlides,3);
  const result=await bench.export(manifest);assert.equal(result.exported,true,JSON.stringify(result.issues));
  const zip=await JSZip.loadAsync(fs.readFileSync(result.path));
  const xml=await zip.file('ppt/slides/slide1.xml').async('string');assert.match(xml,/<a:t>从结构到精确排版/);assert.match(xml,/<p:sp>/);
  const tableXml=await zip.file('ppt/slides/slide2.xml').async('string');assert.match(tableXml,/<a:tbl>/);
  for(const cell of tableXml.matchAll(/<a:tc>.*?<\/a:tc>/gs)) {
    assert.ok(!/<a:bodyPr[^>]*(?:lIns|anchor)=/.test(cell[0]));assert.match(cell[0],/marL="152400"/);
  }
  assert.match(await zip.file('ppt/slides/slide3.xml').async('string'),/<p:pic>/);
  const again=await bench.export(manifest);assert.notEqual(again.path,result.path);
  const preview=await bench.preview(manifest);assert.equal(preview.contactSheets.length,1);assert.ok(fs.existsSync(preview.contactSheets[0]));
  fs.writeFileSync(path.resolve('tests','latest-demo.json'),JSON.stringify({manifest,...result,contactSheet:preview.contactSheets[0]},null,2));
});
test('overflow and overlap report paths and refuse export',async()=>{
  const manifest=make('invalid');
  put(manifest,'cover',frame('cover','<p style="position:absolute;left:100px;top:100px;width:800px;font-size:50px">重叠检查第一行</p><p style="position:absolute;left:100px;top:100px;width:800px;font-size:50px">重叠检查第二行</p><p style="position:absolute;left:1800px;top:800px;width:600px;font-size:60px">画布外内容</p>'));
  const report=await bench.check(manifest);assert.equal(report.ok,false);assert.ok(report.issues.some(i=>i.path&&i.message.includes('重叠')));assert.ok(report.issues.some(i=>i.message.includes('超出画布')));
  assert.equal((await bench.export(manifest)).exported,false);assert.equal(fs.readdirSync(path.join(path.dirname(manifest),'exports')).length,0);
});
test('incremental editing remeasures only changed page and protects stale matches',async()=>{
  const manifest=make('incremental',['a','b']);await bench.check(manifest);
  const originalB=fs.readFileSync(path.join(path.dirname(manifest),'slides','b.html'),'utf8');
  const edit=replaceText(manifest,'a','incremental','中文修改后的标题');assert.ok(fs.existsSync(edit.backup));
  assert.throws(()=>replaceText(manifest,'a','incremental','stale'),/精确匹配/);
  const report=await bench.check(manifest);assert.equal(report.measuredSlides,1);assert.equal(report.cachedSlides,1);
  assert.equal(fs.readFileSync(path.join(path.dirname(manifest),'slides','b.html'),'utf8'),originalB);
});
test('105 repeated checks return zero model images and use unchanged cache',async()=>{
  const manifest=make('long-session');
  for(let i=0;i<105;i++) {const report=await bench.check(manifest);assert.equal(report.ok,true);assert.equal(report.modelImageInputs,0);if(i) assert.equal(report.cachedSlides,1);}
});
test('two independent projects do not share revisions or cache',async()=>{
  const one=make('first-new-project'),two=make('second-new-project');
  const a=await bench.export(one),b=await bench.export(two);assert.equal(a.exported,true);assert.equal(b.exported,true);assert.notEqual(a.sourceHash,b.sourceHash);
});
test('missing ordered page fails instead of silently dropping content',async()=>{
  const manifest=make('missing');const m=JSON.parse(fs.readFileSync(manifest));m.order.push('absent');fs.writeFileSync(manifest,JSON.stringify(m));
  await assert.rejects(()=>bench.export(manifest),/ENOENT/);
});
test('unlisted page is not exported',async()=>{
  const manifest=make('unlisted');put(manifest,'stale',frame('stale',h('不应出现')));
  const result=await bench.export(manifest);assert.equal(result.exported,true);assert.equal(result.slides,1);
});
test('script markup, duplicate ID and missing font fail clearly',async()=>{
  const manifest=make('rejected');put(manifest,'cover',frame('cover','<script>alert(1)</script>'));
  await assert.rejects(()=>bench.check(manifest),/不支持/);
  put(manifest,'cover',frame('cover',h('字体测试')));
  const m=JSON.parse(fs.readFileSync(manifest));m.fonts=['FontThatDoesNotExist_PPT_Workbench'];fs.writeFileSync(manifest,JSON.stringify(m));
  const report=await bench.check(manifest);assert.equal(report.ok,false);assert.ok(report.issues.some(i=>i.message.includes('字体未成功加载')));
  m.order.push('cover');fs.writeFileSync(manifest,JSON.stringify(m));await assert.rejects(()=>bench.check(manifest),/重复/);
});
