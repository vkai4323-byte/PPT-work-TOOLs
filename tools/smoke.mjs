import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {Workbench,initProject,doctor} from '../src/workbench.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ppt-workbench-verify-'));
const bench=new Workbench();
try {
  const env=await doctor();assert.equal(env.ok,true,JSON.stringify(env));
  const {manifestPath}=initProject(path.join(root,'fresh.deck'),'安装验收');
  const result=await bench.export(manifestPath);assert.equal(result.exported,true,JSON.stringify(result));
  const zip=await JSZip.loadAsync(fs.readFileSync(result.path));assert.match(await zip.file('ppt/slides/slide1.xml').async('string'),/安装验收/);
  const html='<section id="cover" style="background:#FFFFFF"><p style="position:absolute;left:100px;top:100px;font-size:60px">重叠一</p><p style="position:absolute;left:100px;top:100px;font-size:60px">重叠二</p></section>';
  fs.writeFileSync(path.join(root,'fresh.deck','slides','cover.html'),html);
  const invalid=await bench.export(manifestPath);assert.equal(invalid.exported,false);
  console.log(JSON.stringify({ok:true,environment:env,nativePptx:result.path,overlapBlocked:true,modelImageInputs:0},null,2));
} finally {await bench.close();}
