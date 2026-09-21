import assert from "node:assert/strict";
import { test } from "node:test";

// Run against Wrangler Pages dev or a deployed Pages URL, not a mock server.
const origin = process.env.PHOTO_MEMORY_LANDING_URL;
assert(origin, "Set PHOTO_MEMORY_LANDING_URL to the Pages URL under test");

async function get(path) {
  return fetch(new URL(path, origin), { signal: AbortSignal.timeout(15_000) });
}

test("robots.txt is a plain-text policy allowing public crawling", async () => {
  const response = await get("/robots.txt");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/plain\b/);
  const body = await response.text();
  assert.match(body, /^User-agent:\s*\*\s*$/m);
  assert.match(body, /^Allow:\s*\/\s*$/m);
  assert.doesNotMatch(body, /<html/i);
});

for (const path of ["/missing-page-issue-16", "/nested/missing-page", "/.env", "/.git/config"]) {
  test(`${path} returns a helpful 404 instead of the homepage`, async () => {
    const response = await get(path);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/);
    const body = await response.text();
    assert.match(body, /<h1>Page not found<\/h1>/);
    assert.match(body, /href="\/"/);
    assert.doesNotMatch(body, /<form\b|\[core\]|PRIVATE KEY|DATABASE_URL=/i);
  });
}

for (const path of ["/", "/privacy", "/terms", "/upgrade-thank-you", "/privacy.html", "/terms.html", "/upgrade-thank-you.html"]) {
  test(`${path} remains available`, async () => {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/);
    assert.doesNotMatch(await response.text(), /<h1>Page not found<\/h1>/);
  });
}
