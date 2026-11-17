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
