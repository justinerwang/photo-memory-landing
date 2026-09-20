# Cloudflare Pages Hosting Migration

Status: Cloudflare Pages in production; GitHub Pages disabled
Plan date: 2026-09-02
Retirement status verified: 2026-09-20

## Objective

Cloudflare Pages hosts `photo-memory.app`. GitHub remains the source repository,
pull-request system, and deployment trigger. This document records the final
hosting configuration, the historical migration sequence, and recovery steps.

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
- Production host: Cloudflare Pages project `photo-memory-landing`.
- GitHub Pages hosting is disabled (`has_pages: false`, verified 2026-09-20).
- The obsolete GitHub Pages `CNAME` file has been removed. Cloudflare custom
  domains and DNS control production routing; a repository `CNAME` is not needed.
- The domain already uses Cloudflare nameservers.
- The site is plain static HTML with no application build step.
- `npm run smoke` is the canonical static and rendered browser verification.
- `photo-memory.app` and `www.photo-memory.app` use the production API. Other
  hosts, including `*.pages.dev` previews, intentionally use the staging API.

## Production configuration

The Cloudflare Pages configuration is:

| Setting | Value |
| --- | --- |
| Project | `photo-memory-landing` |
| Repository | `justinerwang/photo-memory-landing` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `.` |
| Pages Functions | None |
| Production domains | `photo-memory.app`, `www.photo-memory.app` |

Cloudflare's native GitHub integration deploys pushes to `main`, reports checks
in GitHub, and creates preview deployments for eligible pull requests. Retiring
GitHub Pages does not remove this integration or change repository access.

The stable `photo-memory-landing.pages.dev` hostname is the staging integration
acceptance surface. It is explicitly allowlisted by the staging API and
Turnstile widget. Branch- and deployment-specific Pages hostnames verify the
static build, routes, and rendering only; do not widen CORS or Turnstile to a
wildcard preview origin.


References:

- [Deploy a static HTML site](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)
- [Cloudflare Pages GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)

## Historical migration sequence

These steps describe the original cutover and soak. GitHub Pages is now disabled;
do not re-enable it unless following the explicit fallback below.

### 1. Create the Pages project

1. Grant the Cloudflare Workers and Pages GitHub App access only to
   `justinerwang/photo-memory-landing`.
2. Create the Pages project with the target configuration above.
3. Do not attach the production domains yet.
4. Confirm the first `main` deployment succeeds at its `*.pages.dev` address.

### 2. Validate the stable preview deployment

1. Run `npm run smoke` against the checked-out production commit.
2. Verify these Pages routes:
   - `/`
   - `/privacy.html`
   - `/terms.html`
   - `/upgrade-thank-you.html`
3. Confirm there are no browser console errors or failed static assets.
4. Compare the rendered page with the current production site at desktop and
   narrow viewport sizes.
5. Verify the preview host selects `api-staging.photo-memory.app`.
6. Exercise the beta-signup flow against staging and confirm it creates only a
   pending application.
7. Verify the download action follows the stable staging API endpoint to the
   expected artifact.

For an eligible pull request, separately confirm that Cloudflare reports a
successful preview deployment and that its static routes render. Run the
staging API, Turnstile, signup, and download checks on the stable project
hostname above.

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

### Recover a bad Cloudflare deployment

1. Open Cloudflare **Workers & Pages → photo-memory-landing → Deployments**.
2. Select a previous successful **production** deployment whose commit is known
   to work, and use **Rollback to this deployment**. Preview deployments are not
   production rollback targets.
3. Verify the apex, permanent `www` redirect, valid HTTPS, legal pages, signup,
   download, and analytics using the production checks above.
4. Revert or fix the bad source change through a reviewed GitHub pull request.
   A dashboard rollback changes the served deployment, not Git history; a later
   push to `main` can deploy the bad code again if it is still in the branch.

This recovery keeps the Cloudflare custom domains, DNS, and GitHub integration.
It does not roll back the separate API Worker, database, or download artifacts.

Reference: [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)

### Fall back to GitHub Pages hosting

Use this only when Cloudflare hosting itself must be replaced. It is a hosting
cutover and may require DNS propagation and certificate provisioning time.

1. Save the current Cloudflare DNS records (type, name, target, proxy status,
   TTL), custom-domain settings, and production deployment commit privately.
   Current Cloudflare DNS records restore Cloudflare; they are not necessarily
   the historical records needed to restore GitHub Pages.
2. In this repository's **Settings → Pages**, choose **Deploy from a branch**,
   then **main → / (root)** and save. Wait for the GitHub Pages build to succeed.
3. Restore a root `CNAME` containing only `photo-memory.app` through a reviewed
   pull request. Set the GitHub Pages custom domain to `photo-memory.app` and
   verify that the settings and repository file agree.
4. Prepare DNS using GitHub's current custom-domain instructions or a verified
   pre-cutover GitHub DNS snapshot. Do not guess IP addresses or reuse the
   current Cloudflare Pages targets. Plan removal of the Cloudflare Pages
   custom-domain associations as part of this cutover if required; keep the
   Pages project and GitHub integration available for recovery.
5. Point the apex and `www` records to GitHub Pages as documented by GitHub.
   Wait for DNS checks and certificate provisioning, then enable **Enforce
   HTTPS** when available. Verify `www` redirects permanently to the HTTPS apex,
   without loops or conflicting Cloudflare redirect rules.
6. Repeat all production checks before declaring recovery complete. Record the
   hosting change and verification results in the incident notes.
7. To return to Cloudflare, associate and validate both custom domains on the
   Pages project before restoring its DNS records. Verify HTTPS and all flows,
   then retire GitHub Pages and remove `CNAME` again through a reviewed PR.

References:

- [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

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
