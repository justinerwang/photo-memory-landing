<!-- address-cr:1:start -->
## PR #1 Review Follow-ups

Source: https://github.com/justinerwang/photo-memory-landing/pull/1

- [x] Remove Finder handoffs from local audit-log examples. (`privacy.html`)
- [x] Change optional error reporting copy to start with "Error reporting is optional." (`privacy.html`)
- [x] Clarify that error reports exclude PII data. (`privacy.html`)
- [x] Remove local activity-log export sentence. (`privacy.html`)
- [x] Remove default-state wording from error reporting copy. (`privacy.html`)
<!-- address-cr:1:end -->

## Issue #332 Public Download And Beta CTAs

Source: https://github.com/justinerwang/photo-memory/issues/332

- [x] Add the Public Beta Apple Silicon download CTA through the stable API endpoint.
- [x] Replace Formspree with an accessible Turnstile-backed beta application flow.
- [x] Verify desktop and narrow layouts, keyboard behavior, response states, and console output.

<!-- address-cr:2:start -->
## PR #2 Review Follow-ups

Source: https://github.com/justinerwang/photo-memory-landing/pull/2

- [x] P2: Keep beta submission disabled and preserve the outage message when Turnstile initialization fails. (`index.html`, `scripts/test-public-cta-browser.mjs`)
<!-- address-cr:2:end -->

## Issue #3 Beta Signup Message Bubble

Source: https://github.com/justinerwang/photo-memory-landing/issues/3

- [x] Show successful beta signup submissions in an accessible transient bubble.
- [x] Show beta signup submission failures in the same transient bubble.
- [x] Verify dismissal timing, repeat submissions, and narrow viewport behavior.

<!-- address-cr:5:start -->
## PR #5 Review Follow-ups

Source: https://github.com/justinerwang/photo-memory-landing/pull/5

- [x] P2: Keep the empty beta result live region mounted before inserting a message. (`index.html`, `scripts/test-public-cta-browser.mjs`)
- [x] P2: Preserve accessible beta error-message contrast in dark mode. (`index.html`, `scripts/test-public-cta-browser.mjs`)
<!-- address-cr:5:end -->

## Issue #4 Beta Signup Copy

Source: https://github.com/justinerwang/photo-memory-landing/issues/4

- [x] Replace the beta introduction with the requested unlimited-indexing copy.
- [x] Remove the immediate-access sentence while retaining the local-photo reassurance.
- [x] Verify the updated copy in static and rendered landing tests.

## Issue #7 Cloudflare Pages Preview

Source: https://github.com/justinerwang/photo-memory-landing/issues/7

- [x] Create a Git-connected Cloudflare Pages project for `main`.
- [x] Allow the stable Pages hostname through the staging API and Turnstile checks.
- [x] Verify the stable Pages deployment and an eligible pull-request preview.
- [ ] Confirm beta signup remains pending-only and the staging download flow works.
- [x] Keep production DNS and GitHub Pages unchanged.

<!-- address-cr:11:start -->
## PR #11 Review Follow-ups

Source: https://github.com/justinerwang/photo-memory-landing/pull/11

- [x] P2: Clarify that pull-request previews verify static deployment while the exact stable Pages hostname is the staging integration acceptance surface. (`CLOUDFLARE_PAGES_MIGRATION.md`)
<!-- address-cr:11:end -->
