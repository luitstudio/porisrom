// Standalone browser regression fixture. Bundles the real components with synthetic
// server actions; never connects to a backend or uses account credentials.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const adminRequire = createRequire(resolve(root, "../admin/package.json"));
const vitestRequire = createRequire(adminRequire.resolve("vitest/package.json"));
const viteRequire = createRequire(vitestRequire.resolve("vite"));
const { build } = viteRequire("esbuild");
const result = await build({
  absWorkingDir: root, tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
  stdin: { resolveDir: root, loader: "tsx", contents: `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { ChatThread } from "./src/components/messages/chat-thread";
    import { WorkAssignmentPanel } from "./src/components/work-assignments/work-assignment-panel";
    import { runBrowserModerationRegression } from "./test/moderation-browser-regression.mjs";
    window.runBrowserModerationRegression = runBrowserModerationRegression;
    const h = window.__moderationHarness = { readOnly: false, offline: false, sends: 0, writes: 0 };
    const completed = (id) => ({ id, title: id, description: "Preserved historical assignment", conversationId: "synthetic-conversation", createdById: "client",
      status: "completed", budgetAmount: "10", currency: "INR", dueDate: null, cancelRequestedById: null,
      events: [{ id: id + "-event", actorId: "client", action: "proposed", createdAt: "2026-10-22T00:00:00Z" }],
      deliverables: [], reviews: [], paymentVerification: null });
    h.assignments = [{ ...completed("Active work"), status: "accepted" }, completed("Historical one"), completed("Historical two")];
    createRoot(document.getElementById("root")).render(<>
      <ChatThread conversationId="synthetic-conversation" viewerUserId="client" accessToken="" otherPartyName="Synthetic counterpart" initialMessages={[{ id: "old", body: "Historical message remains", senderId: "freelancer" }]} />
      <WorkAssignmentPanel conversationId="synthetic-conversation" viewerUserId="client" viewerRole="client" otherPartyName="Synthetic counterpart" initialAssignments={h.assignments} />
    </>);
  ` },
  bundle: true, write: false, format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "synthetic-actions", setup(builder) {
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "next/navigation", namespace: "synthetic" }));
    builder.onResolve({ filter: /^@\// }, async ({ path }) => {
      if (["@/app/safety/actions", "@/app/messages/actions", "@/app/work-assignments/actions", "@/lib/use-backend-access-token"].includes(path)) return { path, namespace: "synthetic" };
      return builder.resolve(resolve(root, "src", path.slice(2)), { kind: "import-statement", resolveDir: root });
    });
    builder.onLoad({ filter: /.*/, namespace: "synthetic" }, ({ path }) => {
      if (path === "next/navigation") return { contents: "export const useRouter = () => ({ refresh() {} });" };
      if (path.includes("safety/actions")) return { contents: "export async function safetyAction() { return {message:'Synthetic escalation recorded'}; }" };
      if (path.endsWith("use-backend-access-token")) return { contents: "export const useBackendAccessToken = () => null;" };
      if (path.includes("messages/actions")) return { contents: `
        export async function getConversationAccessAction() { if(window.__moderationHarness.offline) throw Error("Synthetic outage"); return {readOnly: window.__moderationHarness.readOnly}; }
        export async function getMessagesAction() { return [{id:"old", body:"Historical message remains", senderId:"freelancer"}]; }
        export async function sendMessageAction(conversationId,body) { window.__moderationHarness.sends++; return {id:"sent",conversationId,body,senderId:"client"}; }
      ` };
      return { contents: `export async function listWorkAssignmentsAction() { return window.__moderationHarness.assignments; }
        ${["acceptDelivery", "cancelWorkAssignment", "claimPaid", "claimReceived", "createReview", "createWorkAssignment", "requestDeliveryRevision", "respondWorkAssignment", "reviseWorkAssignment", "submitDeliverable"].map((name) => `export async function ${name}Action() { window.__moderationHarness.writes++; return {}; }`).join("\n")}` };
    });
  } }],
});
const bundle = result.outputFiles[0].contents;
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/bundle.js" ? "text/javascript" : "text/html");
  response.end(request.url === "/bundle.js" ? bundle : '<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
server.listen(4899, "127.0.0.1", () => console.log("Synthetic moderation browser fixture: http://127.0.0.1:4899"));
