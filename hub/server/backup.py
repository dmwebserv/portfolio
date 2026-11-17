"""Create a consistent SQLite snapshot. Destination must be private, off-repo.
Usage: python -m hub.server.backup /private/backup-directory
Offsite transfer, encryption, retention and scheduling are deployment tasks.
"""
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

def backup(source, destination):
    source=Path(source).resolve();destination=Path(destination).resolve()
    repo=Path(__file__).resolve().parents[2]
    if destination.is_relative_to(repo):
        raise ValueError('Backups must be outside the source repository.')
    if not source.is_file(): raise ValueError('Source database not found.')
    destination.mkdir(parents=True,exist_ok=True,mode=0o700)
    name=destination/('studio-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.sqlite')
    old=os.umask(0o077)
    try:
        with sqlite3.connect(source.as_uri()+'?mode=ro',uri=True) as src:
            with sqlite3.connect(name) as dst:
                src.backup(dst)
                if dst.execute('PRAGMA integrity_check').fetchone()[0]!='ok':
                    raise RuntimeError('Backup integrity check failed.')
    finally: os.umask(old)
    return name

if __name__=='__main__':
    if len(sys.argv)!=2: raise SystemExit(__doc__)
    print(backup(Path(os.environ.get('HUB_DATA_DIR','/data/studio'))/'studio.sqlite',sys.argv[1]))
