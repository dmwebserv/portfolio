"""Run with python -m unittest hub.server.test_server. Isolated temporary DB."""
import os
import tempfile
import unittest
from werkzeug.security import generate_password_hash

_tmp=tempfile.TemporaryDirectory()
os.environ['HUB_DATA_DIR']=_tmp.name
os.environ['HUB_PASSWORD_HASH']=generate_password_hash('test-only-not-a-real-password')
os.environ['HUB_SESSION_SECRET']='test-only-session-secret-which-is-long-enough'
os.environ.pop('HUB_DEMO_MODE',None)
from .app import app

class ServerTests(unittest.TestCase):
    def setUp(self): self.client=app.test_client()
    def login(self):
        return self.client.post('/api/login',json={'password':'test-only-not-a-real-password'},headers={'X-Studio-Request':'1'})
    def test_auth_and_logout(self):
        self.assertEqual(self.client.get('/api/workspace').status_code,401)
        self.assertEqual(self.client.get('/').status_code,302)
        self.assertEqual(self.client.get('/operations/uk-export/README.md').status_code,302)
        self.assertEqual(self.login().status_code,200)
        with self.client.get('/') as response:
            self.assertEqual(response.status_code,200)
        with self.client.get('/operations/uk-export/README.md') as response:
            self.assertEqual(response.status_code,200)
        self.client.post('/api/logout',json={},headers={'X-Studio-Request':'1'})
        self.assertEqual(self.client.get('/api/workspace').status_code,401)
    def test_write_and_conflict(self):
        self.login();data=self.client.get('/api/workspace').json
        payload={'version':data['version'],'projects':[{'id':'a','name':'Sample'}]}
        self.assertEqual(self.client.put('/api/workspace',json=payload).status_code,403)
        headers={'X-Studio-Request':'1'}
        self.assertEqual(self.client.put('/api/workspace',json=payload,headers={**headers,'Sec-Fetch-Site':'cross-site'}).status_code,403)
        self.assertEqual(self.client.put('/api/workspace',json=payload,headers=headers).status_code,200)
        self.assertEqual(self.client.put('/api/workspace',json=payload,headers=headers).status_code,409)
        self.assertEqual(self.client.get('/api/workspace').json['projects'][0]['name'],'Sample')
    def test_headers_and_validation(self):
        r=self.login();self.assertIn('HttpOnly',r.headers['Set-Cookie']);self.assertIn('Secure',r.headers['Set-Cookie'])
        self.assertIn('SameSite=Strict',r.headers['Set-Cookie'])
        with self.client.get('/') as response:
            self.assertEqual(response.headers['Cache-Control'],'no-store')
        self.assertEqual(self.client.get('/server/app.py').status_code,404)
        self.assertEqual(self.client.put('/api/workspace',json={'version':0,'projects':[{}]},headers={'X-Studio-Request':'1'}).status_code,400)

if __name__=='__main__': unittest.main()
