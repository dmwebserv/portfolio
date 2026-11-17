const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(records=[]){
 const w=new JSDOM('<div id="connected-mail"></div><textarea id="outreach-text">Subject: Test\n\nReviewed body</textarea><button id="record-followup"></button><button id="record-sent"></button><button id="prepare-email"></button><button id="open-email"></button>',{url:'https://studio.example',runScripts:'outside-only'}).window;
 w.eval(fs.readFileSync('hub/email-template.js','utf8'));w.eval(fs.readFileSync('hub/mail.js','utf8'));w.confirm=()=>true;
 const p={id:'p',name:'Test',email:'test@example.com',stage:'Demo ready',checks:Object.fromEntries(['demo','facts','contact','eligibility','email'].map(k=>[k,true])),mailPresentation:{format:'plain',postalAddress:''}};
 let posts=0,fail=false;
 w.StudioCloud={api:async(path,body)=>{if(path==='/api/gmail/status')return{connected:true,enabled:true,account:{mailbox:'owner@example.com'},sender:'sender@example.com'};if(body?.approved){posts++;if(fail){records.push({id:'queued',direction:'outbound',status:'queued',subject:'Test',recipient:p.email,detail:'Preparation stopped: Email image unavailable.'});throw Error('Email image unavailable.');}return {send:{status:'accepted'}};}return{messages:records};}};
 const mount=()=>w.StudioMail.mount(p,{toast:()=>{},save:()=>{},log:()=>{}});mount();return{w,p,mount,posts:()=>posts,fail:()=>{fail=true;}};
}
(async()=>{
 for(const [status,reason]of[['queued','Queued'],['sending','outcome'],['uncertain','uncertain'],['accepted','accepted']]){
  const f=fixture([{id:'record',direction:'outbound',status,subject:'Test',recipient:'test@example.com',created_at:'2026-11-12T00:00:00Z',detail:'Visible stored detail'}]);await tick();const d=f.w.document;assert(d.querySelector('#mail-send').disabled);assert(d.querySelector('#mail-blocked').textContent.toLowerCase().includes(reason.toLowerCase()));assert(d.querySelector('#mail-summary').textContent.includes('Visible stored detail'));assert(d.querySelector('#mail-history details').open);assert(d.querySelector('.email-design').compareDocumentPosition(d.querySelector('#mail-summary'))&f.w.Node.DOCUMENT_POSITION_FOLLOWING);d.querySelector('#mail-send').click();assert.equal(f.posts(),0);f.w.close();
 }
 const f=fixture();await tick();assert(!f.w.document.querySelector('#mail-send').disabled);f.fail();f.w.document.querySelector('#mail-send').click();await tick();await tick();assert.equal(f.posts(),1);assert(!f.w.document.querySelector('#mail-error').hidden);assert(f.w.document.querySelector('#mail-error').textContent.includes('unavailable'));assert(f.p.mailLastError.message.includes('unavailable'));f.mount();await tick();assert(!f.w.document.querySelector('#mail-error').hidden);assert(f.w.document.querySelector('[data-retry-mail="queued"]'));assert(f.w.document.querySelector('#mail-blocked').textContent.includes('Queued'));f.w.close();
 console.log('PASS: queued/sending/uncertain/accepted visible beside disabled send, no duplicate POST, open history, persistent preflight error and preview before send, readable records and queued recovery.');
})().catch(e=>{console.error(e);process.exit(1)});
