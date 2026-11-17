const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const w=new JSDOM(fs.readFileSync('hub/index.html','utf8'),{url:'https://studio.example/',runScripts:'outside-only'}).window;
w.structuredClone=structuredClone;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.confirm=()=>true;
w.eval(fs.readFileSync('hub/app.js','utf8'));const d=w.document;
d.querySelector('[data-open="shibiao"]').click();d.querySelector('#edit-detail').click();const f=d.querySelector('#project-form');f.elements.email.value='test@example.test';f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));d.querySelector('[data-open="shibiao"]').click();
for(const k of ['demo','facts','contact','eligibility']){const c=d.querySelector(`[data-check="${k}"]`);c.checked=true;c.dispatchEvent(new w.Event('change'));}
d.querySelector('#prepare-email').click();assert(d.querySelector('#outreach-text').value.includes('https://studio.example/demos/lfastener/?tier=catalogue'));
d.querySelector('#save-email').click();const reviewed=d.querySelector('[data-check="email"]');reviewed.checked=true;reviewed.dispatchEvent(new w.Event('change'));
// Placeholders prevent a message from being recorded as sent.
d.querySelector('#record-sent').click();let saved=JSON.parse(w.localStorage.getItem('dm-studio-v1'));assert(!saved.find(p=>p.id==='shibiao').sentAt);
let text=d.querySelector('#outreach-text');text.value=text.value.replace('[Add required business postal details before sending]','Test business address');text.dispatchEvent(new w.Event('input'));assert.equal(d.querySelector('[data-check="email"]').checked,false);
d.querySelector('#save-email').click();const reviewedAgain=d.querySelector('[data-check="email"]');reviewedAgain.checked=true;reviewedAgain.dispatchEvent(new w.Event('change'));d.querySelector('#record-sent').click();
saved=JSON.parse(w.localStorage.getItem('dm-studio-v1'));const p=saved.find(p=>p.id==='shibiao');assert.equal(p.stage,'Contacted');assert(p.sentAt);assert(p.due);assert.equal(p.outreachHistory.length,1);assert.equal(p.outreachHistory[0].to,'test@example.test');assert(p.outreachDraft.includes('Test business address'));assert.equal(saved.length,2);
// Existing checklist and history survive validation on reload.
const w2=new JSDOM(fs.readFileSync('hub/index.html','utf8'),{url:'https://studio.example/',runScripts:'outside-only'}).window;w2.structuredClone=structuredClone;w2.HTMLDialogElement.prototype.showModal=function(){this.open=true};w2.localStorage.setItem('dm-studio-v1',JSON.stringify(saved));w2.eval(fs.readFileSync('hub/app.js','utf8'));w2.document.querySelector('[data-open="shibiao"]').click();assert(w2.document.querySelector('#record-sent').disabled);assert(w2.document.querySelector('.sent-status'));w.close();w2.close();
console.log('PASS: checklist, preview links, email drafts, placeholder guard, review invalidation, manual sent log, follow-up date and reload persistence. No email sent.');
