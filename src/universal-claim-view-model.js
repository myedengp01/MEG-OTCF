/* MEG Universal Claim Management v2026.09.17-14:30
 * OTCF staging adapter. NOT wired into index.html yet. Read-only.
 * The server filters visible records; missing or failed statuses are UNKNOWN, not unpaid.
 */
(function(root){
  'use strict';
  const CODE='otcf';
  function createClaimViewModel(sb){
    if(!sb || typeof sb.rpc!=='function') throw new TypeError('Supabase client required');
    function normalize(row,id){
      if(!row || row.form_code!==CODE || String(row.submission_id)!==id) return null;
      return Object.freeze({id,displayStatus:String(row.display_status||''),
        workflowStatus:String(row.workflow_status||''),paymentStatus:String(row.payment_status||''),
        claimPaid:row.claim_paid===true,canMarkPaid:row.can_mark_paid===true});
    }
    async function status(submissionId){
      const id=String(submissionId||'').trim();
      if(!id) throw new TypeError('Submission ID required');
      const {data,error}=await sb.rpc('meg_forms_claim_status',{
        p_form_code:CODE,p_submission_id:id});
      if(error) throw error;
      const rows=Array.isArray(data)?data:(data?[data]:[]);
      return normalize(rows.find(r=>r && r.form_code===CODE && String(r.submission_id)===id),id);
    }
    async function reconcile(rows){
      if(!Array.isArray(rows)) throw new TypeError('Rows must be an array');
      if(rows.length===0) return [];
      const ids=[...new Set(rows.map(r=>String(r?.id||'').trim()).filter(Boolean))];
      const found=new Map();
      const failed=new Set();
      for(let i=0;i<ids.length;i+=100){
        const chunk=ids.slice(i,i+100);
        try{
          const {data,error}=await sb.rpc('meg_forms_claim_status_batch',{
            p_form_code:CODE,p_submission_ids:chunk});
          if(error) throw error;
          for(const entry of Array.isArray(data)?data:[]){
            const id=String(entry?.submission_id||'');
            if(chunk.includes(id)){
              const state=normalize(entry,id);
              if(state) found.set(id,state);
            }
          }
        }catch(error){
          // Fail closed for this entire chunk; never substitute a stale local paid flag.
          chunk.forEach(id=>failed.add(id));
        }
      }
      return rows.map(row=>{
        const id=String(row?.id||'').trim();
        const state=id && !failed.has(id)?found.get(id)||null:null;
        return Object.freeze({...row,universalStatus:state,universalStatusAvailable:state!==null});
      });
    }
    return Object.freeze({status,reconcile});
  }
  root.MEGCreateOTCFClaimViewModel=createClaimViewModel;
})(typeof window!=='undefined'?window:globalThis);
