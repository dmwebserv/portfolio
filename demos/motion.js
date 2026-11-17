// Progressive enhancement only: content is visible without JS or reduced-motion.
(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 if(reduced.matches||!('IntersectionObserver'in window))return;
 const targets=[...document.querySelectorAll('.section-heading,.card,.photo-grid figure,.spec-card,.company-grid,.section-head,.materials article,.material-intro,.company,.reference-card')];
 const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.remove('motion-pending');e.target.classList.add('motion-in');observer.unobserve(e.target);}},{threshold:.08});
 targets.forEach((el,i)=>{el.style.setProperty('--motion-delay',(i%3)*55+'ms');el.classList.add('motion-pending');observer.observe(el);});
 reduced.addEventListener?.('change',()=>{if(reduced.matches){targets.forEach(el=>el.classList.remove('motion-pending'));observer.disconnect();}});
})();
