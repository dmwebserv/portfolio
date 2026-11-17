/* Supabase REST adapter. Public project key only; database RLS is the boundary. */
(()=>{
 const cfg=window.HUB_CONFIG;
 if(!cfg?.supabaseUrl||!cfg?.supabaseKey)return;
 const base=new URL(cfg.supabaseUrl).origin,key=cfg.supabaseKey,slot='studio-auth:'+base;
 let refreshing=null;
 function read(){try{return JSON.parse(localStorage.getItem(slot)||'null');}catch{return null;}}
 function store(s){if(!s.expires_at&&s.expires_in)s.expires_at=Math.floor(Date.now()/1000)+s.expires_in;localStorage.setItem(slot,JSON.stringify(s));return s;}
 async function call(path,{method='GET',body,token,prefer}={}){
  const headers={apikey:key};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;if(prefer)headers.Prefer=prefer;
  const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('Unexpected response from the cloud service.');}
  if(!r.ok){const e=Error(data?.msg||data?.message||data?.error_description||'Cloud request failed');e.status=r.status;throw e;}return data;
 }
 async function session(){
  const s=read();if(!s?.access_token)throw Object.assign(Error('Sign in required'),{status:401});
  if(s.expires_at*1000>Date.now()+60000)return s;
  if(!refreshing)refreshing=call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh_token}}).then(store).catch(e=>{localStorage.removeItem(slot);throw e;}).finally(()=>refreshing=null);
  return refreshing;
 }
 async function authCall(path,options={}){const s=await session();return call(path,{...options,token:s.access_token});}
 window.StudioCloud={
  async api(path,body){const s=await session();const r=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+s.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error||'Studio service failed');return data;},
  async login(email,password){return store(await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}}));},
  async logout(){try{await authCall('/auth/v1/logout',{method:'POST'});}finally{localStorage.removeItem(slot);}},
  async load(){
   const s=await session();const user=await call('/auth/v1/user',{token:s.access_token});this.owner=user.id;
   let rows=await authCall('/rest/v1/studio_workspaces?select=version,projects&owner_id=eq.'+encodeURIComponent(user.id));
   if(!rows.length){
    try{await authCall('/rest/v1/studio_workspaces',{method:'POST',body:{owner_id:user.id,version:0,projects:[]}});}catch(e){if(e.status!==409)throw Error('This account is not authorised yet. Complete the owner allowlist setup in Supabase.');}
    rows=await authCall('/rest/v1/studio_workspaces?select=version,projects&owner_id=eq.'+encodeURIComponent(user.id));
   }
   if(rows.length!==1)throw Error('Workspace access denied. Check the owner allowlist.');return rows[0];
  },
  async save(version,projects){
   const rows=await authCall('/rest/v1/studio_workspaces?owner_id=eq.'+encodeURIComponent(this.owner)+'&version=eq.'+version,{method:'PATCH',body:{projects,version:version+1},prefer:'return=representation'});
   if(!rows?.length)throw Error('Workspace changed on another device, or access was removed. Export your edits, then reload.');return {version:rows[0].version};
  }
 };
})();
