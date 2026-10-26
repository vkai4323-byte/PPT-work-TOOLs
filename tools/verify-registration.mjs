import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import TOML from '@iarna/toml';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const request=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
const cfg=TOML.parse(fs.readFileSync(path.join(request.codexHome,'config.toml'),'utf8'));
const mcp=cfg.mcp_servers?.ppt_workbench;assert.ok(mcp?.enabled,'PPT Workbench MCP is not registered/enabled.');
assert.equal(mcp.command,request.node);assert.equal(mcp.args[0],path.join(request.runtimeRoot,'src','mcp.mjs'));
const skill=path.join(request.userHome,'.agents','skills','ppt-workbench');
assert.ok(fs.existsSync(path.join(skill,'SKILL.md')));assert.equal(JSON.parse(fs.readFileSync(path.join(skill,'runtime.json'))).root,request.runtimeRoot);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ppt-workbench-new-session-'));
const results=[];
for(let i=0;i<2;i++) {
  const client=new Client({name:'installed-acceptance',version:'1.0'});
  const transport=new StdioClientTransport({command:mcp.command,args:mcp.args,env:{...process.env,...mcp.env},cwd:temp,stderr:'pipe'});
  await client.connect(transport);
  try {
    assert.equal((await client.listTools()).tools.length,16);
    const init=await client.callTool({name:'deck_init',arguments:{directory:path.join(temp,'project-'+i),title:'全新项目 '+i}});
    assert.ok(!init.isError,JSON.stringify(init));const {manifestPath}=JSON.parse(init.content[0].text);
    const call=async(name,args={})=>{const response=await client.callTool({name:'deck_'+name,arguments:{manifestPath,...args}});assert.ok(!response.isError,JSON.stringify(response));assert.ok(response.content.every(b=>b.type==='text'));return JSON.parse(response.content[0].text);};
    await call('context',{patch:{focus:['局部改稿'],confirmed:['保留原有页序']}});
    const ids=await call('identify',{slideId:'cover'});const title=ids.elements.find(e=>e.tag==='h1');
    const snap=await call('snapshot',{label:'安装验收基线'});
    await call('edit_element',{slideId:'cover',elementId:title.elementId,oldText:'全新项目 '+i,newText:'定点修改 '+i,expectedElementHash:title.elementHash});
    assert.ok((await call('elements',{slideId:'cover'})).elements.some(e=>e.text==='定点修改 '+i));
    const plan=await call('restore',{snapshotId:snap.id});await call('restore',{snapshotId:snap.id,apply:true,expectedCurrentHash:plan.currentHash});
    assert.ok((await call('elements',{slideId:'cover'})).elements.some(e=>e.text==='全新项目 '+i));
    assert.deepEqual((await call('resume')).context.confirmed,['保留原有页序']);
    const out=await client.callTool({name:'deck_export',arguments:{manifestPath}});
    assert.ok(!out.isError,JSON.stringify(out));assert.ok(out.content.every(b=>b.type==='text'));
    const result=JSON.parse(out.content[0].text);assert.equal(result.exported,true);assert.ok(fs.existsSync(result.path));
    results.push({project:i,path:result.path,modelImageInputs:result.modelImageInputs});
  } finally {await client.close();}
}
const report={ok:true,freshMcpSessions:2,projects:results,stableElementEditAndRestore:true,flexibleContextResumed:true,skillRegistered:true,config:request.codexHome,codexUiRoutingTested:false};
fs.writeFileSync(path.join(request.runtimeRoot,'registration-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
