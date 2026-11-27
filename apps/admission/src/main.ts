import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { createPrismaClient, Prisma } from "@porisrom/database";
import { validateBackupArtifactProof, verifyBackupArtifactProof } from "@porisrom/shared-types";

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value; };
const db = createPrismaClient(required("ADMISSION_DATABASE_URL"));
const port = Number(process.env.ADMISSION_PORT ?? "7443");
const host = process.env.ADMISSION_HOST ?? "0.0.0.0";
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error("ADMISSION_PORT is invalid");
if (!/^(127\.0\.0\.1|0\.0\.0\.0)$/.test(host)) throw new Error("ADMISSION_HOST must be an explicit local or container listener");


function json(request: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => { let text = ""; request.setEncoding("utf8"); request.on("data", part => { text += part; if (text.length > 100_000) request.destroy(); }); request.on("end", () => { try { resolve(JSON.parse(text)); } catch { reject(new Error("Malformed JSON")); } }); request.on("error", reject); });
}
function fail(response: import("node:http").ServerResponse, code: number, message: string) { response.writeHead(code, { "content-type": "application/json" }); response.end(JSON.stringify({ error: message })); }
function workloadFingerprint(request: import("node:https").RequestOptions | any) {
  const socket = request.socket; const certificate = socket.getPeerCertificate?.(true);
  if (!socket.authorized || !certificate?.raw) throw new Error("mTLS client authentication is required");
  return createHash("sha256").update(certificate.raw).digest("hex");
}
async function admitOnce(fingerprint: string, input: unknown) {
  const proof = validateBackupArtifactProof(input);
  return db.$transaction(async (tx: any) => {
    const keys = await tx.$queryRaw(Prisma.sql`SELECT * FROM "backup_lock_admission_identity"(${fingerprint}, ${proof.verifierPrincipalId}, ${proof.verifierCertificateFingerprint})`) as { signingPublicKeyPem: string | null }[];
    if (keys.length !== 1 || !keys[0].signingPublicKeyPem || !verifyBackupArtifactProof(proof, keys[0].signingPublicKeyPem)) throw new Error("Proof signature or registered signing key is invalid");
    const args = [randomUUID(), proof.canonicalSetId, proof.captureJobId, proof.captureRequestId, proof.captureAttemptId, proof.leaseId, proof.generation, Prisma.sql`${proof.backupClass}::"BackupCaptureClass"`, proof.manifestSha256, proof.verifierCertificateFingerprint, proof.verificationMethod, Prisma.sql`${JSON.stringify(proof)}::jsonb`, proof.signature, proof.evidenceSha256, proof.idempotencyKey];
    const rows = await tx.$queryRaw(Prisma.sql`SELECT * FROM "backup_admit_verified_capture_verification"(${Prisma.join(args)})`) as { attemptId: string; idempotent: boolean }[];
    if (rows.length !== 1) throw new Error("Admission returned an invalid result"); return rows[0];
  }, { isolationLevel: "Serializable" });
}
async function admit(fingerprint: string, input: unknown) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await admitOnce(fingerprint, input); }
    catch (error: any) {
      const code = String(error?.meta?.code ?? error?.code ?? "");
      const retryable = ["40001", "40P01", "23505"].includes(code) || /Code: `(40001|40P01|23505)`/.test(String(error?.message));
      if (!retryable || attempt === 2) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

// Readiness is the sole unauthenticated route. Keep requesting client
// certificates, but allow its local TLS probe to finish the handshake; POST
// admission still requires an authorized mTLS peer in workloadFingerprint.
const server = createServer({ key: readFileSync(required("ADMISSION_TLS_KEY_FILE")), cert: readFileSync(required("ADMISSION_TLS_CERT_FILE")), ca: readFileSync(required("ADMISSION_TLS_CLIENT_CA_FILE")), requestCert: true, rejectUnauthorized: false, minVersion: "TLSv1.3" }, async (request, response) => {
  if (request.method === "GET" && request.url === "/health/ready") { response.writeHead(200); response.end("ok"); return; }
  if (request.method !== "POST" || request.url !== "/v1/capture-verifications") return fail(response, 404, "Not found");
  try { const result = await admit(workloadFingerprint(request), await json(request)); response.writeHead(201, { "content-type": "application/json" }); response.end(JSON.stringify(result)); }
  catch (error) { fail(response, 403, error instanceof Error ? error.message : "Admission refused"); }
});
server.listen(port, host);
process.on("SIGTERM", () => server.close(() => db.$disconnect().finally(() => process.exit(0))));
