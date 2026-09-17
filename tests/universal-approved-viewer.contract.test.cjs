'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const page=fs.readFileSync('index.html','utf8');
assert.match(page,/<script src="\.\/src\/universal-claim-view-model\.js"><\/script>\s*<script src="\.\/src\/universal-approved-viewer\.js"><\/script>\s*<\/body>/);
const claims=[{id:'paid',payment_done:false},{id:'pending',payment_done:true},{id:'hidden',payment_done:true}];
const infos=claims.map(()=>({badges:[],querySelector(selector){return selector==='.meg-universal-claim-status'?this.badges.at(-1)||null:null;},appendChild(b){this.badges.push(b);b.remove=()=>{this.badges=this.badges.filter(x=>x!==b);};}}));
const rows=infos.map(info=>({isConnected:true,querySelector:s=>s==='.viewer-claim-info'?info:null}));
const list={isConnected:true,querySelectorAll:s=>s==='.viewer-claim-row'?rows:[]};
let calls=[];
const root={
  document:{getElementById:id=>id==='viewerClaimsList'?list:null,createElement:tag=>({tagName:tag,style:{},textContent:''})},
  sb:{rpc:async(fn,args)=>{calls.push({fn,args});return {error:null,data:[
    {form_code:'otcf',submission_id:'paid',workflow_status:'approved',display_status:'Claim Paid',payment_status:'done',claim_paid:true,can_mark_paid:false},
    {form_code:'otcf',submission_id:'pending',workflow_status:'approved',display_status:'Pending Payment',payment_status:'pending',claim_paid:false,can_mark_paid:false}
  ]};}},
  __OTCF_APPROVED_VIEWER_CACHE__:claims,
  renderViewerClaims:async()=>undefined
};
const context={window:root,console};
vm.runInNewContext(fs.readFileSync('src/universal-claim-view-model.js','utf8'),context);
vm.runInNewContext(fs.readFileSync('src/universal-approved-viewer.js','utf8'),context);
(async()=>{
 assert.equal(root.renderViewerClaims.__megUniversalStatus,true);
 await root.renderViewerClaims();
 assert.equal(infos[0].badges[0].textContent,'Claim Paid');
 assert.equal(infos[1].badges[0].textContent,'Pending Payment');
 assert.match(infos[2].badges[0].textContent,/Status unavailable/);
 assert.equal(claims[0].payment_done,false);
 assert.equal(claims[1].payment_done,true);
 assert.ok(calls.every(c=>c.fn==='meg_forms_claim_status_batch' && c.args.p_form_code==='otcf'));
 assert.equal(calls.length,1);
 await root.renderViewerClaims();
 assert.equal(infos.every(info=>info.badges.length===1),true);
 console.log('PASS OTCF viewer: wired, canonical paid/pending, fail-closed unknown, no writes, no duplicate badges');
})().catch(e=>{console.error(e);process.exitCode=1;});
