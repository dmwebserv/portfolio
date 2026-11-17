# Studio — £0-first deployment (recommended)

Do not use the legacy paid Render blueprint. No Render account/card required.

## 1. Supabase: free project and owner account
1. Create/sign into Supabase and create a project on the **Free organisation plan**, choosing a nearby region. Store the database password privately. Do not enable paid add-ons.
2. Open SQL Editor and run `hub/cloud/schema.sql` from this branch.
3. Authentication → Users → Add user → Create user. Create your own email/password login and mark email confirmed using the admin dashboard option. Use a unique password from your password manager. No public signup UI or transactional email is needed.
4. Copy that user's UUID. Run this separately in SQL Editor, substituting your UUID:
   ```sql
   insert into public.studio_owners(user_id) values ('YOUR-AUTH-USER-UUID');
   ```
5. Authentication settings: disable **Allow new users to sign up**. Even if accidentally enabled, RLS denies workspace access to anyone absent from the owner allowlist. Configure session/security settings as appropriate. Do not disable RLS.
6. Project settings / Connect dialog: note the project URL and **publishable key** (or legacy anon key). These are intentionally public browser configuration. NEVER use a secret key, service_role key, database password or access token in the build configuration/code/chat.

## 2. Cloudflare Pages: static shell
1. Sign into Cloudflare → Workers & Pages → Create → Pages → Connect Git repository. Use the free Pages path, not a paid Worker or Render service. No domain transfer required.
2. Connect `dmwebserv/portfolio`. Select branch `arena/55698364-portfolio` until these changes are merged. App name such as `dm-studio` (availability not guaranteed).
3. Framework preset: None. Repository root: unchanged. Build command:
   ```
   python3 scripts/build-studio-cloud.py
   ```
   Output directory: **dist/studio**. Never publish the repository root.
4. Build environment variables:
   - `SUPABASE_URL` = your project HTTPS URL.
   - `SUPABASE_PUBLISHABLE_KEY` = your public publishable key (or legacy anon key).
5. Deploy. Use the supplied `*.pages.dev` HTTPS address; no custom domain purchase needed. In Supabase Auth URL settings set Site URL to this exact address. This release uses password login, not redirect/magic-link login.
6. Open `/login` and sign in. Shell, generic templates and demos are public; confidential project data is in the RLS-protected database, not static files or source code.

## 3. Verify BEFORE real records
- Logged out browser: REST access using only public key must not reveal workspace data.
- Owner: create a non-sensitive record, reload and check it on a second device.
- Non-owner: create a temporary second Auth user using dashboard (leave off allowlist), sign in in another browser. Confirm workspace read is empty and write is denied. Delete test user after check. Public signup alone must not grant access.
- Stale tab: try conflicting edits; old tab must show error rather than silently overwrite.
- Export JSON to private storage, test import with a disposable record; protect plain-text backups.
- Sign out, reload and confirm login is required to load records. Supabase access tokens expire; sign-out revokes the refresh session but an already copied access token may remain usable until expiry. Use short appropriate token lifetime/provider controls for emergency access revocation; removing owner allowlist entry denies data access immediately.
- Use a trusted browser profile. Tokens live in browser storage (as in many SPAs); this is not the HttpOnly-cookie Python backend. CSP and escaped rendering reduce but do not eliminate XSS risk. Never paste unknown scripts into the console.

## What is free / limitations
Checked official pricing/docs during preparation:
- https://supabase.com/pricing — Free lists 500 MB DB, 1 GB files, 50,000 monthly active users, 5 GB egress; projects pause after one week of inactivity. Two active Free projects. Paid daily database backups are not promised on Free.
- https://developers.cloudflare.com/pages/platform/limits/ — Free lists 500 builds/month and static hosting limits. This app uses no paid functions.
Stay on Free, monitor limits and decline upgrades. No automated keep-alive used to bypass inactivity rules. Paused project may need restoring from dashboard before login works. Free quotas/terms can change. No promise of unlimited availability or permanent free service.

## Working now / not connected
- Working integration code: password auth, session refresh, owner-only workspace, optimistic save conflicts, local export/import.
- Generic playbook and existing concept demos included in static build. No private project data gets bundled.
- Live AI still manual prompt export. No API key/cost.
- File resources are links; private uploads are NOT implemented merely because storage allowance exists.
- No Gmail, Stripe, scheduled backups, MFA workflow or realtime subscriptions. Reload to see another device's changes. Back up using private JSON exports; production/offline restore checks are owner tasks.

Account provisioning and live RLS verification cannot be completed from the repository without your provider authorisation. Never send account passwords here. Project URL and publishable key are not administrative credentials, but prefer entering them directly into Pages build settings.

## Public website separation
Public proposal/legal URLs on Studio redirect to `https://dmwebservices.co.uk/`. Deploy the repository main branch through its existing GitHub Pages configuration for those pages. Studio deployment still uses only `dist/studio`; it does not publish or replace the public homepage. Demo previews remain available on both hosts.

## Optional OpenAI project assistant

For owner-only research, private HTML concepts and email drafts, follow [OPENAI-SETUP.md](OPENAI-SETUP.md). This requires an encrypted runtime secret and the separate `ai-quota.sql` migration; existing Studio functions without it. Never put the provider key in the static build.

## Optional dedicated Gmail connection

See [MAIL-SETUP.md](MAIL-SETUP.md). Disabled until explicitly configured/enabled. Uses server-side Gmail OAuth for immediate approved first sends and on-demand replies, with optional scheduled HTTPS reply checks. The previous SMTP/IMAP sending worker is retired. Do not use real outreach until an owner-controlled send/reply round trip has passed.
