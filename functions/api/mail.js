import {owner,json} from '../../hub/cloud/ai-service.js';
import '../../hub/email-template.js';
import {sendGmail,prepareGmail,recordQueuedError} from '../../hub/cloud/gmail-service.js';
export async function onRequest({request,env}){
 try{
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
  if(request.method==='POST'&&request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Same origin required'},403);
  const identity=await owner(request,env),headers={...identity.headers,'Content-Type':'application/json'};
  const get=async path=>{const r=await fetch(identity.url+'/rest/v1/'+path,{headers});if(!r.ok)throw Error('Install the mail SQL migration before using connected mail.');return r.json();};
  if(request.method==='GET'){
   const params=new URL(request.url).searchParams;
   if(params.get('scope')==='mailbox')return json({messages:await get('studio_mail?select=id,project_id,direction,status,recipient,subject,body,detail,created_at,accepted_at&order=created_at.desc&limit=200')});
   const id=params.get('project');if(!id||id.length>200)return json({error:'Project required'},400);
   return json({messages:await get('studio_mail?project_id=eq.'+encodeURIComponent(id)+'&order=created_at.desc&limit=100')});
  }
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
  const raw=await request.text();if(raw.length>35000)return json({error:'Email too large'},413);const body=JSON.parse(raw);
  if(typeof body.cancel==='string'&&/^[0-9a-f-]{36}$/i.test(body.cancel)){
   const r=await fetch(identity.url+'/rest/v1/rpc/studio_cancel_mail',{method:'POST',headers,body:JSON.stringify({mail_id:body.cancel})});
   if(!r.ok||await r.json()!==true)return json({error:'Could not cancel: worker may already have claimed this email. Check status and mailbox.'},409);
   return json({cancelled:true});
  }
  if(body.bounce){
   if(typeof body.bounce!=='string'||!/^[-0-9a-f]{36}$/i.test(body.bounce)||body.confirmed!==true||typeof body.reason!=='string'||body.reason.trim().length<10||body.reason.length>4000)return json({error:'Confirm an actual delivery-failure notice and enter its reason (10–4000 characters).'},400);
   const r=await fetch(identity.url+'/rest/v1/rpc/studio_record_bounce',{method:'POST',headers,body:JSON.stringify({mail_id:body.bounce,reason:body.reason.trim()})});
   if(!r.ok)return json({error:'Could not record delivery failure. Install mail-delivery.sql in Supabase, then refresh status.'},409);
   if(await r.json()!==true)return json({error:'Only your own Gmail-accepted outbound message can be marked bounced. Refresh status.'},409);
   return json({recorded:true});
  }
  if(env.GMAIL_ENABLED!=='true')return json({error:'Gmail sending is disabled. Connect and enable Gmail first.'},503);
  if((body.approved!==true&&body.preflight!==true)||typeof body.project!=='string')return json({error:'Explicit approval required'},400);
  const workspaces=await get('studio_workspaces?select=owner_id,projects');const workspace=workspaces[0];const p=workspace?.projects?.find(x=>x.id===body.project);
  if(!p)return json({error:'Save the project first'},400);
  if(['Do not contact','Not interested'].includes(p.stage))return json({error:'Outreach blocked'},403);
  if(!['demo','facts','contact','eligibility','email'].every(k=>p.checks?.[k]))return json({error:'Save the final draft and complete all five review checks first.'},400);
  const text=p.outreachDraft||'';
  if(!body.preflight&&text!==body.draft)return json({error:'Draft differs from the saved, reviewed version. Save it, review it and try again.'},409);
  if(!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(p.email||'')||!text.trim()||/\[[^\]]+\]/.test(text))return json({error:'Verify the recipient and replace placeholders first.'},400);
  const lines=text.split('\n'),subject=lines.shift().replace(/^Subject:\s*/i,'').trim(),content=lines.join('\n').trim();
  if(!subject||subject.length>250||/[\r\n]/.test(subject)||!content)return json({error:'A subject line and body are required.'},400);
  let presentation;
  try{presentation=globalThis.StudioEmail.render(p,text);}catch(e){return json({error:e.message},400);}
  if(presentation.html&&p.mailPresentation?.templateVersion!==presentation.config.version)return json({error:'The demo screenshots have changed. Save appearance and review the updated preview before sending.'},409);
  if(body.presentation&&JSON.stringify(body.presentation)!==JSON.stringify(presentation.config))return json({error:'Email appearance changed. Save and review the final preview first.'},409);
  if(!body.preflight&&presentation.html&&!body.presentation)return json({error:'Review the formatted preview before sending.'},400);
  const existing=await get('studio_mail?project_id=eq.'+encodeURIComponent(p.id)+'&select=*');
  if(existing.some(m=>m.direction==='inbound'))return json({error:'A reply is recorded. Review the conversation in your mailbox; automated outreach is paused.'},409);
  const retry=body.retry?existing.find(m=>m.id===body.retry&&m.status==='queued'&&m.direction==='outbound'):null;
  if(!body.preflight&&existing.some(m=>['queued','sending','uncertain'].includes(m.status)&&(!retry||m.id!==retry.id)))return json({error:'A send is pending or uncertain. Check its status and your mailbox before trying again.'},409);
  if(body.retry&&body.resendOf&&body.resendOf!==retry?.resend_of)return json({error:'Queued retry does not belong to this delivery-failure record.'},409);
  const resendId=body.resendOf||retry?.resend_of||null;
  const parent=resendId?existing.find(m=>m.id===resendId&&m.direction==='outbound'&&m.status==='bounced'):null;
  if(existing.some(m=>m.direction==='outbound'&&m.status==='bounced')&&!parent)return json({error:'Choose the recorded delivery failure to prepare a linked resend.'},409);
  if(resendId&&!parent)return json({error:'Resend requires a recorded delivery failure on this prospect.'},409);
  if(parent&&existing.some(m=>m.resend_of===parent.id&&!['failed','bounced'].includes(m.status)&&m.id!==retry?.id))return json({error:'A replacement attempt already exists. Review its status instead of sending another.'},409);
  if(existing.some(m=>m.direction==='outbound'&&m.status==='accepted')||(p.sentAt&&!parent))return json({error:'First contact was already sent. Record a genuine delivery failure before preparing a resend; handle normal follow-ups in Gmail.'},409);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p.id+'\n'+p.email.toLowerCase()+'\n'+text+'\n'+JSON.stringify(presentation.config)+(parent?'\nresend:'+parent.id:'')));
  const dedupe=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
  if(body.preflight){await prepareGmail(env,{owner_id:workspace.owner_id,project_id:p.id,recipient:p.email,subject,body:content,html_body:presentation.html,presentation:presentation.config});return json({ready:true,message:'Gmail connection, From identity, saved draft, embedded images and reply check passed. No email was queued or sent.'});}
  if(body.retry){if(!retry||retry.dedupe!==dedupe)return json({error:'Queued email differs from this reviewed version. No retry performed.'},409);try{return json({message:retry,send:await sendGmail(env,retry)});}catch(e){try{await recordQueuedError(env,retry.id,e);}catch{}return json({error:e.status?e.message:'Retry stopped before sending. Check status.'},e.status||503);}}
  const prepared=await prepareGmail(env,{owner_id:workspace.owner_id,project_id:p.id,recipient:p.email,subject,body:content,html_body:presentation.html,presentation:presentation.config});
  const r=await fetch(identity.url+'/rest/v1/studio_mail',{method:'POST',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({owner_id:workspace.owner_id,project_id:p.id,direction:'outbound',recipient:p.email,subject,body:content,dedupe,status:'queued',...(parent?{resend_of:parent.id}:{}),...(presentation.html?{html_body:presentation.html,presentation:presentation.config}:{})})});
  if(r.status===409)return json({error:'This exact message has already been queued. Refresh mail status.'},409);
  if(!r.ok)throw Error('Could not queue email. For resends, install mail-delivery.sql and refresh status. Nothing was sent by this request.');
  const queued=(await r.json())[0];
  try{return json({message:queued,send:await sendGmail(env,queued,prepared)});}
  catch(e){try{await recordQueuedError(env,queued.id,e);}catch{}return json({queued:true,error:e.status?e.message:'Send did not complete. Check status before retrying; the queued record is retained.'},e.status||503);}
 }catch(e){return json({error:e.status?e.message:'Mail request failed. Check setup and refresh status before retrying.'},e.status||503);}
}
