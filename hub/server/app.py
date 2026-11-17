"""Single-owner Studio backend. Run behind HTTPS with a persistent private data volume."""
import hashlib
import json
import os
import secrets
import sqlite3
import time
from datetime import timedelta
from pathlib import Path
from functools import wraps
from contextlib import contextmanager
from threading import Lock
from flask import Flask, request, session, jsonify, send_from_directory, redirect, Response
from werkzeug.security import check_password_hash

ROOT = Path(__file__).resolve().parents[2]
DEMO = os.environ.get('HUB_DEMO_MODE') == '1'
DATA = Path(os.environ.get('HUB_DATA_DIR', '/tmp/dm-studio-demo' if DEMO else '/data/studio'))
PASSWORD = os.environ.get('HUB_PASSWORD_HASH', '')
SECRET = os.environ.get('HUB_SESSION_SECRET', '')
if not DEMO and (not PASSWORD or len(SECRET) < 32):
    raise RuntimeError('Set HUB_PASSWORD_HASH and a random HUB_SESSION_SECRET of at least 32 characters. See README. Never commit secrets.')
os.umask(0o077)
DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
app = Flask(__name__, static_folder=None)
app.secret_key = SECRET or secrets.token_hex(32)
app.config.update(MAX_CONTENT_LENGTH=5_000_000, SESSION_COOKIE_HTTPONLY=True,
                  SESSION_COOKIE_SECURE=not DEMO, SESSION_COOKIE_SAMESITE='Strict',
                  PERMANENT_SESSION_LIFETIME=timedelta(hours=12))
ATTEMPTS = {}
LOGIN_LOCK = Lock()

@contextmanager
def db():
    c = sqlite3.connect(DATA / 'studio.sqlite', timeout=15)
    c.execute('CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, data TEXT NOT NULL)')
    c.execute('INSERT OR IGNORE INTO workspace VALUES (1,0,?)', ('[]',))
    c.commit()
    try:
        with c:
            yield c
    finally:
        c.close()
with db(): pass

def authenticated():
    return DEMO or (session.get('owner') is True and secrets.compare_digest(session.get('credential', ''), hashlib.sha256(PASSWORD.encode()).hexdigest()))

def protected(fn):
    @wraps(fn)
    def wrapped(*a, **kw):
        if not authenticated():
            return (jsonify(error='Sign in required'), 401) if request.path.startswith('/api/') else redirect('/login')
        return fn(*a, **kw)
    return wrapped

@app.before_request
def protect_writes():
    if request.method in ('POST','PUT','DELETE','PATCH'):
        # Custom non-simple header forces preflight for cross-origin browser requests.
        # No CORS permissions are issued by this application.
        if request.headers.get('X-Studio-Request') != '1' or not request.is_json:
            return jsonify(error='JSON request with Studio header required'), 403
        if request.headers.get('Sec-Fetch-Site') == 'cross-site':
            return jsonify(error='Cross-site requests are not permitted'), 403

@app.after_request
def headers(r):
    r.headers['Cache-Control'] = 'no-store'
    r.headers['X-Content-Type-Options'] = 'nosniff'
    r.headers['X-Frame-Options'] = 'DENY'
    r.headers['Referrer-Policy'] = 'no-referrer'
    r.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    if not DEMO: r.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return r

@app.get('/health')
def health(): return jsonify(status='ok', demo=DEMO)

@app.get('/login')
def login_page():
    if authenticated(): return redirect('/')
    return send_from_directory(ROOT/'hub', 'login.html')

@app.post('/api/login')
def login():
    now=time.time()
    # Single-owner global limit avoids relying on untrusted forwarded IP headers.
    with LOGIN_LOCK:
        recent=[t for t in ATTEMPTS.get('login',[]) if now-t<600]
        if len(recent)>=10: return jsonify(error='Too many attempts. Try again in 10 minutes.'),429
        recent.append(now); ATTEMPTS['login']=recent
    body=request.get_json(silent=True)
    if not isinstance(body,dict): return jsonify(error='Invalid login request'),400
    candidate=body.get('password','')
    if not isinstance(candidate,str) or len(candidate)>1000: return jsonify(error='Invalid password'),400
    if not PASSWORD or not check_password_hash(PASSWORD,candidate): return jsonify(error='Incorrect password'),401
    with LOGIN_LOCK: ATTEMPTS.clear()
    session.clear();session['owner']=True;session.permanent=True
    session['credential']=hashlib.sha256(PASSWORD.encode()).hexdigest()
    return jsonify(ok=True)

@app.post('/api/logout')
@protected
def logout(): session.clear();return jsonify(ok=True)

@app.get('/config.js')
@protected
def config():
    return Response('window.HUB_CONFIG='+json.dumps({'server':True,'demo':DEMO})+';',mimetype='application/javascript')

@app.route('/api/workspace', methods=['GET','PUT'])
@protected
def workspace():
    with db() as c:
        if request.method=='GET':
            version,data=c.execute('SELECT version,data FROM workspace WHERE id=1').fetchone()
            return jsonify(version=version,projects=json.loads(data))
        body=request.get_json(silent=True)
        if not isinstance(body,dict) or type(body.get('version')) is not int: return jsonify(error='Invalid version'),400
        records=body.get('projects')
        if not isinstance(records,list) or len(records)>1000: return jsonify(error='Invalid workspace'),400
        ids=set()
        for p in records:
            if not isinstance(p,dict) or not isinstance(p.get('id'),str) or not isinstance(p.get('name'),str) or not p['name'].strip():
                return jsonify(error='Each project requires an id and company name'),400
            if p['id'] in ids: return jsonify(error='Duplicate project id'),400
            ids.add(p['id'])
        data=json.dumps(records)
        if len(data.encode())>4_000_000: return jsonify(error='Workspace too large'),400
        result=c.execute('UPDATE workspace SET version=version+1,data=? WHERE id=1 AND version=?',(data,body['version']))
        if result.rowcount!=1: return jsonify(error='Workspace changed on another device. Export your edits, then reload before continuing.'),409
        return jsonify(version=body['version']+1)

@app.get('/')
@protected
def index(): return send_from_directory(ROOT/'hub','index.html')

@app.get('/<name>')
def assets(name):
    if name not in ('app.js','style.css','login.js','ai.js','mail.js','email-template.js','shell.js','app.webmanifest'): return 'Not found',404
    return send_from_directory(ROOT/'hub',name)

@app.get('/app-icons/<path:name>')
def app_icons(name): return send_from_directory(ROOT/'hub/app-icons',name)

@app.get('/operations/uk-export/<path:name>')
@protected
def resources(name):
    if not name.endswith('.md'): return 'Not found',404
    return send_from_directory(ROOT/'operations/uk-export',name)

@app.get('/demos/<path:name>')
@protected
def demos(name):
    if name.endswith('/'): name+='index.html'
    return send_from_directory(ROOT/'demos',name)

@app.get('/uk-export.html')
@app.get('/uk-export-terms.html')
@protected
def offer(): return send_from_directory(ROOT,request.path.lstrip('/'))
