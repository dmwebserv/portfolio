import {owner,json} from '../../hub/cloud/ai-service.js';
import {sendGmail} from '../../hub/cloud/gmail-service.js';
export async function onRequest({request,env}){
 try{
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
  if(request.method==='POST'&&request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Same origin required'},403);
  const identity=await owner(request,env),headers={...identity.headers,'Content-Type':'application/json'};
  const get=async path=>{const r=await fetch(identity.url+'/rest/v1/'+path,{headers});if(!r.ok)throw Error('Install the mail SQL migration before using connected mail.');return r.json();};
  if(request.method==='GET'){
   const id=new URL(request.url).searchParams.get('project');if(!id||id.length>200)return json({error:'Project required'},400);
   return json({messages:await get('studio_mail?project_id=eq.'+encodeURIComponent(id)+'&order=created_at.desc&limit=100')});
  }
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
  const raw=await request.text();if(raw.length>35000)return json({error:'Email too large'},413);const body=JSON.parse(raw);
  if(typeof body.cancel==='string'&&/^[0-9a-f-]{36}$/i.test(body.cancel)){
   const r=await fetch(identity.url+'/rest/v1/rpc/studio_cancel_mail',{method:'POST',headers,body:JSON.stringify({mail_id:body.cancel})});
   if(!r.ok||await r.json()!==true)return json({error:'Could not cancel: worker may already have claimed this email. Check status and mailbox.'},409);
   return json({cancelled:true});
  }
  if(env.GMAIL_ENABLED!=='true')return json({error:'Gmail sending is disabled. Connect and enable Gmail first.'},503);
  if(body.approved!==true||typeof body.project!=='string')return json({error:'Explicit approval required'},400);
  const workspaces=await get('studio_workspaces?select=owner_id,projects');const workspace=workspaces[0];const p=workspace?.projects?.find(x=>x.id===body.project);
  if(!p)return json({error:'Save the project first'},400);
  if(['Do not contact','Not interested'].includes(p.stage))return json({error:'Outreach blocked'},403);
  if(!['demo','facts','contact','eligibility','email'].every(k=>p.checks?.[k]))return json({error:'Save the final draft and complete all five review checks first.'},400);
  const text=p.outreachDraft||'';
  if(text!==body.draft)return json({error:'Draft differs from the saved, reviewed version. Save it, review it and try again.'},409);
  if(!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(p.email||'')||!text.trim()||/\[[^\]]+\]/.test(text))return json({error:'Verify the recipient and replace placeholders first.'},400);
  const lines=text.split('\n'),subject=lines.shift().replace(/^Subject:\s*/i,'').trim(),content=lines.join('\n').trim();
  if(!subject||subject.length>250||/[\r\n]/.test(subject)||!content)return json({error:'A subject line and body are required.'},400);
  const existing=await get('studio_mail?project_id=eq.'+encodeURIComponent(p.id)+'&select=direction,status');
  if(existing.some(m=>m.direction==='inbound'))return json({error:'A reply is recorded. Review the conversation in your mailbox; automated outreach is paused.'},409);
  if(existing.some(m=>['queued','sending','uncertain'].includes(m.status)))return json({error:'A send is pending or uncertain. Check its status and your mailbox before trying again.'},409);
  if(existing.filter(m=>m.direction==='outbound'&&m.status==='accepted').length||p.sentAt)return json({error:'First-contact sending only for now. Handle follow-ups and replies in your mailbox.'},409);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p.id+'\n'+p.email.toLowerCase()+'\n'+text));
  const dedupe=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
  const r=await fetch(identity.url+'/rest/v1/studio_mail',{method:'POST',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({owner_id:workspace.owner_id,project_id:p.id,direction:'outbound',recipient:p.email,subject,body:content,dedupe,status:'queued'})});
  if(r.status===409)return json({error:'This exact message has already been queued. Refresh mail status.'},409);
  if(!r.ok)throw Error('Could not queue email. Nothing was sent by this request.');
  const queued=(await r.json())[0];
  try{return json({message:queued,send:await sendGmail(env,queued)});}
  catch(e){return json({queued:true,error:e.status?e.message:'Send did not complete. Check status before retrying; the queued record is retained.'},e.status||503);}
 }catch(e){return json({error:e.status?e.message:'Mail request failed. Check setup and refresh status before retrying.'},e.status||503);}
}
