import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { chromium } from "playwright";

const port = Number(process.env.PHOTO_MEMORY_LANDING_TEST_PORT ?? 4173);
const origin = `http://127.0.0.1:${port}`;
const landingRoot = resolve(".");
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", origin).pathname;
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = resolve(landingRoot, relativePath);
    if (!filePath.startsWith(`${landingRoot}/`)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentType(filePath),
      "cache-control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolveListen);
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
const networkEvents = [];
const signupPayloads = [];
let configAvailable = true;
let responseMode = "success";
let pendingResolve = null;

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));
page.on("response", (response) => {
  if (response.url().includes("beta-signups")) {
    networkEvents.push(`${response.request().method()} ${response.status()}`);
  }
});
page.on("requestfailed", (request) => {
  if (request.url().includes("beta-signups")) {
    networkEvents.push(`FAILED ${request.method()} ${request.failure()?.errorText}`);
  }
});

await page.route("https://www.googletagmanager.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
);
await page.route("https://www.google-analytics.com/**", (route) =>
  route.fulfill({ status: 204, body: "" })
);
await page.route(
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `window.turnstile = {
        render: function (_selector, options) {
          window.__turnstileOptions = options;
          setTimeout(function () { options.callback("turnstile-token-1"); }, 0);
          return "widget-1";
        },
        reset: function () {
          setTimeout(function () { window.__turnstileOptions.callback("turnstile-token-reset"); }, 0);
        }
      };`
    })
);
await page.route("https://api-staging.photo-memory.app/v1/beta-signups/config", (route) =>
  route.fulfill({
    status: configAvailable ? 200 : 503,
    contentType: "application/json",
    headers: { "access-control-allow-origin": origin },
    body: JSON.stringify(
      configAvailable
        ? { turnstileSiteKey: "test-site-key" }
        : { error: "beta_signup_unavailable" }
    )
  })
);
await page.route("https://api-staging.photo-memory.app/v1/beta-signups", async (route) => {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST",
        "access-control-allow-headers": "content-type"
      },
      body: ""
    });
    return;
  }
  signupPayloads.push(JSON.parse(route.request().postData() ?? "{}"));
  if (responseMode === "pending") {
    await new Promise((resolvePending) => { pendingResolve = resolvePending; });
  }
  const status = responseMode === "service-error" ? 503 : 202;
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": origin },
    body: JSON.stringify(
      status === 202 ? { ok: true } : { error: "beta_signup_unavailable" }
    )
  });
});

try {
  await page.goto(`${origin}/?utm_source=launch&utm_medium=site`, {
    waitUntil: "networkidle"
  });
  await page.locator("#beta-turnstile").waitFor({ state: "visible" });
  await page.waitForFunction(() => Boolean(window.__turnstileOptions));

  assert(
    await page.locator('[data-track="hero_download_click"]').getAttribute("href") ===
      "https://api-staging.photo-memory.app/v1/downloads/latest",
    "Local QA must rewrite Download to the staging API"
  );
  await assertDownloadsHidden(page);
  assert(await page.locator('[data-track="nav_beta_click"]').isVisible(), "Desktop navigation must retain Join Beta");
  assert(
    await page.locator('[data-track="nav_beta_click"]').textContent() === "Join Beta for Free",
    "Navigation Join Beta must communicate that signup is free"
  );
  for (const text of ["Public Beta", "Apple Silicon", "macOS"]) {
    assert(await page.getByText(text, { exact: false }).first().isVisible(), `${text} must be visible`);
  }
  const heroScreenshot = page.locator(".hero-screenshot");
  assert(await heroScreenshot.isVisible(), "Approved Search screenshot must be visible in the hero");
  assert(
    await page.locator(".hero-preview").evaluate((preview) => getComputedStyle(preview).transform) ===
      "none",
    "Hero screenshot frame must align with the page without rotation"
  );
  assert(
    await heroScreenshot.getAttribute("alt") ===
      "Photo Memory search results for Jamie at Cannon Beach in 2023",
    "Hero screenshot must describe its visible search context"
  );
  assert(
    await heroScreenshot.evaluate((image) => image.complete && image.naturalWidth === 1586),
    "Hero screenshot must load at its expected source width"
  );
  assert(
    await page.getByText("For unlimited photo indexing and early features.", { exact: true }).isVisible(),
    "The concise beta introduction must be visible"
  );
  assert(
    await page.getByText("Your photos stay local and are never uploaded.", { exact: true }).isVisible(),
    "The local-photo reassurance must remain visible"
  );
  assert(
    (await page.getByText("Applying does not grant beta access immediately.", { exact: false }).count()) === 0,
    "The superseded immediate-access sentence must not render"
  );
  const form = page.locator("form[data-api-path]");
  const toast = page.locator("#beta-toast");
  assert(
    (await toast.getAttribute("hidden")) === null && (await toast.textContent()) === "",
    "The empty signup live region must stay mounted before a result is announced"
  );
  await form.locator("#email").fill("person@example.com");
  await form.locator("#discovery_source").selectOption("search");
  await form.getByRole("button", { name: "Join Beta for Free" }).click();
  const successText =
    "Request received. We will email you separately when beta access is granted.";
  try {
    await page.getByText(successText, { exact: true }).waitFor({ timeout: 5_000 });
  } catch (error) {
    const statusText = await form.locator(".form-status").textContent();
    const buttonText = await form.locator('button[type="submit"]').textContent();
    throw new Error(
      `First signup did not succeed: requests=${signupPayloads.length}, ` +
        `status=${JSON.stringify(statusText)}, button=${JSON.stringify(buttonText)}, ` +
        `network=${JSON.stringify(networkEvents)}, console=${JSON.stringify(consoleErrors)}; ` +
      `${error.message}`
    );
  }
  assert(await toast.isVisible(), "Successful signup must show a visible message bubble");
  assert(await toast.getAttribute("role") === "status", "Message bubble must expose status semantics");
  assert(
    (await toast.getAttribute("aria-live")) === "polite",
    "Message bubble must announce submission results politely"
  );
  assert(await toast.evaluate((element) => element.classList.contains("success")),
    "Successful signup must use success styling");
  assert(signupPayloads.length === 1, "One click must send one application");
  assert(
    JSON.stringify(signupPayloads[0]) === JSON.stringify({
      email: "person@example.com",
      discoverySource: "search",
      campaign: { source: "launch", medium: "site" },
      turnstileToken: "turnstile-token-1"
    }),
    `Unexpected signup payload: ${JSON.stringify(signupPayloads[0])}`
  );

  await page.waitForTimeout(4_000);
  await waitForFreshTurnstileToken(page);
  await form.getByRole("button", { name: "Join Beta for Free" }).click();
  await page.getByText(successText, { exact: true }).waitFor();
  assert(signupPayloads.length === 2, "A repeated application must receive the same flow");
  await page.waitForTimeout(1_200);
  assert(await toast.isVisible(), "A previous timer must not dismiss a newer signup bubble");
  await page.waitForTimeout(3_900);
  assert(
    (await toast.textContent()) === "" &&
      !(await toast.evaluate((element) => element.classList.contains("success"))),
    "The newer signup bubble must dismiss after five seconds"
  );

  await waitForFreshTurnstileToken(page);
  responseMode = "service-error";
  await form.getByRole("button", { name: "Join Beta for Free" }).click();
  await page
    .getByText("Beta applications are temporarily unavailable. Please try again later.", {
      exact: true
    })
    .waitFor();
  assert(await toast.isVisible(), "Failed signup must show a visible message bubble");
  assert(await toast.evaluate((element) => element.classList.contains("error")),
    "Failed signup must use error styling");
  await page.emulateMedia({ colorScheme: "dark" });
  const darkErrorContrast = await toast.evaluate((element) => {
    const parseRgb = (value) => value.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
    const luminance = (rgb) => {
      const channels = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const styles = getComputedStyle(element);
    const foreground = luminance(parseRgb(styles.color));
    const background = luminance(parseRgb(styles.backgroundColor));
    return (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05);
  });
  assert(darkErrorContrast >= 4.5, `Dark-mode error contrast must meet WCAG AA: ${darkErrorContrast}`);
  const darkHeroNoteContrast = await page.locator(".hero-preview-note strong").evaluate((element) => {
    const parseRgb = (value) => value.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
    const luminance = (rgb) => {
      const channels = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const foreground = luminance(parseRgb(getComputedStyle(element).color));
    const background = luminance(parseRgb(getComputedStyle(element.parentElement).backgroundColor));
    return (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05);
  });
  assert(
    darkHeroNoteContrast >= 4.5,
    `Dark-mode hero note contrast must meet WCAG AA: ${darkHeroNoteContrast}`
  );
  await page.emulateMedia({ colorScheme: "light" });
  assert(
    (await form.locator("#email").inputValue()) === "person@example.com",
    "Server errors must preserve the email field"
  );

  await waitForFreshTurnstileToken(page);
  responseMode = "pending";
  const pendingClick = form.getByRole("button", { name: "Join Beta for Free" }).click();
  await page.getByRole("button", { name: "Applying..." }).waitFor();
  assert(
    await page.getByRole("button", { name: "Applying..." }).isDisabled(),
    "Submit must be disabled while the request is pending"
  );
  const countWhilePending = signupPayloads.length;
  await page.getByRole("button", { name: "Applying..." }).click({ force: true });
  assert(signupPayloads.length === countWhilePending, "Pending requests must not run in parallel");
  pendingResolve();
  await pendingClick;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  responseMode = "success";
  assert(
    await page.locator(".hero-screenshot").isVisible(),
    "Hero screenshot must remain visible at the narrow viewport"
  );
  await assertDownloadsHidden(page);
  const narrowForm = page.locator("form[data-api-path]");
  await page.waitForFunction(() => Boolean(window.__turnstileOptions));
  await narrowForm.locator("#email").fill("person@example.com");
  await narrowForm.locator("#discovery_source").selectOption("search");
  await narrowForm.getByRole("button", { name: "Join Beta for Free" }).click();
  await page.getByText(successText, { exact: true }).waitFor();
  assert(await toast.isVisible(), "Signup bubble must remain visible at the narrow viewport");
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, className: element.className, left: rect.left, right: rect.right };
      })
      .filter((rect) => rect.left < -1 || rect.right > document.documentElement.clientWidth + 1)
      .slice(0, 10)
  }));
  assert(
    overflow.scrollWidth <= overflow.clientWidth + 1,
    `Landing page must not overflow at the narrow viewport: ${JSON.stringify(overflow)}`
  );
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const active = document.activeElement;
    return active ? getComputedStyle(active).outlineStyle : "none";
  });
  assert(outline !== "none", "Keyboard focus must remain visible");

  configAvailable = false;
  await page.reload({ waitUntil: "networkidle" });
  const unavailableMessage =
    "Beta applications are temporarily unavailable. Please try again later.";
  await page.getByText(unavailableMessage, { exact: true }).waitFor();
  const unavailableForm = page.locator("form[data-api-path]");
  assert(
    await unavailableForm.getByRole("button", { name: "Join Beta for Free" }).isDisabled(),
    "Submit must stay disabled when verification initialization fails"
  );
  await unavailableForm.evaluate((form) => form.requestSubmit());
  assert(
    (await unavailableForm.locator(".form-status").textContent()) === unavailableMessage,
    "Submitting an unavailable form must preserve the initialization error"
  );
  const unexpectedConsoleErrors = consoleErrors.filter(
    (message) => !message.includes("status of 503 (Service Unavailable)")
  );
  assert(
    unexpectedConsoleErrors.length === 0,
    `Console errors: ${unexpectedConsoleErrors.join(" | ")}`
  );
} finally {
  await page.close();
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log("Landing public CTA browser flow passed");

function contentType(filePath) {
  return extname(filePath) === ".html" ? "text/html; charset=utf-8" : "text/plain";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForFreshTurnstileToken(page) {
  await page.waitForFunction(
    () => window.betaState?.token === "turnstile-token-reset"
  );
}

async function assertDownloadsHidden(page) {
  assert(
    await page.getByRole("link", { name: /download/i }).count() === 0,
    "Download links must be absent from the accessible UI during beta"
  );
  for (const track of ["nav_download_click", "hero_download_click"]) {
    const link = page.locator(`[data-track="${track}"]`);
    assert(await link.isHidden(), `${track} must not be visible during beta`);
    await link.evaluate((element) => element.focus());
    assert(
      !await link.evaluate((element) => document.activeElement === element),
      `${track} must not receive keyboard focus during beta`
    );
  }
  assert(
    await page.locator('[data-track="hero_beta_click"]').count() === 0,
    "Duplicate hero Join Beta must be absent at every viewport"
  );
}
