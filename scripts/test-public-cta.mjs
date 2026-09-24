import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("index.html"), "utf8");
const privacy = readFileSync(resolve("privacy.html"), "utf8");
const terms = readFileSync(resolve("terms.html"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const heroScreenshotPath = resolve("assets/search-jamie-cannon-beach.webp");

for (const [name, page] of [["Privacy", privacy], ["Terms", terms]]) {
  const copy = page.replace(/\s+/g, " ");
  assert(
    copy.includes("Photo Memory does not modify your original photos or change your folder structure."),
    `${name} must state that original photos and folder structure remain unchanged`
  );
}
const termsCopy = terms.replace(/\s+/g, " ");
assert(
  termsCopy.includes("Submitting a beta application is free and does not start a subscription.") &&
    termsCopy.includes("Paid plans, including subscriptions, may be offered in the future.") &&
    termsCopy.includes("Pricing and applicable terms will be provided before purchase."),
  "Terms must distinguish free beta applications from possible future paid plans"
);

assert(
  !/no subscription|no recurring fee/i.test(html),
  "Landing copy and metadata must not promise subscription-free access"
);
assert(
  html.includes("Your originals stay untouched") &&
    html.includes("Photo Memory never changes your original photos or folder structure."),
  "Landing must reassure visitors that originals and folder structure stay unchanged"
);

assert(existsSync(heroScreenshotPath), "Landing hero screenshot asset must exist");
assert(
  html.includes('src="assets/search-jamie-cannon-beach.webp"'),
  "Landing hero must use the approved Jamie search screenshot"
);
assert(
  html.includes('alt="Photo Memory search results for Jamie at Cannon Beach in 2023"'),
  "Landing hero screenshot must describe the visible search result"
);
assert(!html.includes('class="photo-grid"'), "Synthetic hero photo tiles must be removed");

assert(
  html.includes('href="https://api.photo-memory.app/v1/downloads/latest"'),
  "Every production Download CTA must use the stable Worker endpoint"
);
assert(
  packageJson.scripts.smoke.includes("npm run test:public-cta") &&
    packageJson.scripts.smoke.includes("npm run test:public-cta-browser"),
  "Canonical smoke must include static and rendered landing CTA coverage"
);
assert(!privacy.includes("Formspree"), "Privacy copy must not name the removed processor");
assert(
  privacy.includes("pending beta application") && privacy.includes("protect the application form from") &&
    privacy.includes("abuse"),
  "Privacy copy must disclose pending beta applications and abuse prevention"
);
assert(
  (html.match(/https:\/\/api\.photo-memory\.app\/v1\/downloads\/latest/g) ?? [])
    .length >= 2,
  "Navigation and hero must retain the stable Download URL for restoration"
);
assert(!html.includes("formspree.io"), "Join Beta must not submit to Formspree");
assert(!html.includes("downloads.photo-memory.app/"), "Landing page must not embed an R2 artifact URL");
for (const label of ["Download for Mac - Free", "Public Beta", "Apple Silicon", "macOS"]) {
  assert(html.includes(label), `Landing markup must retain ${label}`);
}
assert(
  html.includes('data-api-path="/v1/beta-signups"'),
  "Join Beta must target Photo Memory's API"
);
assert(
  html.includes('aria-live="polite"'),
  "Join Beta status changes must use an accessible live region"
);
assert(
  html.includes('id="beta-toast"') && html.includes('class="beta-toast"'),
  "Join Beta submission results must use the transient message bubble"
);
assert(
  html.includes(
    "Request received. We will email you separately when beta access is granted."
  ),
  "Join Beta success must use the approved access-grant copy"
);
assert(
  html.includes("For unlimited photo indexing and early features."),
  "Join Beta must use the concise unlimited-indexing introduction"
);
assert(
  !html.includes("Apply for unlimited beta access, early features, and closer feedback.") &&
    !html.includes("Your application stays pending until it is separately approved.") &&
    !html.includes("Applying does not grant beta access immediately."),
  "Join Beta must remove the superseded application copy"
);
assert(
  html.includes("Your photos stay local and are never uploaded."),
  "Join Beta must retain the local-photo reassurance"
);
assert(
  html.includes('action: "beta_signup"'),
  "Turnstile must render with the beta_signup action"
);
assert(
  html.includes('https://api-staging.photo-memory.app'),
  "Local and staging QA must use the staging API without editing production constants"
);

console.log("Landing public CTA contract passed");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
