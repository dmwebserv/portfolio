# Recommended deployment: FREE-TIER

See [cloud/SETUP.md](cloud/SETUP.md). Supabase Auth + owner-only RLS database, Cloudflare Pages static hosting. No paid Render deployment required.

# Studio — dashboard and server foundation
Open `/hub/` on the preview server (port 8000). No build step or external dependencies.

Includes local prospect CRUD, stages, search, pipeline board, next-action completion, resource links, notes, working drafts, AI context prompt preparation, JSON export/import and operational playbook links. Sample Shibiao and Tianyu records are not evidence of outreach or payment.

## Dedicated server
See `server/README.md`. A separate server on port 8001 opens the hub directly, supports owner authentication and SQLite workspace persistence with version conflict checks. The current preview uses an explicitly public sample mode with isolated sample storage. A production deployment is not yet provisioned.

## Static-preview boundaries
- When opened on the static portfolio server (`/hub/` on port 8000), uses browser localStorage only. Dedicated server mode is separate. No live AI or email integration in either mode.
- Do not enter sensitive client information on this shared unauthenticated preview.
- Anyone able to use the same browser profile can access its saved records. Backups contain plain JSON; protect them.
- AI workflow prepares text to manually copy into a chosen service. Review data before sharing. It does not call a model or scrape research links.
- Excluded from public GitHub Pages deployment through `_config.yml`; robots/noindex are not access controls. Source repository may be public; no records or secrets are written to source files.
- Playbook links work on the local server, not a production Pages deployment.

## Production requirements
Deploy as a separate private app, not a private-looking page on the public portfolio. Use managed authentication, server-validated sessions, a database with per-user row-level access rules, private file storage with signed links, encrypted transport and tested backups/export. Keep AI API keys server-side; request opt-in for the project context sent to the provider and record draft provenance. Add cross-device integration tests and account recovery before storing real client records. Provider account setup/costs must be agreed first. Do not present this prototype as secure or synced.

## Guided project workflow
Open a prospect via its company name or Manage. The project checklist has both demo preview links, five explicit review checks, a recommended next step, editable outreach email, copy/mail-app actions and manual sent/follow-up recording. First contact schedules a seven-day reply/follow-up task. One follow-up maximum; opt-out stages block outreach actions. The form does not send mail or verify eligibility automatically. Prepared messages include a postal-details placeholder which must be replaced before sending/recording. Recorded message snapshots are kept with the project. New fields are inside existing workspace JSON, so no SQL migration is needed. Existing records are retained.

AI context export can prepare a brief for further design work; this release cannot generate or publish a new website from Studio autonomously. Live AI, private uploads and email inbox sync remain unconnected.

## Home Screen / app presentation

The cloud build includes a standalone web manifest, dm. app icons, favicon and Apple Home Screen metadata. In Safari on iOS, use Share → Add to Home Screen (Open as Web App if shown); existing shortcuts may need removing/re-adding to refresh their cached icon. A new standalone install may ask you to sign in again. Internet access remains required. There is no service-worker/offline cache of private pages, records, OAuth tokens or correspondence.

Startup keeps the workspace hidden until its authenticated load completes. The login card fades in; reduced-motion preferences disable transitions. Safe-area/dynamic-viewport styling supports Home Screen mode, and the existing moving glass navigation selection is retained. This is a web-app interpretation of glass styling, not native iOS controls. Browser/Chromium checks do not replace a physical iPhone/Safari test of installation, keyboard and status-bar behaviour.

## Focused project sheets and central mailbox

Prospects open in a large, native-scrolling sheet with five keyboard-accessible tabs: Review & next step, Email & mailbox, Design & AI, Notes & resources, and Activity. Switching tabs retains in-progress inputs; saving a draft keeps the current tab selected. Manual sent-date logging is collapsed to keep it distinct from connected Gmail sending. The background blur is disabled while a sheet is open to avoid repainting the entire glass workspace during scroll. The sidebar's moving glass selection remains intact.

Mailbox lists the latest 200 owner-accessible stored mail records, with search, reply/sent/attention filters, connection management and manual reply sync. It is **not** a full Gmail inbox or a new reply composer. Follow-ups and replies continue in Gmail; new first-contact sends still require the prospect's review checks and explicit approval. Deleted prospects are not restored; historical mail remains readable. No database migration or new paid service is required.

Browser favicon corners now use real transparency; iOS touch/maskable icons retain their required opaque background. Favicon links are cache-versioned. Regenerate favicons with `PYTHONPATH=<Pillow location> python3 scripts/fix-studio-favicon.py`.

Validation: `scripts/test-studio-workspace-browser.cjs` covers 1440/768/390/320 layouts, five single-visible panes, keyboard navigation, draft/tab retention, native wheel scroll, mailbox filters/search/sync/open, escaped message text, no send calls and transparent corners. Uses mocked accounts only. Auth shell, iOS shell, cloud build, records/workflow, mail UI/send-state, Gmail/MIME and branded email preview tests also pass locally. Physical-device scroll performance and live mailbox delivery must still be tested after deployment. No private workspace data or real mailbox was changed by these checks.
