import { Workbench, initProject, replaceText, doctor } from './workbench.mjs';
import {snapshotProject,listSnapshots,restoreProject,projectContext,mediaRecord,resumeProject} from './project-state.mjs';
import {identifyElements,listElements,editElement} from './elements.mjs';
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
    case 'snapshot': return snapshotProject(args.manifestPath,args.label);
    case 'snapshots': return listSnapshots(args.manifestPath);
    case 'restore': return restoreProject(args.manifestPath,args.snapshotId,args);
    case 'context': return projectContext(args.manifestPath,args.patch);
    case 'media': return mediaRecord(args.manifestPath,args);
    case 'resume': return resumeProject(args.manifestPath);
    case 'identify': return identifyElements(args.manifestPath,args.slideId);
    case 'elements': return listElements(args.manifestPath,args.slideId);
    case 'edit_element': return editElement(args.manifestPath,args.slideId,args.elementId,args.oldText,args.newText,args.expectedElementHash);
    default: throw new Error('Unknown command: '+name);
  }
}
