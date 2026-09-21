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
