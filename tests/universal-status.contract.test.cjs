'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const form = process.env.MEG_FORM_CODE || 'otcf';
const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'universal-claim-view-model.js'), 'utf8');
const context = {};
vm.runInNewContext(code, context, { filename: 'universal-claim-view-model.js' });
const factory = context[form === 'otcf' ? 'MEGCreateOTCFClaimViewModel' : 'MEGCreateSCFClaimViewModel'];
assert.equal(typeof factory, 'function');
let requests = [];
const sb = {rpc: async (fn, args) => {
  requests.push({ fn, args });
  if (args.p_submission_id === 'PAID') return {data:[{form_code:form,submission_id:'PAID',workflow_status:'approved',display_status:'Claim Paid',payment_status:'done',claim_paid:true,can_mark_paid:false}],error:null};
  if (args.p_submission_id === 'PENDING') return {data:[{form_code:form,submission_id:'PENDING',workflow_status:'approved',display_status:'Pending Payment',payment_status:'pending',claim_paid:false,can_mark_paid:true}],error:null};
  if (args.p_submission_id === 'HIDDEN') return {data:[],error:null};
  return {data:null,error:{message:'network error'}};
}};
(async()=>{
  const api = factory(sb);
  assert.equal((await api.status('PAID')).claimPaid,true);
  assert.equal((await api.status('PENDING')).claimPaid,false);
  assert.equal(await api.status('HIDDEN'),null);
  await assert.rejects(()=>api.status('ERROR'));
  await assert.rejects(()=>api.status('   '), {name:'TypeError'});
  const result = await api.reconcile([
    {id:'PAID',payment_confirmed:false},
    {id:'PENDING',payment_confirmed:true},
    {id:'HIDDEN',payment_confirmed:true},
    {id:'ERROR',payment_confirmed:true}
  ]);
  assert.equal(result[0].universalStatus.claimPaid,true);
  assert.equal(result[1].universalStatus.claimPaid,false);
  assert.equal(result[2].universalStatusAvailable,false);
  assert.equal(result[3].universalStatusAvailable,false);
  assert.equal(result[2].universalStatus,null);
  assert.equal(result[3].universalStatus,null);
  assert.ok(requests.every(r=>r.fn==='meg_forms_claim_status' && r.args.p_form_code===form));
  console.log(`PASS ${form}: 12 read-only status / stale-flag / failure assertions`);
})().catch(e=>{console.error(e);process.exitCode=1;});