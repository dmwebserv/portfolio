import fs from 'node:fs';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
globalThis.crypto??=webcrypto;
const moduleURL='data:text/javascript;base64,'+Buffer.from(fs.readFileSync('hub/cloud/ai-service.js')).toString('base64');
const source=fs.readFileSync('functions/api/mail.js','utf8').replace('../../hub/cloud/ai-service.js',moduleURL);
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public'};
const p={id:'p',email:'test@example.com',stage:'Demo ready',outreachDraft:'Subject: Hello\n\nA reviewed email.',checks:{demo:true,facts:true,contact:true,eligibility:true,email:true}};
const input=()=>({project:'p',approved:true,draft:p.outreachDraft});
let calls=[];function mock(replies){calls=[];globalThis.fetch=async(u,o={})=>{calls.push({u,o});assert(replies.length,'Unexpected external call');return new Response(JSON.stringify(replies.shift()),{status:200});};}
function request(body=input(),origin='https://studio.example'){return new Request('https://studio.example/api/mail',{method:'POST',headers:{Origin:origin,Authorization:'Bearer fake-token','Content-Type':'application/json'},body:JSON.stringify(body)});}
const auth=()=>[{id:'owner'},[{user_id:'owner'}]];
mock([]);assert.equal((await onRequest({request:request(input(),'https://evil.example'),env})).status,403);
mock([...auth(),[{owner_id:'owner',projects:[p]}],[],[{id:'queued'}]]);assert.equal((await onRequest({request:request(),env})).status,200);const queued=JSON.parse(calls.at(-1).o.body);assert.equal(queued.status,'queued');assert.equal(queued.subject,'Hello');assert.equal(queued.owner_id,'owner');assert.equal(queued.dedupe.length,64);
mock([...auth(),[{owner_id:'owner',projects:[p]}]]);assert.equal((await onRequest({request:request({...input(),draft:'Unsaved edit'}),env})).status,409);
for(const status of ['queued','sending','uncertain','accepted']){mock([...auth(),[{owner_id:'owner',projects:[p]}],[{direction:'outbound',status}]]);assert.equal((await onRequest({request:request(),env})).status,409);}
mock([...auth(),[{owner_id:'owner',projects:[p]}],[{direction:'inbound',status:'received'}]]);assert.equal((await onRequest({request:request(),env})).status,409);
p.stage='Do not contact';mock([...auth(),[{owner_id:'owner',projects:[p]}]]);assert.equal((await onRequest({request:request(),env})).status,403);
console.log('PASS: mail same-origin, saved/reviewed snapshot, duplicate/pending/replied/opt-out guards. All external calls mocked; no mail sent.');
