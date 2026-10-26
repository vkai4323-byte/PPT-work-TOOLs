import { Workbench, initProject, replaceText, doctor } from './workbench.mjs';
export const bench=new Workbench();
export async function dispatch(name,args={}) {
  switch(name) {
    case 'doctor': return doctor();
    case 'init': return initProject(args.directory,args.title,args.slides);
    case 'check': return bench.check(args.manifestPath);
    case 'export': return bench.export(args.manifestPath);
    case 'inspect': return bench.inspect(args.manifestPath,args.slideId);
    case 'edit': return replaceText(args.manifestPath,args.slideId,args.oldText,args.newText);
    case 'preview': return bench.preview(args.manifestPath,args.slideIds);
    default: throw new Error('Unknown command: '+name);
  }
}
