import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import TOML from '@iarna/toml';

function copyTree(from,to) {
  // Avoid Node 24 cpSync's native Windows path handling on Unicode paths.
  fs.mkdirSync(to,{recursive:true});
  for(const entry of fs.readdirSync(from,{withFileTypes:true})) {
    const source=path.join(from,entry.name),target=path.join(to,entry.name);
    if(entry.isSymbolicLink()) throw new Error('技能目录不支持符号链接。');
    if(entry.isDirectory()) copyTree(source,target);else if(entry.isFile()) fs.copyFileSync(source,target);
  }
}

export function configure({runtimeRoot,node=process.execPath,browsers,userHome=os.homedir(),codexHome=process.env.CODEX_HOME||path.join(userHome,'.codex')}) {
  for(const p of [runtimeRoot,node,browsers,userHome,codexHome]) if(!path.isAbsolute(p)) throw new Error('配置路径必须为绝对路径。');
  const configFile=path.join(codexHome,'config.toml');
  const previous=fs.existsSync(configFile)?fs.readFileSync(configFile,'utf8').replace(/^\uFEFF/,''):'';
  const begin='# BEGIN PPT-WORKBENCH',end='# END PPT-WORKBENCH';
  const re=/# BEGIN PPT-WORKBENCH\r?\n[\s\S]*?# END PPT-WORKBENCH\r?\n?/g;
  const clean=previous.replace(re,'');
  const parsed=TOML.parse(clean);
  if(parsed.mcp_servers?.ppt_workbench) throw new Error('已有非本安装器管理的 mcp_servers.ppt_workbench 配置，请先核对。');
  const stanza=[begin,'[mcp_servers.ppt_workbench]',`command = ${JSON.stringify(node)}`,`args = [${JSON.stringify(path.join(runtimeRoot,'src','mcp.mjs'))}]`,'startup_timeout_sec = 30','tool_timeout_sec = 180','enabled = true','[mcp_servers.ppt_workbench.env]',`PLAYWRIGHT_BROWSERS_PATH = ${JSON.stringify(browsers)}`,end,''].join('\n');
  const updated=clean.trimEnd()+'\n\n'+stanza;TOML.parse(updated);
  const override=path.join(codexHome,'AGENTS.override.md');
  const instructions=fs.existsSync(override)&&fs.readFileSync(override,'utf8').trim()?override:path.join(codexHome,'AGENTS.md');
  const before=fs.existsSync(instructions)?fs.readFileSync(instructions,'utf8'):'';
  const marker=/<!-- BEGIN PPT-WORKBENCH -->[\s\S]*?<!-- END PPT-WORKBENCH -->\r?\n?/g;
  const rules=`<!-- BEGIN PPT-WORKBENCH -->
当用户要求新建 PPT、精确排版或继续修改 HTML deck 时，优先使用用户级 ppt-workbench 技能及 ppt_workbench 的 deck_* 工具（若可用）；用户或项目明确指定其他工具时按其要求。已有用户修改过的 PPTX 以最新文件为准，不能重导出旧 HTML 覆盖修改。该工具使用 Chromium 全页测量、文字诊断和原生导出，预览只返回本地路径。不要把未做的视觉验收声称为通过，也不要把工具内的零图片输出当成整个会话没有历史图片。若工具不可用，读取该技能的 CLI 备用入口；不能跳过检查伪装成功。
<!-- END PPT-WORKBENCH -->\n`;
  const skillDest=path.join(userHome,'.agents','skills','ppt-workbench');
  if(fs.existsSync(skillDest)&&!fs.existsSync(path.join(skillDest,'.ppt-workbench-managed'))) throw new Error('同名技能目录已存在且非本安装器管理；为避免覆盖，请先核对。');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex');
  const backupDir=path.join(codexHome,'ppt-workbench-backups',stamp);
  fs.mkdirSync(backupDir,{recursive:true});
  for(const [file,label] of [[configFile,'config.toml'],[instructions,path.basename(instructions)]]) if(fs.existsSync(file)) fs.copyFileSync(file,path.join(backupDir,label));
  if(fs.existsSync(skillDest)) copyTree(skillDest,path.join(backupDir,'skill'));
  const planned=[[configFile,updated],[instructions,before.replace(marker,'').trimEnd()+'\n\n'+rules]];
  for(const [file,body] of planned) {fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.ppt-workbench.tmp';fs.writeFileSync(tmp,body,'utf8');fs.renameSync(tmp,file);}
  fs.mkdirSync(path.dirname(skillDest),{recursive:true});
  copyTree(path.join(runtimeRoot,'skills','ppt-workbench'),skillDest);
  fs.writeFileSync(path.join(skillDest,'.ppt-workbench-managed'),'0.2.0\n');
  fs.writeFileSync(path.join(skillDest,'runtime.json'),JSON.stringify({root:runtimeRoot,node,env:{PLAYWRIGHT_BROWSERS_PATH:browsers}},null,2));
  return {ok:true,configFile,instructions,skillDest,backupDir};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)) {
  try {
    const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
    console.log(JSON.stringify(configure(input),null,2));
  } catch(e) {console.error(e.message);process.exitCode=1;}
}
