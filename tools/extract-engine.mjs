/** Reproducible, fail-closed extraction from the user's installed SuperADC.
 * Only declarations reachable from the named pure deck functions are copied.
 * No SuperADC server startup code, accounts, config or sessions are copied.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node tools/extract-engine.mjs <SuperADC bundle/index.js>');
const source = fs.readFileSync(sourcePath, 'utf8');
const ast = parse(source, { sourceType:'module' });
let scope;
traverse(ast, { Program(p) { scope = p.scope; p.stop(); } });
const roots = { Um:'readDeck', p_e:'wrapSlide', u_e:'resolveFont', aLt:'writePptx', y_e:'uniqueExportPath' };
const overrides = {
  QE: 'import QE from "jszip";',
  kx: 'function kx() { return process.env.PPT_WORKBENCH_HOME || z.join(fr.homedir(), ".ppt-workbench"); }',
};
const selected = new Map();
function include(name) {
  if (selected.has(name)) return;
  if (overrides[name]) { selected.set(name,{name,override:overrides[name],start:-1}); return; }
  const binding = scope.getBinding(name);
  if (!binding) throw new Error('Missing top-level declaration: ' + name);
  const p = binding.path;
  if (!['FunctionDeclaration','VariableDeclarator','ClassDeclaration','ImportSpecifier','ImportDefaultSpecifier','ImportNamespaceSpecifier'].includes(p.node.type)) throw new Error('Unexpected declaration '+name+': '+p.node.type);
  selected.set(name,{name,path:p,start:p.node.start});
  p.traverse({ ReferencedIdentifier(q) {
    const b = q.scope.getBinding(q.node.name);
    if (b && b.scope === scope) include(q.node.name);
  }});
}
Object.keys(roots).forEach(include);
const entries = [...selected.values()].sort((a,b)=>a.start-b.start);
const imports = new Map();
const body = [];
for (const e of entries) {
  if (e.override) { body.push(e.override); continue; }
  const p = e.path;
  if (p.isImportSpecifier() || p.isImportDefaultSpecifier() || p.isImportNamespaceSpecifier()) {
    const parent=p.parentPath.node;
    if (!/^(node:)?(fs|path|os|crypto|url|buffer|module)$/.test(parent.source.value)) throw new Error('Unexpected external import: '+parent.source.value);
    imports.set(parent.start, source.slice(parent.start,parent.end));
  } else if(p.isVariableDeclarator()) {
    body.push(`${p.parentPath.node.kind} ${source.slice(p.node.start,p.node.end)};`);
  } else body.push(source.slice(p.node.start,p.node.end));
}
const root = path.resolve(import.meta.dirname,'..');
fs.mkdirSync(path.join(root,'src/vendor'),{recursive:true});
let code = '// Derived from the user-installed SuperADC 0.580.0. See PROVENANCE.json.\n'+[...imports.values(),...body,`export { ${Object.entries(roots).map(([a,b])=>a+' as '+b).join(', ')} };`].join('\n\n')+'\n';
// PowerPoint gives bodyPr insets priority over table tcPr margins. The upstream
// zero-inset bodyPr suppresses padding; let the measured cell margins apply.
const tableBody='${NM({ ...c.text, insets: { l: 0, t: 0, r: 0, b: 0 } }, t.mode, "a:txBody")}';
if(code.split(tableBody).length!==2) throw new Error('Table patch target changed');
code=code.replace(tableBody,'${NM({ ...c.text, insets: { l: 0, t: 0, r: 0, b: 0 } }, t.mode, "a:txBody").replace(/ (?:lIns|rIns|tIns|bIns|anchor)="[^"]*"/g, "")}');
code=code.replace('"*": ["style"]','"*": ["style", "data-ppt-id"]').replace('"viewBox",','"data-ppt-id",\n    "viewBox",');
const metadataTarget='var Se = o[W.tagName] || o["*"], be = 0';
if(code.split(metadataTarget).length!==2)throw new Error('Metadata patch target changed');
code=code.replace(metadataTarget,'var Se = (o[W.tagName] || o["*"]).concat(["data-ppt-id"]), be = 0');
fs.writeFileSync(path.join(root,'src/vendor/deck-engine.mjs'),code);
const provenance = {
  sourceProduct:'SuperADC', sourceVersion:'0.580.0', sourceBundleSHA256:crypto.createHash('sha256').update(source).digest('hex'),
  extractedSHA256:crypto.createHash('sha256').update(code).digest('hex'),
  roots, modifications:['Use pinned jszip instead of bundled copy','Resolve optional font directory under PPT_WORKBENCH_HOME or ~/.ppt-workbench','Replace host measurement outside this vendor file with independent Playwright adapter','Remove table bodyPr insets/anchor so measured tcPr padding and vertical alignment are honored'],
  stableElementMetadata:'Allow data-ppt-id metadata on HTML/SVG; uniqueness and edits validated by adapter',
  declarations:entries.map(e=>({name:e.name,sourceLine:e.path?.node.loc.start.line ?? null,override:!!e.override})),
};
fs.writeFileSync(path.join(root,'PROVENANCE.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({declarations:entries.length,bytes:Buffer.byteLength(code),sha256:provenance.extractedSHA256}));
