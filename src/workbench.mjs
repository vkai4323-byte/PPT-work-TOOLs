import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import http from 'node:http';
import { chromium } from 'playwright';
import { readDeck, wrapSlide, resolveFont, writePptx, uniqueExportPath } from './vendor/deck-engine.mjs';

export const VERSION = '0.1.0';
const MANIFEST = 'super-adc-deck.json';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const ENGINE_KEY = sha(Buffer.concat([fs.readFileSync(import.meta.filename),fs.readFileSync(new URL('./vendor/deck-engine.mjs',import.meta.url))]));
const json = x => JSON.stringify(x,null,2)+'\n';
const escape = x => String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function inside(root,file) { const rel=path.relative(root,file); return !rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel); }
function assertAbsolute(p) { if(typeof p!=='string'||!path.isAbsolute(p)) throw new Error('请提供绝对路径。'); }
function atomic(file, content) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(tmp,content,{flag:'wx'});
  try { fs.renameSync(tmp,file); } finally { if(fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
function safeFile(root,file) {
  if(!inside(root,path.resolve(file))) throw new Error('路径超出 deck 目录。');
  const actual=fs.realpathSync(file);
  if(!inside(root,actual)||!fs.statSync(actual).isFile()) throw new Error('文件链接超出 deck 目录或不是普通文件。');
  return actual;
}
function validateSource(source) {
  // CSP blocks user scripts in the headless renderer. Reject the common invalid
  // cases before any browser navigation, including local-file exfiltration paths.
  if(/<(script|iframe|object|embed|link|style)\b/i.test(source)||/\son\w+\s*=/i.test(source)) throw new Error('页面包含不支持的脚本、事件、样式块或嵌入标签。');
}
function assetsDigest(root) {
  const out=[];
  const visit=dir=>{
    if(!fs.existsSync(dir)) return;
    for(const ent of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const p=path.join(dir,ent.name);
      if(ent.isSymbolicLink()) throw new Error('assets 不支持符号链接。');
      if(ent.isDirectory()) visit(p); else if(ent.isFile()) out.push([path.relative(root,p),sha(fs.readFileSync(p))]);
    }
  };
  visit(path.join(root,'assets'));
  return sha(json(out));
}
function load(manifestPath) {
  assertAbsolute(manifestPath);
  const root=fs.realpathSync(path.dirname(manifestPath));
  const file=safeFile(root,manifestPath);
  if(path.basename(file)!==MANIFEST) throw new Error('清单必须命名为 '+MANIFEST);
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));
  if(raw.v!==0||!Array.isArray(raw.order)||!raw.order.length||raw.order.length>200) throw new Error('清单 v 必须为 0，order 必须包含 1–200 页。');
  if(raw.order.some(id=>!ID.test(id))||new Set(raw.order).size!==raw.order.length) throw new Error('页 ID 无效或重复。');
  for(const id of raw.order) safeFile(root,path.join(root,'slides',id+'.html'));
  const deck=readDeck(file,{readSources:true});
  // SuperADC includes unlisted slides in its snapshot. The portable adapter only
  // exports manifest order, preventing stray or removed files from resurfacing.
  deck.slides=deck.slides.filter(s=>s.inOrder);
  for(const slide of deck.slides) {
    if(Buffer.byteLength(slide.source)>512*1024) throw new Error('单页 HTML 超过 512 KiB。');
    validateSource(slide.source);
  }
  const fingerprint=sha(json({manifest:raw,slides:deck.slides.map(s=>[s.id,sha(s.source)]),assets:assetsDigest(root)}));
  return {...deck,root,file,fingerprint};
}
function lock(root) {
  const file=path.join(root,'.ppt-workbench','write.lock');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  try { fs.writeFileSync(file,json({pid:process.pid,createdAt:new Date().toISOString()}),{flag:'wx'}); }
  catch(e) { if(e.code==='EEXIST') throw new Error('此 deck 正在被另一个操作修改；若进程已经退出，请检查 .ppt-workbench/write.lock。'); throw e; }
  return ()=>fs.unlinkSync(file);
}
function fontData(deck) {
  const font=resolveFont(deck.manifest);
  // Distinct local() aliases for 400/700 can resolve to the same face in Chromium.
  // On Windows bind the real YaHei regular/bold files, as PowerPoint does.
  if(process.platform==='win32'&&font.family==='Microsoft YaHei') {
    const dir=path.join(process.env.WINDIR||'C:\\Windows','Fonts');
    const regular=path.join(dir,'msyh.ttc'),bold=path.join(dir,'msyhbd.ttc');
    if(fs.existsSync(regular)&&fs.existsSync(bold)) font.faces=[{weight:400,source:{kind:'file',path:regular}},{weight:700,source:{kind:'file',path:bold}}];
  }
  return font;
}
function fontKey(font) {
  return sha(json({...font,files:font.faces.filter(f=>f.source.kind==='file').map(f=>sha(fs.readFileSync(f.source.path)))}));
}
async function serve(deck,font) {
  const token=crypto.randomBytes(16).toString('hex');
  const fonts=font.faces.filter(f=>f.source.kind==='file');
  let origin;
  const server=http.createServer((req,res)=>{
    try {
      if(req.method!=='GET') {res.writeHead(405).end();return;}
      const url=new URL(req.url,origin);
      const prefix='/'+token+'/';
      if(!url.pathname.startsWith(prefix)) {res.writeHead(404).end();return;}
      const rel=decodeURIComponent(url.pathname.slice(prefix.length));
      if(rel.includes('..')||rel.includes('\\')) throw new Error('Invalid path');
      const match=/^slide\/([A-Za-z0-9_-]+)$/.exec(rel);
      if(match) {
        const slide=deck.slides.find(s=>s.id===match[1]);
        if(!slide) {res.writeHead(404).end();return;}
        res.setHeader('Content-Type','text/html;charset=utf-8');
        res.end(wrapSlide({mode:'measure',title:slide.id,slideSource:slide.source,font,
          fontUrl:f=>origin+prefix+'font/'+fonts.indexOf(f),baseHref:origin+prefix}));
      } else {
        let file;
        if(/^font\/\d+$/.test(rel)) file=fonts[Number(rel.split('/')[1])]?.source.path;
        else if(rel.startsWith('assets/')) file=safeFile(deck.root,path.join(deck.root,rel));
        if(!file) {res.writeHead(404).end();return;}
        const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.otf':'font/otf','.ttf':'font/ttf','.ttc':'font/collection','.woff':'font/woff','.woff2':'font/woff2'}[path.extname(file).toLowerCase()];
        if(!mime) {res.writeHead(415).end();return;}
        res.setHeader('Content-Type',mime);res.setHeader('Cache-Control','no-store');
        fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
      }
    } catch {res.writeHead(400).end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  origin='http://127.0.0.1:'+server.address().port;
  return {origin,url:id=>origin+'/'+token+'/slide/'+id,close:()=>new Promise(r=>server.close(r))};
}
export class Workbench {
  constructor() {this.browser=null;this.queue=Promise.resolve();}
  async getBrowser() {
    if(!this.browser) this.browser=await chromium.launch({headless:true});
    return this.browser;
  }
  async close() {if(this.browser) await this.browser.close();this.browser=null;}
  async measure(manifestPath,{previewDir=null,selectedIds=null}={}) {
    const deck=load(manifestPath),font=fontData(deck),browser=await this.getBrowser();
    const host=await serve(deck,font),issues=[...deck.diagnostics],measured=[],previews=[];
    const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
    await context.route('**/*',route=>{
      const url=route.request().url();
      return url.startsWith(host.origin+'/')||url.startsWith('data:') ? route.continue() : route.abort();
    });
    let cached=0;
    try {
      const browserVersion=browser.version();
      const assetHash=assetsDigest(deck.root),fk=fontKey(font);
      for(const slide of deck.slides) {
        if(selectedIds&&!selectedIds.includes(slide.id)) continue;
        const key=sha(json([VERSION,ENGINE_KEY,browserVersion,font,fk,assetHash,slide.id,slide.source]));
        const cacheFile=path.join(deck.root,'.ppt-workbench','cache',slide.id+'.json');
        let result;
        if(!previewDir) try {const c=JSON.parse(fs.readFileSync(cacheFile,'utf8'));if(c.key===key){result=c.result;cached++;}} catch {}
        if(!result) {
          const page=await context.newPage();
          try {
            await page.goto(host.url(slide.id),{waitUntil:'load',timeout:30000});
            result=await page.evaluate(async()=>{
              await document.fonts.ready;
              await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));
              const api=window.__deck;
              if(!api) throw new Error('测量引擎未加载。');
              api.validate();
              const scene=api.extract();
              const fixAnchors=items=>{for(const item of items||[]) {
                if(item.type==='shape'&&item.text&&item.path) {
                  const el=document.querySelector(item.path);
                  if(el?.tagName==='X-SHAPE') {
                    const css=getComputedStyle(el);
                    const vertical=css.display.includes('flex')?(css.flexDirection.startsWith('column')?css.justifyContent:css.alignItems):'start';
                    item.text.anchor={center:'ctr',end:'b','flex-end':'b'}[vertical]||'t';
                  }
                }
                if(item.items) fixAnchors(item.items);
              }};
              fixAnchors(scene?.items);
              const diagnostics=[...api.diagnostics];
              for(const img of document.images) if(!img.naturalWidth) diagnostics.push({level:'error',path:api.pathOf(img),message:'图片加载失败：'+img.getAttribute('src')});
              return {scene,diagnostics,loadedFonts:api.loadedFonts()};
            });
            if(result.scene?.id!==slide.id) result.diagnostics.push({level:'error',path:'section',message:'section id 必须与页面文件名一致。'});
            if(!result.loadedFonts.some(f=>f.startsWith(font.family+' '))) result.diagnostics.push({level:'error',path:'section',message:'目标字体未成功加载：'+font.family+'。请安装该字体或明确修改清单 fonts。'});
            // Canvas overflow is an error in this adapter, rather than merely a warning.
            result.diagnostics=result.diagnostics.map(i=>i.message.includes('超出画布')?{...i,level:'error'}:i);
            atomic(cacheFile,json({key,result}));
            if(previewDir) {
              fs.mkdirSync(previewDir,{recursive:true});
              await page.evaluate(()=>window.__deck.applyPreview());
              const out=path.join(previewDir,slide.id+'.png');
              await page.screenshot({path:out});previews.push({id:slide.id,path:out});
            }
          } finally {await page.close();}
        }
        measured.push({id:slide.id,...result});
        issues.push(...result.diagnostics.map(i=>({...i,slide:slide.id,page:deck.manifest.order.indexOf(slide.id)+1})));
      }
      if(font.warning) issues.push({level:'warning',message:font.warning});
      if(load(manifestPath).fingerprint!==deck.fingerprint) throw new Error('文件在测量期间发生变化，请重新检查。');
      const errors=issues.filter(i=>i.level==='error').length;
      return {deck,font,measured,report:{ok:errors===0,slides:measured.length,errors,warnings:issues.length-errors,issues,font:font.family,browserVersion,sourceHash:deck.fingerprint,cachedSlides:cached,measuredSlides:measured.length-cached,modelImageInputs:0,previews}};
    } finally {await context.close();await host.close();}
  }
  async check(manifestPath) {
    const {deck,report}=await this.measure(manifestPath);
    atomic(path.join(deck.root,'.ppt-workbench','check.json'),json(report));return report;
  }
  async export(manifestPath) {
    const root=fs.realpathSync(path.dirname(manifestPath)),unlock=lock(root);
    try {
      const {deck,font,measured,report}=await this.measure(manifestPath);
      if(!report.ok) return {...report,exported:false};
      const output=await writePptx(measured.map(m=>m.scene),{title:deck.manifest.title,font:font.family,deckDir:deck.root});
      if(load(manifestPath).fingerprint!==deck.fingerprint) throw new Error('文件在导出期间变化，导出已中止。');
      fs.mkdirSync(path.join(root,'exports'),{recursive:true});
      const file=uniqueExportPath(root,deck.manifest.title);
      fs.writeFileSync(file,output.buffer,{flag:'wx'});
      const result={...report,exported:true,path:file,bytes:output.buffer.length,exportWarnings:output.warnings};
      atomic(path.join(root,'.ppt-workbench','latest-export.json'),json(result));
      atomic(path.join(root,'progress.md'),`# ${deck.manifest.title}\n\n最新导出：${file}\n源文件摘要：${deck.fingerprint}\n页数：${deck.manifest.order.length}\n程序检查：${report.errors} 错误，${report.warnings} 警告\n\n编辑源：${deck.file}\n当前版本已完成全页程序检查；审美与 PowerPoint 实际渲染须按交付要求验收。\n导出的 PPTX 外部修改不会自动同步回 HTML。用户外部改稿时，以其最新 PPTX 为编辑源。\n`);
      return result;
    } finally {unlock();}
  }
  async inspect(manifestPath,slideId) {
    const {deck,measured,report}=await this.measure(manifestPath,{selectedIds:slideId?[slideId]:null});
    if(slideId&&!deck.manifest.order.includes(slideId)) throw new Error('页面不存在。');
    const flatten=(items,out=[])=>{for(const i of items){out.push({type:i.type,path:i.path,box:i.box,text:i.text?.paragraphs?.map(p=>p.lines.map(l=>l.runs.map(r=>r.text).join('')).join('')).join('\n')});if(i.items) flatten(i.items,out);}return out;};
    return {...report,pages:measured.map(m=>({id:m.id,elements:flatten(m.scene?.items||[])}))};
  }
  async preview(manifestPath,slideIds) {
    const deck=load(manifestPath);
    if(slideIds?.some(id=>!deck.manifest.order.includes(id))) throw new Error('预览页不存在。');
    const dest=path.join(deck.root,'.ppt-workbench','previews',Date.now()+'-'+crypto.randomBytes(3).toString('hex'));
    const {report}=await this.measure(manifestPath,{previewDir:dest,selectedIds:slideIds});
    const browser=await this.getBrowser(),sheets=[];
    for(let i=0;i<report.previews.length;i+=9) {
      const group=report.previews.slice(i,i+9),page=await browser.newPage({viewport:{width:1440,height:Math.ceil(group.length/3)*294},deviceScaleFactor:1});
      try {
        await page.setContent(`<html><body style="margin:0;background:#e8ecf1;font:16px Arial;display:grid;grid-template-columns:repeat(3,480px)">${group.map(p=>`<div><div style="height:24px;padding-left:8px">${deck.manifest.order.indexOf(p.id)+1}. ${escape(p.id)}</div><img style="display:block;width:480px;height:270px" src="data:image/png;base64,${fs.readFileSync(p.path).toString('base64')}"></div>`).join('')}</body></html>`);
        await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
        const out=path.join(dest,`contact-${i/9+1}.png`);await page.screenshot({path:out});sheets.push(out);
      } finally {await page.close();}
    }
    return {...report,contactSheets:sheets,note:'图片仅保存到本地；工具返回文本路径，没有把图片提交给模型。需要视觉判断时再按需查看。'};
  }
}

export function initProject(directory,title,ids=['cover']) {
  assertAbsolute(directory);
  if(fs.existsSync(directory)) throw new Error('新建目录必须尚不存在，避免覆盖已有工作。');
  if(!ids.length||ids.some(id=>!ID.test(id))||new Set(ids).size!==ids.length) throw new Error('页 ID 无效。');
  fs.mkdirSync(directory,{recursive:true});
  for(const sub of ['slides','assets','notes','exports']) fs.mkdirSync(path.join(directory,sub));
  const file=path.join(directory,MANIFEST);
  fs.writeFileSync(file,json({v:0,title,order:ids}));
  for(const [i,id] of ids.entries()) fs.writeFileSync(path.join(directory,'slides',id+'.html'),`<section id="${id}" style="background:#101820;display:flex;flex-direction:column;justify-content:center;padding:128px;gap:40px;color:#FFFFFF"><h1 style="font-size:80px">${escape(i===0?title:'第 '+(i+1)+' 页')}</h1></section>\n`);
  fs.writeFileSync(path.join(directory,'notes','decisions.md'),'# 制作记录\n\n在此记录用户确认的内容、风格、参考图结论及未完成事项。\n');
  return {ok:true,manifestPath:file,slides:ids.length};
}
export function replaceText(manifestPath,slideId,oldText,newText) {
  const deck=load(manifestPath);
  if(!deck.manifest.order.includes(slideId)) throw new Error('页面不存在。');
  if(typeof oldText!=='string'||!oldText||typeof newText!=='string') throw new Error('替换内容必须是字符串，原文不能为空。');
  const file=path.join(deck.root,'slides',slideId+'.html'),unlock=lock(deck.root);
  try {
    const current=fs.readFileSync(file,'utf8');
    if(current.split(oldText).length!==2) throw new Error('原文需精确匹配一次；请读取当前页面，避免改错对象。');
    const next=current.replace(oldText,newText);validateSource(next);
    const dir=path.join(deck.root,'.ppt-workbench','history');
    fs.mkdirSync(dir,{recursive:true});
    const backup=path.join(dir,`${Date.now()}-${crypto.randomUUID()}-${slideId}.html`);
    fs.writeFileSync(backup,current,{flag:'wx'});atomic(file,next);
    return {ok:true,slide:slideId,backup,needsCheck:true};
  } finally {unlock();}
}
export async function doctor() {
  const executable=chromium.executablePath();
  const info={ok:false,version:VERSION,node:process.version,platform:process.platform,chromium:executable,chromiumInstalled:fs.existsSync(executable),modelImageInputs:0};
  if(!info.chromiumInstalled) return {...info,error:'请运行 npm exec -- playwright install chromium'};
  const bench=new Workbench();
  try {
    const b=await bench.getBrowser(),p=await b.newPage();
    const font=resolveFont({});
    await p.setContent(`<style>@font-face{font-family:Probe;src:local(${JSON.stringify(font.family)})}</style><p style="font-family:Probe">中文字体检测</p>`);
    await p.evaluate(()=>document.fonts.ready);
    const loaded=await p.evaluate(()=>[...document.fonts].some(f=>f.family==='Probe'&&f.status==='loaded'));
    return {...info,ok:loaded,font:font.family,fontLoaded:loaded,browserVersion:b.version(),...(!loaded?{error:'默认中文字体不可用，请安装 Microsoft YaHei 或配置字体。'}:{})};
  } finally {await bench.close();}
}
