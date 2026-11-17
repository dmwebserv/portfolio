"""Offline static build regression checks, including Pages login routing."""
import os
import subprocess
import sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
env={**os.environ,'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_test_placeholder'}
subprocess.run([sys.executable,'scripts/build-studio-cloud.py'],cwd=root,env=env,check=True)
out=root/'dist/studio'
assert (out/'login/index.html').is_file()
assert not (out/'login.html').exists()
assert '/login ' not in (out/'_redirects').read_text(), 'Login must not use a rewrite to an .html canonical URL'
assert '/uk-export.html https://dmwebservices.co.uk/uk-export.html 302' in (out/'_redirects').read_text()
assert not (out/'uk-export.html').exists()
s=(out/'login/index.html').read_text()
for path in ['/style.css','/config.js','/cloud.js','/login.js']:
    assert '"'+path+'"' in s
    assert (out/path.lstrip('/')).is_file()
assert 'id="email"' in s
assert "CLOUD?'/login/':'/login'" in (out/'app.js').read_text()
assert not (out/'server').exists()
print('PASS: directory-index login, root-relative assets, cloud redirect and server exclusion')

import json, struct
manifest=json.loads((out/'app.webmanifest').read_text())
assert manifest['display']=='standalone' and manifest['start_url']=='/'
for icon in manifest['icons']:
    p=out/icon['src'].lstrip('/')
    assert p.exists()
    assert struct.unpack('>II',p.read_bytes()[16:24])==tuple(map(int,icon['sizes'].split('x')))
for name in ['index.html','login/index.html']:
    html=(out/name).read_text()
    assert 'apple-mobile-web-app-capable' in html and 'viewport-fit=cover' in html
    assert 'apple-touch-icon' in html and 'app.webmanifest' in html
assert 'studio-booting' in (out/'index.html').read_text()
assert not list(out.glob('*service-worker*')), 'No private offline cache is configured'
print('PASS: iOS standalone metadata, favicon/touch icons and manifest sizes; auth-first startup shell.')
