import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
test('fresh MCP connection discovers tools and creates/checks/exports a project',async()=>{
  const client=new Client({name:'acceptance-test',version:'1.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[path.resolve('src/mcp.mjs')],stderr:'pipe'});
  await client.connect(transport);
  try {
    const tools=await client.listTools();assert.equal(tools.tools.length,16);
    const tmp=fs.mkdtempSync(path.resolve('tests','mcp-'));
    const init=await client.callTool({name:'deck_init',arguments:{directory:path.join(tmp,'fresh.deck'),title:'全新会话测试'}});
    const {manifestPath}=JSON.parse(init.content[0].text);
    const context=await client.callTool({name:'deck_context',arguments:{manifestPath,patch:{focus:['文字与美术交叉进行']}}});assert.ok(!context.isError);
    const identity=await client.callTool({name:'deck_identify',arguments:{manifestPath,slideId:'cover'}});assert.ok(!identity.isError);
    const state=JSON.parse((await client.callTool({name:'deck_resume',arguments:{manifestPath}})).content[0].text);assert.deepEqual(state.context.focus,['文字与美术交叉进行']);
    for(const name of ['deck_check','deck_export']) {
      const r=await client.callTool({name,arguments:{manifestPath}});assert.ok(!r.isError,JSON.stringify(r));assert.ok(r.content.every(b=>b.type==='text'));assert.equal(JSON.parse(r.content[0].text).modelImageInputs,0);
    }
  } finally {await client.close();}
});
