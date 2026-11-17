# Readiness report — 12 November 2026

## Passed
- Structural check: proposal, package terms and both demos have valid local file/anchor targets.
- Both demos marked noindex/nofollow; robots excludes demos; sitemap excludes demo URLs.
- Shibiao product filters show matching groups.
- £295 switch hides full-tier sections and resets filters; £695 restores sections.
- Product enquiry links preselect the correct range.
- Demo form action is intercepted; no message sent.
- Personalisation uses textContent, not HTML; hostile client-name sample remains plain text. Valid demo return route resolves.
- Python HTTP server on port 8000 returned 200 for new terms, proposal and both demos.
- git diff whitespace check passed.

Functional tests used temporary jsdom tooling outside repository. This is DOM behaviour testing, not a visual browser/accessibility audit or evidence of inbox delivery. Re-run structural checks with `python3 scripts/check-uk-export.py`.

## Not verified; must not be represented as complete
- Mobile/desktop rendering in a real browser following these latest changes.
- Third-party FormSubmit activation and actual delivery; no unsolicited test submitted.
- Current DNS authentication/inbox placement; previously configured but not rechecked here.
- Stripe invoice setup, supported methods, tax status or client bank details.
- Registrar availability/pricing, production hosting account or actual client enquiries.
- Legal compliance in recipient country or employer outside-work restrictions.
- Public deployment: files remain on working branch until published.

## Commercial launch gate
Do not send draft outreach with placeholders or non-public links. Confirm sender business details, relevant recipient, jurisdiction and working public demo first. Accepting an enquiry does not constitute a paid project; scope acceptance and cleared deposit are required.
