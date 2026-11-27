import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";
const require = createRequire(new URL("../apps/backend/package.json", import.meta.url));
const { Client } = require("pg");
const required = name => { const value = process.env[name]; if (!value) throw Error(`${name} is required`); return value; };
const connect = async url => { const client = new Client({ connectionString: url }); await client.connect(); return client; };
const owner = await connect(required("STEP6_OWNER_DATABASE_URL"));
const finalizer = await connect(required("STEP6_FINALIZER_DATABASE_URL"));
const id = `step6-${randomUUID()}`; const digest = value => createHash("sha256").update(value).digest("hex");
const principal = `principal-${id}`, certificate = `certificate-${id}`, fingerprint = digest(`cert-${id}`), requestId = `request-${id}`, jobId = `job-${id}`, canonicalId = `canonical-${id}`, evidenceId = `evidence-${id}`, leaseId = randomUUID(), attemptId = randomUUID(), idempotencyKey = `finalization-${id}`;
let previous;
try {
  previous = (await owner.query('SELECT * FROM "StorageMaintenanceState" WHERE id=$1 FOR UPDATE', ["storage"])).rows[0];
  await owner.query('INSERT INTO "BackupVerifierPrincipal" (id,name) VALUES ($1,$2)', [principal, "Step 6 fixture"]);
  await owner.query('INSERT INTO "BackupVerifierCertificate" (id,"principalId",fingerprint,purpose,"signingPublicKeyPem") VALUES ($1,$2,$3,$4,$5)', [certificate, principal, fingerprint, "artifact_verifier", "-----BEGIN PUBLIC KEY-----\nfixture\n-----END PUBLIC KEY-----"]);
  await owner.query('INSERT INTO "BackupCaptureRequest" (id,"scheduleKey","scheduledFor","backupClass",status,"updatedAt") VALUES ($1,$2,NOW(),$3,$4,NOW())', [requestId, `schedule-${id}`, "daily", "ready"]);
  const manifest = digest(`manifest-${id}`);
  await owner.query('INSERT INTO "BackupCaptureJob" (id,"requestId","backupClass","leaseId","leaseGeneration",status,"coordinatorAttemptId","resultOutcome") VALUES ($1,$2,$3,$4,1,$5,$6,$7)', [jobId, requestId, "daily", leaseId, "reported", attemptId, "succeeded"]);
  await owner.query('INSERT INTO "BackupCanonicalSet" (id,"captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","manifestFormatVersion","canonicalStorageKey") VALUES ($1,$2,$3,$4,$5,1,$6,$7,1,$8)', [canonicalId, jobId, requestId, attemptId, leaseId, "daily", manifest, `backup-canonical/${id}/manifest`]);
  await owner.query('INSERT INTO "BackupCaptureVerificationAttempt" (id,"canonicalSetId","captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","verifierPrincipalId","verifierCertificateId","certificatePurpose","verificationMethod",result,"resultPayload","evidenceSha256","idempotencyKey") VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)', [evidenceId, canonicalId, jobId, requestId, attemptId, leaseId, "daily", manifest, principal, certificate, "artifact_verifier", "independent-artifact-ed25519-v2", "verified", JSON.stringify({ proofVersion: "2" }), digest(`proof-${id}`), `proof-${id}`]);
  await owner.query('UPDATE "StorageMaintenanceState" SET mode=$1,generation=1,"captureLeaseId"=$2,"captureGeneration"=1,"captureJobId"=$3,"captureOutcome"=$4,"captureOutcomeAt"=NOW(),"captureOutcomeBy"=$5 WHERE id=$6', ["quiescent", leaseId, jobId, "succeeded", "coordinator", "storage"]);
  const first = await finalizer.query('SELECT * FROM "backup_finalize_verified_capture"($1,$2,$3,$4)', [jobId, canonicalId, evidenceId, idempotencyKey]);
  const retry = await finalizer.query('SELECT * FROM "backup_finalize_verified_capture"($1,$2,$3,$4)', [jobId, canonicalId, evidenceId, idempotencyKey]);
  if (first.rows.length !== 1 || first.rows[0].idempotent !== false || retry.rows[0]?.idempotent !== true) throw Error("finalization idempotency failed");
  const state = await owner.query('SELECT "captureJobId","captureLeaseId" FROM "StorageMaintenanceState" WHERE id=$1', ["storage"]);
  const job = await owner.query('SELECT status,"finalizedVerificationAttemptId" FROM "BackupCaptureJob" WHERE id=$1', [jobId]);
  if (state.rows[0].captureJobId !== null || state.rows[0].captureLeaseId !== null || job.rows[0].status !== "finalized" || job.rows[0].finalizedVerificationAttemptId !== evidenceId) throw Error("atomic terminal transition failed");
  let backendDenied = false;
  try { await owner.query('SELECT has_function_privilege($1,$2,$3) AS allowed', ["porisrom_backend_runtime", 'public."backup_finalize_verified_capture"(text,text,text,text)', "EXECUTE"]).then(result => { if (result.rows[0].allowed) throw Error("backend execute privilege leaked"); }); backendDenied = true; } catch (error) { if (error.message === "backend execute privilege leaked") throw error; }
  console.log(JSON.stringify({ atomicFinalization: true, idempotentRetry: true, backendFinalizationDenied: backendDenied }));
} finally {
  if (previous) {
    await owner.query('UPDATE "StorageMaintenanceState" SET mode=$1,generation=$2,"captureLeaseId"=$3,"captureGeneration"=$4,"captureAcquiredAt"=$5,"captureAcquiredBy"=$6,"captureOutcome"=$7,"captureOutcomeAt"=$8,"captureOutcomeBy"=$9,"captureOutcomeReason"=$10,"captureJobId"=$11 WHERE id=$12', [previous.mode, previous.generation, previous.captureLeaseId, previous.captureGeneration, previous.captureAcquiredAt, previous.captureAcquiredBy, previous.captureOutcome, previous.captureOutcomeAt, previous.captureOutcomeBy, previous.captureOutcomeReason, previous.captureJobId, "storage"]);
  }
  await Promise.all([owner.end(), finalizer.end()]);
}
