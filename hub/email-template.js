/* Shared deterministic template: classic browser script and server side-effect import. */
(()=>{
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function publicDemo(value){try{const u=new URL(value,'https://dmwebservices.co.uk');if(u.origin!=='https://dmwebservices.co.uk'||!/^\/demos\/(lfastener|tyfibre)\/$/.test(u.pathname))return '';u.hash='';u.search='?tier=catalogue';return u.href;}catch{return '';}}
 function settings(p){return {version:1,format:p.mailPresentation?.format==='branded'?'branded':'plain',demo:publicDemo(p.demo),postalAddress:String(p.mailPresentation?.postalAddress||'').trim().slice(0,500)};}
 function asset(p){const u=settings(p).demo;if(u.includes('/lfastener/'))return 'shibiao-v1.jpg';if(u.includes('/tyfibre/'))return 'tianyu-v1.jpg';return '';}
 function introduction(p,address=''){
  const demo=publicDemo(p.demo),name=p.contact?.trim()||p.name+' team',kind=demo.includes('/lfastener/')?'your WF branding and fastener range':demo.includes('/tyfibre/')?'your fibreglass mesh, tape and screening ranges':'your public product information';
  return `Subject: A UK-facing website concept for ${p.name}\n\nHi ${name},\n\nI’m Danny, an independent web designer based in the UK.\n\nI’ve put together a small, unofficial website concept for ${p.name}, using ${kind}. The idea is to give UK trade buyers a clearer way to browse the products and prepare an enquiry.\n\n${demo||p.demo||'[DEMO LINK]'}\n\nIt would sit alongside your existing website—there’s no need to replace it or give me access to its server.\n\nWould a separate UK-facing website be useful to your team?\n\nBest regards,\nDanny Manning\nIndependent web designer · dmwebservices\ndanny@dmwebservices.co.uk\nhttps://dmwebservices.co.uk/\n\nIf this isn’t relevant, let me know and I won’t follow up.\n\n${address.trim()||'[BUSINESS POSTAL DETAILS]'}\nPrivacy: https://dmwebservices.co.uk/privacy-policy.html`;
 }
 function links(text){return escape(text).replace(/https:\/\/[^\s<]+/g,value=>{const trailing=value.match(/[.,;!?]+$/)?.[0]||'';const href=value.slice(0,value.length-trailing.length);return `<a href="${href}" style="color:#245c54;text-decoration:underline">${href}</a>${trailing}`;}).replace(/\n/g,'<br>');}
 function render(p,text){
  const config=settings(p),lines=text.split('\n'),subject=lines.shift().replace(/^Subject:\s*/i,'').trim(),body=lines.join('\n').trim();
  if(config.format!=='branded')return {subject,body,html:'',config,assets:[]};
  if(!config.postalAddress||!body.includes(config.postalAddress)||/\[[^\]]+\]/.test(body))throw Error('Add your business postal details and replace draft placeholders before previewing or sending.');
  const image=asset(p),hasDemo=image&&body.split(/\n\s*\n/).some(paragraph=>paragraph.trim()===config.demo),assets=[{file:'dm-logo-v1.png',cid:'studio-logo',type:'image/png'}];
  if(hasDemo)assets.push({file:image,cid:'studio-demo',type:'image/jpeg'});
  let logo=false,preview=false;
  const paragraphs=body.split(/\n\s*\n/).map(paragraph=>{
   if(hasDemo&&paragraph.trim()===config.demo&&!preview){preview=true;return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;table-layout:fixed"><tr><td><a href="${escape(config.demo)}"><img src="cid:studio-demo" width="560" alt="${escape(p.name)} — independent website concept. Open the demo." style="display:block;width:100%;max-width:100%;height:auto;border:1px solid #dce3df;border-radius:6px"></a></td></tr><tr><td style="padding-top:8px;font:12px/1.6 Arial,sans-serif;color:#68736d">Independent concept—not the official ${escape(p.name)} website.<br><a href="${escape(config.demo)}" style="color:#245c54">View the website concept →</a></td></tr></table>`;}
   const signature=!logo&&paragraph.includes('Danny Manning');if(signature)logo=true;
   return `${signature?'<img src="cid:studio-logo" width="44" height="44" alt="dmwebservices" style="display:block;width:44px;height:44px;margin:22px 0 10px;border:0">':''}<p style="margin:0 0 18px;font:15px/1.7 Arial,sans-serif;color:#26342d;overflow-wrap:anywhere;word-break:break-word">${links(paragraph)}</p>`;
  }).join('');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;padding:0;background:#fff"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed"><tr><td style="padding:24px 16px"><table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;table-layout:fixed"><tr><td>${paragraphs}</td></tr></table></td></tr></table></body></html>`;
  return {subject,body,html,config,assets:logo?assets:assets.filter(a=>a.cid!=='studio-logo')};
 }
 globalThis.StudioEmail=Object.freeze({settings,render,introduction,publicDemo,asset});
})();
