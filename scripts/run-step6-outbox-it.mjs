import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(new URL("../apps/backend/package.json", import.meta.url));
const { Client } = require("pg");
const required = name => { const value = process.env[name]; if (!value) throw Error(`${name} is required`); return value; };
const ownerUrl = required("STEP6_OWNER_DATABASE_URL");
const dispatcherUrl = required("STEP6_DISPATCHER_DATABASE_URL");
const backendUrl = required("STEP6_BACKEND_DATABASE_URL");
const connect = async url => { const client = new Client({ connectionString: url }); await client.connect(); return client; };
const owner = await connect(ownerUrl); const dispatcher = await connect(dispatcherUrl); const backend = await connect(backendUrl);
const eventId = `step6-outbox-${randomUUID()}`; const expiredId = `step6-expired-${randomUUID()}`;
const eventType = `step6.test.${eventId}`;
try {
  await owner.query('INSERT INTO "BackupWorkflowOutbox" (id,"eventType","aggregateId",payload,"deduplicationKey") VALUES ($1,$2,$3,$4::jsonb,$5)', [eventId, eventType, "aggregate", JSON.stringify({ test: true }), eventId]);
  const first = await dispatcher.query('SELECT * FROM "backup_claim_workflow_outbox"($1,$2,$3)', ["worker-a", eventType, 60]);
  if (first.rows.length !== 1 || first.rows[0].id !== eventId || !first.rows[0].claimToken) throw Error("outbox claim failed");
  await dispatcher.query('SELECT "backup_retry_workflow_outbox"($1,$2,$3,$4)', [eventId, first.rows[0].claimToken, "retry", 1]);
  await new Promise(resolve => setTimeout(resolve, 1100));
  const second = await dispatcher.query('SELECT * FROM "backup_claim_workflow_outbox"($1,$2,$3)', ["worker-b", eventType, 60]);
  if (second.rows.length !== 1 || second.rows[0].claimToken === first.rows[0].claimToken) throw Error("outbox reclaim was not fenced");
  let staleDenied = false;
  try { await dispatcher.query('SELECT "backup_ack_workflow_outbox"($1,$2)', [eventId, first.rows[0].claimToken]); } catch (error) { staleDenied = error.code === "42501"; }
  if (!staleDenied) throw Error("stale outbox acknowledgement was accepted");
  await dispatcher.query('SELECT "backup_ack_workflow_outbox"($1,$2)', [eventId, second.rows[0].claimToken]);
  await owner.query('INSERT INTO "BackupWorkflowOutbox" (id,"eventType","aggregateId",payload,"deduplicationKey",status,"lockedAt","lockedBy","claimToken","lockExpiresAt") VALUES ($1,$2,$3,$4::jsonb,$5,$6,NOW(),$7,$8,NOW()-INTERVAL \'1 second\')', [expiredId, "step6.expired", "aggregate", JSON.stringify({ test: true }), expiredId, "processing", "dead-worker", "dead-token"]);
  await dispatcher.query('SELECT * FROM "backup_claim_workflow_outbox"($1,$2,$3)', ["worker-c", "step6.none", 60]);
  const expired = await owner.query('SELECT status,"lastError" FROM "BackupWorkflowOutbox" WHERE id=$1', [expiredId]);
  if (expired.rows[0]?.status !== "failed" || expired.rows[0]?.lastError !== "lease_expired_requires_reconciliation") throw Error("expired outbox lease was not fail-closed");
  let unauthorizedDenied = false;
  try { await backend.query('SELECT * FROM "backup_claim_workflow_outbox"($1,$2,$3)', ["backend", eventType, 60]); } catch (error) { unauthorizedDenied = error.code === "42501"; }
  if (!unauthorizedDenied) throw Error("backend runtime may claim outbox work");
  console.log(JSON.stringify({ fencedClaim: true, staleAcknowledgementDenied: staleDenied, expiredLeaseFailClosed: true, backendClaimDenied: unauthorizedDenied }));
} finally { await Promise.all([owner.end(), dispatcher.end(), backend.end()]); }
