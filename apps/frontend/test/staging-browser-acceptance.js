// Execute with Chrome evaluate_script on the real loopback marketplace.
// Uses only synthetic accounts in the explicitly provisioned isolated database.
globalThis.runStagingBrowserAcceptance = async () => {
  if (!["http://127.0.0.1:3100", "https://marketplace.porisrom.test:8443"].includes(location.origin)) throw Error("Local isolated browser origin required");
  const api = location.protocol === "https:" ? "https://api.porisrom.test:8443" : "http://127.0.0.1:4100";
  const results = [];
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const run = async (name, test) => { try { await test(); results.push({ name, passed: true }); } catch (e) { results.push({ name, passed: false, error: e.message }); throw e; } };
  const request = async (path, token, body, method = body ? "POST" : "GET", expected) => {
    const response = await fetch(api + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => null);
    if (expected) assert(response.status === expected, `${method} ${path}: expected ${expected}, received ${response.status}`);
    else assert(response.ok, `${method} ${path}: received ${response.status}`);
    return data;
  };
  const namespace = `security-browser-${crypto.randomUUID().slice(0, 16)}`;
  const password = "Synthetic-test-only-2026!";
  let freelancer, client, admin, conversation, assignment, payment, block;
  const reason = "Synthetic staging acceptance evidence reviewed.";
  try {
    await run("freelancer registration and login", async () => {
      const email = `${namespace}-freelancer@example.test`;
      await request("/auth/signup", null, { name: namespace, email, password, role: "freelancer" });
      freelancer = await request("/auth/login", null, { email, password }, "POST", 200);
    });
    await run("client registration and login", async () => {
      const email = `${namespace}-client@example.test`;
      await request("/auth/signup", null, { name: namespace, email, password, role: "client" });
      client = await request("/auth/login", null, { email, password }, "POST", 200);
    });
    await run("both participant onboarding profiles persist", async () => {
      await request("/freelancers/me", freelancer.accessToken, { bio: reason, state: "Assam" }, "PATCH");
      await request("/companies/me", client.accessToken, { companyName: namespace, about: reason, state: "Assam" }, "PATCH");
    });
    await run("admin login and profile approval", async () => {
      assert(window.__syntheticAdminEmail, "Supply the task-owned synthetic admin email before this run");
      admin = await request("/auth/login", null, { email: window.__syntheticAdminEmail, password }, "POST", 200);
      await request(`/admin/users/${freelancer.user.id}/approve`, admin.accessToken, {}, "PATCH");
      await request(`/admin/users/${client.user.id}/approve`, admin.accessToken, {}, "PATCH");
    });
    await run("active approved freelancer and client discovery", async () => {
      const frees = await request(`/search/freelancers?keyword=${namespace}`, client.accessToken);
      const companies = await request(`/search/companies?keyword=${namespace}`, freelancer.accessToken);
      assert(frees.items.length === 1 && frees.total === 1, "Freelancer item/count mismatch");
      assert(companies.items.length === 1 && companies.total === 1, "Company item/count mismatch");
    });
    await run("connection request and acceptance", async () => {
      const connection = await request("/connections", client.accessToken, { receiverId: freelancer.user.id });
      const accepted = await request(`/connections/${connection.id}/accept`, freelancer.accessToken, {}, "PATCH");
      conversation = accepted.conversation;
      assert(conversation?.id, "Accepted conversation missing");
    });
    await run("messaging and authorized historical reads", async () => {
      await request(`/conversations/${conversation.id}/messages`, client.accessToken, { body: "Synthetic browser message" });
      assert((await request(`/conversations/${conversation.id}/messages`, freelancer.accessToken)).length === 1, "Message not persisted");
    });
    await run("assignment proposal and negotiation", async () => {
      assignment = await request(`/conversations/${conversation.id}/work-assignments`, client.accessToken, { title: "Synthetic browser work", description: reason, budgetAmount: 100 });
      await request(`/work-assignments/${assignment.id}/respond`, freelancer.accessToken, { action: "request_modification" }, "PATCH");
      await request(`/work-assignments/${assignment.id}/revise`, client.accessToken, { action: "revise", title: "Synthetic revised work", budgetAmount: 110 }, "PATCH");
    });
    await run("assignment acceptance", async () => { await request(`/work-assignments/${assignment.id}/respond`, freelancer.accessToken, { action: "accept" }, "PATCH"); });
    await run("deliverable submission", async () => { await request(`/work-assignments/${assignment.id}/deliverables`, freelancer.accessToken, { type: "github_link", url: "https://example.test/synthetic-delivery" }); });
    await run("revision and delivery acceptance", async () => {
      await request(`/work-assignments/${assignment.id}/delivery/request-revision`, client.accessToken, { note: reason }, "PATCH");
      await request(`/work-assignments/${assignment.id}/deliverables`, freelancer.accessToken, { type: "github_link", url: "https://example.test/synthetic-revision" });
      await request(`/work-assignments/${assignment.id}/delivery/accept`, client.accessToken, {}, "PATCH");
    });
    await run("payment claims and three mismatches enter dispute", async () => {
      for (let n = 0; n < 3; n++) {
        await request(`/work-assignments/${assignment.id}/payment/claim-paid`, client.accessToken, { utr: `SYNTHETIC-CLIENT-${n}` });
        await request(`/work-assignments/${assignment.id}/payment/claim-received`, freelancer.accessToken, { utr: `SYNTHETIC-FREE-${n}` });
      }
      payment = await request(`/work-assignments/${assignment.id}/payment`, client.accessToken);
      assert(payment.mismatchCount === 3, "Mismatch threshold missing");
    });
    await run("admin dispute review and non-admin denial", async () => {
      await request(`/admin/payments/${payment.id}`, admin.accessToken);
      await request(`/admin/payments/${payment.id}`, client.accessToken, undefined, "GET", 403);
    });
    await run("admin reopen then three new mismatches", async () => {
      await request(`/admin/payments/${payment.id}/resolve`, admin.accessToken, { outcome: "reopen_claims", reason, expectedMismatchCount: 3 }, "POST");
      for (let n = 3; n < 6; n++) {
        await request(`/work-assignments/${assignment.id}/payment/claim-paid`, client.accessToken, { utr: `SYNTHETIC-CLIENT-${n}` });
        await request(`/work-assignments/${assignment.id}/payment/claim-received`, freelancer.accessToken, { utr: `SYNTHETIC-FREE-${n}` });
      }
    });
    await run("admin administrative completion preserves claims and records its audit", async () => {
      await request(`/admin/payments/${payment.id}/resolve`, admin.accessToken, { outcome: "complete", reason, expectedMismatchCount: 6 }, "POST");
      const detail = await request(`/admin/payments/${payment.id}`, admin.accessToken);
      assert(detail.status === "administratively_resolved" && detail.claims.length === 12 && detail.decisions.length === 2, "Administrative evidence incomplete");
    });
    await run("user block/report freeze existing work without erasing history", async () => {
      block = await request("/safety/blocks", client.accessToken, { blockedUserId: freelancer.user.id });
      await request("/safety/reports", client.accessToken, { targetUserId: freelancer.user.id, category: "harassment", reason, conversationId: conversation.id });
      await request(`/conversations/${conversation.id}/messages`, freelancer.accessToken, { body: "Denied after block" }, "POST", 403);
      assert((await request(`/conversations/${conversation.id}/messages`, client.accessToken)).length === 1, "Historical records changed");
      const hidden = await request(`/search/freelancers?keyword=${namespace}`, client.accessToken);
      assert(hidden.total === 0 && hidden.items.length === 0, "Blocked search visibility leak");
    });
    await run("unblock, cancellation escalation, and audited admin confirmation", async () => {
      await request(`/safety/blocks/${block.id}`, client.accessToken, undefined, "DELETE");
      const work = await request(`/conversations/${conversation.id}/work-assignments`, client.accessToken, { title: "Synthetic cancellation", description: reason, budgetAmount: 10 });
      await request(`/work-assignments/${work.id}/cancel`, client.accessToken, { note: reason }, "PATCH");
      const escalation = await request(`/safety/assignments/${work.id}/escalate-cancellation`, freelancer.accessToken, { reason });
      await request(`/admin/safety/cases/${escalation.id}/review`, admin.accessToken, { decision: "cancel_assignment", reason });
      assert((await request(`/work-assignments/${work.id}`, client.accessToken)).status === "cancelled", "Cancellation decision not applied");
    });
    await run("private support with owner-only history", async () => {
      const support = await request("/safety/support", client.accessToken, { category: "technical", reason });
      assert(!(await request("/safety/cases", freelancer.accessToken)).some((c) => c.id === support.id), "Support leaked to counterpart");
      await request(`/admin/safety/cases/${support.id}/review`, admin.accessToken, { decision: "resolve", reason });
    });
    await run("unauthorized private-document access denied", async () => {
      for (const path of ["/freelancers/me/identity-document/file", `/admin/users/${freelancer.user.id}/identity-document/file`]) {
        const r = await fetch(api + path); assert(!r.ok, `Private route publicly accessible: ${path}`);
      }
    });
    await run("logout revokes access and refresh credentials", async () => {
      await request("/auth/logout", client.accessToken, { refreshToken: client.refreshToken }, "POST", 200);
      await request("/auth/me", client.accessToken, undefined, "GET", 401);
      await request("/auth/refresh", null, { refreshToken: client.refreshToken }, "POST", 401);
    });
  } catch { /* Return only sanitized assertions, never tokens or user payloads. */ }
  finally {
    for (const session of [freelancer, client, admin]) if (session) await request("/auth/logout", session.accessToken, { refreshToken: session.refreshToken }, "POST", 200).catch(() => {});
  }
  window.__stagingBrowserResults = { synthetic: true, apiThroughRealBrowser: true, uiJourneys: false, results };
  return window.__stagingBrowserResults;
};
