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
