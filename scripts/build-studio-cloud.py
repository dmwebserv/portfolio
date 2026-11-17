"""Build only the free-tier static Studio site, not the repository root.
Required build variables: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (public values).
Output: dist/studio. NEVER use a secret/service-role key here.
"""
import base64
import json
import os
import shutil
from pathlib import Path
from urllib.parse import urlsplit

root=Path(__file__).resolve().parents[1]
url=os.environ.get('SUPABASE_URL','').rstrip('/')
key=os.environ.get('SUPABASE_PUBLISHABLE_KEY','')
u=urlsplit(url)
if u.scheme!='https' or not u.hostname or not u.hostname.endswith('.supabase.co') or u.path not in ('','/') or u.username or u.query or u.fragment:
    raise SystemExit('Set SUPABASE_URL to your https://PROJECT.supabase.co project URL.')
if not key: raise SystemExit('Set SUPABASE_PUBLISHABLE_KEY to the PUBLIC publishable (or legacy anon) key.')
if not key.startswith('sb_publishable_'):
    try:
        payload=json.loads(base64.urlsafe_b64decode(key.split('.')[1]+'==='))
        assert payload['role']=='anon'
    except Exception: raise SystemExit('Refusing key: only a publishable key or legacy anon JWT may enter browser assets. Never use secret/service_role.')
out=root/'dist/studio'
if out.exists(): shutil.rmtree(out)
out.mkdir(parents=True)
for name in ['index.html','style.css','app.js','login.html','login.js']:
    shutil.copy2(root/'hub'/name,out/name)
shutil.copy2(root/'hub/cloud/adapter.js',out/'cloud.js')
(out/'config.js').write_text('window.HUB_CONFIG = '+json.dumps({'server':True,'demo':False,'cloud':True,'supabaseUrl':url,'supabaseKey':key})+';\n')
for name in ['index.html','login.html']:
    p=out/name;s=p.read_text()
    if name=='login.html':
        s=s.replace('<label>Password','<label>Email<input type="email" id="email" autocomplete="username" required></label><label>Password')
        s=s.replace('<script src="/login.js"></script>','<script src="/config.js"></script><script src="/cloud.js"></script><script src="/login.js"></script>')
    else:
        s=s.replace('<script src="app.js"></script>','<script src="cloud.js"></script><script src="app.js"></script>')
    p.write_text(s)
# Generic playbook templates only; these are public boilerplate, not client records.
for rel in ['README.md','templates/outreach.md','templates/agreement-and-invoices.md','templates/onboarding-and-handover.md','templates/care-plan.md','templates/contact-assessment.md']:
    dest=out/'operations/uk-export'/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/'operations/uk-export'/rel,dest)
# Public, explicitly unofficial concept assets; private records remain in RLS-protected DB.
shutil.copytree(root/'demos',out/'demos')
for name in ['uk-export.html','uk-export-terms.html','terms.html','refunds.html','privacy-policy.html','thanks.html']:
    shutil.copy2(root/name,out/name)
shutil.copytree(root/'images',out/'images')
(out/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
(out/'_redirects').write_text('/login /login.html 200\n')
(out/'_headers').write_text('/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Cache-Control: no-store\n  Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'self\' '+url+'; frame-ancestors \'none\'; base-uri \'self\'; form-action \'self\' https://formsubmit.co\n')
(out/'404.html').write_text('<!doctype html><title>Not found</title><a href="/">Return to Studio</a>')
print('Built dist/studio. Publish ONLY this directory. Public shell/templates; private workspace protected by Supabase RLS.')
