# OpenAI in Studio — one-time owner setup

No Arena model credit/key is available to this deployed app. Use your own OpenAI API project. Never paste a key into chat, source code, a public build variable, or the Studio browser.

1. In OpenAI create a dedicated project/key for Studio. Restrict permissions to the Responses API where the provider supports it, review data controls, and set project budget alerts/limits. Provider budget notifications are not guaranteed hard spending caps. Model defaults to gpt-4.1-mini.
2. In Supabase SQL Editor run `hub/cloud/ai-quota.sql`. This adds a separate server-owned 20-request/day counter. It does not change existing project records. Failed/timed-out calls count to deter retry abuse. No exact monetary guarantee: token usage and optional web search vary.
3. In Cloudflare **Pages → Studio project → Settings → Variables and Secrets → Production**, add **OPENAI_API_KEY as an encrypted Secret** (not plaintext variable). Existing SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must also be available to Functions at runtime. Optional OPENAI_MODEL is a server variable, never a browser-supplied model.
4. Cloudflare Pages must build from the repository root so it discovers `functions/api/`. Output stays `dist/studio`. Redeploy latest code on the new branch `arena/8ba2ca78-portfolio` (or main after merge). Check build logs for Functions compilation. Static assets bypass Functions through `_routes.json`; /api/* uses the Free Workers request allowance. No paid Workers upgrade or automatic purchase is configured.
5. Open a project → AI project assistant. Start with Research without notes. Review what will be shared and the credit confirmation. Optional web search is a separate provider tool that may cost extra. Then draft a demo/email or use Prepare all three.

## Boundaries
Auth is verified against Supabase on every request, followed by owner allowlist check and atomic quota RPC. No Supabase service-role key required. The OpenAI key stays in Function secrets. Requests use store:false, but provider retention/security policies still apply; do not assume zero data retention.

Research uses OpenAI's web search when selected. No arbitrary website fetching/SSRF proxy exists. Search results/website content are untrusted evidence, never instructions. Generated facts and citations still need review. Source URL strings proposed by the model are distinct from provider-returned citations.

Generated demos are private HTML/CSS drafts saved inside your existing workspace JSON. Sandboxed preview blocks scripts/forms/network resources; downloaded drafts have a restrictive CSP. No untrusted HTML is injected into the Studio document. No public link, screenshot worker, GitHub write, email send or production deployment is automatic. Review and publish manually; existing tested demos remain the outreach-ready examples.

The app can research a supplied domain; it does NOT autonomously discover/contact arbitrary companies. The batch action reduces copy/paste, not human accountability. No live provider call was made during development without your secret. Run a small owner request after setup and check OpenAI usage. Existing free Supabase quotas (including 4 MB workspace limit) apply; remove/export old generated drafts as needed.

If unavailable: 503 usually means missing secret/runtime config/quota migration; 401 means expired session; 403 owner access; 429 daily cap. Provider failures return a generic error without exposing provider payloads or credentials. Requests are never automatically retried.

## Recommended starting workflow: no API call

Open a prospect in Studio. **Work in Arena** is the first section. Choose Build/improve, Research/qualify, Draft outreach or Plan delivery, inspect **Review / edit brief**, then **Copy Arena brief**. Paste it into a new Arena coding chat with `dmwebserv/portfolio` selected. No provider key or API spend is needed to assemble/copy the brief (Arena's own usage limits still apply).

Notes are excluded until explicitly selected. Contact details, correspondence and activity history are not included. Prior AI research and sources are included as unverified context, so review those too. After work finishes, paste the returned dated summary into project notes; there is no automatic sync from Arena. A downloaded text version and clipboard-denied manual fallback are available. The optional paid OpenAI section remains collapsed by default.
