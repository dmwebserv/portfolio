import {json} from '../../hub/cloud/ai-service.js';
import {db,syncGmail} from '../../hub/cloud/gmail-service.js';
const problem=(code,error,status=503)=>json({code,error},status);
export async function onRequestPost({request,env}){
 if(!env.MAIL_SYNC_SECRET||env.MAIL_SYNC_SECRET.length<32)return problem('SYNC_DISABLED','Scheduled sync is disabled.');
 const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [actual,expected]=await Promise.all([digest(request.headers.get('Authorization')||''),digest('Bearer '+env.MAIL_SYNC_SECRET)]);let difference=0;for(let i=0;i<32;i++)difference|=actual[i]^expected[i];if(difference)return problem('SYNC_UNAUTHORIZED','Forbidden',403);
 let accounts;
 try{accounts=await db(env,'studio_gmail_accounts?select=owner_id&limit=2');}
 catch{return problem('SYNC_DATABASE_FAILED','Mail database check failed.');}
 if(!accounts.length)return problem('SYNC_ACCOUNT_MISSING','No connected Gmail account.');
 if(accounts.length>1)return problem('SYNC_MULTIPLE_ACCOUNTS','This free-tier sync is limited to one owner mailbox.');
 for(const a of accounts){
  let owners;
  try{owners=await db(env,'studio_owners?user_id=eq.'+encodeURIComponent(a.owner_id));}
  catch{return problem('SYNC_DATABASE_FAILED','Mail owner database check failed.');}
  if(owners.length!==1)return problem('SYNC_OWNER_DENIED','Mailbox owner not authorised.',403);
  try{await syncGmail(env,a.owner_id);}
  catch{return problem('SYNC_GMAIL_FAILED','Gmail sync failed. Check the account connection in Studio.');}
 }
 return json({ok:true});
}
