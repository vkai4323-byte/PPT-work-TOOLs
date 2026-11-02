import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
const root=path.resolve(import.meta.dirname,'..');
const output=path.resolve(process.argv[2]||path.join(root,'dist','PPT-Workbench-Codex-0.4.0-dev.zip'));
const zip=new JSZip(),prefix='PPT-Workbench-Codex-0.4.0-dev/';
const files=[];
const preview=process.argv.includes('--preview');
if(!process.argv.includes('--candidate')&&!preview)throw new Error('Choose --candidate for local tests or --preview for customer acceptance. Stable release is not enabled.');
zip.file(prefix+'CANDIDATE-STATE.json',JSON.stringify({channel:preview?'public_preview':'local_candidate',releaseReady:false,customerVerified:false,monet:'fixed_test_baseline_received_live_proposal_not_verified',purpose:preview?'customer_installation_and_paid_scenario_acceptance':'local_installation_acceptance'},null,2));
function add(rel) {
  if(/(?:^|[\\/])__pycache__(?:[\\/]|$)|\.pyc$/.test(rel))return;
  if(/(?:^|[\\/])wheels(?:[\\/]|$)|(?:^|[\\/])(?:wheel-manifest\.json|requirements-win-py313\.lock)$/.test(rel))return;
  const p=path.join(root,rel),stat=fs.lstatSync(p);
  if(stat.isSymbolicLink()) throw new Error('Unexpected package symlink: '+rel);
  if(stat.isDirectory()) {for(const n of fs.readdirSync(p).sort()) add(path.join(rel,n));return;}
  const name=rel.replaceAll('\\','/'),data=fs.readFileSync(p);
  if(/(?:^|\/)(?:node_modules|\.codex|\.agents|\.git|provider-bindings|private-providers|runtime\.json|install-request\.json|workflow-tools\.json|browser-onboarding\.json)(?:\/|$)|\.dpapi$/.test(name)) throw new Error('Unexpected package content: '+name);
  zip.file(prefix+name,data);files.push({path:name,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
}
for(const name of ['src','tools','skills','modules','examples','docs','AGENTS.md','.gitignore','.gitattributes','package.json','package-lock.json','PROVENANCE.json','README.md','验收说明.md','install.ps1','install.cmd','verify.ps1','uninstall.ps1']) add(name);
for(const name of fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.mjs'))) add(path.join('tests',name));
zip.file(prefix+'FILES.sha256.json',JSON.stringify(files,null,2)+'\n');
fs.writeFileSync(path.join(root,'FILES.sha256.json'),JSON.stringify(files,null,2)+'\n');
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
