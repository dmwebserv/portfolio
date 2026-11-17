import importlib.util, io, json, os, unittest, urllib.error
from unittest.mock import patch, MagicMock
spec=importlib.util.spec_from_file_location('trigger','scripts/request-mail-sync.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def setUp(self):
  self.env=patch.dict(os.environ,{'SYNC_URL':'https://studio.example/api/mail-sync','SYNC_TOKEN':'private-token-'+'x'*32});self.env.start();self.addCleanup(self.env.stop)
 def call(self, response=None, error=None):
  opener=MagicMock();opener.open.side_effect=error
  if response is not None:opener.open.return_value.__enter__.return_value=response
  with patch.object(m.urllib.request,'build_opener',return_value=opener):m.main()
 def test_success(self):
  response=MagicMock(status=200);response.read.return_value=b'{"ok":true}';self.call(response)
 def test_http_diagnostics_redacted(self):
  for status,body,expected in [(403,b'{"code":"SYNC_UNAUTHORIZED","error":"private-token-secret"}','rejected authentication'),(403,b'<html>private-token-secret</html>','proxy'),(503,b'{"code":"SYNC_DATABASE_FAILED"}','database'),(302,b'private-token-secret','redirect')]:
   e=urllib.error.HTTPError('https://secret.example',status,'sensitive',{},io.BytesIO(body))
   with self.assertRaises(SystemExit) as result:self.call(error=e)
   self.assertIn(str(status),str(result.exception));self.assertIn(expected,str(result.exception));self.assertNotIn('private-token',str(result.exception));self.assertNotIn('secret.example',str(result.exception))
 def test_html_success_not_accepted(self):
  response=MagicMock(status=200);response.read.return_value=b'<html>private content</html>'
  with self.assertRaises(SystemExit) as result:self.call(response)
  self.assertIn('not JSON',str(result.exception));self.assertNotIn('private content',str(result.exception))
 def test_config_and_transport(self):
  with patch.dict(os.environ,{'SYNC_TOKEN':'bad\n'}),self.assertRaises(SystemExit) as result:self.call()
  self.assertIn('Invalid',str(result.exception))
  with self.assertRaises(SystemExit) as result:self.call(error=urllib.error.URLError('private-sensitive-url'))
  self.assertNotIn('private-sensitive',str(result.exception))
 def test_redirects_disabled(self):self.assertIsNone(m.NoRedirect().redirect_request(None,None,302,'',{},'https://untrusted.example'))
if __name__=='__main__':unittest.main()
