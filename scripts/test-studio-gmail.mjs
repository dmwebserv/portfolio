// No live Google calls, authorisation or mailbox used.
import fs from 'node:fs';import assert from 'node:assert/strict';import{webcrypto}from'node:crypto';globalThis.crypto??=webcrypto;
const url=path=>{let source=fs.readFileSync(path,'utf8');if(path==='hub/cloud/gmail-service.js')source=source.replace('../email-template.js',url('hub/email-template.js')).replace('./email-assets.js',url('hub/cloud/email-assets.js'));return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');};
const g=await import(url('hub/cloud/gmail-service.js'));
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'server-test',MAIL_TOKEN_KEY:Buffer.alloc(32,9).toString('base64'),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'server-only',GOOGLE_MAILBOX_EMAIL:'project@gmail.com',GOOGLE_SEND_AS_EMAIL:'danny@example.com',STUDIO_ORIGIN:'https://studio.example',GMAIL_ENABLED:'true'};
const cipher=await g.seal(env,{refresh_token:'private-refresh-token'});assert(!cipher.includes('private-refresh-token'));assert.equal((await g.open(env,cipher)).refresh_token,'private-refresh-token');await assert.rejects(()=>g.open(env,cipher.slice(0,-3)+'bad'));
let calls=[];function mock(replies){calls=[];globalThis.fetch=async(u,o={})=>{calls.push({u,o});assert(replies.length,'Unexpected network request');const [status,data]=replies.shift();return new Response(Buffer.isBuffer(data)?data:JSON.stringify(data),{status});};}
const row={id:'message',owner_id:'owner',project_id:'p',recipient:'prospect@example.com',subject:'An idea — £295',body:'Plain text only'};
const project={id:'p',email:row.recipient,stage:'Demo ready',outreachDraft:'Subject: '+row.subject+'\n\n'+row.body,checks:{demo:true,facts:true,contact:true,eligibility:true,email:true}};
const preflight=()=>[[200,[{token_cipher:cipher,mailbox:'project@gmail.com'}]],[200,{access_token:'short-lived'}],[200,{emailAddress:'project@gmail.com'}],[200,{sendAs:[{sendAsEmail:'danny@example.com',verificationStatus:'accepted'}]}],[200,[{projects:[project]}]],[200,[]],[200,[row]]];
mock([...preflight(),[200,[row]],[200,{id:'gmail-id',threadId:'thread'}],[200,[row]],[200,{payload:{headers:[{name:'Message-ID',value:'<actual@example.com>'}]}}],[200,[row]]]);
assert.equal((await g.sendGmail(env,row)).status,'accepted');const send=calls.find(c=>c.u.endsWith('/messages/send'));assert(send);const raw=Buffer.from(JSON.parse(send.o.body).raw,'base64url').toString('utf8');assert(raw.includes('From: danny@example.com'));assert(raw.includes('Subject: =?UTF-8?B?'));assert(!JSON.stringify(send.o).includes('private-refresh-token'));
mock([...preflight(),[200,[row]],[500,{error:'provider detail not returned'}],[200,[row]]]);assert.equal((await g.sendGmail(env,row)).status,'uncertain');assert.equal(calls.filter(c=>c.u.endsWith('/messages/send')).length,1);
project.stage='Do not contact';mock(preflight().slice(0,5));await assert.rejects(()=>g.sendGmail(env,row));assert(!calls.some(c=>c.u.endsWith('/messages/send')));project.stage='Demo ready';
mock([[200,{emailAddress:'wrong@gmail.com'}]]);await assert.rejects(()=>g.verifySender(env,'token'));assert.equal(calls.length,1);
// Exercise cookie state/PKCE start without exposing a token to browser.
const aiURL=url('hub/cloud/ai-service.js'),gmailURL=url('hub/cloud/gmail-service.js');
let source=fs.readFileSync('functions/api/gmail/[[path]].js','utf8').replace('../../../hub/cloud/ai-service.js',aiURL).replace('../../../hub/cloud/gmail-service.js',gmailURL);
const endpoint=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
mock([[200,{id:'owner'}],[200,[{user_id:'owner'}]],[200,{id:'owner'}]]);
const req=new Request('https://studio.example/api/gmail/connect',{method:'POST',headers:{Origin:'https://studio.example',Authorization:'Bearer token'}});
const r=await endpoint.onRequest({request:req,env});assert.equal(r.status,200);const auth=new URL((await r.json()).url);assert.equal(auth.origin,'https://accounts.google.com');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.equal(auth.searchParams.get('redirect_uri'),'https://studio.example/api/gmail/callback');assert(!auth.search.includes('server-only'));assert(r.headers.get('Set-Cookie').includes('HttpOnly; Secure; SameSite=Lax'));
mock([]);const badCallback=await endpoint.onRequest({request:new Request('https://studio.example/api/gmail/callback?state=bad&code=bad'),env});assert.equal(badCallback.status,303);assert(badCallback.headers.get('Location').endsWith('gmail=failed'));assert.equal(calls.length,0);
console.log('PASS: encrypted refresh token/tamper check, verified account/From, MIME send, no retry after failure, opt-out preflight, PKCE/state cookie and invalid callback. No live mail or OAuth.');

// Bounded reply import; attachments/HTML ignored and matching sender/references required.
const sentRow={...row,status:'accepted',gmail_id:'outbound-id',thread_id:'thread',message_id:'<source@example.com>'};
const reply={id:'reply-id',labelIds:['INBOX'],payload:{mimeType:'multipart/alternative',headers:[{name:'From',value:'Prospect <prospect@example.com>'},{name:'Subject',value:'Re: Idea'},{name:'In-Reply-To',value:'<source@example.com>'}],parts:[{mimeType:'text/html',body:{data:Buffer.from('<script>unsafe</script>').toString('base64url')}},{mimeType:'text/plain',body:{data:Buffer.from('Interested, tell me more.').toString('base64url')}}]}};
mock([[200,[{token_cipher:cipher,mailbox:'project@gmail.com'}]],[200,{access_token:'token'}],[200,[sentRow]],[200,[]],[200,{messages:[{id:'outbound-id',labelIds:['SENT']},reply]}],[200,[]],[200,[]],[200,[]]]);
assert.equal((await g.syncGmail(env,'owner')).imported,1);const imported=calls.find(c=>c.o.method==='POST'&&c.u.includes('studio_mail?on_conflict'));assert(imported);assert.equal(JSON.parse(imported.o.body).body,'Interested, tell me more.');assert(!JSON.parse(imported.o.body).body.includes('script'));
console.log('PASS: Gmail thread/reference/sender matched plain-text reply import; sent message skipped. No live mailbox.');

// Modern opaque secret keys belong in apikey, never in a JWT bearer header.
const modern={...env,SUPABASE_SERVICE_ROLE_KEY:undefined,SUPABASE_SECRET_KEY:'sb_secret_test_only'};
g.config(modern);mock([[200,[]]]);await g.db(modern,'studio_owners?select=user_id');assert.equal(calls[0].o.headers.apikey,'sb_secret_test_only');assert(!('Authorization' in calls[0].o.headers));
mock([[200,[]]]);await g.db(env,'studio_owners?select=user_id');assert.equal(calls[0].o.headers.Authorization,'Bearer server-test');
console.log('PASS: modern secret API header and legacy fallback. Fake keys only.');

// Actual multipart MIME contains exact saved HTML, fallback and embedded curated images.
project.demo='/demos/lfastener/';project.name='Shibiao Fastener';project.mailPresentation={format:'branded',postalAddress:'Test business postal address'};
project.outreachDraft=globalThis.StudioEmail.introduction(project,project.mailPresentation.postalAddress);
const rendered=globalThis.StudioEmail.render(project,project.outreachDraft);Object.assign(row,{subject:rendered.subject,body:rendered.body,html_body:rendered.html,presentation:rendered.config});
mock([...preflight().slice(0,5),...rendered.assets.map(a=>[200,fs.readFileSync('images/email/'+a.file)]),...preflight().slice(5),[200,[row]],[200,{id:'formatted-id',threadId:'formatted-thread'}],[200,[row]],[200,{payload:{headers:[]}}]]);
assert.equal((await g.sendGmail(env,row)).status,'accepted');const formatted=calls.find(c=>c.u.endsWith('/messages/send'));const mime=Buffer.from(JSON.parse(formatted.o.body).raw,'base64url').toString('utf8');
const {spawnSync}=await import('node:child_process');const parsed=spawnSync('python3',['-c',`import sys,email,email.policy
m=email.message_from_bytes(sys.stdin.buffer.read(),policy=email.policy.default)
assert m.get_content_type()=='multipart/related'
parts=list(m.walk())
assert any(p.get_content_type()=='multipart/alternative' for p in parts)
assert any(p.get_content_type()=='text/plain' and 'Test business postal address' in p.get_content() for p in parts)
assert any(p.get_content_type()=='text/html' and 'cid:studio-demo' in p.get_content() for p in parts)
assert {str(p['Content-ID']) for p in parts if p['Content-ID']}=={'<studio-logo>','<studio-demo>'}
assert len([p for p in parts if p.get_content_maintype()=='image'])==2
`],{input:mime,encoding:'utf8'});assert.equal(parsed.status,0,parsed.stderr);
project.mailPresentation.postalAddress='Changed after review';mock(preflight().slice(0,5));await assert.rejects(()=>g.sendGmail(env,row));assert(!calls.some(c=>c.u.endsWith('/messages/send')));
console.log('PASS: multipart/related + alternative MIME parsed independently, inline logo/screenshot, exact HTML/plain fallback and changed-approval rejection. No live email.');
