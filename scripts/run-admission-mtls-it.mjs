import { createHash, generateKeyPairSync, randomUUID, sign, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import https from "node:https";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(new URL("../apps/backend/package.json", import.meta.url));
const pg = require("pg");

const required = name => { const value = process.env[name]; if (!value) throw Error(`${name} is required`); return value; };
const tlsDir = required("ADMISSION_TEST_TLS_DIR");
const databaseUrl = required("ADMISSION_TEST_DATABASE_URL");
const endpoint = new URL(process.env.ADMISSION_TEST_ENDPOINT ?? "https://localhost:57444/v1/capture-verifications");
const openssl = process.env.ADMISSION_TEST_OPENSSL ?? "C:/Program Files/Git/usr/bin/openssl.exe";
const sha = value => createHash("sha256").update(value).digest("hex");
const canonical = value => value && typeof value === "object" && !Array.isArray(value) ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
const request = (body, clientDir) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body); const req = https.request({ hostname: endpoint.hostname, port: endpoint.port, path: endpoint.pathname, method: "POST", ca: readFileSync(`${tlsDir}/ca.crt`), cert: readFileSync(join(clientDir, "client.crt")), key: readFileSync(join(clientDir, "client.key")), headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) } }, response => { let text = ""; response.on("data", part => text += part); response.on("end", () => resolve({ status: response.statusCode, body: text })); }); req.on("error", reject); req.end(data);
});

const db = new pg.Client({ connectionString: databaseUrl });
const clientDir = await mkdtemp(join(tmpdir(), "porisrom-admission-client-"));
for (const args of [["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "client.key", "-out", "client.csr", "-subj", `/CN=workload-${Date.now()}`], ["x509", "-req", "-in", "client.csr", "-CA", join(tlsDir, "ca.crt"), "-CAkey", join(tlsDir, "ca.key"), "-CAcreateserial", "-out", "client.crt", "-days", "1"]]) { const result = spawnSync(openssl, args, { cwd: clientDir, encoding: "utf8" }); if (result.status !== 0) throw Error(result.stderr || "synthetic client certificate generation failed"); }
await db.connect();
try {
  const suffix = `mtls-${Date.now()}`; const principal = `principal-${suffix}`; const certificate = sha(`certificate-${suffix}`); const requestId = `request-${suffix}`; const jobId = `job-${suffix}`; const canonicalId = `canonical-${suffix}`; const attemptId = randomUUID(); const leaseId = randomUUID(); const manifest = sha(`manifest-${suffix}`);
  const clientFingerprint = sha(new X509Certificate(readFileSync(join(clientDir, "client.crt"))).raw); const keys = generateKeyPairSync("ed25519"); const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
  await db.query('INSERT INTO "BackupVerifierPrincipal" (id,name) VALUES ($1,$2)', [principal, "mTLS fixture"]);
  await db.query('INSERT INTO "BackupVerifierCertificate" (id,"principalId",fingerprint,purpose,"signingPublicKeyPem") VALUES ($1,$2,$3,$4,$5)', [`certificate-${suffix}`, principal, certificate, "artifact_verifier", publicKey]);
  await db.query('INSERT INTO "BackupVerifierWorkloadIdentity" (fingerprint,"principalId",purpose) VALUES ($1,$2,$3)', [clientFingerprint, principal, "artifact_verifier"]);
  await db.query('INSERT INTO "BackupCaptureRequest" (id,"scheduleKey","scheduledFor","backupClass",status,"updatedAt") VALUES ($1,$2,NOW(),$3,$4,NOW())', [requestId, `schedule-${suffix}`, "daily", "ready"]);
  await db.query('INSERT INTO "BackupCaptureJob" (id,"requestId","backupClass","leaseId","leaseGeneration",status,"coordinatorAttemptId") VALUES ($1,$2,$3,$4,1,$5,$6)', [jobId, requestId, "daily", leaseId, "reported", attemptId]);
  await db.query('INSERT INTO "BackupCanonicalSet" (id,"captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","manifestFormatVersion","canonicalStorageKey") VALUES ($1,$2,$3,$4,$5,1,$6,$7,1,$8)', [canonicalId, jobId, requestId, attemptId, leaseId, "daily", manifest, `backup-canonical/${suffix}/manifest`]);
  const proof = { canonicalSetId: canonicalId, captureJobId: jobId, captureRequestId: requestId, captureAttemptId: attemptId, leaseId, generation: 1, backupClass: "daily", manifestFormatVersion: 1, manifestSha256: manifest, canonicalStorageKey: `backup-canonical/${suffix}/manifest`, proofVersion: 2, verificationMethod: "independent-artifact-ed25519-v2", result: "verified", verifiedAt: new Date().toISOString(), artifactHashes: { "database.dump.age": sha(`db-${suffix}`), "production_public_assets.tar.age": sha(`public-${suffix}`), "production_private_documents.tar.age": sha(`private-${suffix}`) }, idempotencyKey: `proof-${suffix}`, verifierPrincipalId: principal, verifierCertificateFingerprint: certificate };
  proof.evidenceSha256 = sha(canonical(proof)); proof.signature = sign(null, Buffer.from(canonical(proof)), keys.privateKey).toString("base64url");
  const concurrent = await Promise.all([request(proof, clientDir), request(proof, clientDir)]);
  if (concurrent.some(result => result.status !== 201) || concurrent.filter(result => JSON.parse(result.body).idempotent === false).length !== 1 || concurrent.filter(result => JSON.parse(result.body).idempotent === true).length !== 1) throw Error(`concurrent admission was not exactly-once idempotent: ${JSON.stringify(concurrent)}`);
  const accepted = concurrent.find(result => JSON.parse(result.body).idempotent === false);
  const retry = await request(proof, clientDir); if (retry.status !== 201 || !JSON.parse(retry.body).idempotent) throw Error("exact retry was not idempotent");
  const conflictProof = { ...proof, verifiedAt: new Date(Date.now() + 1000).toISOString() }; const unsignedConflict = { ...conflictProof }; delete unsignedConflict.evidenceSha256; delete unsignedConflict.signature; conflictProof.evidenceSha256 = sha(canonical(unsignedConflict)); delete conflictProof.signature; conflictProof.signature = sign(null, Buffer.from(canonical(conflictProof)), keys.privateKey).toString("base64url");
  const conflict = await request(conflictProof, clientDir); if (conflict.status === 201) throw Error("conflicting retry was admitted");
  const tampered = await request({ ...proof, manifestSha256: sha("tampered") }, clientDir); if (tampered.status === 201) throw Error("tampered proof was admitted");
  const rows = await db.query('SELECT "resultPayload"->>\'proofVersion\' AS version, count(*)::int AS count FROM "BackupCaptureVerificationAttempt" WHERE "canonicalSetId"=$1 GROUP BY "resultPayload"->>\'proofVersion\'', [canonicalId]);
  if (rows.rows.length !== 1 || rows.rows[0].count !== 1 || rows.rows[0].version !== "2") throw Error("authenticated evidence persistence/provenance failed");
  const replacement = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
  const immutabilityCodes = [];
  for (const value of [replacement, null]) {
    try { await db.query('UPDATE "BackupVerifierCertificate" SET "signingPublicKeyPem"=$1 WHERE fingerprint=$2', [value, certificate]); }
    catch (error) { immutabilityCodes.push(error.code); }
  }
  const immutable = immutabilityCodes.length === 2 && immutabilityCodes.every(code => ["23514", "55000"].includes(code));
  if (!immutable) throw Error("registered signing key was mutable");
  const revocation = db.query('UPDATE "BackupVerifierCertificate" SET status=$1,"revokedAt"=NOW(),"revokeReason"=$2 WHERE fingerprint=$3', ["revoked", "concurrency fixture", certificate]);
  const racingAdmission = request(proof, clientDir);
  const [, raced] = await Promise.all([revocation, racingAdmission]);
  if (![201, 403].includes(raced.status)) throw Error(`admission/revocation race produced unexpected status ${raced.status}`);
  const revoked = await request(proof, clientDir); if (revoked.status === 201) throw Error("revoked certificate was admitted");
  const rotatedCertificate = sha(`rotated-certificate-${suffix}`);
  await db.query('INSERT INTO "BackupVerifierCertificate" (id,"principalId",fingerprint,purpose,"signingPublicKeyPem") VALUES ($1,$2,$3,$4,$5)', [`certificate-rotated-${suffix}`, principal, rotatedCertificate, "artifact_verifier", replacement]);
  const rotated = await db.query('SELECT count(*)::int AS count FROM "BackupVerifierCertificate" WHERE "principalId"=$1 AND purpose=$2 AND status=$3', [principal, "artifact_verifier", "active"]);
  if (rotated.rows[0].count !== 1) throw Error("key rotation did not require a distinct active certificate identity");
  console.log(JSON.stringify({ accepted, concurrent, retry, conflict, tampered, persisted: rows.rows[0], signingKeyImmutable: immutable, immutabilityCodes, admissionRevocationRace: raced.status, revoked, rotatedCertificateIdentity: rotatedCertificate }));
} finally { await db.end(); await rm(clientDir, { recursive: true, force: true }); }
