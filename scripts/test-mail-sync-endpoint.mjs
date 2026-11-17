import fs from 'node:fs';import assert from 'node:assert/strict';import{webcrypto}from'node:crypto';globalThis.crypto??=webcrypto;
const enc=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const source=fs.readFileSync('functions/api/mail-sync.js','utf8').replace('../../hub/cloud/ai-service.js',enc('export const json=(x,status=200)=>new Response(JSON.stringify(x),{status});')).replace('../../hub/cloud/gmail-service.js',enc('export const db=(...args)=>globalThis.testDb(...args);export const syncGmail=(...args)=>globalThis.testSync(...args);'));
const{onRequestPost}=await import(enc(source));const secret='x'.repeat(40),env={MAIL_SYNC_SECRET:secret};const req=(token=secret)=>new Request('https://studio.example/api/mail-sync',{method:'POST',headers:{Authorization:'Bearer '+token}});
async function expect(code,setup,extra={}){let calls=0;globalThis.testDb=async()=>{calls++;return setup(calls);};globalThis.testSync=async()=>{};const r=await onRequestPost({request:req(extra.token),env:extra.env||env});const body=await r.json();assert.equal(body.code,code);return calls;}
assert.equal(await expect('SYNC_UNAUTHORIZED',()=>{throw Error('must not call')},{token:'wrong'}),0);
await expect('SYNC_DISABLED',()=>[],{env:{}});
await expect('SYNC_DATABASE_FAILED',()=>{throw Error('private provider payload')});
await expect('SYNC_ACCOUNT_MISSING',()=>[]);
await expect('SYNC_MULTIPLE_ACCOUNTS',()=>[{owner_id:'a'},{owner_id:'b'}]);
await expect('SYNC_OWNER_DENIED',n=>n===1?[{owner_id:'a'}]:[]);
globalThis.testDb=async(_env,path)=>path.includes('studio_gmail_accounts')?[{owner_id:'a'}]:[{user_id:'a'}];globalThis.testSync=async()=>{throw Error('private message contents')};const fail=await onRequestPost({request:req(),env});assert.equal((await fail.json()).code,'SYNC_GMAIL_FAILED');
globalThis.testSync=async()=>{};const ok=await onRequestPost({request:req(),env});assert.equal((await ok.json()).ok,true);
console.log('PASS: scheduled endpoint diagnostics, auth gates and empty/denied accounts fail closed. Mocked only.');
