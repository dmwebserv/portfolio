'use strict';
(()=>{
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function describe(m){
  if(m.direction==='inbound')return {tone:'reply',label:'Reply received',reason:'A reply is recorded. Review it before any further outreach.'};
  switch(m.status){
   case 'queued':return {tone:'warning',label:m.detail?.includes('Preparation stopped')?'Blocked · not sent':'Queued · not sent',reason:m.detail?.includes('[images]')?'Embedded email images could not be prepared. Check send readiness.':m.detail?.includes('[account]')?'Gmail connection needs attention. Check send readiness.':m.detail?.includes('Preparation stopped')?'Preparation stopped before a send attempt. Check send readiness.':'No send attempt recorded yet. Check readiness before retrying.'};
   case 'sending':return {tone:'pending',label:'Sending · outcome pending',reason:'A send attempt has started. Check Gmail Sent; do not send another copy.'};
   case 'uncertain':return {tone:'danger',label:'Outcome uncertain',reason:'Check Gmail Sent before doing anything else. Do not resend.'};
   case 'accepted':return {tone:'success',label:'Accepted by Gmail',reason:'Gmail accepted the request. Inbox delivery is not confirmed.'};
   case 'failed':return /cancel/i.test(m.detail||'')?{tone:'neutral',label:'Cancelled',reason:'This stored attempt was cancelled. It has not been retried.'}:{tone:'danger',label:'Failed / stopped',reason:'This attempt stopped. Read the recorded detail before taking action.'};
   default:return {tone:'neutral',label:'Status unavailable',reason:'Refresh stored records before sending or retrying.'};
  }
 }
 function html(m,withReason=true){const d=describe(m);return `<span class="mail-chip" data-tone="${d.tone}">${escape(d.label)}</span>${withReason?`<span class="mail-at-glance">${escape(d.reason)}</span>`:''}`;}
 window.StudioMailStatus=Object.freeze({describe,html});
})();
