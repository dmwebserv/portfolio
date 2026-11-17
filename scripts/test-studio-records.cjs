// Install jsdom in a temporary tools directory, then run with NODE_PATH pointing there.
const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
function boot(records){const w=new JSDOM(fs.readFileSync('hub/index.html','utf8'),{url:'https://studio.example/hub/',runScripts:'outside-only'}).window;w.structuredClone=structuredClone;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.confirm=()=>true;if(records)w.localStorage.setItem('dm-studio-v1',JSON.stringify(records));w.eval(fs.readFileSync('hub/app.js','utf8'));return w;}
function records(w){return JSON.parse(w.localStorage.getItem('dm-studio-v1'));}
function submit(w,name){const f=w.document.querySelector('#project-form');if(name)f.elements.name.value=name;f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
const w=boot(),d=w.document;
d.querySelector('[data-open="shibiao"]').click();d.querySelector('#edit-detail').click();submit(w);
d.querySelector('#add').click();assert.equal(d.querySelector('#project-form').elements.id.value,'');submit(w,'Test one');
let saved=records(w);assert.equal(saved.length,3);assert(saved.some(p=>p.name==='Shibiao Fastener'));assert(saved.some(p=>p.name==='Tianyu Fibre'));assert(saved.some(p=>p.name==='Test one'));
d.querySelector('#add').click();submit(w,'Test two');assert.equal(records(w).length,4);assert.equal(new Set(records(w).map(p=>p.id)).size,4);
assert(!d.querySelector('.intro .eyebrow'));
// Intentionally removed or renamed sample prospects stay that way.
const original=saved.find(p=>p.id==='shibiao');original.name='Keep my test';original.domain='test.example';original.notes='Do not replace these notes';w.close();
const r=boot(saved);assert.equal(r.document.querySelector('[data-restore-concepts]'),null);
assert(r.document.querySelector('#content').textContent.includes('Keep my test'));r.close();
const empty=boot([]);assert.equal(empty.document.querySelector('[data-open]'),null);assert.equal(empty.document.querySelector('[data-restore-concepts]'),null);empty.close();
console.log('PASS: edit/create preserves records and unique IDs; removed or renamed sample prospects stay removed without restore prompts.');
