# Cloudflare Pages Hosting Migration

Status: Approved plan
Date: 2026-09-02

## Objective

Move `photo-memory.app` landing-page hosting from GitHub Pages to Cloudflare
Pages while retaining GitHub as the source repository, pull-request system, and
deployment trigger.

```text
GitHub repository
      | push to main
      v
Cloudflare Pages build and deployment
      |
      v
photo-memory.app
```

## Cost expectation

The landing page should fit within the Cloudflare Pages Free plan:

- Static asset requests are free and unlimited when they do not invoke Pages
  Functions.
- The Free plan includes 500 builds per month.
- A Free-plan Pages site can contain up to 20,000 files.
- The maximum individual static asset size is 25 MiB.
- This repository is a small static HTML site and does not use Pages Functions.

Domain registration remains a separate annual expense. Browser calls from the
landing page to the existing Photo Memory API continue to consume that API's
normal Cloudflare Workers allowance; migrating the static HTML does not create a
new compute charge.

References:

- [Cloudflare Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

## Current state

- GitHub repository: `justinerwang/photo-memory-landing`
- Production branch: `main`
- GitHub Pages publishes the repository root through its legacy branch-based
  build.
- `CNAME` configures `photo-memory.app` for GitHub Pages.
- The domain already uses Cloudflare nameservers.
- The site is plain static HTML with no application build step.
- `npm run smoke` is the canonical static and rendered browser verification.
- `photo-memory.app` and `www.photo-memory.app` use the production API. Other
  hosts, including `*.pages.dev` previews, intentionally use the staging API.

## Target configuration

Create a Cloudflare Pages project with these settings:

| Setting | Value |
| --- | --- |
| Repository | `justinerwang/photo-memory-landing` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `.` |
| Pages Functions | None |
| Production domains | `photo-memory.app`, `www.photo-memory.app` |

Cloudflare's native GitHub integration is the preferred steady-state deployment
mechanism because it deploys pushes to `main`, reports checks in GitHub, and
creates preview deployments for eligible pull requests.

If rollout must remain entirely CLI-driven, use a GitHub Actions workflow that
runs `wrangler pages deploy`. Store a narrowly scoped Cloudflare API token and
account identifier as GitHub Actions secrets. This alternative adds workflow and
credential-management overhead and must be selected when the Pages project is
created so the automation path is unambiguous from the first deployment.

References:

- [Deploy a static HTML site](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)
- [Cloudflare Pages GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)

## Migration sequence

### 1. Create the Pages project

1. Grant the Cloudflare Workers and Pages GitHub App access only to
   `justinerwang/photo-memory-landing`.
2. Create the Pages project with the target configuration above.
3. Do not attach the production domains yet.
4. Confirm the first `main` deployment succeeds at its `*.pages.dev` address.

### 2. Validate the preview deployment

1. Run `npm run smoke` against the checked-out production commit.
2. Verify these Pages routes:
   - `/`
   - `/privacy.html`
   - `/terms.html`
   - `/thank-you.html`
   - `/upgrade-thank-you.html`
3. Confirm there are no browser console errors or failed static assets.
4. Compare the rendered page with the current production site at desktop and
   narrow viewport sizes.
5. Verify the preview host selects `api-staging.photo-memory.app`.
6. Exercise the beta-signup flow against staging and confirm it creates only a
   pending application.
7. Verify the download action follows the stable staging API endpoint to the
   expected artifact.

### 3. Prepare the production cutover

1. Record the current DNS records so they can be restored during rollback.
2. Add `photo-memory.app` as a custom domain on the Pages project.
3. Add `www.photo-memory.app` as a custom domain.
4. Configure a permanent redirect from `www.photo-memory.app` to
   `photo-memory.app`.
5. Let Cloudflare create or update the Pages DNS records and issue certificates.

The apex domain is already a Cloudflare zone, so no nameserver migration is
required. The custom domains must be associated with the Pages project before
their DNS records point to it.

Reference: [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)

### 4. Verify production

Treat the cutover as successful only after all of the following pass:

- `https://photo-memory.app/` serves the expected production commit.
- HTTPS is valid and redirects do not loop.
- `www.photo-memory.app` redirects permanently to the apex domain.
- All static and legal pages return successfully.
- No browser console errors or failed static assets appear.
- The production hostname selects `api.photo-memory.app`.
- Beta signup uses the production Turnstile configuration and returns the
  expected pending-only response.
- Download links use `https://api.photo-memory.app/v1/downloads/latest` and
  reach the expected release artifact.
- Analytics requests still fire as expected.
- A subsequent test push or approved content change produces a successful
  Cloudflare Pages deployment from `main`.

### 5. Soak with GitHub Pages available for rollback

Keep GitHub Pages enabled but non-authoritative for approximately 24 hours after
the DNS cutover. Do not remove `CNAME` during this window. Monitor the landing
page, beta-signup configuration, download flow, certificate state, and Pages
deployment status.

### 6. Retire GitHub Pages

After the soak period passes:

1. Disable GitHub Pages hosting for the repository.
2. Remove the GitHub-specific `CNAME` file in a normal pull request.
3. Confirm Cloudflare Pages continues serving both production domains.
4. Leave the GitHub repository, branches, pull requests, and issues unchanged.

## Rollback

During the soak window:

1. Restore the recorded DNS records that routed the domain to GitHub Pages.
2. Confirm `photo-memory.app` serves the prior production site.
3. Investigate the Pages deployment without deleting it.

After GitHub Pages has been disabled, rollback requires re-enabling GitHub Pages,
restoring its custom domain if necessary, and restoring the previous DNS records.
Because changing a custom domain away from Pages can deactivate it, verify the
Pages custom-domain status again before attempting a later cutover.

## Security and operational constraints

- Grant the Cloudflare GitHub App access only to the landing repository.
- Do not add Pages Functions unless a separate design establishes the need and
  accounts for Workers quotas.
- Keep the public beta-signup endpoint pending-only; it must not grant an invite,
  session, entitlement, or download access.
- Keep production and staging API/Turnstile configuration separate.
- Do not expose Cloudflare credentials in the repository. If using GitHub
  Actions, store only a narrowly scoped token in repository secrets.
- Do not disable GitHub Pages or remove `CNAME` until production verification
  and the rollback soak have passed.

## Completion criteria

The migration is complete when:

- Cloudflare Pages serves `photo-memory.app` and `www.photo-memory.app` with
  valid HTTPS.
- GitHub `main` remains the source of production deployments.
- Preview deployments use staging services and production domains use
  production services.
- The smoke suite and production browser checks pass.
- GitHub Pages is disabled after the soak period.
- The obsolete `CNAME` file is removed.
- The rollback procedure and final Cloudflare project settings are documented.
