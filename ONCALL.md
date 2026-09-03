# Landing Page On-Call

## Production

- Site: <https://photo-memory.app>
- `www.photo-memory.app` permanently redirects to the apex domain.
- Host: Cloudflare Pages project `photo-memory-landing`
- Source: `justinerwang/photo-memory-landing`, branch `main`
- The site is static HTML; there is no build output directory.

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

## Incident Notes

- Landing deployments: Cloudflare Pages deployment history and logs.
- Signup/download failures: inspect `api.photo-memory.app`; it is a separate
  Cloudflare Worker.
- Keep credentials, DNS snapshots, and rollback details out of this public repo.
- See [CLOUDFLARE_PAGES_MIGRATION.md](./CLOUDFLARE_PAGES_MIGRATION.md) for the
  migration and rollback runbook.
