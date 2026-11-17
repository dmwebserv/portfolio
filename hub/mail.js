'use strict';
(()=>{
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.StudioMail={mount(p,{toast,save,log}){
  const target=document.getElementById('connected-mail');if(!target)return;
  target.innerHTML=`<section class="detail-section live-ai"><h3>Connected mailbox</h3><p>IONOS connection requires one-time setup. Approved first emails enter a queue; a scheduled worker sends them, typically checking every 10 minutes (delays possible). This is not instant sending.</p><div class="tools"><button class="primary" id="mail-send">Approve & queue first email</button><button class="secondary" id="mail-refresh">Check sent mail & replies</button></div><p id="mail-status" role="status">Check status before sending. Replies and follow-ups can still be handled in your normal mailbox.</p><div id="mail-history"></div></section>`;
  const state=document.getElementById('mail-status'),send=document.getElementById('mail-send');let busy=false;
  async function refresh(){
   if(!window.StudioCloud?.api){state.textContent='Connected email is available only in the deployed private Studio after mail setup.';send.disabled=true;return;}
   const result=await window.StudioCloud.api('/api/mail?project='+encodeURIComponent(p.id));
   const messages=result.messages||[],reply=messages.some(m=>m.direction==='inbound'),pending=messages.some(m=>m.direction==='outbound'&&m.status!=='failed');
   let changed=false;
   const accepted=messages.find(m=>m.direction==='outbound'&&m.status==='accepted');
   if(accepted&&!p.sentAt){p.sentAt=accepted.updated_at.slice(0,10);if(!['Do not contact','Not interested'].includes(p.stage))p.stage='Contacted';(p.outreachHistory||=[]).push({kind:'IONOS SMTP accepted (not delivery confirmation)',date:p.sentAt,to:accepted.recipient,body:'Subject: '+accepted.subject+'\n\n'+accepted.body});p.next='Check connected mailbox for a reply; no automatic follow-up.';p.due='';log?.(p,'Connected email accepted by IONOS SMTP');changed=true;}
   if(reply&&!['Do not contact','Not interested'].includes(p.stage)&&p.next!=='Reply received — review in mailbox before responding.'){p.next='Reply received — review in mailbox before responding.';p.due='';if(['Contacted','Demo ready'].includes(p.stage))p.stage='In discussion';log?.(p,'Connected reply received; follow-up reminders paused');changed=true;}
   if(changed)save?.();
   send.disabled=pending||reply||!!p.sentAt||['Do not contact','Not interested'].includes(p.stage);
   state.textContent=reply?'Reply received — outreach paused. Read below and respond in your normal mailbox.':messages.length?'Latest stored mail status shown below. Accepted means SMTP accepted, not delivered. Refresh to check for changes.':'No connected messages recorded. Queue only after setup is complete; queued messages wait for the worker.';
   document.getElementById('mail-history').innerHTML=messages.map(m=>`<details><summary>${esc(m.direction==='inbound'?'Reply received':m.status)} · ${esc(m.created_at)} · ${esc(m.subject)}</summary><p>${esc(m.detail)}</p><p>To: ${esc(m.recipient)}</p>${m.status==='queued'?`<button class="secondary" data-cancel-mail="${esc(m.id)}">Cancel queued email</button>`:''}<pre class="ai-result">${esc(m.body)}</pre></details>`).join('');
   target.querySelectorAll('[data-cancel-mail]').forEach(b=>b.onclick=async()=>{if(!confirm('Cancel this queued email? If sending has already started it cannot be recalled.'))return;b.disabled=true;try{await window.StudioCloud.api('/api/mail',{cancel:b.dataset.cancelMail});await refresh();}catch(e){state.textContent=e.message;}});
   if(reply||pending){for(const id of ['record-sent','record-followup','prepare-email','open-email']){const el=document.getElementById(id);if(el)el.disabled=true;}}
  }
  document.getElementById('mail-refresh').onclick=()=>refresh().catch(()=>{state.textContent='Mail status unavailable. Complete mail setup or check your session. Nothing was sent by this check.';});
  send.onclick=async()=>{
   if(busy)return;
   if(!window.StudioCloud?.api){toast('Deploy and configure mail first.');return;}
   const draft=document.getElementById('outreach-text')?.value||'';
   if(['Do not contact','Not interested'].includes(p.stage)||!['demo','facts','contact','eligibility','email'].every(k=>p.checks?.[k])){toast('Save the final draft and complete all five review checks first.');return;}
   if(!confirm(`Approve this exact email to ${p.email}?\n\n${draft}\n\nIt will be queued for your IONOS mailbox worker. Sending may be delayed. Do not also send it manually. This version supports first contact only.`))return;
   busy=true;send.disabled=true;state.textContent='Queuing approved email…';
   try{await window.StudioCloud.api('/api/mail',{project:p.id,draft,approved:true});state.textContent='Queued — not yet sent. The scheduled worker must run before IONOS can accept it.';await refresh();}
   catch(e){state.textContent=e.message+' Refresh status before retrying; do not also send manually.';}
   finally{busy=false;}
  };
  if(window.StudioCloud?.api)refresh().catch(()=>{state.textContent='Mail setup is not complete, or status is unavailable. Do not queue until setup is confirmed.';send.disabled=true;});else send.disabled=true;
 }};
})();
