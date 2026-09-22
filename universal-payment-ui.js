/* MEG-OTCF canonical payment view — v2026.09.22-20:00.
 * Payment is written ONLY by the permission-checked, approval-guarded Supabase RPC.
 * This module never changes claim workflow status or deletes a claim.
 */
(function(root){
 'use strict';
 const FORM='otcf', VERSION='v2026.09.22-20:00';
 const pending=new Set(); let generation=0, scheduled=false;
 function client(){return typeof sb!=='undefined'?sb:root.sb;}
 function stamp(iso){if(!iso)return '';const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleString('en-GB');}
 function rows(){return [...(root.document?.querySelectorAll('#viewerClaimsList .viewer-claim-row')||[])];}
 async function refresh(){
   const db=client(), cache=root.__OTCF_APPROVED_VIEWER_CACHE__, current=rows();
   if(!db||!Array.isArray(cache)||!current.length||cache.length!==current.length)return;
   const token=++generation;
   const refs=cache.map((sub,i)=>({id:String(sub?.id||''),node:current[i]}));
   for(const {node} of refs){node.querySelectorAll('.meg-canonical-payment').forEach(el=>el.remove());}
   const ids=refs.map(r=>r.id).filter(Boolean);
   if(!ids.length)return;
   try{
     const [statusResult,permissionResult,dateResult]=await Promise.all([
       db.rpc('meg_forms_claim_status_batch',{p_form_code:FORM,p_submission_ids:ids}),
       db.rpc('meg_forms_user_can_mark_paid',{p_form_code:FORM}),
       db.rpc('meg_forms_payment_dates_batch',{p_form_code:FORM,p_submission_ids:ids})
     ]);
     if(statusResult.error)throw statusResult.error;
     const authorized=!permissionResult.error&&permissionResult.data===true;
     const dates=dateResult.error?new Map():new Map((dateResult.data||[]).map(x=>[String(x.submission_id),x.payment_done_at]));
     const byId=new Map((statusResult.data||[]).map(s=>[String(s.submission_id),s]));
     if(token!==generation||rows().some((r,i)=>r!==refs[i]?.node)||rows().length!==refs.length)return;
     for(const {id,node} of refs){
       const state=byId.get(id), actions=node.querySelector('.viewer-claim-actions');
       if(!actions)continue;
       const badge=root.document.createElement('div');badge.className='meg-canonical-payment';
       badge.style.cssText='display:inline-flex;align-items:center;font-size:12px;margin:0 6px;color:#17446b;font-weight:600;';
       if(!state){badge.textContent='Payment status unavailable';actions.appendChild(badge);continue;}
       if(state.claim_paid){
         badge.textContent='✓ Claim Paid'+(stamp(dates.get(id))?' · '+stamp(dates.get(id)):' · Date unavailable');
         badge.style.color='#166534';
         // An approved claim that is already paid must not present a Delete control.
         node.querySelectorAll('[data-otcf-admin-delete]').forEach(el=>el.remove());
       }else{
         badge.textContent=String(state.display_status||'Pending Payment');
       }
       actions.appendChild(badge);
       if(!state.claim_paid&&authorized&&state.can_mark_paid&&!pending.has(id)){
         const button=root.document.createElement('button');button.type='button';
         button.className='meg-canonical-payment';button.textContent='✓ Claim Paid';
         button.style.cssText='padding:6px 12px;border-radius:6px;border:1px solid #166534;background:#166534;color:#fff;font-weight:700;cursor:pointer;margin-left:6px;';
         button.addEventListener('click',async ev=>{
           ev.preventDefault();ev.stopPropagation();
           if(pending.has(id))return;
           if(!root.confirm('Confirm actual payment for OTCF claim '+String(cache.find(s=>String(s.id)===id)?.serial_no||id)+'?'))return;
           pending.add(id);button.disabled=true;button.textContent='Processing…';
           try{
             // Re-read authorization and claim status before writing; server rechecks both.
             const [auth,latest]=await Promise.all([
               db.rpc('meg_forms_user_can_mark_paid',{p_form_code:FORM}),
               db.rpc('meg_forms_claim_status',{p_form_code:FORM,p_submission_id:id})
             ]);
             if(auth.error||auth.data!==true)throw new Error('Finance payment permission required.');
             if(latest.error)throw latest.error;
             const s=Array.isArray(latest.data)?latest.data[0]:latest.data;
             if(!s)throw new Error('Claim status unavailable.');
             if(!s.claim_paid){
               if(!s.can_mark_paid)throw new Error('Claim is not eligible for payment.');
               const result=await db.rpc('meg_forms_set_payment_done_strict',{p_form_code:FORM,p_submission_id:id,p_done:true});
               if(result.error)throw result.error;
             }
             const verified=await db.rpc('meg_forms_claim_status',{p_form_code:FORM,p_submission_id:id});
             if(verified.error)throw verified.error;
             const after=Array.isArray(verified.data)?verified.data[0]:verified.data;
             if(!after?.claim_paid)throw new Error('Payment not verified. Refresh before retrying.');
             await root.renderViewerClaims();
           }catch(error){root.alert('Claim Paid failed: '+(error?.message||String(error)));}
           finally{pending.delete(id);schedule();}
         });
         actions.appendChild(button);
       }
     }
   }catch(error){
     root.console?.warn?.('OTCF canonical payment status unavailable',error);
     for(const {node} of refs){const actions=node.querySelector('.viewer-claim-actions');if(actions){const note=root.document.createElement('div');note.className='meg-canonical-payment';note.textContent='Payment status unavailable';actions.appendChild(note);}}
   }
 }
 function schedule(){if(scheduled)return;scheduled=true;root.setTimeout(()=>{scheduled=false;void refresh();},30);}
 function install(){
   const list=root.document?.getElementById('viewerClaimsList');if(!list)return;
   const observer=new MutationObserver(records=>{
     if(records.some(rec=>[...rec.addedNodes,...rec.removedNodes].some(node=>node.nodeType===1&&(node.matches?.('.viewer-claim-row')||node.querySelector?.('.viewer-claim-row')))))schedule();
   });
   observer.observe(list,{childList:true,subtree:true});
   schedule();
 }
 if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});else install();
 root.MEG_OTCF_CANONICAL_PAYMENT={uvn:VERSION,refresh};
})(typeof window!=='undefined'?window:globalThis);
