import '../email-template.js';
import {emailAssets} from './email-assets.js';
// Server-only Gmail transport. Never import into a browser asset.
const scopes=['https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.settings.basic'];
export {scopes};
const fail=(message,status=503)=>Object.assign(Error(message),{status});
export function config(env){
 if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.MAIL_TOKEN_KEY||!(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY)||!env.GOOGLE_MAILBOX_EMAIL||!env.STUDIO_ORIGIN)throw fail('Gmail setup is incomplete. Configure server secrets first.');
 const origin=new URL(env.STUDIO_ORIGIN);if(origin.protocol!=='https:'||origin.origin!==env.STUDIO_ORIGIN)throw fail('STUDIO_ORIGIN must be the exact HTTPS Studio origin.');
 return {origin:origin.origin,sender:env.GOOGLE_SEND_AS_EMAIL||'danny@dmwebservices.co.uk',mailbox:env.GOOGLE_MAILBOX_EMAIL.toLowerCase()};
}
export async function db(env,path,{method='GET',body}={}){
 const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
 const base=env.SUPABASE_URL?.replace(/\/$/,'');if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)||!secret)throw fail('Mail database runtime configuration missing.');
 const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:secret,...(secret.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+secret}),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw fail('Mail database operation failed. Check migration and runtime configuration.');
 const text=await r.text();return text?JSON.parse(text):null;
}
function b64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function un64(value){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
async function key(env){const raw=un64(env.MAIL_TOKEN_KEY);if(raw.length!==32)throw fail('MAIL_TOKEN_KEY must encode 32 random bytes.');return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(env,data){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('studio-gmail-v1')},await key(env),new TextEncoder().encode(JSON.stringify(data)));return b64(iv)+'.'+b64(new Uint8Array(cipher));}
export async function open(env,text){const [iv,cipher]=text.split('.');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv),additionalData:new TextEncoder().encode('studio-gmail-v1')},await key(env),un64(cipher));return JSON.parse(new TextDecoder().decode(plain));}
export function random(){return b64(crypto.getRandomValues(new Uint8Array(32)));}
export async function challenge(value){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));}
export async function exchange(env,parameters){
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,...parameters}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw fail('Google authorisation failed. Reconnect Gmail; check OAuth app settings.');return r.json();
}
export async function gmail(token,path,{method='GET',body}={}){
 const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw fail('Gmail request failed. Check permissions, account connection and Google limits.');return r.json();
}
export async function account(env,owner){
 config(env);const rows=await db(env,'studio_gmail_accounts?owner_id=eq.'+encodeURIComponent(owner));
 if(rows?.length!==1)throw fail('Connect Gmail in the Connected mailbox section first.');
 if(rows[0].mailbox?.toLowerCase()!==config(env).mailbox)throw fail('Configured Google mailbox changed. Reconnect Gmail.');
 const stored=await open(env,rows[0].token_cipher),tokens=await exchange(env,{grant_type:'refresh_token',refresh_token:stored.refresh_token});
 return {row:rows[0],token:tokens.access_token};
}
export async function verifySender(env,token){
 const cfg=config(env),profile=await gmail(token,'profile');if(profile.emailAddress?.toLowerCase()!==cfg.mailbox)throw fail('The connected Google account is not the configured project mailbox.',403);
 const aliases=await gmail(token,'settings/sendAs');
 if(!aliases.sendAs?.some(a=>a.sendAsEmail.toLowerCase()===cfg.sender.toLowerCase()&&a.verificationStatus==='accepted'))throw fail('The domain From address must be a verified Gmail send-as identity.',403);
 return profile;
}
export async function update(env,id,body){return db(env,'studio_mail?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:{...body,updated_at:new Date().toISOString()}});}
export async function sendGmail(env,row){
 if(env.GMAIL_ENABLED!=='true')throw fail('Gmail sending is disabled. Complete setup and controlled testing first.');
 // Refresh/verify BEFORE claim. Failures here cannot have sent a message.
 const {token}=await account(env,row.owner_id);await verifySender(env,token);
 const work=await db(env,'studio_workspaces?owner_id=eq.'+encodeURIComponent(row.owner_id)+'&select=projects');
 const p=work?.[0]?.projects?.find(p=>p.id===row.project_id);
 const draft=(p?.outreachDraft||'').split('\n');
 if(!p||['Do not contact','Not interested'].includes(p.stage)||p.email!==row.recipient||draft[0].replace(/^Subject:\s*/i,'').trim()!==row.subject||draft.slice(1).join('\n').trim()!==row.body||!['demo','facts','contact','eligibility','email'].every(k=>p.checks?.[k]))throw fail('Saved draft, recipient or review status changed. Sending stopped.',409);
 const rendered=globalThis.StudioEmail.render(p,p.outreachDraft||'');
 if((row.html_body||'')!==rendered.html||(row.presentation&&(row.presentation.version!==1||JSON.stringify(globalThis.StudioEmail.settings({mailPresentation:row.presentation,demo:row.presentation.demo}))!==JSON.stringify(rendered.config))))throw fail('Formatted email changed after approval. Sending stopped.',409);
 const inline=[];
 if(rendered.html){
  for(const asset of rendered.assets){
   const expected=emailAssets[asset.file];if(!expected)throw fail('Unknown email asset.');
   const r=await fetch('https://dmwebservices.co.uk/images/email/'+asset.file,{redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!r.ok||Number(r.headers.get('Content-Length')||0)>500000)throw fail('Email image unavailable. Deploy the public email assets before sending.');
   const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>500000)throw fail('Email image too large.');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
   if(hash!==expected.sha256)throw fail('Email image changed since this template was prepared. Sending stopped.');
   inline.push({...asset,bytes});
  }
 }
 const replies=await db(env,'studio_mail?owner_id=eq.'+encodeURIComponent(row.owner_id)+'&project_id=eq.'+encodeURIComponent(row.project_id)+'&direction=eq.inbound&limit=1');
 if(replies.length)throw fail('Reply recorded. Review the conversation in Gmail before contacting again.',409);
 const claim=await db(env,'rpc/studio_claim_mail',{method:'POST',body:{mail_id:row.id}});if(!claim?.length)throw fail('Email already claimed. Check status before doing anything else.',409);
 const cfg=config(env),messageId='<'+crypto.randomUUID()+'@'+cfg.sender.split('@')[1]+'>';
 try{
  await update(env,row.id,{message_id:messageId,detail:'Gmail send attempt started. Do not resend.'});
  if(/[\r\n]/.test(row.subject+row.recipient+cfg.sender)||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(row.recipient))throw Error('Invalid mail headers');
  const subject=btoa(String.fromCharCode(...new TextEncoder().encode(row.subject)));
  const encode=value=>{const bytes=typeof value==='string'?new TextEncoder().encode(value):value;let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).match(/.{1,76}/g)?.join('\r\n')||'';};
  const headers='From: '+cfg.sender+'\r\nTo: '+row.recipient+'\r\nSubject: =?UTF-8?B?'+subject+'?=\r\nMessage-ID: '+messageId+'\r\nDate: '+new Date().toUTCString()+'\r\nMIME-Version: 1.0\r\n';
  let raw;
  if(!row.html_body)raw=headers+'Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+encode(row.body);
  else{
   const related='related_'+crypto.randomUUID(),alternative='alternative_'+crypto.randomUUID();
   const part=(type,value)=>'Content-Type: '+type+'; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+encode(value)+'\r\n';
   raw=headers+'Content-Type: multipart/related; boundary="'+related+'"\r\n\r\n--'+related+'\r\nContent-Type: multipart/alternative; boundary="'+alternative+'"\r\n\r\n--'+alternative+'\r\n'+part('text/plain',row.body)+'--'+alternative+'\r\n'+part('text/html',row.html_body)+'--'+alternative+'--\r\n';
   for(const asset of inline)raw+='--'+related+'\r\nContent-Type: '+asset.type+'\r\nContent-ID: <'+asset.cid+'>\r\nContent-Disposition: inline; filename="'+asset.file+'"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+encode(asset.bytes)+'\r\n';
   raw+='--'+related+'--\r\n';
  }
  const result=await gmail(token,'messages/send',{method:'POST',body:{raw:b64(new TextEncoder().encode(raw))}});
  if(!result.id||!result.threadId)throw Error('Missing send receipt');
  await update(env,row.id,{status:'accepted',accepted_at:new Date().toISOString(),gmail_id:result.id,thread_id:result.threadId,detail:'Gmail accepted the send request. This is not proof of delivery.'});
  try{const sent=await gmail(token,'messages/'+encodeURIComponent(result.id)+'?format=metadata&metadataHeaders=Message-ID');const actual=sent.payload?.headers?.find(h=>h.name.toLowerCase()==='message-id')?.value;if(actual)await update(env,row.id,{message_id:actual});}catch{}
  return {status:'accepted'};
 }catch{
  // Includes accepted-but-recording-failed. NEVER retry a claimed request.
  try{await update(env,row.id,{status:'uncertain',detail:'Send outcome uncertain. Check Gmail Sent before any manual retry.'});}catch{}
  return {status:'uncertain'};
 }
}
function decode(value=''){try{return new TextDecoder().decode(un64(value));}catch{return '';}}
function textPart(part){if(part?.mimeType==='text/plain'&&part.body?.data)return decode(part.body.data).slice(0,30000);for(const p of part?.parts||[]){const text=textPart(p);if(text)return text;}return '';}
export async function syncGmail(env,owner){
 if(env.GMAIL_ENABLED!=='true')throw fail('Gmail is disabled.');
 const {row:connection,token}=await account(env,owner);
 const sent=await db(env,'studio_mail?owner_id=eq.'+encodeURIComponent(owner)+'&direction=eq.outbound&status=in.(accepted,sending,uncertain)&order=gmail_checked_at.asc.nullsfirst&limit=5');
 const all=await db(env,'studio_mail?owner_id=eq.'+encodeURIComponent(owner)+'&direction=eq.inbound&select=gmail_id&limit=1000');const seen=new Set(all.map(m=>m.gmail_id));
 let imported=0;
 for(const outgoing of sent){
  let threadId=outgoing.thread_id;
  // Reconcile uncertain send from its pre-persisted RFC Message-ID. Never resend.
  if(!threadId&&outgoing.message_id){const found=await gmail(token,'messages?q='+encodeURIComponent('in:sent rfc822msgid:'+outgoing.message_id)+'&maxResults=2');if(found.messages?.length===1){const m=await gmail(token,'messages/'+found.messages[0].id+'?format=metadata');threadId=m.threadId;await update(env,outgoing.id,{status:'accepted',accepted_at:m.internalDate?new Date(Number(m.internalDate)).toISOString():outgoing.created_at,gmail_id:m.id,thread_id:threadId,detail:'Reconciled with Gmail Sent by Message-ID. Not proof of delivery.'});}}
  if(!threadId){await update(env,outgoing.id,{gmail_checked_at:new Date().toISOString()});continue;}
  const thread=await gmail(token,'threads/'+encodeURIComponent(threadId)+'?format=full');
  for(const message of thread.messages||[]){
   if(imported>=5)break;
   if(seen.has(message.id)||message.id===outgoing.gmail_id||message.labelIds?.includes('SENT')||message.labelIds?.includes('DRAFT'))continue;
   const headers=message.payload?.headers||[],header=name=>headers.find(h=>h.name.toLowerCase()===name.toLowerCase())?.value||'';
   const from=header('From'),sender=(from.match(/<([^<>]+)>/)?.[1]||from).trim().toLowerCase();
   const refs=header('In-Reply-To')+' '+header('References');
   if(sender!==outgoing.recipient.toLowerCase()||!outgoing.message_id||!refs.includes(outgoing.message_id))continue;
   const body=textPart(message.payload)||'[No plain-text body. Open this conversation in Gmail.]';
   await db(env,'studio_mail?on_conflict=owner_id,dedupe',{method:'POST',body:{owner_id:owner,project_id:outgoing.project_id,direction:'inbound',recipient:config(env).sender,subject:header('Subject').slice(0,250),body,dedupe:'gmail:'+message.id,message_id:header('Message-ID').slice(0,1000),status:'received',gmail_id:message.id,thread_id:threadId,detail:'Matched Gmail thread, reference headers and sender address; not sender-authenticity verification.'}});
   seen.add(message.id);imported++;
  }
  await update(env,outgoing.id,{gmail_checked_at:new Date().toISOString()});
 }
 await db(env,'studio_gmail_accounts?owner_id=eq.'+encodeURIComponent(owner),{method:'PATCH',body:{last_sync_at:new Date().toISOString()}});
 return {imported,lastSync:new Date().toISOString(),mailbox:connection.mailbox};
}

// Retain preflight diagnostics without overwriting a concurrent claim/send result.
export async function recordQueuedError(env,id,error){
 const detail='Preparation stopped: '+(error.status?error.message:'Preparation could not complete. Check stored status and Gmail Sent before retrying.');
 await db(env,'studio_mail?id=eq.'+encodeURIComponent(id)+'&status=eq.queued',{method:'PATCH',body:{detail:detail.slice(0,1000),updated_at:new Date().toISOString()}});
}
