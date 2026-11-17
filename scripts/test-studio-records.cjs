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
// Simulate an original record renamed/overwritten while retaining its original ID.
const original=saved.find(p=>p.id==='shibiao');original.name='Keep my test';original.domain='test.example';original.notes='Do not replace these notes';w.close();
const r=boot(saved);r.document.querySelector('[data-restore-concepts]').click();const restored=records(r);
assert.equal(restored.length,4);assert(restored.some(p=>p.id==='shibiao'&&p.name==='Keep my test'&&p.notes==='Do not replace these notes'));
assert(restored.some(p=>p.name==='Shibiao Fastener'&&p.id!=='shibiao'));assert.equal(new Set(restored.map(p=>p.id)).size,4);
assert.equal(r.document.querySelector('[data-restore-concepts]'),null);r.close();
console.log('PASS: edit then create preserves records, repeated creation uses unique IDs, and concept recovery never overwrites existing data.');
