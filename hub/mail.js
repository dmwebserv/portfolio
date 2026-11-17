'use strict';
(()=>{
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.StudioMail={mount(p,{toast,save,log,postalAddress=''}){
  const target=document.getElementById('connected-mail');if(!target)return;
  target.innerHTML=`<section class="detail-section live-ai"><h3>Connected mailbox</h3><p>Connect the dedicated Gmail account you already use for your domain. Approved first emails are submitted to Gmail immediately. Replies can be checked here or by the optional scheduled sync.</p><p id="gmail-connection" role="status">Checking Gmail setup…</p><div class="tools"><button class="secondary" id="gmail-connect">Connect Gmail</button><button class="secondary" id="gmail-disconnect">Disconnect Gmail</button><button class="primary" id="mail-send" disabled>Approve & send first email</button><button class="secondary" id="mail-refresh">Check sent mail & replies</button></div><p id="mail-status" role="status">Check status before sending. Replies and follow-ups can still be handled in your normal mailbox.</p><details open class="email-design"><summary>Email design & preview</summary><p>A restrained signature logo and clickable demo screenshot. Images are embedded in the email, not loaded from a tracking server. No open tracking.</p><div class="tools"><label>Format<select id="email-format"><option value="branded">Professional · logo & demo</option><option value="plain">Plain text</option></select></label><button class="secondary" id="email-intro">Prepare personal introduction</button></div><label>Business postal details<input id="email-postal" maxlength="500" placeholder="Required business postal details — never invented"></label><button class="secondary" id="email-design-save">Save appearance</button><p id="email-preview-status" role="status"></p><iframe id="email-preview" title="Email design preview" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe><p>Preview adapts to this window. The recipient may use different fonts, dark mode or block images; the plain-text version and visible demo link remain available.</p></details><div id="mail-history"></div></section>`;
  const state=document.getElementById('mail-status'),send=document.getElementById('mail-send');let busy=false,connected=false,enabled=false;
  const template=window.StudioEmail,format=document.getElementById('email-format'),postal=document.getElementById('email-postal');
  format.value=p.mailPresentation?.format||'branded';postal.value=p.mailPresentation?.postalAddress||postalAddress;
  const draftInput=document.getElementById('outreach-text');
  function preview(){
   const frame=document.getElementById('email-preview'),status=document.getElementById('email-preview-status');
   if(!template){status.textContent='Email template unavailable. Refresh after deployment.';return;}
   try{
    const value=draftInput?.value||'';
    const result=template.render({...p,mailPresentation:{format:format.value,postalAddress:postal.value}},value);
    const policy=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${location.origin}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`;
    let html=result.html||`<!doctype html><html><head></head><body><pre style="white-space:pre-wrap;font:14px/1.7 Arial">${esc(result.body)}</pre></body></html>`;
    for(const asset of result.assets)html=html.replaceAll('cid:'+asset.cid,location.origin+'/images/email/'+asset.file);
    frame.srcdoc=html.replace('<head>','<head>'+policy);status.textContent=result.html?(result.assets.some(a=>a.cid==='studio-demo')?'Logo, linked screenshot and plain-text fallback ready for review.':'Signature layout ready. No matching curated demo screenshot found; no image has been invented.'):'Plain-text email selected.';
   }catch(e){frame.srcdoc='';status.textContent=e.message;}
  }
  function invalidate(){p.checks=p.checks||{};p.checks.email=false;const box=document.querySelector('[data-check="email"]');if(box)box.checked=false;preview();}
  format.onchange=invalidate;postal.oninput=invalidate;draftInput?.addEventListener('input',preview);
  document.getElementById('email-design-save').onclick=()=>{p.mailPresentation={format:format.value,postalAddress:postal.value.trim()};p.outreachDraft=draftInput?.value||'';invalidate();save?.();toast('Appearance and draft saved. Review the preview, then complete the email review check.');};
  document.getElementById('email-intro').onclick=()=>{if(!template)return;if(p.sentAt||['Do not contact','Not interested'].includes(p.stage)){toast('This record is not eligible for a new first-contact draft.');return;}if(draftInput.value.trim()&&!confirm('Replace this working draft with a personal introduction? Recorded sent mail is not changed.'))return;draftInput.value=template.introduction(p,postal.value);p.outreachDraft=draftInput.value;p.mailPresentation={format:format.value,postalAddress:postal.value.trim()};invalidate();save?.();toast('Introduction prepared and saved. Review facts, recipient and the final preview before sending.');};
  preview();
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
   document.getElementById('mail-history').innerHTML=messages.map(m=>`<details><summary>${esc(m.direction==='inbound'?'Reply received':m.status)} · ${esc(m.created_at)} · ${esc(m.subject)}</summary><p>${esc(m.detail)}</p><p>To: ${esc(m.recipient)}</p>${m.status==='queued'?`<button class="secondary" data-cancel-mail="${esc(m.id)}">Cancel queued email</button><button class="secondary" data-retry-mail="${esc(m.id)}">Review & retry queued email</button>`:''}<pre class="ai-result">${esc(m.body)}</pre></details>`).join('');
   target.querySelectorAll('[data-cancel-mail]').forEach(b=>b.onclick=async()=>{if(!confirm('Cancel this queued email? If sending has already started it cannot be recalled.'))return;b.disabled=true;try{await window.StudioCloud.api('/api/mail',{cancel:b.dataset.cancelMail});await refresh();}catch(e){state.textContent=e.message;}});
   target.querySelectorAll('[data-retry-mail]').forEach(b=>b.onclick=()=>approve(b.dataset.retryMail));
   if(reply||pending){for(const id of ['record-sent','record-followup','prepare-email','open-email']){const el=document.getElementById(id);if(el)el.disabled=true;}}
  }
  document.getElementById('gmail-connect').onclick=async()=>{try{const r=await window.StudioCloud.api('/api/gmail/connect',{});location.assign(r.url);}catch(e){state.textContent=e.message;}};
  document.getElementById('gmail-disconnect').onclick=async()=>{if(!confirm('Disconnect Gmail? No more sends or reply checks will work until you reconnect. Stored message history is retained.'))return;try{const r=await window.StudioCloud.api('/api/gmail/disconnect',{});await refresh();if(!r.revoked)state.textContent='Disconnected locally. Also remove the app in Google Account → Third-party connections if revocation could not be confirmed.';}catch(e){state.textContent=e.message;}};
  document.getElementById('mail-refresh').onclick=()=>refresh(true).catch(()=>{state.textContent='Mail status unavailable. Complete mail setup or check your session. Nothing was sent by this check.';});
  async function approve(retry){
   if(busy)return;
   if(!window.StudioCloud?.api){toast('Deploy and configure mail first.');return;}
   const draft=document.getElementById('outreach-text')?.value||'';
   if(['Do not contact','Not interested'].includes(p.stage)||!['demo','facts','contact','eligibility','email'].every(k=>p.checks?.[k])){toast('Save the final draft and complete all five review checks first.');return;}
   if(template&&JSON.stringify(template.settings(p))!==JSON.stringify(template.settings({...p,mailPresentation:{format:format.value,postalAddress:postal.value.trim()}}))){toast('Save appearance and review the email first.');return;}
   let presentation;try{presentation=template?.render(p,draft).config;}catch(e){toast(e.message);return;}
   if(!confirm(`Approve this exact email to ${p.email}?\n\n${draft}\n\nIt will be submitted now using your verified domain identity in Gmail. Do not also send it manually. ${presentation?.format==='branded'?'Includes the reviewed logo/demo layout and plain-text fallback. ':''}This version supports first contact only.`))return;
   busy=true;send.disabled=true;state.textContent='Submitting approved email to Gmail…';
   try{const r=await window.StudioCloud.api('/api/mail',{project:p.id,draft,approved:true,presentation,...(retry?{retry}:{})});await refresh();if(r.send?.status==='uncertain')state.textContent='Send outcome uncertain. Check Gmail Sent before any manual retry.';}
   catch(e){state.textContent=e.message+' Refresh status before retrying; do not also send manually.';}
   finally{busy=false;}
  }
  send.onclick=()=>approve();
  if(window.StudioCloud?.api)refresh().catch(()=>{state.textContent='Mail setup is not complete, or status is unavailable. Do not send until setup is confirmed.';send.disabled=true;});else send.disabled=true;
 }};
})();
