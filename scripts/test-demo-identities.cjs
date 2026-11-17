const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});const page=await b.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const identities={};
await page.route('**/demos/**',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'self'"}});});
for(const name of ['lfastener','tyfibre']){
 for(const width of [1440,768,390,320])for(const tier of ['catalogue','showcase']){
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`http://127.0.0.1:8000/demos/${name}/?tier=${tier}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} ${tier} ${width}`);assert.equal(await page.locator('[data-category]:visible').count(),tier==='catalogue'?6:3);
  if(width===1440&&tier==='catalogue')identities[name]=await page.locator('h1:visible').evaluate(el=>({font:getComputedStyle(el).fontFamily,background:getComputedStyle(document.body).backgroundColor}));
  if(tier==='catalogue'){
   const filter=name==='lfastener'?'Nuts & washers':'Accessories';await page.getByRole('button',{name:filter,exact:true}).click();assert.equal(await page.locator('[data-category]:visible').count(),2);
   const form=page.locator(name==='lfastener'?'#rfq':'#demoRfqForm');await form.locator('button[type=submit]').click();assert((await page.locator(name==='lfastener'?'#form-status':'#demoNotice').textContent()).includes('Preview only'));
  }
  assert.equal(await page.locator('.motion-pending').count(),0,'Reduced motion must never hide content');
 }
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(`http://127.0.0.1:8000/demos/${name}/?tier=catalogue`);await page.locator('[data-category]').last().scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('[data-category]')].at(-1).classList.contains('motion-in'));
 const images=page.locator('img');for(const image of await images.all()){await image.scrollIntoViewIfNeeded();await image.evaluate(i=>i.decode());assert(await image.evaluate(i=>i.naturalWidth>0));}
}
assert.notEqual(identities.lfastener.font,identities.tyfibre.font);assert.notEqual(identities.lfastener.background,identities.tyfibre.background);assert.deepEqual(errors,[]);await b.close();console.log('PASS: distinct fonts/palettes, both tiers at 1440/768/390/320, filtering, inert forms, CSP image loads, scroll reveals and reduced motion.');})().catch(e=>{console.error(e);process.exit(1)});
