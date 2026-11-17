"""Initialise persistent volume ownership, then drop root before serving."""
import os
from pathlib import Path

path=Path(os.environ.get('HUB_DATA_DIR','/data/studio'))
if os.getuid()==0:
    path.mkdir(parents=True,exist_ok=True,mode=0o700)
    os.chown(path,10001,10001)
    os.chmod(path,0o700)
    os.setgroups([])
    os.setgid(10001)
    os.setuid(10001)
port=int(os.environ.get('PORT','8001'))
if not 1024<=port<=65535: raise SystemExit('PORT must be between 1024 and 65535')
os.execvp('waitress-serve',['waitress-serve',f'--listen=0.0.0.0:{port}','--call','hub.server.runner:create_app'])
