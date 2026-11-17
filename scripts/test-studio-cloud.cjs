// Offline adapter contract tests, no credentials or external requests.
// Run: node scripts/test-studio-cloud.cjs
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function context(replies){const map=new Map(),calls=[];const c={URL,Date,JSON,Error,localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},window:{HUB_CONFIG:{supabaseUrl:'https://test.supabase.co',supabaseKey:'sb_publishable_test'}},fetch:async(url,opts)=>{calls.push({url,...opts});const [status,body]=replies.shift();return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};}};vm.createContext(c);vm.runInContext(fs.readFileSync('hub/cloud/adapter.js','utf8'),c);return {api:c.window.StudioCloud,calls};}
(async()=>{
 const auth={access_token:'test-token',refresh_token:'test-refresh',expires_in:3600};
 const {api,calls}=context([[200,auth],[200,{id:'owner-test'}],[200,[{version:3,projects:[]}]],[200,[{version:4}]],[200,[]],[200,{}]]);
 await api.login('owner@example.test','not-a-real-password');assert.equal((await api.load()).version,3);assert.equal((await api.save(3,[])).version,4);await assert.rejects(api.save(3,[]),/Workspace changed/);assert(calls[3].url.includes('version=eq.3'));assert.equal(calls[3].headers.Authorization,'Bearer test-token');await api.logout();await assert.rejects(api.load(),/Sign in required/);
 const denied=context([[200,auth],[200,{id:'not-allowed'}],[200,[]],[403,{message:'new row violates row-level security policy'}]]).api;
 await denied.login('other@example.test','test-only');await assert.rejects(denied.load(),/not authorised/);
 console.log('PASS: password login, token storage, owner lookup, versioned save, conflict, logout and denied-owner handling (mocked API).');
})().catch(e=>{console.error(e);process.exitCode=1;});
