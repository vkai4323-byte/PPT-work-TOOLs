#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { dispatch,bench } from './dispatch.mjs';
const server=new McpServer({name:'ppt-workbench',version:'0.1.0'});
const manifestPath=z.string().describe('Absolute path to super-adc-deck.json.');
const defs={
  doctor:{description:'Check local Node, Chromium and Chinese font availability. Text result only.',schema:{}},
  init:{description:'Create a new editable HTML deck project in a new directory. Never overwrites an existing project.',schema:{directory:z.string(),title:z.string(),slides:z.array(z.string()).optional()}},
  check:{description:'Measure EVERY slide in Chromium and return text diagnostics with slide and element paths. Detect text overlap, overflow, invalid dialect and missing images/fonts. Reuses content-hashed unchanged measurements; no screenshots or model image inputs. Saves a local JSON report.',schema:{manifestPath}},
  export:{description:'Check all slides, then export native editable PPTX; refuses errors and saves a new version. Update progress.md. Returns a local path, never image blocks. PPTX edits do not sync back into HTML.',schema:{manifestPath}},
  inspect:{description:'Get measured objects, text and geometry for one named slide, as JSON. Use instead of screenshots for mechanical layout changes.',schema:{manifestPath,slideId:z.string()}},
  edit:{description:'Replace one exact source substring in one slide and save a backup. Reject ambiguous/stale matches. Then check/export. Strings may contain HTML; use current source.',schema:{manifestPath,slideId:z.string(),oldText:z.string(),newText:z.string()}},
  preview:{description:'Render selected or all slides to LOCAL PNGs and contact sheets. Returns file paths only, no model image blocks. For aesthetic review or user preview; do not repeatedly view unchanged pages.',schema:{manifestPath,slideIds:z.array(z.string()).optional()}},
};
let queue=Promise.resolve();
for(const [name,def] of Object.entries(defs)) server.registerTool('deck_'+name,{
  description:def.description,inputSchema:def.schema,
  annotations:{readOnlyHint:['doctor','inspect'].includes(name),destructiveHint:false,openWorldHint:false},
},async args=>{
  const task=queue.then(()=>dispatch(name,args));queue=task.catch(()=>{});
  try {
    const result=await task;
    const compact=result.issues?.length>60?{...result,issues:result.issues.slice(0,60),moreIssues:result.issues.length-60,fullReport:'See .ppt-workbench/check.json after deck_check.'}:result;
    return {content:[{type:'text',text:JSON.stringify(compact)}],isError:result.ok===false};
  } catch(e) {return {content:[{type:'text',text:JSON.stringify({ok:false,error:e.message})}],isError:true};}
});
await server.connect(new StdioServerTransport());
process.stdin.on('end',async()=>{await queue;await bench.close();await server.close();});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await bench.close();process.exit(0);});
