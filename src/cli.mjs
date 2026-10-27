#!/usr/bin/env node
import fs from 'node:fs';
import { dispatch,bench } from './dispatch.mjs';
const [command,first,second]=process.argv.slice(2);
if(!command||command==='--help') {
  console.log('PPT Workbench\n  doctor\n  check|export|preview|resume|snapshots <absolute manifest path>\n  init|inspect|edit|snapshot|restore|context|media|identify|elements|edit_element --input request.json\n  pptx_inspect|pptx_adopt|pptx_resume|pptx_prepare|pptx_batch|pptx_review|pptx_commit --input request.json\n  ppt_asset|ppt_placement_plan --input request.json\nAny command accepts --input <UTF-8 JSON file>.');
} else {
  try {
    const args=first==='--input'?JSON.parse(fs.readFileSync(second,'utf8').replace(/^\uFEFF/,'')):{manifestPath:first};
    const result=await dispatch(command,args);console.log(JSON.stringify(result,null,2));
    if(result.ok===false) process.exitCode=2;
  } catch(e) { console.log(JSON.stringify({ok:false,error:e.message}));process.exitCode=1; }
  finally {await bench.close();}
}
