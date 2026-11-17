# Distinct supplier concepts — November 2026

- Shibiao: dark graph-paper engineering identity, red WF branding, source-site product images, original unmeasured component illustrations.
- Tianyu: warm paper/rust materials identity, serif editorial headings, production-floor hero and supplier-source tape/process photographs.
- Scroll entrances and image/button transitions progressively enhance visible content. Reduced motion disables animation and keeps all content visible.
- Provenance and source limitations are in each demo's `images/SOURCES.md`; diagrams are not dimensional specifications and historical images do not verify current operations.

## Local verification
Real Chromium desktop/mobile inspection, including full pages. Automated `test-demo-identities.cjs`: both tiers at 1440/768/390/320 pixels, no horizontal overflow, six versus three cards, filters, inert enquiry forms, CSP, all image loads, scroll reveals and reduced motion. `test-fastener-browser.cjs` and `test-public-site.cjs` passed. Studio email desktop/mobile CSP preview, mocked mail/Gmail and send-state tests passed; no live email sent.

## Screenshot consumers
- Portfolio and export examples retain their shared `images/{shibiao,tyfibre}-site-preview.jpg` paths with new 1440×1000 catalogue captures.
- UK export mobile examples select new 390×844 captures; both designs also have standalone showcase captures.
- Studio and branded email choose v2 images with new manifest hashes. V1 remains unchanged for old mail snapshots. Unsent branded drafts require appearance save/review; stale queued visual snapshots cannot be retried.
- Reproduction: `scripts/capture-supplier-previews.cjs` (static port 8000, Playwright, Chromium). Do not recapture an email version after it has been used in real sends; increment versions instead.

Local checks do not confirm production deployment or mailbox delivery. No DNS/account configuration changed.
