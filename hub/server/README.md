# Dedicated Studio server

Separate app; opens the hub at `/`, not the public portfolio homepage. Single owner, Flask + Waitress + SQLite. No external AI calls, email sending or payment processing.

## Local sample preview
```
python3 -m venv /tmp/studio-venv
/tmp/studio-venv/bin/pip install -r hub/server/requirements.txt
HUB_DEMO_MODE=1 /tmp/studio-venv/bin/waitress-serve --listen=0.0.0.0:8001 --call hub.server.runner:create_app
```
Demo mode deliberately has no authentication: public SAMPLE DATA ONLY, separate `/tmp/dm-studio-demo` database. Never use demo mode for live client records. Demo changes are shared, not private.

## Private deployment
Use one server instance with a persistent private volume mounted at `/data/studio`, not an ephemeral/serverless filesystem. Serve exclusively through an HTTPS reverse proxy. Do not enable demo mode.

Set secrets in host secret settings, never in git or chat:
- `HUB_SESSION_SECRET`: cryptographically random, at least 32 characters. Generate locally with `python -c 'import secrets; print(secrets.token_hex(32))'`.
- `HUB_PASSWORD_HASH`: generate locally using Werkzeug's `generate_password_hash` with a strong unique password entered through `getpass`. Store only the resulting hash in the deployment environment.
- `HUB_DATA_DIR=/data/studio`.

Start: `waitress-serve --listen=0.0.0.0:8001 --call hub.server.runner:create_app`.
Missing secrets fail startup. Cookies are HttpOnly, Secure and SameSite Strict in private mode; local plain HTTP is only for sample demo mode. Login expires after 12 hours. Login rate limit is process-local and global to this single-owner instance (10 failed attempts per 10 minutes); place additional rate limiting at the trusted edge before production. No password reset email; owner recovery requires changing the hash, rotating the session secret and restarting via the hosting account.

## Data and backups
- Frontend gets server data on login/reload. Writes use optimistic version checks to prevent silent overwrites from a stale device/tab. It is not realtime collaboration; reload to see another device's changes.
- Save failures pause writes, keep edits on screen and prompt export/reload. Export before resolving conflicts; automatic conflict merging is not implemented.
- JSON export/import is available. No private API key/contact data is put in the source repository by this server.
- Back up SQLite consistently using `sqlite3.Connection.backup()` into protected encrypted external storage. Test a restore. Hosting disk snapshots and redundancy must be configured by the owner; this repo does not pretend a backup schedule is active.
- Source playbook markdown is served only after authentication in private mode. No filesystem upload or broad directory listing route. Resources are URLs, not uploaded files.

## Next integrations (not yet connected)
1. Choose/provision private hosting and persistent backups; bind a private hub domain with HTTPS.
2. Production security review, real-browser cross-device tests, restore test and edge rate limits; consider managed auth/MFA for longer-term use.
3. Private object storage for uploads, with file limits/scanning and signed access links.
4. AI provider key in server secrets, with explicit per-request context consent, spend limits and draft provenance. Existing prompt export requires no key and makes no AI claims.
5. Optional Gmail/Stripe integrations only after explicit authorisation. Until then record actions manually and use links; never infer payment from the project stage.

This is a working backend foundation, not a claim that a private cloud deployment exists or that security has been independently audited.

## Deployment package
See `DEPLOY.md` for the selected Render path and owner-only steps. Root `render.yaml` plus `Dockerfile` prepare a single-instance persistent deployment, with no automatic release trigger. `make_password.py` generates a salted hash without putting a plaintext password into command history. `backup.py` creates and integrity-checks a consistent SQLite snapshot outside the source repository. Backup scheduling and offsite encrypted storage are still host configuration tasks.
