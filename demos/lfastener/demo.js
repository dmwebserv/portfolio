'use strict';
const tiers=[...document.querySelectorAll('[data-tier]')];
const filters=[...document.querySelectorAll('[data-filter]')];
let activeFilter='all';
function filterProducts(value){activeFilter=value;const query=document.getElementById('product-search').value.trim().toLowerCase();let count=0;document.querySelectorAll('[data-category]').forEach(c=>{const full=document.body.dataset.tier==='full';c.hidden=(!full&&c.hasAttribute('data-catalogue-only'))||(value!=='all'&&c.dataset.category!==value)||(full&&query&&!c.textContent.toLowerCase().includes(query));if(!c.hidden)count++;});filters.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===value)));document.getElementById('product-count').textContent=count+' product range'+(count===1?'':'s');}

function setTier(tier,updateURL=true){
 const full=tier==='full';
 // If the current anchor disappears, return to the product range instead of leaving a blank position.
 const target=document.getElementById(location.hash.slice(1));
 const wasHiddenTarget=target&&(target.matches('[data-full]')||target.closest('[data-full]'));
 document.querySelectorAll('[data-full]').forEach(e=>e.hidden=!full);
 document.querySelectorAll('[data-showcase]').forEach(e=>e.hidden=full);
 tiers.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tier===tier)));
 document.getElementById('tier-status').textContent=full?'£695 catalogue · Product filters, technical reference, sourcing guide and structured enquiry preview.':'£295 showcase · Core product ranges, company introduction and a simple contact route. No technical catalogue or advanced enquiry form.';
 document.body.dataset.tier=tier;document.getElementById('product-search').value='';filterProducts('all');
 if(updateURL){const url=new URL(location.href);url.searchParams.set('tier',full?'catalogue':'showcase');if(!full&&wasHiddenTarget)url.hash='products';history.replaceState(null,'',url);if(!full&&wasHiddenTarget)document.getElementById('products').scrollIntoView?.({block:'start'});}
}
tiers.forEach(b=>b.addEventListener('click',()=>setTier(b.dataset.tier)));
filters.forEach(b=>b.addEventListener('click',()=>filterProducts(b.dataset.filter)));
document.getElementById('product-search').addEventListener('input',()=>filterProducts(activeFilter));
document.querySelectorAll('[data-product]').forEach(a=>a.addEventListener('click',()=>{document.getElementById('product').value=a.dataset.product;}));
document.getElementById('rfq').addEventListener('submit',e=>{e.preventDefault();document.getElementById('form-status').textContent='Preview only — no enquiry has been sent or saved. A live website would route this to your agreed business contact.';});
const initial=new URLSearchParams(location.search).get('tier');setTier(['showcase','one','295'].includes(initial)?'one':'full',false);
function measurePreview(){document.documentElement.style.setProperty('--preview-height',document.querySelector('.preview').getBoundingClientRect().height+'px');}
if(window.ResizeObserver)new ResizeObserver(measurePreview).observe(document.querySelector('.preview'));
window.addEventListener('resize',measurePreview);measurePreview();

const productDialog=document.getElementById('product-dialog');
document.querySelectorAll('.product-detail').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('.card');document.getElementById('detail-title').textContent=card.querySelector('h3').textContent;document.getElementById('detail-description').textContent=card.querySelector('p').textContent;const box=document.getElementById('detail-specs');box.replaceChildren();if(card.querySelector('h3').textContent==='Hexagon bolts'){box.append(document.querySelector('#specification table').cloneNode(true));}else{const p=document.createElement('p');p.textContent='Specify diameter, length, material, grade, finish and quantity for this range. Detailed availability and standards require supplier confirmation.';box.append(p);}document.getElementById('detail-enquire').onclick=()=>{document.getElementById('product').value=card.querySelector('h3').textContent;productDialog.close();};productDialog.showModal();}));
document.getElementById('close-product').addEventListener('click',()=>productDialog.close());
