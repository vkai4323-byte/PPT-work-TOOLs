// These are caller-observed workflow facts, never automatic visual judgments.
export const slotStates=['needed','blocked','acquired','placed','shown','approved','rejected'];
export const outputKinds=['identity','work-evidence','concept-cover','scene-mockup','brand','decoration'];
export function validateSlots(slots,assets,placements,slideIds,sourceHash){
  if(slots===undefined)return undefined; // Legacy plans have no complete demand inventory.
  if(!Array.isArray(slots))throw new Error('slots 必须为数组。');
  const ids=new Set();
  for(const s of slots){
    if(!s.id||ids.has(s.id)||!slideIds.includes(s.slideId))throw new Error('图位 ID 重复、缺失或页面无效。');
    ids.add(s.id);
    if(!slotStates.includes(s.status)||!outputKinds.includes(s.outputKind)||!s.intent?.trim())throw new Error('图位需要有效 status、outputKind 和 intent。');
    const asset=assets.find(a=>a.id===s.assetId);
    if(s.assetId&&!asset)throw new Error('图位素材不存在。');
    if(['acquired','placed','shown','approved','rejected'].includes(s.status)&&!asset)throw new Error('已取材图位必须关联本地素材。');
    if(s.status==='blocked'&&!s.blocker?.trim())throw new Error('受阻图位需记录 blocker。');
    if(s.outputKind==='work-evidence'&&asset&&(asset.role!=='evidence'||asset.origin==='generated'))throw new Error('真实作品图位不可使用生成图或非证据素材。');
    if(['placed','shown','approved','rejected'].includes(s.status)){
      if(!placements.some(p=>p.slideId===s.slideId&&p.assetId===s.assetId))throw new Error('已布图状态需要对应 placement。');
      if(s.versionHash!==sourceHash)throw new Error('布图/展示/确认状态必须绑定当前版本。');
      if(!s.matchReview?.trim())throw new Error('已布图需记录素材与创意的匹配判断。');
    }
    if(['shown','approved','rejected'].includes(s.status)&&!s.deliveryEvidence?.trim())throw new Error('展示状态需要实际交付证据，queued 不等于已展示。');
    if(['approved','rejected'].includes(s.status)&&!s.userFeedback?.trim())throw new Error('确认或否决需要真实用户反馈。');
    for(const a of s.attempts||[]){
      if(!a.route?.trim()||!['success','failed','timeout','unavailable'].includes(a.outcome)||!a.detail?.trim())throw new Error('取材尝试需要 route、outcome、detail。');
      if(a.elapsedMs!==undefined&&(!Number.isFinite(a.elapsedMs)||a.elapsedMs<0))throw new Error('elapsedMs 无效。');
    }
  }
  return slots;
}
export function slotProgress(plan,sourceHash,assetChecks){
  if(!plan?.slots)return {inventoryRecorded:false,total:null,reason:'旧计划未登记全部图位，不能推算完成率。'};
  const counts=Object.fromEntries(slotStates.map(s=>[s,0]));let stale=0;
  for(const s of plan.slots){
    const asset=assetChecks.find(a=>a.id===s.assetId);
    if((s.assetId&&!asset?.current)||(s.versionHash&&s.versionHash!==sourceHash))stale++;
    else counts[s.status]++;
  }
  return {inventoryRecorded:true,total:plan.slots.length,counts,stale,approvalEvidence:'caller-reported; not independently verified'};
}
