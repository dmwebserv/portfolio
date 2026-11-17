import {json} from '../../hub/cloud/ai-service.js';
import {db,syncGmail} from '../../hub/cloud/gmail-service.js';
export async function onRequestPost({request,env}){
 if(!env.MAIL_SYNC_SECRET||env.MAIL_SYNC_SECRET.length<32)return json({error:'Scheduled sync is disabled.'},503);
 const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [actual,expected]=await Promise.all([digest(request.headers.get('Authorization')||''),digest('Bearer '+env.MAIL_SYNC_SECRET)]);let difference=0;for(let i=0;i<32;i++)difference|=actual[i]^expected[i];if(difference)return json({error:'Forbidden'},403);
 try{
  const accounts=await db(env,'studio_gmail_accounts?select=owner_id&limit=2');
  if(accounts.length>1)return json({error:'This free-tier sync is limited to one owner mailbox.'},503);
  for(const a of accounts){const owners=await db(env,'studio_owners?user_id=eq.'+encodeURIComponent(a.owner_id));if(owners.length===1)await syncGmail(env,a.owner_id);}
  return json({ok:true});
 }catch{return json({error:'Gmail sync failed. Check the account connection in Studio.'},503);}
}
