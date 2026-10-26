import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import TOML from '@iarna/toml';

export function unconfigure({userHome,codexHome}) {
  for(const p of [userHome,codexHome]) if(!path.isAbsolute(p)) throw new Error('配置路径必须为绝对路径。');
  const backupDir=path.join(codexHome,'ppt-workbench-backups','disabled-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex'));
  const updates=[];
  for(const name of ['config.toml','AGENTS.md','AGENTS.override.md']) {
    const file=path.join(codexHome,name);if(!fs.existsSync(file)) continue;
    const before=fs.readFileSync(file,'utf8');
    const re=name==='config.toml'?/# BEGIN PPT-WORKBENCH\r?\n[\s\S]*?# END PPT-WORKBENCH\r?\n?/g:/<!-- BEGIN PPT-WORKBENCH -->[\s\S]*?<!-- END PPT-WORKBENCH -->\r?\n?/g;
    const after=before.replace(re,'');if(after===before) continue;
    if(name==='config.toml') TOML.parse(after.replace(/^\uFEFF/,''));
    updates.push({file,name,after});
  }
  const skill=path.join(userHome,'.agents','skills','ppt-workbench');
  const managed=fs.existsSync(path.join(skill,'.ppt-workbench-managed'));
  if(!updates.length&&!managed) return {ok:true,changed:false};
  fs.mkdirSync(backupDir,{recursive:true});
  for(const {file,name} of updates) fs.copyFileSync(file,path.join(backupDir,name));
  for(const {file,after} of updates) {const tmp=file+'.ppt-workbench.tmp';fs.writeFileSync(tmp,after);fs.renameSync(tmp,file);}
  if(managed) {
    // Exact installer-owned directory only; copy before unlinking registration.
    const actual=fs.realpathSync(skill),parent=fs.realpathSync(path.dirname(skill));
    if(path.dirname(actual)!==parent||path.basename(actual)!=='ppt-workbench') throw new Error('技能目录链接异常，请手动检查；未移动技能。');
    // Rename within its own parent (same volume); preserve as a non-skill backup.
    const parked=path.join(path.dirname(parent),'ppt-workbench-disabled-'+Date.now());
    fs.renameSync(skill,parked);
    fs.writeFileSync(path.join(backupDir,'skill-location.txt'),parked+'\n');
  }
  return {ok:true,changed:true,backupDir,runtimePreserved:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)) {
  try {console.log(JSON.stringify(unconfigure(JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''))),null,2));}
  catch(e) {console.error(e.message);process.exitCode=1;}
}
