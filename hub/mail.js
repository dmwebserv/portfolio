'use strict';
(()=>{
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.StudioMail={mount(p,{toast,save,log}){
  const target=document.getElementById('connected-mail');if(!target)return;
  target.innerHTML=`<section class="detail-section live-ai"><h3>Connected mailbox</h3><p>Connect the dedicated Gmail account you already use for your domain. Approved first emails are submitted to Gmail immediately. Replies can be checked here or by the optional scheduled sync.</p><p id="gmail-connection" role="status">Checking Gmail setup…</p><div class="tools"><button class="secondary" id="gmail-connect">Connect Gmail</button><button class="secondary" id="gmail-disconnect">Disconnect Gmail</button><button class="primary" id="mail-send" disabled>Approve & send first email</button><button class="secondary" id="mail-refresh">Check sent mail & replies</button></div><p id="mail-status" role="status">Check status before sending. Replies and follow-ups can still be handled in your normal mailbox.</p><div id="mail-history"></div></section>`;
  const state=document.getElementById('mail-status'),send=document.getElementById('mail-send');let busy=false,connected=false,enabled=false;
  async function refresh(checkGoogle=false){
   if(!window.StudioCloud?.api){state.textContent='Connected email is available only in the deployed private Studio after mail setup.';send.disabled=true;return;}
   const status=await window.StudioCloud.api('/api/gmail/status');connected=status.connected;enabled=status.enabled;
   document.getElementById('gmail-connection').textContent=connected?`Connected: ${status.account.mailbox} · From: ${status.sender} · ${enabled?'sending enabled':'sending disabled'} · Last reply sync: ${status.account.last_sync_at||'not yet checked'}`:'Gmail is not connected. Complete server setup, then Connect Gmail.';
   document.getElementById('gmail-disconnect').disabled=!connected;
   if(checkGoogle&&connected&&enabled)await window.StudioCloud.api('/api/gmail/sync',{});
   const result=await window.StudioCloud.api('/api/mail?project='+encodeURIComponent(p.id));
   const messages=result.messages||[],reply=messages.some(m=>m.direction==='inbound'),pending=messages.some(m=>m.direction==='outbound'&&m.status!=='failed');
   let changed=false;
   const accepted=messages.find(m=>m.direction==='outbound'&&m.status==='accepted');
   if(accepted&&!p.sentAt){p.sentAt=(accepted.accepted_at||accepted.created_at).slice(0,10);if(['Research','Demo preparation','Demo ready','No response'].includes(p.stage))p.stage='Contacted';(p.outreachHistory||=[]).push({kind:'Gmail accepted (not delivery confirmation)',date:p.sentAt,to:accepted.recipient,body:'Subject: '+accepted.subject+'\n\n'+accepted.body});if(p.stage==='Contacted'){p.next='Check connected mailbox for a reply; no automatic follow-up.';p.due='';}log?.(p,'Connected email accepted by Gmail');changed=true;}
   const latestReply=messages.find(m=>m.direction==='inbound'),replyKey=latestReply&&(latestReply.id||latestReply.gmail_id||latestReply.created_at);
   if(reply&&replyKey!==p.mailReplySeen){p.mailReplySeen=replyKey;if(['Research','Demo preparation','Demo ready','Contacted','No response'].includes(p.stage)){p.next='Reply received — review in mailbox before responding.';p.due='';p.stage='In discussion';}log?.(p,'Connected reply received; review in Gmail');changed=true;}
   if(changed)save?.();
   send.disabled=!connected||!enabled||pending||reply||!!p.sentAt||['Do not contact','Not interested'].includes(p.stage);
   state.textContent=reply?'Reply received — outreach paused. Read below and respond in your normal mailbox.':messages.length?'Latest stored mail status shown below. Accepted means Gmail accepted the request, not delivered. Refresh to check for changes.':'No connected messages recorded. Connect and enable Gmail before sending.';
   document.getElementById('mail-history').innerHTML=messages.map(m=>`<details><summary>${esc(m.direction==='inbound'?'Reply received':m.status)} · ${esc(m.created_at)} · ${esc(m.subject)}</summary><p>${esc(m.detail)}</p><p>To: ${esc(m.recipient)}</p>${m.status==='queued'?`<button class="secondary" data-cancel-mail="${esc(m.id)}">Cancel queued email</button>`:''}<pre class="ai-result">${esc(m.body)}</pre></details>`).join('');
   target.querySelectorAll('[data-cancel-mail]').forEach(b=>b.onclick=async()=>{if(!confirm('Cancel this queued email? If sending has already started it cannot be recalled.'))return;b.disabled=true;try{await window.StudioCloud.api('/api/mail',{cancel:b.dataset.cancelMail});await refresh();}catch(e){state.textContent=e.message;}});
   if(reply||pending){for(const id of ['record-sent','record-followup','prepare-email','open-email']){const el=document.getElementById(id);if(el)el.disabled=true;}}
  }
  document.getElementById('gmail-connect').onclick=async()=>{try{const r=await window.StudioCloud.api('/api/gmail/connect',{});location.assign(r.url);}catch(e){state.textContent=e.message;}};
  document.getElementById('gmail-disconnect').onclick=async()=>{if(!confirm('Disconnect Gmail? No more sends or reply checks will work until you reconnect. Stored message history is retained.'))return;try{const r=await window.StudioCloud.api('/api/gmail/disconnect',{});await refresh();if(!r.revoked)state.textContent='Disconnected locally. Also remove the app in Google Account → Third-party connections if revocation could not be confirmed.';}catch(e){state.textContent=e.message;}};
  document.getElementById('mail-refresh').onclick=()=>refresh(true).catch(()=>{state.textContent='Mail status unavailable. Complete mail setup or check your session. Nothing was sent by this check.';});
  send.onclick=async()=>{
   if(busy)return;
   if(!window.StudioCloud?.api){toast('Deploy and configure mail first.');return;}
   const draft=document.getElementById('outreach-text')?.value||'';
   if(['Do not contact','Not interested'].includes(p.stage)||!['demo','facts','contact','eligibility','email'].every(k=>p.checks?.[k])){toast('Save the final draft and complete all five review checks first.');return;}
   if(!confirm(`Approve this exact email to ${p.email}?\n\n${draft}\n\nIt will be submitted now using your verified domain identity in Gmail. Do not also send it manually. This version supports first contact only.`))return;
   busy=true;send.disabled=true;state.textContent='Submitting approved email to Gmail…';
   try{const r=await window.StudioCloud.api('/api/mail',{project:p.id,draft,approved:true});await refresh();if(r.send?.status==='uncertain')state.textContent='Send outcome uncertain. Check Gmail Sent before any manual retry.';}
   catch(e){state.textContent=e.message+' Refresh status before retrying; do not also send manually.';}
   finally{busy=false;}
  };
  if(window.StudioCloud?.api)refresh().catch(()=>{state.textContent='Mail setup is not complete, or status is unavailable. Do not send until setup is confirmed.';send.disabled=true;});else send.disabled=true;
 }};
})();
