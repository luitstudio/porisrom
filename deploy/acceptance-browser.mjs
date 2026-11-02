import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const fixture = JSON.parse(process.env.ACCEPTANCE_FIXTURE ?? "null");
const uiOnly = process.env.ACCEPTANCE_UI_ONLY === "true";
if (!fixture?.conversationId) throw Error("Explicit synthetic fixture required");
const results = []; const uiDiagnostics = {}; const record = (name, passed) => { results.push({ name, passed: !!passed }); if (!passed) throw Error(name); };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
// Only this disposable test browser accepts the task's self-signed certificate.
// Applications trust the mounted test CA; no production TLS verification changes.
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
try {
  await page.goto("https://marketplace.porisrom.test:8443/auth/login");
  if (!uiOnly) {
  await page.evaluate((email) => { window.__syntheticAdminEmail = email; }, fixture.users.admin.email);
  await page.addScriptTag({ path: "/checks/staging-browser-acceptance.js" });
  const journeys = await page.evaluate(() => window.runStagingBrowserAcceptance());
  for (const row of journeys.results) record(`HTTPS API: ${row.name}`, row.passed);
  record("All twenty HTTPS API journeys executed", journeys.results.length === 20);
  const cookieLogin = await context.request.post("https://api.porisrom.test:8443/auth/login", {
    data: { email: fixture.users.client.email, password: "Synthetic-test-only-2026!" },
  });
  const authCookies = cookieLogin.headersArray().filter((header) => header.name.toLowerCase() === "set-cookie");
  record("Backend HTTPS login sets two Secure HttpOnly Lax cookies", cookieLogin.status() === 200 && authCookies.length === 2 &&
    authCookies.every(({ value }) => /;\s*Secure(?:;|$)/i.test(value) && /;\s*HttpOnly(?:;|$)/i.test(value) && /;\s*SameSite=Lax(?:;|$)/i.test(value)));
  record("Backend cookie authentication works through HTTPS ingress", (await context.request.get("https://api.porisrom.test:8443/auth/me")).status() === 200);
  const cookieLogout = await context.request.post("https://api.porisrom.test:8443/auth/logout", { data: {} });
  record("Backend cookie logout clears authentication", cookieLogout.status() === 200 &&
    (await context.request.get("https://api.porisrom.test:8443/auth/me")).status() === 401 &&
    !(await context.cookies("https://api.porisrom.test:8443")).some((cookie) => ["access_token", "refresh_token"].includes(cookie.name)));
  const cross = await page.evaluate(async (f) => {
    const checks = []; const check = (name, condition) => { if (!condition) throw Error(name); checks.push(name); };
    const a = "https://api-a.porisrom.test:8443", b = "https://api-b.porisrom.test:8443";
    const request = async (base, path, token, body, method = body ? "POST" : "GET") => {
      const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, data: await r.json().catch(() => null) };
    };
    const login = async (role) => { const r = await request(b, "/auth/login", null, { email: f.users[role].email, password: "Synthetic-test-only-2026!" }); if (r.status !== 200) throw Error("Fixture login failed"); return r.data; };
    const timeout = (promise) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Error("Socket timeout")), 7000))]);
    const connect = (token) => timeout(new Promise((done, reject) => {
      const ws = new WebSocket("wss://api-a.porisrom.test:8443/socket.io/?EIO=4&transport=websocket");
      ws.events = []; ws.addEventListener("error", () => reject(Error("Socket connection rejected")));
      ws.addEventListener("message", ({ data }) => {
        if (data.startsWith("0")) ws.send("40" + JSON.stringify({ token }));
        else if (data === "2") ws.send("3");
        else if (data.startsWith("40")) done(ws);
        else if (data.startsWith("44")) { ws.close(); reject(Error("Socket authentication rejected")); }
        else if (data.startsWith("42")) ws.events.push(JSON.parse(data.slice(2)));
      });
      ws.addEventListener("close", () => reject(Error("Socket closed")));
    }));
    const rejectsSession = (token) => connect(token).then((s) => { s.close(); return false; }, (error) => error.message === "Socket authentication rejected");
    const client = await login("client"), admin = await login("admin"); let free = await login("freelancer"), socket;
    try {
      socket = await connect(free.accessToken);
      const before = (await request(a, `/conversations/${f.conversationId}/messages`, client.accessToken)).data.length;
      const sent = await request(b, `/conversations/${f.conversationId}/messages`, client.accessToken, { body: "Synthetic two-container WSS delivery" });
      await new Promise((done) => setTimeout(done, 600));
      check("WSS on A receives message persisted on B exactly once", sent.status === 201 && socket.events.filter(([name, value]) => name === "message.created" && value.id === sent.data.id).length === 1);
      check("Cross-container message persistence has no duplicate", (await request(a, `/conversations/${f.conversationId}/messages`, client.accessToken)).data.length === before + 1);
      let closed = timeout(new Promise((done) => socket.addEventListener("close", done, { once: true })));
      check("Logout through B succeeds", (await request(b, "/auth/logout", free.accessToken, { refreshToken: free.refreshToken })).status === 200); await closed;
      check("Logout through B disconnects WSS on A", socket.readyState === WebSocket.CLOSED);
      check("Revoked session cannot reconnect on A", await rejectsSession(free.accessToken));
      free = await login("freelancer"); socket = await connect(free.accessToken);
      closed = timeout(new Promise((done) => socket.addEventListener("close", done, { once: true })));
      check("Moderation through B succeeds", (await request(b, `/admin/users/${f.users.freelancer.id}/block`, admin.accessToken, { blocked: true }, "PATCH")).status === 200); await closed;
      check("Moderation on B disconnects WSS on A", socket.readyState === WebSocket.CLOSED);
      check("Moderated shared history remains readable", (await request(a, `/conversations/${f.conversationId}/messages`, client.accessToken)).status === 200);
      check("Moderated counterpart cannot be mutated", (await request(b, `/conversations/${f.conversationId}/messages`, client.accessToken, { body: "Denied synthetic mutation" })).status === 403);
      await request(b, `/admin/users/${f.users.freelancer.id}/block`, admin.accessToken, { blocked: false }, "PATCH");
      check("Account unblocking does not revive revoked WSS session", await rejectsSession(free.accessToken));
      const rotation = await login("freelancer");
      const rotated = await Promise.all(Array.from({ length: 10 }, (_, i) => request(i % 2 ? a : b, "/auth/refresh", null, { refreshToken: rotation.refreshToken })));
      check("Two API containers permit exactly one concurrent refresh", rotated.filter((r) => r.status === 200).length === 1 && rotated.filter((r) => r.status === 409).length === 9);
      const newTokens = rotated.find((r) => r.status === 200).data;
      await new Promise((done) => setTimeout(done, 5100));
      check("Refresh replay is denied after collision grace", (await request(a, "/auth/refresh", null, { refreshToken: rotation.refreshToken })).status === 401);
      check("Replay revokes the rotated access session", (await request(b, "/auth/me", newTokens.accessToken)).status === 401);
      const support = await request(a, "/safety/support", client.accessToken, { category: "technical", reason: "Synthetic two-container concurrent review evidence." });
      const decisions = await Promise.all([a, b].map((base) => request(base, `/admin/safety/cases/${support.data.id}/review`, admin.accessToken, { decision: "resolve", reason: "Synthetic concurrent administrative decision evidence." })));
      check("Concurrent admin decisions across containers have one winner", decisions.filter((r) => r.status === 201).length === 1 && decisions.filter((r) => r.status === 409).length === 1);
    } finally {
      socket?.close();
      for (const session of [client, admin, free]) await request(b, "/auth/logout", session.accessToken, { refreshToken: session.refreshToken }).catch(() => {});
    }
    return checks;
  }, fixture);
  for (const name of cross) record(name, true);
  }
  // Rendered Next BFF logins use HTTPS internally and in the browser.
  await page.locator('input[name="email"]').fill(fixture.users.client.email);
  await page.locator('input[name="password"]').fill("Synthetic-test-only-2026!");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  const cookies = await context.cookies(); const session = cookies.find((c) => c.name.includes("authjs.session-token"));
  record("Marketplace BFF login across HTTPS containers", !!session && session.secure && session.httpOnly && session.sameSite === "Lax");
  await page.goto("https://marketplace.porisrom.test:8443/safety");
  uiDiagnostics.supportReasonFields = await page.locator('textarea[name="reason"]').evaluateAll((elements) => elements.map((element) => ({
    insideHiddenTree: !!element.closest("[hidden]"), visible: !!element.getBoundingClientRect().height,
  })));
  const supportReason = `Synthetic HTTPS rendered support request for Docker acceptance ${Date.now()}.`;
  const supportForm = page.locator('form:has(input[name="operation"][value="support"]):visible');
  await supportForm.getByRole("textbox", { name: /Reason/ }).fill(supportReason);
  await supportForm.getByRole("button", { name: "Submit support case", exact: true }).click();
  await page.getByText("Request recorded. No funds were moved.", { exact: true }).waitFor();
  const supportArticle = page.locator("article:visible").filter({ hasText: supportReason });
  await supportArticle.waitFor({ state: "visible" });
  record("Rendered private support case persists through HTTPS BFF", await supportArticle.count() === 1);
  const admin = await context.newPage(); await admin.goto("https://admin.porisrom.test:8443/login");
  await admin.locator('input[name="email"]').fill(fixture.users.admin.email); await admin.locator('input[name="password"]').fill("Synthetic-test-only-2026!");
  await admin.locator('button[type="submit"]').click(); await admin.waitForURL("https://admin.porisrom.test:8443/", { timeout: 30000 });
  const adminCookies = (await context.cookies()).filter((c) => ["admin_access_token", "admin_refresh_token"].includes(c.name));
  record("Admin BFF login sets two Secure HttpOnly Lax cookies", adminCookies.length === 2 && adminCookies.every((c) => c.secure && c.httpOnly && c.sameSite === "Lax"));
  await admin.goto("https://admin.porisrom.test:8443/safety");
  const safetyHeading = admin.getByRole("heading", { name: "Safety & support cases", exact: true });
  await safetyHeading.waitFor({ state: "visible" });
  record("Rendered administrator safety queue loads", await safetyHeading.count() === 1);
  await page.goto(`https://marketplace.porisrom.test:8443/dashboard/client/messages/${fixture.conversationId}`);
  const historicalMessage = page.getByText("Synthetic two-container WSS delivery", { exact: true }).filter({ visible: true });
  await historicalMessage.first().waitFor({ state: "visible" });
  record("Rendered historical conversation remains available after moderation", await historicalMessage.count() >= 1);
  await page.getByRole("button", { name: "Sign out", exact: true }).first().click(); await page.waitForURL("https://marketplace.porisrom.test:8443/");
  record("Marketplace logout clears the browser session", !(await page.evaluate(async () => (await (await fetch("/api/auth/session")).json())?.user)));
  await admin.locator(".admin-account-menu summary").click(); await admin.locator(".admin-account-menu button").click(); await admin.waitForURL(/\/login/);
  await admin.goto("https://admin.porisrom.test:8443/safety");
  record("Admin logout denies subsequent private queue access", admin.url().includes("/login"));
} catch (error) {
  const forms = await page.locator('form:has(textarea[name="reason"])').evaluateAll((elements) => elements.map((form) => ({
    operation: form.querySelector('input[name="operation"]')?.value ?? null,
    visible: !!form.getBoundingClientRect().height,
    reasonFields: form.querySelectorAll('textarea[name="reason"]').length,
  }))).catch(() => []);
  results.push({ name: "Runner failure", passed: false, forms, error: String(error.message).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token]") });
}
finally {
  await browser.close();
  const report = { localDockerSimulation: true, selfSignedTestTls: true, productionOrRemoteStagingVerified: false, uiOnly, uiDiagnostics, results };
  await writeFile(uiOnly ? "/results/browser-ui.json" : "/results/browser.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length, failures: results.filter((r) => !r.passed) }));
  if (results.some((r) => !r.passed)) process.exitCode = 1;
}
