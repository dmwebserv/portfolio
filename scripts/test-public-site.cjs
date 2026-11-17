// Requires Playwright. Run against portfolio preview on port 8000.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
const b=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}: {})});
const p=await b.newPage();const fonts=[];
for(const width of [1440,768,390]){
 await p.setViewportSize({width,height:1000});
 for(const path of ['/','/uk-export.html','/demos/lfastener/?tier=showcase','/demos/lfastener/?tier=catalogue']){
  await p.goto('http://127.0.0.1:8000'+path);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} overflows at ${width}`);
  if(path==='/'){
   assert.equal(await p.locator('.work-cases>.work-case').count(),3);
   for(const img of await p.locator('.case-image-frame img').all()){
    await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());const v=await img.evaluate(i=>({rendered:i.getBoundingClientRect().width/i.getBoundingClientRect().height,natural:i.naturalWidth/i.naturalHeight}));assert(Math.abs(v.rendered-v.natural)<0.01,'Portfolio image distorted');
   }
   if(width===1440)fonts.push(await p.locator('h1').evaluate(i=>getComputedStyle(i).fontFamily));
  }
  if(path==='/uk-export.html'){
   if(width===1440)fonts.push(await p.locator('h1').evaluate(i=>getComputedStyle(i).fontFamily));
   for(const img of await p.locator('.browser-frame img').all()){
    await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());assert(await img.evaluate(i=>Math.abs(i.width/i.height-i.naturalWidth/i.naturalHeight)<0.01),'Export image distorted');
   }
  }
 }
}
assert.equal(fonts[0],fonts[1]);
await p.goto('http://127.0.0.1:8000/demos/lfastener/?tier=catalogue');
await p.locator('#product-search').fill('hexagon');assert.equal(await p.locator('[data-category]:visible').count(),1);
await p.locator('.product-detail:visible').click();assert(await p.locator('#product-dialog').isVisible());assert(await p.locator('#product-dialog table').isVisible());await p.locator('#close-product').click();
await p.getByRole('button',{name:'Showcase £295'}).click();assert.equal(await p.locator('[data-category]:visible').count(),3);assert.equal(await p.locator('.catalogue-toolbar').isVisible(),false);
await b.close();console.log('PASS: public pages at 1440/768/390, all portfolio image proportions, shared fonts, three case-study layout, catalogue search/details and distinct tiers.');
})().catch(e=>{console.error(e);process.exit(1);});
