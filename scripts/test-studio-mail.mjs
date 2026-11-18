import fs from 'node:fs';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
globalThis.crypto??=webcrypto;
const moduleURL='data:text/javascript;base64,'+Buffer.from(fs.readFileSync('hub/cloud/ai-service.js')).toString('base64');
const transport='data:text/javascript;base64,'+Buffer.from("export async function prepareGmail(){if(globalThis.__preflightFailure)throw Object.assign(Error('[images] Could not load the embedded images.'),{status:503});return {};} export async function sendGmail(){return {status:'accepted'};} export async function recordQueuedError(){}").toString('base64');
await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('hub/email-template.js')).toString('base64'));
const source=fs.readFileSync('functions/api/mail.js','utf8').replace('../../hub/cloud/ai-service.js',moduleURL).replace('../../hub/cloud/gmail-service.js',transport).replace("import '../../hub/email-template.js';",'');
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public',GMAIL_ENABLED:'true'};
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
// Branded emails store a server-rendered snapshot, never browser-supplied HTML.
p.stage='Demo ready';p.name='Shibiao Fastener';p.demo='/demos/lfastener/';p.mailPresentation={format:'branded',postalAddress:'Test business address',templateVersion:2};p.outreachDraft=globalThis.StudioEmail.introduction(p,p.mailPresentation.postalAddress);
const snapshot=globalThis.StudioEmail.render(p,p.outreachDraft);
mock([...auth(),[{owner_id:'owner',projects:[p]}],[],[{id:'new-formatted'}]]);assert.equal((await onRequest({request:request({...input(),presentation:snapshot.config,html:'<script>browser supplied</script>'}),env})).status,200);const stored=JSON.parse(calls.at(-1).o.body);assert.equal(stored.html_body,snapshot.html);assert(!stored.html_body.includes('<script>'));assert.equal(stored.presentation.format,'branded');
mock([...auth(),[{owner_id:'owner',projects:[p]}]]);assert.equal((await onRequest({request:request({...input(),presentation:{...snapshot.config,postalAddress:'Changed'}}),env})).status,409);
const queuedRow={...stored,id:'queued-retry'};mock([...auth(),[{owner_id:'owner',projects:[p]}],[queuedRow]]);assert.equal((await onRequest({request:request({...input(),presentation:snapshot.config,retry:queuedRow.id}),env})).status,200);assert(!calls.some(c=>c.o.method==='POST'&&c.u.endsWith('/studio_mail')));
console.log('PASS: formatted snapshot created server-side, appearance drift rejected, exact queued-only retry requires fresh approval.');

// The central mailbox uses the same authenticated owner/RLS access and bounded projection.
mock([...auth(),[]]);const mailbox=await onRequest({request:new Request('https://studio.example/api/mail?scope=mailbox',{headers:{Authorization:'Bearer fake-token'}}),env});assert.equal(mailbox.status,200);assert.deepEqual((await mailbox.json()).messages,[]);assert(calls.at(-1).u.includes('limit=200'));assert(calls.at(-1).u.includes('select=id,project_id'));assert(!calls.at(-1).u.includes('select=*'));
console.log('PASS: owner-authenticated mailbox query is bounded, excludes HTML and does not send mail.');

// Dry-run diagnoses an existing queued draft without inserting, claiming or sending.
mock([...auth(),[{owner_id:'owner',projects:[p]}],[{id:'old',direction:'outbound',status:'queued'}]]);
const check=await onRequest({request:request({project:'p',preflight:true}),env});assert.equal(check.status,200);assert.equal((await check.json()).ready,true);assert(!calls.some(c=>c.o.method==='POST'));
// New sends fail preflight BEFORE creating another durable queue record.
globalThis.__preflightFailure=true;mock([...auth(),[{owner_id:'owner',projects:[p]}],[]]);
const stopped=await onRequest({request:request({...input(),presentation:globalThis.StudioEmail.settings(p)}),env});assert.equal(stopped.status,503);assert((await stopped.json()).error.includes('[images]'));assert(!calls.some(c=>c.u.endsWith('/rest/v1/studio_mail')&&c.o.method==='POST'));delete globalThis.__preflightFailure;
console.log('PASS: safe readiness check for queued records, and preparation failures create no new queued send.');
// Owner reporting a real bounce is explicit and does not call the transport.
const bounceId='11111111-1111-4111-8111-111111111111';
mock([...auth(),true]);assert.equal((await onRequest({request:request({bounce:bounceId,confirmed:true,reason:'550 5.7.0 DT:SPM rejected by recipient server'}),env})).status,200);assert(calls.at(-1).u.includes('studio_record_bounce'));assert.equal(JSON.parse(calls.at(-1).o.body).mail_id,bounceId);
mock(auth());assert.equal((await onRequest({request:request({bounce:bounceId,reason:'550 rejected',confirmed:false}),env})).status,400);
const bounced={id:bounceId,direction:'outbound',status:'bounced',recipient:p.email,bounce_reason:'550 policy rejection'};
p.sentAt='2026-11-12';
mock([...auth(),[{owner_id:'owner',projects:[p]}],[bounced],[{id:'replacement'}]]);const replacement=await onRequest({request:request({...input(),resendOf:bounceId,presentation:globalThis.StudioEmail.settings(p)}),env});assert.equal(replacement.status,200);const savedReplacement=JSON.parse(calls.at(-1).o.body);assert.equal(savedReplacement.resend_of,bounceId);assert.equal(savedReplacement.status,'queued');const resendDedupe=savedReplacement.dedupe;
mock([...auth(),[{owner_id:'owner',projects:[p]}],[bounced]]);assert.equal((await onRequest({request:request({...input(),presentation:globalThis.StudioEmail.settings(p)}),env})).status,409);
for(const obstacle of [{direction:'inbound',status:'received'},{direction:'outbound',status:'uncertain'},{direction:'outbound',status:'accepted'},{direction:'outbound',status:'queued',resend_of:bounceId}]){
 mock([...auth(),[{owner_id:'owner',projects:[p]}],[bounced,obstacle]]);assert.equal((await onRequest({request:request({...input(),resendOf:bounceId,presentation:globalThis.StudioEmail.settings(p)}),env})).status,409);
}
p.stage='Do not contact';mock([...auth(),[{owner_id:'owner',projects:[p]}]]);assert.equal((await onRequest({request:request({...input(),resendOf:bounceId}),env})).status,403);p.stage='Demo ready';
// A queued linked replacement keeps its dedupe/retry identity; it is not a fresh attempt.
mock([...auth(),[{owner_id:'owner',projects:[p]}],[bounced,{id:'replacement',resend_of:bounceId,direction:'outbound',status:'queued',dedupe:resendDedupe}]]);assert.equal((await onRequest({request:request({...input(),retry:'replacement',resendOf:bounceId,presentation:globalThis.StudioEmail.settings(p)}),env})).status,200);
console.log('PASS: explicit bounce reporting, linked fresh resend and queued retry; existing acceptance/uncertainty/reply/opt-out guards remain enforced.');
