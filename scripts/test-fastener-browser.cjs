// Requires playwright; set CHROMIUM_PATH if using a system Chromium.
// Start the portfolio preview on port 8000 first. No credentials required.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Apply the same no-inline-script rule used on Pages; this caught the original switcher bug.
 await page.route('**/demos/lfastener/**',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'self'"}});});
 await page.goto('http://127.0.0.1:8000/demos/lfastener/');
 await page.getByRole('button',{name:'Showcase £295'}).click();assert.equal(await page.locator('#rfq').isVisible(),false);assert.equal(await page.locator('#specification').isVisible(),false);
 await page.reload();assert.equal(await page.locator('#rfq').isVisible(),false);
 await page.getByRole('button',{name:'Full catalogue £695'}).click();assert.equal(await page.locator('#rfq').isVisible(),true);
 await page.getByRole('button',{name:'Nuts & washers',exact:true}).click();assert.equal(await page.locator('[data-category]:visible').count(),2);
 await page.getByRole('button',{name:'Showcase £295'}).click();assert.equal(await page.locator('[data-category]:visible').count(),3);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: package switching under CSP, shared tier URL, filtering, reset, mobile width and real image loads.');
})().catch(e=>{console.error(e);process.exitCode=1;});
