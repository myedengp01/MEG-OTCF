/* MEG Universal Claim Management v2026.09.17-14:30
 * OTCF staging adapter. NOT wired into index.html yet. Never writes payment data.
 * The dashboard feed RPC enforces caller visibility; a missing row is NOT unpaid.
 */
(function(root){
  'use strict';
  const CODE='otcf';
  function createClaimViewModel(sb){
    if(!sb || typeof sb.rpc!=='function') throw new TypeError('Supabase client required');
    async function status(submissionId){
      const id=String(submissionId||'').trim();
      if(!id) throw new TypeError('Submission ID required');
      const {data,error}=await sb.rpc('meg_forms_claim_status',{
        p_form_code:CODE,p_submission_id:id
      });
      if(error) throw error;
      const rows=Array.isArray(data)?data:(data?[data]:[]);
      const row=rows.find(r=>r && r.form_code===CODE && String(r.submission_id)===id);
      if(!row) return null;
      return Object.freeze({
        id,displayStatus:String(row.display_status||''),
        workflowStatus:String(row.workflow_status||''),
        paymentStatus:String(row.payment_status||''),
        claimPaid:row.claim_paid===true,
        canMarkPaid:row.can_mark_paid===true
      });
    }
    async function reconcile(rows){
      if(!Array.isArray(rows)) throw new TypeError('Rows must be an array');
      const results=await Promise.allSettled(rows.map(r=>status(r.id)));
      return rows.map((row,i)=>{
        const result=results[i];
        const state=result.status==='fulfilled'?result.value:null;
        // Unknown/unavailable status is explicit; do NOT reuse a stale local field.
        return Object.freeze({...row,universalStatus:state,
          universalStatusAvailable:result.status==='fulfilled' && state!==null});
      });
    }
    return Object.freeze({status,reconcile});
  }
  root.MEGCreateOTCFClaimViewModel=createClaimViewModel;
})(typeof window!=='undefined'?window:globalThis);
