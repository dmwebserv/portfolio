/* Public shell only. No service worker or private/offline data cache. */
(()=>{
 const installed=()=>document.documentElement.classList.toggle('standalone',matchMedia('(display-mode: standalone)').matches||navigator.standalone===true);
 installed();window.addEventListener('pageshow',installed);
 document.addEventListener('click',event=>{const target=event.target.closest('[data-install-help]');if(!target)return;const dialog=document.getElementById('install-help');if(dialog)dialog.showModal();});
 document.addEventListener('click',event=>{if(event.target.closest('[data-install-close]'))document.getElementById('install-help')?.close();});
 window.addEventListener('offline',()=>{const banner=document.getElementById('network-status');if(banner){banner.hidden=false;banner.textContent='You’re offline. Sending and server saving need a connection. Keep this window open if you have unsaved edits.';}});
 window.addEventListener('online',()=>{const banner=document.getElementById('network-status');if(banner)banner.hidden=true;});
})();
