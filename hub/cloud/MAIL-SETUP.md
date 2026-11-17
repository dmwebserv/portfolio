# IONOS mailbox bridge — not activated by deploying code

## What is / isn't implemented

Studio can approve and queue a reviewed **first-contact** plain-text email, show its SMTP acceptance/uncertain state, and display replies correlated using Message-ID references and sender address. Mail is stored separately in Supabase, protected by the owner allowlist. Existing manual drafts/history remain untouched. No tracking pixels, attachments, bulk sending, automatic follow-ups or AI use of correspondence.

This is NOT a full IMAP client: existing unrelated Sent mail is not imported, no full-mailbox search, no HTML/attachments, and replies without matching headers, changed sender addresses, messages larger than 250 KB, moved out of INBOX or outside the latest 150 messages require checking IONOS manually. “No reply displayed” is not proof of no reply. Read state in IONOS is preserved. Remote HTML is never rendered in Studio.

Cloudflare Pages Functions do not offer a straightforward conventional SMTP/IMAP library environment; no paid always-on host is added here. Instead, this public repository has a **disabled-by-default GitHub Actions bridge** using Python standard-library SMTP/IMAP with TLS certificate verification. Public repositories currently generally receive standard hosted-runner usage free, subject to GitHub policy. Verify the repo's Actions/billing settings; do not buy/upgrade a plan. Scheduled runs are **best effort**, can be delayed/dropped, and GitHub can disable schedules after 60 days of repo inactivity. This is not an instant or guaranteed mailbox watcher. Minimum proposed interval: 10 minutes. A cron entry alone does not establish working mail connectivity.

## One-time setup (secrets never in chat)

1. Supabase SQL Editor: run `hub/cloud/mail.sql` once. This migration adds mail storage and an atomic queue claim, without modifying existing workspace data.
2. GitHub repository → Settings → Secrets and variables → Actions → **Secrets**. Add:
   - `STUDIO_SUPABASE_URL`: same project URL used by Studio.
   - `STUDIO_SUPABASE_SERVICE_KEY`: Supabase's **legacy service_role JWT** (Project Settings → API keys → legacy keys). Powerful server-only credential: it bypasses RLS. Only the default-branch runner uses it; never put it in Cloudflare's static build, browser config, public code or chat. If you don't want GitHub to hold this credential, do not enable this bridge.
   - `STUDIO_MAIL_OWNER_ID`: your Supabase Authentication → Users → user UUID (not email).
   - `STUDIO_MAIL_USERNAME`: full IONOS mailbox address.
   - `STUDIO_MAIL_PASSWORD`: that mailbox's password / dedicated app password if your account supports one. This is NOT your IONOS account login password. IMAP access must be enabled for the mailbox.
3. Leave `STUDIO_MAIL_ENABLED` unset initially. Deploy Studio from main. A manual Actions → Studio mailbox sync → Run workflow should say disabled without contacting mail.
4. To activate, add the Actions **Variable** `STUDIO_MAIL_ENABLED` = `true`. Run the workflow manually on main. The first run with an empty queue checks INBOX access; SMTP is checked only on a real send. If configuration fails, logs show a generic failure rather than mailbox contents. No DNS, nameserver, SPF or mailbox routing changes are required by this code.
5. Use a new test prospect with an email address you control, an actual saved subject/body with no placeholders, and all review checks complete. Approve & queue from Studio, then run the Action manually. Verify SMTP acceptance in Studio, receipt at your test address and Sent folder copy. Reply from that exact address, keeping the thread headers. Run again, refresh Studio, verify “Reply received” and disabled outreach buttons. Only after that controlled test should you use real outreach. This test sends a real email and requires your explicit approval.

## Safety and recovery

- First-contact only: connected follow-ups/replies are deliberately not sent in this version. Respond in IONOS. Existing manual follow-up UI is disabled when connected outbound/reply records are loaded. Missing/failed sync is never a reason to assume consent or no reply.
- A unique first-contact constraint and atomic claim prevent duplicate workers sending a queued row. Exact repeats have a content digest. Claims are never retried automatically, even after a crash. A row stuck at `sending` must be treated as **uncertain**; check the real mailbox before manual action. SMTP accepted does not mean delivered. Bounce handling is not automated.
- Queue items older than 24 hours are cancelled; current opt-out stage, recipient, draft and checks are rechecked before sending. Already-accepted mail cannot be recalled. Opting out immediately before SMTP can race; use the kill switch and do not rely on cancellation after queueing.
- To pause: set Actions Variable `STUDIO_MAIL_ENABLED` to `false`, then cancel any running mail Action. Already in-flight SMTP may finish. Pending rows remain queued and can send when re-enabled (unless expired); review/cancel them in Supabase first. Delete only queued rows, never erase uncertain/accepted records to force a retry.
- A Sent-folder append is separate from SMTP. A failed append is explicitly shown and never causes a resend.
- No mailbox content or credentials are intentionally logged; GitHub workflow logs/status and run timing are public in this repository. GitHub secrets are available to trusted default-branch workflow code: review collaborators and workflow changes, use 2FA, rotate secrets if compromised. This is a tradeoff, not zero-trust secret isolation.
- Email bodies add personal-data storage in Supabase. Workspace JSON export does not include this separate table. Set a retention policy, export/delete mail records separately as needed, keep opt-out records, and update your privacy information before real outreach.

## Deployment / limits

Cloudflare `/api/mail` uses existing Supabase owner authentication and same-origin POST validation. No additional Cloudflare runtime mail secret needed. Supabase service-role key is GitHub only. Runner uses fixed `smtp.ionos.co.uk:465` and `imap.ionos.co.uk:993`; verify these match your UK IONOS mailbox product before activation. No automatic port/host fallback. No paid resources provisioned.

Local tests mock all external systems. Live IONOS credentials, hosted-runner connectivity (including any outbound SMTP restrictions), provider acceptance, Sent-folder naming, schedule reliability and the reply round trip have NOT been verified. If hosted SMTP is unavailable, stop and choose a different bridge; do not disable TLS or silently switch providers. Until the owner-controlled round-trip test passes, keep sending/reading through IONOS normally.

Queued emails also have a **Cancel queued email** button. Cancellation succeeds only before the worker atomically claims the row; after that, treat it as potentially sent. Cancellation is retained as a failed/cancelled record rather than silently removing history. An identical cancelled draft remains deduplicated; do not use cancellation as a resend mechanism.
