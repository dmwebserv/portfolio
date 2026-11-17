"""Offline structural checks. Run from repository root; no form submissions."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import re
root=Path.cwd()
files=[Path(x) for x in ['uk-export.html','uk-export-terms.html','demos/lfastener/index.html','demos/tyfibre/index.html']]
class Links(HTMLParser):
 def __init__(self): super().__init__(); self.refs=[]; self.ids=set()
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a: self.ids.add(a['id'])
  for k in ('href','src'):
   if a.get(k): self.refs.append(a[k])
errors=[]
for f in files:
 s=f.read_text(); p=Links();p.feed(s)
 for ref in p.refs:
  u=urlsplit(ref)
  if u.scheme or u.netloc: continue
  if not u.path:
   if u.fragment and unquote(u.fragment) not in p.ids: errors.append(f'{f}: missing anchor {ref}')
   continue
  dest=(root/u.path.lstrip('/')) if u.path.startswith('/') else f.parent/u.path
  if dest.is_dir(): dest=dest/'index.html'
  if not dest.exists(): errors.append(f'{f}: missing file {ref}')
 if 'demos/' in str(f):
  assert re.search(r'name="robots" content="noindex,\s*nofollow"',s), f
assert 'Disallow: /demos/' in Path('robots.txt').read_text()
assert 'demos/' not in Path('sitemap.xml').read_text()
if errors: raise SystemExit('\n'.join(errors))
print('PASS: local links, anchors, demo noindex directives and sitemap exclusion')
