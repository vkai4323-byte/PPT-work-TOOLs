import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSlots,slotProgress} from '../src/placement-progress.mjs';
const asset={id:'a',role:'evidence',origin:'creator-work'};
const placement={slideId:'1',assetId:'a'};
const needed={id:'s',slideId:'1',outputKind:'work-evidence',intent:'真实路人互动作品',status:'needed'};
const validate=slots=>validateSlots(slots,[asset],[placement],['1'],'v1');
test('unfilled and blocked needs remain in denominator; legacy inventory is unknown',()=>{
 const slots=validate([needed,{...needed,id:'s2',status:'blocked',blocker:'截图接口超时',attempts:[{route:'browser screenshot',outcome:'timeout',detail:'capture timed out',elapsedMs:5000}]}]);
 const p=slotProgress({slots},'v1',[]);assert.equal(p.total,2);assert.equal(p.counts.needed,1);assert.equal(p.counts.blocked,1);
 assert.equal(slotProgress({assets:[]},'v1',[]).total,null);
 assert.throws(()=>validate([{...needed,status:'acquired'}]),/本地素材/);
 assert.throws(()=>validate([needed,needed]),/重复/);
});
test('version-specific approval requires placement, semantic review, delivery and feedback',()=>{
 const approved={...needed,status:'approved',assetId:'a',versionHash:'v1',matchReview:'人物动作与证据用途对应',deliveryEvidence:'已提供当前单页预览路径',userFeedback:'用户表示此页可用'};
 validate([approved]);
 for(const key of ['versionHash','matchReview','deliveryEvidence','userFeedback'])assert.throws(()=>validate([{...approved,[key]:undefined}]));
 assert.throws(()=>validateSlots([approved],[asset],[],['1'],'v1'),/placement/);
 assert.equal(slotProgress({slots:[approved]},'v1',[{id:'a',current:true}]).counts.approved,1);
 assert.equal(slotProgress({slots:[approved]},'v2',[{id:'a',current:true}]).stale,1);
 assert.equal(slotProgress({slots:[approved]},'v1',[{id:'a',current:false}]).counts.approved,0);
 assert.throws(()=>validateSlots([approved],[{...asset,origin:'generated'}],[placement],['1'],'v1'),/生成图/);
});
