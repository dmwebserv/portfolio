# Private Studio deployment — owner checklist

## Chosen deployment path
A single Docker web service on Render with persistent disk and managed HTTPS. This is a recommendation/configuration, **not a service already provisioned**. Review Render's current web-service and persistent-disk prices before accepting any charge. GitHub Pages cannot run the private backend.

The root `render.yaml` configures the hub only. It does not change the portfolio site's domain or merge this branch. You can use the provider's default HTTPS service URL first; a custom studio subdomain can come later without touching existing mail/MX records.

## Owner steps
1. Sign in to your own Render account. Connect GitHub through Render's normal authorisation screen, granting only this repository where possible. No token/password in chat.
2. Create a Blueprint deployment from `dmwebserv/portfolio`, selecting the branch containing these changes (`arena/55698364-portfolio` until merged). Review `render.yaml`, service region and pricing. Keep one instance: SQLite data lives on its persistent disk.
3. Generate a password hash **on your own computer**:
   ```sh
   python3 -m venv .studio-setup
   .studio-setup/bin/pip install -r hub/server/requirements.txt
   .studio-setup/bin/python hub/server/make_password.py
   ```
   The script prompts privately; use a password manager and a unique 16+ character password. Paste the resulting salted hash into Render's `HUB_PASSWORD_HASH` secret setting, not chat. Save the password in your password manager. Windows uses `.studio-setup\Scripts\python.exe` and `pip.exe`.
4. Let the blueprint generate `HUB_SESSION_SECRET`. Verify `HUB_DEMO_MODE=0`, `HUB_DATA_DIR=/data/studio` and the persistent disk mounted at `/data`. Never reuse a sample database for production.
5. Deploy. Visit the HTTPS service URL: it must open **Sign in**, not the dashboard. A private/incognito request to `/api/workspace` must return 401. `/health` should report `demo: false`.
6. Sign in on laptop, create a non-sensitive test prospect, reload, then sign in on phone and confirm it appears. Test editing, export, logout and the stale-tab conflict warning. Refresh browser assets after future releases.
7. Set up private encrypted offsite backups using `python -m hub.server.backup /your-private-backup-directory`. Copy snapshots off the persistent disk into a separately protected backup location. Do not rely on a same-disk snapshot as disaster recovery. Scheduling/storage is NOT configured by the blueprint.
8. Restore-test a snapshot to an isolated instance: stop writes, back up the current DB, replace with the snapshot, check integrity and sign in to verify records. Never experiment with the only live copy. Set a daily backup schedule and retention after the successful test.
9. Review edge login rate limiting and security settings before adding sensitive records. No MFA is built in; use the host's access gateway if stronger access control is required, or add managed authentication before scaling beyond single-owner use.

## Deployment behaviour and limitations
- No automatic deploy trigger: review releases before deploying. Persistent disk does not live in the source image.
- Secure session cookies require HTTPS. Twelve-hour sessions; changing the password hash invalidates existing sessions. Rotate the session secret for emergency revocation as well.
- Startup creates volume ownership as root, then drops to UID/GID 10001 before serving the app.
- Daily backups, live AI, document uploads, Gmail and Stripe are separate integrations, not secretly enabled by deployment.
- No automatic payments, emails or customer-site publication.
- Actual Docker build, provider volume permissions, HTTPS cookies, browser rendering and offsite restore must be verified on the host. Local tests are not a substitute for that deployment check.

## If anything goes wrong
Keep sample mode off. Inspect host logs without copying credentials or client data into chat. Export working data before migrations. Rotate any exposed credentials in the provider dashboard. A lost password is recovered by generating a new hash and updating the secret, then restarting. The app has no email password-reset route.
