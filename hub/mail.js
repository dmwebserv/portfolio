'use strict';
(()=>{
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.StudioMail={mount(p,{toast,save,log,flush=async()=>{},postalAddress=''}){
  const target=document.getElementById('connected-mail');if(!target)return;
  target.innerHTML=`<section class="detail-section live-ai"><h3>Connected mailbox</h3><p>Connect the dedicated Gmail account you already use for your domain. Approved first emails are submitted to Gmail immediately. Replies can be checked here or by the optional scheduled sync.</p><p id="gmail-connection" role="status">Checking Gmail setup…</p><div id="mail-summary" class="mail-summary" role="status">Loading stored send status…</div><p id="mail-blocked" class="mail-reason"></p><div id="mail-error" class="mail-error" role="alert" hidden></div><div class="tools"><button class="secondary" id="gmail-connect">Connect Gmail</button><button class="secondary" id="gmail-disconnect">Disconnect Gmail</button><button class="primary" id="mail-send" disabled>Approve & send first email</button><button class="secondary" id="mail-refresh">Check sent mail & replies</button></div><p id="mail-status" role="status">Check status before sending. Replies and follow-ups can still be handled in your normal mailbox.</p><div id="mail-history"></div><details open class="email-design"><summary>Email design & preview</summary><p>A restrained signature logo and clickable demo screenshot. Images are embedded in the email, not loaded from a tracking server. No open tracking.</p><div class="tools"><label>Format<select id="email-format"><option value="branded">Professional · logo & demo</option><option value="plain">Plain text</option></select></label><button class="secondary" id="email-intro">Prepare personal introduction</button></div><label>Business postal details<input id="email-postal" maxlength="500" placeholder="Required business postal details — never invented"></label><button class="secondary" id="email-design-save">Save appearance</button><p id="email-preview-status" role="status"></p><iframe id="email-preview" title="Email design preview" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe><p>Preview adapts to this window. The recipient may use different fonts, dark mode or block images; the plain-text version and visible demo link remain available.</p></details></section>`;
  // Keep the recipient-facing design ahead of any send action.
  const section=target.firstElementChild,design=section.querySelector('.email-design');
  const delivery=document.createElement('section');delivery.className='mail-delivery';
  for(const child of [...section.children])if(child!==design)delivery.append(child);
  section.append(design,delivery);
  const readiness=document.createElement('div');readiness.className='mail-readiness';
  readiness.innerHTML='<button class="secondary" id="mail-preflight">Check send readiness · does not send</button><p id="mail-preflight-result" role="status"></p>';
  delivery.querySelector('.tools').before(readiness);
  const state=document.getElementById('mail-status'),send=document.getElementById('mail-send');let busy=false,connected=false,enabled=false,messages=[],statusKnown=false,statusError=false;
  function showError(message){
   if(!target.isConnected)return;
   const box=target.querySelector('#mail-error');box.hidden=!message;box.textContent=message||'';
   if(message&&p.mailLastError?.message!==message){p.mailLastError={message:String(message).slice(0,1000),at:new Date().toISOString()};save?.();}
  }
  function reason(){
   if(busy)return 'Submitting the approved email. Do not send another copy.';
   if(!statusKnown)return statusError?'Mail status is unavailable. Use Check sent mail & replies before another send.':'Checking stored mail status before allowing a send.';
   if(!connected)return 'Connect Gmail before sending.';
   if(!enabled)return 'Gmail sending is disabled in server settings.';
   if(['Do not contact','Not interested'].includes(p.stage))return 'Outreach is blocked for this prospect.';
   if(messages.some(m=>m.direction==='inbound'))return 'A reply is recorded. Continue the conversation in Gmail.';
   const outbound=messages.find(m=>m.direction==='outbound'&&m.status!=='failed');
   if(outbound?.status==='queued'&&outbound.presentation&&outbound.presentation.version!==template?.settings(p).version)return 'This unsent queued draft uses the previous screenshots. Cancel it below, save the new appearance and review before a fresh approval.';
   if(outbound?.status==='queued')return 'Queued at the last check. Use Check send readiness to diagnose preparation without sending. Review the stored record and Gmail Sent before retrying.';
   if(outbound?.status==='sending')return 'A send attempt was claimed. Its outcome is not yet confirmed. Check Gmail Sent; do not retry.';
   if(outbound?.status==='uncertain')return 'Send outcome uncertain. Check Gmail Sent before taking any further action. Automatic retry is blocked.';
   if(outbound?.status==='accepted')return 'Gmail accepted this first email. Another first-contact send is blocked to prevent duplicates.';
   if(p.sentAt)return 'A first email has already been recorded. Follow-ups must be handled in Gmail.';
   if(!p.email||!/^\S+@\S+\.\S+$/.test(p.email))return 'Add a verified recipient email in Edit details.';
   const missing=['demo','facts','contact','eligibility','email'].filter(k=>!p.checks?.[k]);
   if(missing.length)return 'Complete the review checks: '+missing.join(', ')+'.';
   return '';
  }
  function updateSend(){const message=reason();send.disabled=!!message;send.setAttribute('aria-describedby','mail-blocked mail-summary');target.querySelector('#mail-blocked').textContent=message||'Ready for your final approval. Nothing is sent until you confirm.';}
  if(p.mailLastError?.message)showError(p.mailLastError.message);
  const template=window.StudioEmail,format=document.getElementById('email-format'),postal=document.getElementById('email-postal');
  format.value=p.mailPresentation?.format||'branded';postal.value=p.mailPresentation?.postalAddress||postalAddress;
  const draftInput=document.getElementById('outreach-text');
  function preview(){
   if(!target.isConnected)return;
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
  function invalidate(){p.checks=p.checks||{};p.checks.email=false;const box=document.querySelector('[data-check="email"]');if(box)box.checked=false;preview();updateSend();}
  let previewTimer;const schedulePreview=()=>{clearTimeout(previewTimer);previewTimer=setTimeout(preview,220);};
  format.onchange=invalidate;postal.oninput=invalidate;draftInput?.addEventListener('input',schedulePreview);
  function saveDraftAndAppearance(){p.mailPresentation={format:format.value,postalAddress:postal.value.trim(),templateVersion:template?.settings(p).version||2};p.outreachDraft=draftInput?.value||'';invalidate();log?.(p,'Email draft and appearance saved; review required');save?.();toast('Draft and appearance saved together. Review the final preview, then confirm the email review check.');}
  document.getElementById('email-design-save').textContent='Save draft and appearance';
  document.getElementById('email-design-save').onclick=saveDraftAndAppearance;
  const draftSave=document.getElementById('save-email');if(draftSave){draftSave.textContent='Save draft and appearance';draftSave.onclick=saveDraftAndAppearance;}
  document.getElementById('email-intro').onclick=()=>{if(!template)return;if(p.sentAt||['Do not contact','Not interested'].includes(p.stage)){toast('This record is not eligible for a new first-contact draft.');return;}if(draftInput.value.trim()&&!confirm('Replace this working draft with a personal introduction? Recorded sent mail is not changed.'))return;draftInput.value=template.introduction(p,postal.value);p.outreachDraft=draftInput.value;p.mailPresentation={format:format.value,postalAddress:postal.value.trim(),templateVersion:template?.settings(p).version||2};invalidate();save?.();toast('Introduction prepared and saved. Review facts, recipient and the final preview before sending.');};
  if(!p.sentAt&&p.mailPresentation?.format==='branded'&&p.mailPresentation.templateVersion!==template?.settings(p).version){p.checks=p.checks||{};p.checks.email=false;const box=document.querySelector('[data-check="email"]');if(box)box.checked=false;showError('The demo designs and screenshots have changed. Save appearance, review the updated preview and complete the email review check again.');}
  preview();
  async function refresh(checkGoogle=false){
   statusKnown=false;statusError=false;updateSend();
   if(!window.StudioCloud?.api){state.textContent='Connected email is available only in the deployed private Studio after mail setup.';target.querySelector('#mail-summary').textContent='Mail is unavailable in this local preview.';updateSend();return;}
   const status=await window.StudioCloud.api('/api/gmail/status');if(!target.isConnected)return;connected=status.connected;enabled=status.enabled;
   document.getElementById('gmail-connection').textContent=connected?`Connected: ${status.account.mailbox} · From: ${status.sender} · ${enabled?'sending enabled':'sending disabled'} · Last reply sync: ${status.account.last_sync_at||'not yet checked'}`:'Gmail is not connected. Complete server setup, then Connect Gmail.';
   document.getElementById('gmail-disconnect').disabled=!connected;
   if(checkGoogle&&connected&&enabled)await window.StudioCloud.api('/api/gmail/sync',{});
   const result=await window.StudioCloud.api('/api/mail?project='+encodeURIComponent(p.id));
   if(!target.isConnected||document.getElementById('mail-send')!==send)return;
   messages=result.messages||[];statusKnown=true;const reply=messages.some(m=>m.direction==='inbound'),pending=messages.some(m=>m.direction==='outbound'&&m.status!=='failed');
   let changed=false;
   const accepted=messages.find(m=>m.direction==='outbound'&&m.status==='accepted');
   if(accepted&&!p.sentAt){p.sentAt=(accepted.accepted_at||accepted.created_at).slice(0,10);if(['Research','Demo preparation','Demo ready','No response'].includes(p.stage))p.stage='Contacted';(p.outreachHistory||=[]).push({kind:'Gmail accepted (not delivery confirmation)',date:p.sentAt,to:accepted.recipient,body:'Subject: '+accepted.subject+'\n\n'+accepted.body});if(p.stage==='Contacted'){p.next='Check connected mailbox for a reply; no automatic follow-up.';p.due='';}log?.(p,'Connected email accepted by Gmail');changed=true;}
   const latestReply=messages.find(m=>m.direction==='inbound'),replyKey=latestReply&&(latestReply.id||latestReply.gmail_id||latestReply.created_at);
   if(reply&&replyKey!==p.mailReplySeen){p.mailReplySeen=replyKey;if(['Research','Demo preparation','Demo ready','Contacted','No response'].includes(p.stage)){p.next='Reply received — review in mailbox before responding.';p.due='';p.stage='In discussion';}log?.(p,'Connected reply received; review in Gmail');changed=true;}
   if(changed)save?.();
   updateSend();
   const latest=messages.find(m=>m.direction==='outbound'),labels={queued:'Queued — not sent',sending:'Send attempt started — outcome not confirmed',uncertain:'Outcome uncertain — do not resend',accepted:'Accepted by Gmail — not delivery confirmation',failed:'Cancelled / failed before another attempt'};
   target.querySelector('#mail-summary').innerHTML=latest?`<strong>${window.StudioMailStatus?.html(latest)||esc(labels[latest.status]||latest.status)}</strong><span>${esc(latest.subject)} · ${esc(latest.recipient)}</span><p>${esc(latest.detail||'No further detail recorded.')}</p>`:'<strong>No connected send recorded for this prospect.</strong>';
   if(latest?.status==='queued'&&latest.detail)showError(latest.detail);
   if(latest?.status==='accepted'&&p.mailLastError){p.mailLastError=null;target.querySelector('#mail-error').hidden=true;save?.();}
   state.textContent=reply?'Reply received — outreach paused. Read below and respond in your normal mailbox.':messages.length?'Latest stored mail status shown below. Accepted means Gmail accepted the request, not delivered. Refresh to check for changes.':'No connected messages recorded. Connect and enable Gmail before sending.';
   document.getElementById('mail-history').innerHTML=messages.length?'<h3>Stored email records</h3>'+messages.map(m=>`<details class="mail-record" ${m===messages[0]?'open':''}><summary><strong>${esc(m.subject||'(No subject)')}</strong>${window.StudioMailStatus?.html(m)||'<span>'+esc(m.direction==='inbound'?'Reply received':labels[m.status]||m.status)+'</span>'}</summary><dl class="mail-record-meta"><dt>To</dt><dd>${esc(m.recipient)}</dd><dt>Recorded</dt><dd>${esc(readableDate(m.created_at))}</dd>${m.accepted_at?`<dt>Gmail accepted</dt><dd>${esc(readableDate(m.accepted_at))}</dd>`:''}<dt>Record ID</dt><dd>${esc(m.id||'Not available')}</dd></dl><div class="mail-record-detail">${esc(m.detail||'No additional transport detail recorded.')}</div><h4>Saved plain-text email</h4><pre class="mail-message-body">${esc(m.body)}</pre>${m.status==='queued'?`<div class="tools"><button class="secondary" data-cancel-mail="${esc(m.id)}">Cancel queued email</button>${!m.presentation||m.presentation.version===template?.settings(p).version?`<button class="secondary" data-retry-mail="${esc(m.id)}">Review and retry this queued email</button>`:''}</div>`:''}</details>`).join(''):'<p>No stored email records yet.</p>';
   target.querySelectorAll('[data-cancel-mail]').forEach(b=>b.onclick=async()=>{if(!confirm('Cancel this queued email? If sending has already started it cannot be recalled.'))return;b.disabled=true;try{await window.StudioCloud.api('/api/mail',{cancel:b.dataset.cancelMail});await refresh();}catch(e){showError(e.message);}});
   target.querySelectorAll('[data-retry-mail]').forEach(b=>b.onclick=()=>approve(b.dataset.retryMail));
   if(reply||pending){for(const id of ['record-sent','record-followup','prepare-email','open-email']){const el=document.getElementById(id);if(el)el.disabled=true;}}
  }
  function readableDate(value){if(!value)return 'Not recorded';const date=new Date(value);return Number.isNaN(date.valueOf())?value:date.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});}
  document.getElementById('mail-preflight').onclick=async()=>{
   const result=target.querySelector('#mail-preflight-result'),button=target.querySelector('#mail-preflight');
   if(!window.StudioCloud?.api){result.textContent='Available only in the signed-in private Studio.';return;}
   if(draftInput?.value!==(p.outreachDraft||'')){result.textContent='Save the draft and complete its review first, so this check tests the same email you are viewing.';return;}
   button.disabled=true;result.textContent='Checking the saved email, Gmail connection and embedded images. Nothing will be sent…';
   try{await flush();const r=await window.StudioCloud.api('/api/mail',{project:p.id,preflight:true});if(target.isConnected)result.textContent=r.message||'Readiness check passed. No email was sent.';}
   catch(e){if(target.isConnected)result.textContent='Readiness check stopped: '+e.message+' No send was requested by this check.';}
   finally{button.disabled=false;}
  };
  document.getElementById('gmail-connect').onclick=async()=>{try{const r=await window.StudioCloud.api('/api/gmail/connect',{});location.assign(r.url);}catch(e){state.textContent=e.message;}};
  document.getElementById('gmail-disconnect').onclick=async()=>{if(!confirm('Disconnect Gmail? No more sends or reply checks will work until you reconnect. Stored message history is retained.'))return;try{const r=await window.StudioCloud.api('/api/gmail/disconnect',{});await refresh();if(!r.revoked)state.textContent='Disconnected locally. Also remove the app in Google Account → Third-party connections if revocation could not be confirmed.';}catch(e){state.textContent=e.message;}};
  document.getElementById('mail-refresh').onclick=()=>refresh(true).catch(statusFailed);
  async function approve(retry){
   if(busy)return;
   if(!retry&&reason()){showError(reason());return;}
   if(!window.StudioCloud?.api){showError('Deploy and configure mail first.');return;}
   const draft=document.getElementById('outreach-text')?.value||'';
   if(['Do not contact','Not interested'].includes(p.stage)||!['demo','facts','contact','eligibility','email'].every(k=>p.checks?.[k])){showError('Save the final draft and complete all five review checks first.');return;}
   if(template&&JSON.stringify(template.settings(p))!==JSON.stringify(template.settings({...p,mailPresentation:{format:format.value,postalAddress:postal.value.trim()}}))){showError('Save appearance and review the email first.');return;}
   let presentation;try{presentation=template?.render(p,draft).config;}catch(e){showError(e.message);return;}
   if(!confirm(`Approve this exact email to ${p.email}?\n\n${draft}\n\nIt will be submitted now using your verified domain identity in Gmail. Do not also send it manually. ${presentation?.format==='branded'?'Includes the reviewed logo/demo layout and plain-text fallback. ':''}This version supports first contact only.`))return;
   busy=true;updateSend();state.textContent='Submitting approved email to Gmail…';
   try{await flush();const r=await window.StudioCloud.api('/api/mail',{project:p.id,draft,approved:true,presentation,...(retry?{retry}:{})});p.mailLastError=null;target.querySelector('#mail-error').hidden=true;save?.();await refresh();if(r.send?.status==='uncertain')state.textContent='Send outcome uncertain. Check Gmail Sent before any manual retry.';}
   catch(e){showError(e.message+' Check the stored status before retrying; do not also send manually.');try{await refresh();}catch{statusFailed();} }
   finally{busy=false;updateSend();}
  }
  send.onclick=()=>approve();
  function statusFailed(){if(!target.isConnected)return;state.textContent='Mail status unavailable. Sending is paused for safety.';statusKnown=false;statusError=true;target.querySelector('#mail-summary').textContent='Stored send status could not be checked.';showError('Could not load mail status. Check your connection, then use Check sent mail & replies.');updateSend();}
  if(window.StudioCloud?.api)refresh().catch(statusFailed);else{send.disabled=true;target.querySelector('#mail-blocked').textContent='Connected sending requires the deployed private Studio.';}
 }};
})();
