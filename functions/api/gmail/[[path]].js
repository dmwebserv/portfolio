import {owner,json} from '../../../hub/cloud/ai-service.js';
import {config,db,seal,open,random,challenge,exchange,scopes,verifySender,account,syncGmail} from '../../../hub/cloud/gmail-service.js';
const cookieName='__Secure-studio-gmail';
const cookie=(value,age=600)=>`${cookieName}=${value}; Path=/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function onRequest({request,env}){
 const route=new URL(request.url).pathname.split('/').pop();
 try{
  const cfg=config(env);if(new URL(request.url).origin!==cfg.origin)return json({error:'Use the configured production Studio address for Gmail.'},403);
  if(route==='callback'){
   if(request.method!=='GET')return json({error:'GET required'},405);
   const redirect=status=>new Response(null,{status:303,headers:{Location:cfg.origin+'/?gmail='+status,'Set-Cookie':cookie('',0),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
   try{
    const sealed=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    if(!sealed)return redirect('failed');const state=await open(env,sealed),params=new URL(request.url).searchParams;
    if(state.expires<Date.now()||params.get('state')!==state.nonce||!params.get('code')||params.has('error'))return redirect('failed');
    const allowed=await db(env,'studio_owners?user_id=eq.'+encodeURIComponent(state.owner));if(allowed.length!==1)return redirect('failed');
    const tokens=await exchange(env,{grant_type:'authorization_code',code:params.get('code'),redirect_uri:cfg.origin+'/api/gmail/callback',code_verifier:state.verifier});
    if(!tokens.refresh_token||!scopes.every(s=>tokens.scope?.split(' ').includes(s)))return redirect('failed');
    const profile=await verifySender(env,tokens.access_token);
    // Upsert account while keeping tokens completely inaccessible to browser roles.
    const rows=await db(env,'studio_gmail_accounts?owner_id=eq.'+encodeURIComponent(state.owner));
    const data={owner_id:state.owner,mailbox:profile.emailAddress,token_cipher:await seal(env,{refresh_token:tokens.refresh_token}),connected_at:new Date().toISOString(),last_sync_at:null};
    await db(env,'studio_gmail_accounts'+(rows.length?'?owner_id=eq.'+encodeURIComponent(state.owner):''),{method:rows.length?'PATCH':'POST',body:data});
    return redirect('connected');
   }catch{return redirect('failed');}
  }
  const identity=await owner(request,env);
  const res=await fetch(identity.url+'/auth/v1/user',{headers:identity.headers,signal:AbortSignal.timeout(12000)});if(!res.ok)return json({error:'Sign in again'},401);const user=await res.json();
  if(request.method==='GET'&&route==='status'){
   const rows=await db(env,'studio_gmail_accounts?owner_id=eq.'+encodeURIComponent(user.id)+'&select=mailbox,connected_at,last_sync_at');
   return json({configured:true,connected:rows.length===1,enabled:env.GMAIL_ENABLED==='true',sender:cfg.sender,account:rows[0]||null});
  }
  if(request.method!=='POST'||request.headers.get('Origin')!==cfg.origin)return json({error:'Same-origin POST required'},403);
  if(route==='connect'){
   const nonce=random(),verifier=random();const state=await seal(env,{nonce,verifier,owner:user.id,expires:Date.now()+600000});
   const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:cfg.origin+'/api/gmail/callback',response_type:'code',scope:scopes.join(' '),access_type:'offline',prompt:'consent',state:nonce,code_challenge:await challenge(verifier),code_challenge_method:'S256',login_hint:cfg.mailbox}).toString();
   return new Response(JSON.stringify({url:url.href}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie(state)}});
  }
  if(route==='sync')return json(await syncGmail(env,user.id));
  if(route==='disconnect'){
   const rows=await db(env,'studio_gmail_accounts?owner_id=eq.'+encodeURIComponent(user.id));let revoked=false;
   try{if(rows.length){const token=await open(env,rows[0].token_cipher);const r=await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:token.refresh_token}),signal:AbortSignal.timeout(15000)});revoked=r.ok;}}catch{}
   await db(env,'studio_gmail_accounts?owner_id=eq.'+encodeURIComponent(user.id),{method:'DELETE'});
   return json({disconnected:true,revoked});
  }
  return json({error:'Not found'},404);
 }catch(e){return json({error:e.status?e.message:'Gmail operation failed. Check server setup; no automatic retry.'},e.status||503);}
}
