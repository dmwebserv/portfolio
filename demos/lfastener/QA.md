# Preview QA
- Real Chromium desktop 1440px and mobile 390px rendering inspected.
- Both price buttons switch under a CSP that blocks inline scripts (the original deployed bug).
- Showcase hides technical reference, filtering, sourcing guide, photo-detail section and advanced RFQ; retains three featured ranges, a compact company introduction and simple contact preview.
- Catalogue restores those sections, all six ranges, search and range-detail dialogs. Product filters reset on package change.
- `?tier=showcase` and `?tier=catalogue` work after reload and can be shared from Studio.
- All local images load; no mobile horizontal overflow in tested viewport.
- Advanced enquiry form remains inert. No message sent, stored or routed to a prospect.
- Website noindex/nofollow retained. Source screenshot imagery provenance recorded in images/SOURCES.md.

Automated browser check: `scripts/test-fastener-browser.cjs` (requires Playwright and Chromium). Actual deployed account/data access is not tested by these local UI checks.
