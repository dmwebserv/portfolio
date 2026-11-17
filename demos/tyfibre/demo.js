(function () {
      var btn695 = document.getElementById('btnMode695');
      var btn295 = document.getElementById('btnMode295');

      if (btn695 && btn295) {
        btn695.addEventListener('click', function () {
          document.body.classList.remove('mode-295');
          btn695.classList.add('is-active');
          btn295.classList.remove('is-active');
        });
        btn295.addEventListener('click', function () {
          document.body.classList.add('mode-295');
          btn295.classList.add('is-active');
          btn695.classList.remove('is-active');
        });
      }

      function applyTier(tier,updateURL) {
        var cheap = tier === 'showcase';
        document.body.classList.toggle('mode-295',cheap);
        btn295.classList.toggle('is-active',cheap);btn695.classList.toggle('is-active',!cheap);
        btn295.setAttribute('aria-pressed',String(cheap));btn695.setAttribute('aria-pressed',String(!cheap));
        if(updateURL){var u=new URL(location.href);u.searchParams.set('tier',tier);history.replaceState(null,'',u);}
      }
      btn295.addEventListener('click',function(){applyTier('showcase',true);});
      btn695.addEventListener('click',function(){applyTier('catalogue',true);});
      applyTier(new URLSearchParams(location.search).get('tier')==='showcase'?'showcase':'catalogue',false);

      var form = document.getElementById('demoRfqForm');
      var notice = document.getElementById('demoNotice');
      if (form && notice) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          notice.classList.add('is-shown');
        });
      }
    })();
