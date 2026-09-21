# Landing Page On-Call

## Production

- Site: <https://photo-memory.app>
- `www.photo-memory.app` permanently redirects to the apex domain.
- Host: Cloudflare Pages project `photo-memory-landing`
- Source: `justinerwang/photo-memory-landing`, branch `main`
- GitHub Pages hosting is disabled (verified 2026-09-20); the legacy `CNAME`
  file is removed. GitHub remains source control and the deployment trigger.
- Build command: `exit 0`; output directory: `.` (repository root); no framework
  build step or Pages Functions.

## Deploy

Run the smoke suite before merging:

```bash
npm install
npm run smoke
```

Open and review a pull request to `main`. Merging it triggers the production
Cloudflare Pages deployment automatically. Confirm the deployment is successful
in Cloudflare Pages and matches the merged commit.

`npm run deploy` in `server/api` deploys the API Worker, not this landing page.

## Test a Pull Request on Cloudflare

Pushing a PR branch triggers a Cloudflare Pages preview deployment. In the PR,
wait for the **Cloudflare Pages** check to pass, then open the **Preview URL** in
the Cloudflare bot comment. Confirm the comment's commit matches the PR head.

Test the changed flow at desktop and mobile widths, check for horizontal
overflow, and confirm images and links load. Preview domains use the staging API,
so test production API behavior separately after merging when needed.

## Verify

```bash
/usr/bin/curl -sSI https://photo-memory.app/
/usr/bin/curl -sSI https://www.photo-memory.app/
```

The apex should return `200`. The `www` hostname should return a permanent
redirect to the apex. Also check `/privacy`, `/terms`, and
`/upgrade-thank-you` after a production deployment.

### Crawling and missing pages

The root `robots.txt` allows public crawling. The root `404.html` makes Pages
return HTTP 404 for missing resources instead of treating this static site as a
single-page application. Keep both files in the published root. See
[Cloudflare route matching](https://developers.cloudflare.com/pages/configuration/serving-pages/).

Run the HTTP contract checks against the PR preview, then production after deployment:

```bash
PHOTO_MEMORY_LANDING_URL=https://YOUR-PREVIEW.photo-memory-landing.pages.dev npm run test:crawlability
PHOTO_MEMORY_LANDING_URL=https://photo-memory.app npm run test:crawlability
```

The checks require plain-text robots instructions, helpful HTTP 404 responses for
unknown paths (including `/.env` and `/.git/config`), and working homepage/legal
routes. They make read-only GET requests and do not submit signups or download the app.
For local validation, start `wrangler pages dev .` and set the URL to its local
address; the CTA test's simple HTTP server does not emulate Pages routing.

Also confirm the 404 page's home link works from a nested missing URL at desktop
and mobile widths. Preview hosts may independently carry Cloudflare's `noindex`
header. This cleanup does not establish or resolve the Google Ads suspension cause.

## Visitor transport security (issue #17)

Target settings: zone Minimum TLS Version **1.2**, TLS 1.3 **on**, and Always
Use HTTPS **on**. Verify actual dashboard values before treating a rollout as
complete. R2 custom domains have their own minimum-TLS setting: the zone setting
alone does not cover `downloads.photo-memory.app`.

The verification inventory is apex, `www`, `api`, `api-staging`, and `downloads`
under `photo-memory.app`. Recheck DNS and service custom domains before each rollout
for additions. The app API and updater URLs already use HTTPS; HTTP callers must
switch to HTTPS directly, especially for POST requests. Redirects do not protect
a request body that was already sent over HTTP.

### Rollout and verification

1. Save current zone settings, R2 custom-domain TLS setting, hostname overrides,
   and affected hostname inventory privately. Keep credentials out of this repo.
2. Run the checks below to capture the baseline. Raise the zone minimum to 1.2,
   retain TLS 1.3, and verify TLS handshakes and HTTPS endpoints. If R2's custom
   domain still accepts legacy TLS, set its own minimum to 1.2 and verify it.
3. Enable Always Use HTTPS, then verify every host's redirect path and query,
   API responses, and release artifact access. Investigate any hostname exception
   before claiming the entire inventory passes. Do not add broad redirects blindly.
4. Record actual before/after settings and verification results in the PR.

```bash
# Requires Node.js and OpenSSL 3 with TLS 1.0 through 1.3 support.
# Optional: OPENSSL_BIN=/absolute/path/to/openssl
npm run test:transport
PHOTO_MEMORY_LANDING_URL=https://photo-memory.app npm run test:crawlability
npm run smoke
```

`test:transport` contacts the listed live hosts. It performs TLS handshakes,
read-only GETs, and HEAD requests for downloads, without signup submissions or
full artifact downloads. Legacy TLS tests require an explicit protocol-version
alert; DNS failures, unsupported local protocols, certificate errors, and timeouts
fail the test rather than count as successful server rejection. Keep the configured
signup origins aligned with the API allowlists. A staging outage must be reported
separately, not silently skipped. These probes sample the current network path;
they do not establish compatibility for every historical client or region.

To verify TLS and HTTPS endpoint availability before enabling HTTP redirects:

```bash
node --test --test-name-pattern='TLS|HTTPS' scripts/test-transport.mjs
```

### Settings rollback

If a changed setting causes regression, restore that setting's captured prior
value immediately, then repeat endpoint checks. In **SSL/TLS → Edge Certificates**,
restore Minimum TLS Version or Always Use HTTPS independently. Restore an R2
custom domain's prior minimum through its custom-domain settings API if changed.
Do not disable domain access or detach the bucket. Reverting a Git commit or a
Pages deployment does **not** restore these account settings. HSTS and origin
SSL encryption mode are outside this rollout.

References: [Minimum TLS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/minimum-tls/),
[Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/),
and [R2 custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/).

## Rollback

For a bad landing deployment, open Cloudflare **Workers & Pages →
photo-memory-landing → Deployments** and roll back to a known-good successful
production deployment. Verify the site, then revert or fix the source change
through a reviewed PR: the dashboard rollback does not change `main`, and the
next push deploys from `main` again. This does not roll back the API or database.

Returning to GitHub Pages is a separate hosting cutover: re-enable publishing
from `main` at `/ (root)`, restore `CNAME` through a reviewed PR, configure the
custom domain and GitHub DNS targets, and verify HTTPS and the `www` redirect.
Restoring `CNAME` alone does not move traffic. Follow the detailed
[rollback procedures](./CLOUDFLARE_PAGES_MIGRATION.md#rollback).

## Incident Notes

- Landing deployments: Cloudflare Pages deployment history and logs.
- Signup/download failures: inspect `api.photo-memory.app`; it is a separate
  Cloudflare Worker.
- Keep credentials, DNS snapshots, and private incident evidence out of this
  public repo. Generic recovery procedures belong in the runbook.
- See [CLOUDFLARE_PAGES_MIGRATION.md](./CLOUDFLARE_PAGES_MIGRATION.md) for the
  migration and rollback runbook.
