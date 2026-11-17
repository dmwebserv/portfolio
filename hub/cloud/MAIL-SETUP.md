# Dedicated Gmail connection — owner setup

## Current state

The never-activated IONOS SMTP/IMAP worker has been replaced. Gmail is the working inbox and already sends as the verified domain address via IONOS. Leave that Gmail setting, mailbox, DNS and nameservers unchanged. No mailbox password is needed by Studio. No Drive permissions are requested. Studio uses the Gmail HTTPS API from Cloudflare Functions.

**Disabled until explicitly configured.** Local tests use mocks only. Do not use real outreach until an owner-controlled send/reply round trip succeeds. Gmail account identity, send-as behaviour and hosted OAuth have NOT been verified live.

### Implemented
- Owner-only Connect Gmail with Google OAuth, PKCE, expiring encrypted HttpOnly state cookie and exact configured callback origin.
- One dedicated Google mailbox; the profile must match GOOGLE_MAILBOX_EMAIL, and GOOGLE_SEND_AS_EMAIL must be an accepted Gmail send-as identity.
- Explicit approval of a saved, reviewed first email; immediate Gmail API submission, not a scheduled send. Database uniqueness and atomic claim prevent duplicate requests.
- Separate owner-protected mail history. Refresh tokens are AES-GCM encrypted in a service-role-only Supabase table; never sent to the browser. Encryption/client secrets remain in Cloudflare runtime secrets.
- Reply checks on demand, or optional best-effort scheduled checks. Matching uses Gmail thread, reference headers and recipient sender address. No tracking pixels or attachment downloads. Reply bodies are rendered as text, never HTML.
- Uncertain sends are NOT retried. Reply checks attempt to reconcile an uncertain send with Gmail Sent using the pre-persisted RFC Message-ID.
- Once the prospect is opened/refreshed, accepted mail is reflected in the project and a recorded reply pauses follow-up reminders. There is no live push into an already-open page.

### Deliberate limits
First-contact only; send replies and follow-ups in Gmail. Existing unrelated Sent mail isn't imported. This is not a full mail client. Sender matching is not authenticity verification; changed-address replies, new conversations without references and bounces need manual checking. A missing displayed reply does not prove no reply.

Each sync checks five least-recently-checked tracked threads, importing at most five replies, to keep within the Pages Free per-request subrequest budget. Older tracked threads rotate through subsequent runs. At larger volumes this needs batching/history cursors, not a promise of instant monitoring. Sync currently supports one owner mailbox. Gmail message/thread data may contain personal information; no email content is automatically sent to OpenAI.

## 1. Google Cloud / Google Auth Platform

Use the dedicated Google account and create/select a project, e.g. **dmwebservices Studio**. No paid server, domain transfer or Workspace upgrade is required by this code; do not add a billing account solely for this integration.

1. Google Cloud Console → APIs & Services → Library → enable **Gmail API**.
2. Configure Google Auth Platform (OAuth consent screen): app name **dmwebservices Studio**, your own support/developer email. For a normal @gmail.com account use External audience. Only your dedicated account needs access initially.
3. Configure Web application OAuth client. Add **https://studio.dmwebservices.co.uk/api/gmail/callback** as an exact authorised redirect URI. Use your actual production Studio origin consistently; no trailing slash on STUDIO_ORIGIN, no preview hosts. JavaScript origins are not needed for this server-side redirect flow.
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.settings.basic`

`gmail.settings.basic` is requested only to verify the accepted domain send-as identity (Google's permission is broader than this read operation). The code does not modify Gmail settings or SMTP configuration. Gmail read access is broad and restricted by Google's scope classification even though code reads tracked threads only. Review Google's consent carefully.

**Token expiry / verification:** External apps in Testing generally have seven-day refresh-token expiry for these scopes. Add your account as a test user for the controlled test, but do not call it a durable setup. Before relying on it, review publishing the OAuth app to Production and Google's current personal-use / unverified-app / restricted-scope requirements. A personal single-user app may qualify for verification exceptions, but publishing does not automatically grant verification. Do not bypass a Google block. If Google requires a verification/security process you cannot meet on the free personal-use basis, stop and reassess rather than promise the connection will last. Company-wide/public use requires a separate review.

## 2. Supabase and encrypted Cloudflare runtime configuration

Run **hub/cloud/mail.sql** in Supabase SQL Editor. It is safe to run whether or not the earlier IONOS migration was installed. Existing workspace records are untouched. Browser roles cannot read the Gmail token table. Mail bodies are separate from workspace JSON export.

Cloudflare → Pages → Studio → Settings → Variables and Secrets → Production:

**Encrypted Secrets**:
- GOOGLE_CLIENT_SECRET: OAuth web client's secret.
- SUPABASE_SECRET_KEY: server-only Supabase secret API key (starts with `sb_secret_`). Powerful RLS-bypassing credential: never put it in browser config, plaintext public build variables or chat.
- MAIL_TOKEN_KEY: 32 random bytes encoded as base64/base64url. Generate privately, for example with `openssl rand -base64 32` on your own computer; paste directly into Cloudflare, never here. Back it up securely. Losing/changing it means reconnecting Gmail. Do not use an ordinary password of the same length.
- MAIL_SYNC_SECRET: optional scheduling token, at least 32 random characters. Only required for external scheduled sync.

**Runtime variables**:
- GOOGLE_CLIENT_ID: OAuth web client ID.
- GOOGLE_MAILBOX_EMAIL: actual dedicated Google account address (usually ...@gmail.com), not the domain alias.
- GOOGLE_SEND_AS_EMAIL: danny@dmwebservices.co.uk (or the already verified domain identity).
- STUDIO_ORIGIN: https://studio.dmwebservices.co.uk
- GMAIL_ENABLED: **false** initially. This gates sending and reply sync, but allows Connect Gmail.
- Existing SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must remain available at runtime.

No provider/service-role/encryption secret is copied by the static build script. The build uses only the existing public Supabase key. Protect the Cloudflare project and repository collaborators with strong account security: trusted server code can access these secrets.

## 3. Deploy, connect, controlled test

1. Deploy main to Cloudflare Production. Open a prospect → Connected mailbox → **Connect Gmail**.
2. Google should show the dedicated account and requested Gmail permissions. Authorise only if the app/account is yours. On success you return to Studio; open a prospect again to inspect connection status. The callback never returns tokens in the URL.
3. If callback returns `?gmail=failed`, check client credentials, exact redirect URI, Google test-user/app status, granted scopes, actual account address, verified send-as identity, SQL migration and server secrets. Error details/tokens are deliberately not exposed to browser/logs.
4. Set GMAIL_ENABLED=true and redeploy. Use a **test prospect at an address you control** with a real saved subject/body, no bracketed placeholders, a demo link and five completed reviews. Click Approve & send first email. This sends a REAL message and requires your approval.
5. Confirm in Gmail Sent and at the receiving test address: From is the domain identity, body is correct, one send only, and Studio shows Gmail accepted. Reply from that exact recipient, preserving the thread. **Check sent mail & replies** in Studio; confirm reply displayed, reminder paused, send controls disabled. Check on mobile too. Only then start outreach.

A Gmail acceptance response is not delivery confirmation. If state is `sending` or `uncertain`, inspect Gmail Sent. Never delete a claimed record merely to force another attempt. A `queued` row after a preflight/config failure is retained but no scheduled job will send it; use Cancel queued email, fix setup, and review the draft. Exact repeats remain deduplicated.

## 4. Optional scheduled reply checks

On-demand sync works without GitHub secrets. For unattended checks the public repository's **Studio Gmail reply sync** Action makes one authenticated HTTPS POST; it never receives mailbox OAuth/client/service-role secrets and never sends an email.

GitHub → repository Settings → Secrets and variables → Actions:
- Secret STUDIO_MAIL_SYNC_URL = https://studio.dmwebservices.co.uk/api/mail-sync
- Secret STUDIO_MAIL_SYNC_TOKEN = the same value as Cloudflare MAIL_SYNC_SECRET
- Variable STUDIO_GMAIL_SYNC_ENABLED = true

Schedule: approximately every ten minutes, best effort. GitHub may delay/drop runs or disable schedules after repo inactivity (commonly 60 days). Public Actions run timing and logs are public; logs intentionally omit response bodies/mail data. Verify current free-runner/billing policy before activation; no paid upgrade is configured. Use Actions → Run workflow for a controlled sync test. Old STUDIO_MAIL_ENABLED and IONOS/STUDIO_SUPABASE_* Actions credentials are no longer used; remove them if you previously added them.

A Cloudflare scheduled Worker could replace this scheduler later. No Pub/Sub push, guaranteed timing or always-on watcher is configured by this implementation.

## Disconnect / pause / data

- Set GMAIL_ENABLED=false and redeploy to stop new send/sync requests; already in-flight requests can finish. Turn off STUDIO_GMAIL_SYNC_ENABLED as well to stop scheduler attempts.
- Disconnect Gmail removes the encrypted stored refresh token and attempts Google revocation. If revocation cannot be confirmed, remove the app in Google Account → Third-party connections too. Message history remains; disconnect is not a deletion request. Rotating the OAuth client's credentials alone doesn't delete mail records.
- Keep the IONOS mailbox and Gmail send-as/forwarding configuration unchanged. No IONOS password is needed by Studio.
- Define mail retention and deletion/export procedures and update your privacy information before real outreach. Bodies in Supabase are not part of the browser workspace export; Gmail remains the primary mailbox and source of truth. Retain minimal opt-out records. A dedicated account reduces accidental exposure, not the need for privacy safeguards.
- Google Drive is a separate future integration, not enabled or requested here.

## Safe scheduler diagnostics

The scheduled trigger now reports an HTTP status plus a fixed allowlisted diagnostic, never raw response bodies, URLs, tokens or exception payloads. Redirects are rejected rather than forwarding credentials. HTTP 200 HTML/login pages are not treated as success. A 403 without an endpoint diagnostic may be from Cloudflare Access/WAF or an older endpoint deployment; inspect the matching Cloudflare security event before changing any rule. Do not disable site-wide security or regenerate keys speculatively. `SYNC_UNAUTHORIZED` specifically means the endpoint rejected the bearer token. `SYNC_DATABASE_FAILED` and `SYNC_GMAIL_FAILED` mean authentication passed and identify the later failing stage. New endpoint codes require the updated Production deployment; the trigger still prints HTTP status for older deployments.

## Professional email presentation

Run `email-presentation.sql` once for an existing deployment (new installs already include its two columns in `mail.sql`). No OAuth scopes or secrets change. Studio's Connected mailbox section offers Professional or Plain text, an editable body, a sandboxed desktop/mobile-responsive preview and **Prepare personal introduction**. Business postal details must be entered, saved and present in a professional draft; Studio reuses saved details from another prospect as a starting point. These details remain private project records, not public source code. Do not use a made-up address.

Professional emails use the existing dm. signature logo and a curated screenshot for the two known demo paths. Generic projects get no invented screenshot. Demo links resolve to the main public domain, not private Studio. Screenshot captions identify the independent/unofficial concept. Images are CID MIME parts, not remotely loaded pixels; there is no open or click tracker. Gmail recipients may still block images or show inline parts as attachments. Always test the result in your real recipient inbox on desktop and mobile before real outreach.

The plain-text fallback is the saved draft itself. Server-generated HTML and its template configuration are stored alongside the text in `studio_mail`. The server rejects changed appearance, recipient or text after review, fetches only fixed versioned public assets and checks their SHA-256 digests before claiming a send. Deployment must include `images/email/` on the public site before sending professional email. Never overwrite versioned assets: create a new version and update the manifest/template together. Old records keep their exact HTML snapshot; asset filenames/digests document the embedded version.

A preflight failure leaves a queued record. After fixing setup/assets, **Review & retry queued email** requires fresh approval and an identical saved snapshot; the atomic claim still permits at most one attempt. Sending/uncertain/accepted records cannot be retried by this feature. Plain-text remains available for existing workflows. Sending logic is still first-contact only; this does not implement the future Mailbox tab or threaded outgoing replies.
