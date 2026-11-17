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
