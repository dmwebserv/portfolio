'use strict';
// Native scrolling, one visible project pane, and no offscreen iframe painting.
(()=>{
 const selected=new Map();
 window.StudioWorkspace={organise(id){
  const root=document.getElementById('detail-content');if(!root)return;
  const heading=root.querySelector('.dialog-head');heading.querySelector('.close').setAttribute('aria-label','Close prospect');
  const nav=document.createElement('div');nav.className='project-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Prospect sections');heading.after(nav);
  const definitions=[['review','Review & next step'],['email','Email & mailbox'],['build','Design & AI'],['notes','Notes & resources'],['activity','Activity']];
  const panes=Object.fromEntries(definitions.map(([key,label])=>{const pane=document.createElement('section');pane.id='project-pane-'+key;pane.className='project-pane';pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby','project-tab-'+key);root.append(pane);const button=document.createElement('button');button.id='project-tab-'+key;button.type='button';button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls',pane.id);button.onclick=()=>activate(key);nav.append(button);return[key,pane];}));
  const workflow=root.querySelector('.workflow');
  for(const el of [...root.children]){
   if(el===heading||el===nav||el.classList.contains('project-pane'))continue;
   let key='review';
   if(el.id==='connected-mail')key='email';
   else if(el.id==='arena-brief-tools'||el.querySelector('#ai-project-tools')||el.querySelector('#ai-task'))key='build';
   else if(el.querySelector('#delete-project'))key='activity';
   else if(el.querySelector('#resource-form')||el.querySelector('h3')?.textContent==='Research & notes')key='notes';
   panes[key].append(el);
  }
  for(const el of [...workflow.children])if(el.matches('.outreach-desk,.outreach-history'))panes.email.prepend(el);
  const context=document.createElement('div');context.className='email-context';const recipient=document.createElement('p');recipient.textContent='Recipient: '+(root.querySelector('.detail-meta')?.nextElementSibling?.textContent||'Verify the recipient in Review & next step.');const review=document.createElement('button');review.className='secondary';review.textContent='Go to review checklist';review.onclick=()=>activate('review',true);context.append(recipient,review);panes.email.prepend(context);
  const desk=panes.email.querySelector('.outreach-desk');if(desk){const manual=document.createElement('details');manual.className='manual-mail';const summary=document.createElement('summary');summary.textContent='Manual sending & recording · only if not using connected Gmail';manual.append(summary);for(const el of [...desk.children])if(el.matches('.send-log,.sent-status,#record-followup'))manual.append(el);desk.append(manual);}
  const foot=workflow.querySelector('.workflow-footnote');if(foot){const d=document.createElement('details');const s=document.createElement('summary');s.textContent='Review guidance';d.append(s,foot);workflow.append(d);}
  function activate(key,focus=false){if(!panes[key])key='review';selected.set(id,key);for(const[k,p]of Object.entries(panes)){p.hidden=k!==key;const b=document.getElementById('project-tab-'+k);b.setAttribute('aria-selected',String(k===key));b.tabIndex=k===key?0:-1;if(k===key&&focus)b.focus();}document.getElementById('detail').scrollTop=0;}
  nav.onkeydown=e=>{const buttons=[...nav.children],i=buttons.indexOf(document.activeElement);let n;if(e.key==='ArrowRight')n=(i+1)%buttons.length;if(e.key==='ArrowLeft')n=(i+buttons.length-1)%buttons.length;if(e.key==='Home')n=0;if(e.key==='End')n=buttons.length-1;if(n!==undefined){e.preventDefault();activate(definitions[n][0],true);}};
  activate(selected.get(id)||'review');
 },openTab(key){document.getElementById('project-tab-'+key)?.click();}};
})();
