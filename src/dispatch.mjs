import { Workbench, initProject, replaceText, doctor } from './workbench.mjs';
import {snapshotProject,listSnapshots,restoreProject,projectContext,mediaRecord,resumeProject} from './project-state.mjs';
import {identifyElements,listElements,editElement} from './elements.mjs';
import {inspectPptx,adoptPptx,resumePptx,preparePptx,reviewPptx,commitPptx,batchPptx} from './native-pptx.mjs';
import {placementPlan,inspectAsset} from './placement-plan.mjs';
export const bench=new Workbench();
export async function dispatch(name,args={}) {
  switch(name) {
    case 'pptx_inspect': return inspectPptx(args);
    case 'pptx_adopt': return adoptPptx(args);
    case 'pptx_resume': return resumePptx(args);
    case 'pptx_prepare': return preparePptx(args);
    case 'pptx_review': return reviewPptx(args);
    case 'pptx_commit': return commitPptx(args);
    case 'pptx_batch': return batchPptx(args);
    case 'ppt_placement_plan': return placementPlan(args);
    case 'ppt_asset': return inspectAsset(args);
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
