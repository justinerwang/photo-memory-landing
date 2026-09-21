import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const hosts = [
  "photo-memory.app",
  "www.photo-memory.app",
  "api.photo-memory.app",
  "api-staging.photo-memory.app",
  "downloads.photo-memory.app"
];

for (const host of hosts) {
  for (const version of ["1", "1_1", "1_2", "1_3"]) {
    test(`TLS ${version.replace("_", ".")} on ${host}`, () => {
      const legacy = version === "1" || version === "1_1";
      const result = spawnSync(process.env.OPENSSL_BIN ?? "openssl", [
        "s_client", "-connect", `${host}:443`, "-servername", host,
        `-tls${version}`, "-brief", "-verify_return_error", "-verify_hostname", host,
        ...(legacy ? ["-cipher", "DEFAULT:@SECLEVEL=0"] : [])
      ], { input: "", encoding: "utf8", timeout: 15_000 });
      assert.ifError(result.error);
      const output = result.stdout + result.stderr;
      if (legacy) {
        assert.notEqual(result.status, 0, `${host} accepted legacy TLS`);
        // A DNS error or locally disabled protocol is NOT evidence of server rejection.
        assert.match(output, /alert protocol version|alert number 70/i, output);
      } else {
        assert.equal(result.status, 0, output);
        assert.match(output, new RegExp(`Protocol version: TLSv${version.replace("_", "\\.")}`), output);
        assert.match(output, /Verification: OK/, output);
      }
    });
  }

  test(`HTTP redirects preserve path and query on ${host}`, async () => {
    const path = "/health?transport_check=issue17&value=a%2Fb";
    let url = new URL(`http://${host}${path}`);
    const destination = new URL(`https://${host === "www.photo-memory.app" ? "photo-memory.app" : host}${path}`);
    for (let hop = 0; hop < 4; hop += 1) {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
      await response.body?.cancel();
      assert.ok([301, 302, 307, 308].includes(response.status), `${url}: expected redirect, got ${response.status}`);
      const location = response.headers.get("location");
      assert.ok(location, `${url}: missing Location`);
      url = new URL(location, url);
      assert.equal(url.protocol, "https:", "Redirect must immediately upgrade to HTTPS");
      assert.ok([host, destination.hostname].includes(url.hostname), "Unexpected redirect host");
      assert.equal(url.pathname, destination.pathname);
      assert.equal(url.search, destination.search);
      if (url.href === destination.href) return;
    }
    assert.fail("Redirect chain did not reach the intended HTTPS destination");
  });
}

for (const host of ["api.photo-memory.app", "api-staging.photo-memory.app"]) {
  for (const path of ["/health", "/v1/beta-signups/config"]) {
    test(`HTTPS ${host}${path} remains available`, async () => {
      const response = await fetch(`https://${host}${path}`, {
        headers: { Origin: host.includes("staging")
          ? "https://photo-memory-landing.pages.dev" : "https://photo-memory.app" },
        signal: AbortSignal.timeout(15_000)
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /application\/json/);
      const body = await response.json();
      if (path.endsWith("/config")) assert.ok(body.turnstileSiteKey);
    });
  }
}

test("HTTPS download endpoint still reaches the release artifact", async () => {
  const response = await fetch("https://api.photo-memory.app/v1/downloads/latest", {
    method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(15_000)
  });
  assert.equal(response.status, 302);
  const artifact = new URL(response.headers.get("location"));
  assert.equal(artifact.protocol, "https:");
  assert.equal(artifact.hostname, "downloads.photo-memory.app");
  const result = await fetch(artifact, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
  assert.equal(result.status, 200);
  assert.ok(Number(result.headers.get("content-length")) > 0);
});
