import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const file=path.resolve(import.meta.dirname,'..','runtime.json');
if(!fs.existsSync(file)) throw new Error('请先运行 PPT Workbench 安装脚本。');
const runtime=JSON.parse(fs.readFileSync(file,'utf8'));
const result=spawnSync(runtime.node,[path.join(runtime.root,'src','cli.mjs'),...process.argv.slice(2)],{stdio:'inherit',windowsHide:true,env:{...process.env,...runtime.env}});
if(result.error) throw result.error;
process.exitCode=result.status??1;
