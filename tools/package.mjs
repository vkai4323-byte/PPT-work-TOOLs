import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
const root=path.resolve(import.meta.dirname,'..');
const output=path.resolve(process.argv[2]||path.join(root,'dist','PPT-Workbench-Codex-0.2.0.zip'));
const zip=new JSZip(),prefix='PPT-Workbench-Codex-0.2.0/';
const files=[];
function add(rel) {
  const p=path.join(root,rel),stat=fs.lstatSync(p);
  if(stat.isSymbolicLink()) throw new Error('Unexpected package symlink: '+rel);
  if(stat.isDirectory()) {for(const n of fs.readdirSync(p).sort()) add(path.join(rel,n));return;}
  const name=rel.replaceAll('\\','/'),data=fs.readFileSync(p);
  if(/(?:^|\/)(?:node_modules|\.codex|\.agents|\.git|runtime\.json|install-request\.json)(?:\/|$)/.test(name)) throw new Error('Unexpected package content: '+name);
  zip.file(prefix+name,data);files.push({path:name,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
}
for(const name of ['src','tools','skills','examples','docs','AGENTS.md','.gitignore','package.json','package-lock.json','PROVENANCE.json','README.md','验收说明.md','install.ps1','install.cmd','verify.ps1','uninstall.ps1']) add(name);
for(const name of fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.mjs'))) add(path.join('tests',name));
zip.file(prefix+'FILES.sha256.json',JSON.stringify(files,null,2)+'\n');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}}));
const reread=await JSZip.loadAsync(fs.readFileSync(output));
for(const f of files) {
  const bytes=await reread.file(prefix+f.path).async('nodebuffer');
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==f.sha256) throw new Error('Archive verification failed: '+f.path);
}
const sha256=crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
fs.writeFileSync(output+'.sha256',sha256+'  '+path.basename(output)+'\n');
console.log(JSON.stringify({output,files:files.length,bytes:fs.statSync(output).size,sha256,archiveVerified:true},null,2));
