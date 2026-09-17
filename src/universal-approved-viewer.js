/* MEG Universal Claim Management v2026.09.17-14:30
 * Read-only enhancement for OTCF Approved Claims viewer.
 * Load AFTER the existing index.html scripts and universal-claim-view-model.js.
 * No payment, deletion, approval, printing or PDF mutation.
 */
(function(root){
  'use strict';
  let renderGeneration=0;
  function install(){
    if(typeof root.renderViewerClaims!=='function' ||
       typeof root.MEGCreateOTCFClaimViewModel!=='function') return false;
    if(root.renderViewerClaims.__megUniversalStatus) return true;
    const original=root.renderViewerClaims;
    const wrapped=async function(){
      const generation=++renderGeneration;
      const result=await original.apply(this,arguments);
      const list=root.document.getElementById('viewerClaimsList');
      const claims=Array.isArray(root.__OTCF_APPROVED_VIEWER_CACHE__)?root.__OTCF_APPROVED_VIEWER_CACHE__:[];
      if(!list || !claims.length) return result;
      const rows=Array.from(list.querySelectorAll('.viewer-claim-row'));
      if(rows.length!==claims.length) return result;
      let reconciled;
      try{
        // The existing page declares `sb` in a classic script; top-level const is not window.sb.
        const client=typeof sb!=='undefined'?sb:root.sb;
        reconciled=await root.MEGCreateOTCFClaimViewModel(client).reconcile(claims);
      }catch(e){
        console.error('Universal status reconciliation failed',e);
        reconciled=claims.map(c=>({...c,universalStatusAvailable:false}));
      }
      if(generation!==renderGeneration || !list.isConnected) return result;
      reconciled.forEach((claim,index)=>{
        const row=rows[index];
        if(!row || !row.isConnected) return;
        const target=row.querySelector('.viewer-claim-info');
        if(!target) return;
        const previous=target.querySelector('.meg-universal-claim-status');
        if(previous) previous.remove();
        const badge=root.document.createElement('div');
        badge.className='meg-universal-claim-status';
        badge.style.cssText='font-size:12px;font-weight:700;margin-top:4px;';
        badge.textContent=claim.universalStatusAvailable && claim.universalStatus
          ? (claim.universalStatus.claimPaid ? 'Claim Paid' : (claim.universalStatus.displayStatus||'Status unavailable'))
          : 'Status unavailable — refresh or contact Finance';
        badge.style.color=claim.universalStatusAvailable
          ? (claim.universalStatus.claimPaid?'#237a46':'#805f14'):'#a52828';
        target.appendChild(badge);
      });
      return result;
    };
    wrapped.__megUniversalStatus=true;
    root.renderViewerClaims=wrapped;
    return true;
  }
  root.MEGInstallOTCFUniversalViewer=install;
  install();
})(typeof window!=='undefined'?window:globalThis);
