// Reproducible local captures. Run preview server on 8000 first.
const{chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});const page=await browser.newPage({reducedMotion:'reduce'});const base=process.env.BASE_URL||'http://127.0.0.1:8000';
for(const[slug,name,email]of[['lfastener','shibiao','shibiao'],['tyfibre','tyfibre','tianyu']]){
 for(const[tier,width,height,suffix]of[['catalogue',1440,1000,'site'],['catalogue',390,844,'mobile'],['showcase',1440,1000,'showcase']]){
  await page.setViewportSize({width,height});await page.goto(`${base}/demos/${slug}/?tier=${tier}`);await page.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(slug+' overflows at '+width);
  const file=`images/${name}-${suffix}-preview.jpg`;await page.screenshot({path:file,type:'jpeg',quality:90});
  if(suffix==='site')fs.copyFileSync(file,`images/email/${email}-v2.jpg`);
 }
}
const manifestPath='hub/cloud/email-assets.js',manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8').split('=',2)[1].trim().replace(/;$/,''));for(const name of ['shibiao-v2.jpg','tianyu-v2.jpg']){const bytes=fs.readFileSync('images/email/'+name);manifest[name]={sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),size:bytes.length};}fs.writeFileSync(manifestPath,'export const emailAssets = '+JSON.stringify(manifest,null,2)+';\n');await browser.close();console.log('Updated two catalogue, two showcase, two mobile and two versioned email screenshots.');})().catch(e=>{console.error(e);process.exit(1)});
