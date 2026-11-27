import { readFileSync } from "node:fs";
import { Prisma, createPrismaClient } from "@porisrom/database";
import { ArtifactVerifierAdmissionWorker } from "./artifact-verifier-admission.worker";

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value; };
const db = createPrismaClient(required("VERIFIER_DISPATCH_DATABASE_URL"));
const workerId = required("VERIFIER_WORKER_ID");
const engineModule = process.env.VERIFIER_ENGINE_MODULE ?? "./verifier/src/backup-artifact-verifier.engine.js";
// The engine is copied into the runtime image from the already compiled backend
// artifact; verifier source never receives a backend database credential.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BackupArtifactVerifierEngine } = require(engineModule) as { BackupArtifactVerifierEngine: new (config: any) => { verify(binding: any, candidateName: string): Promise<any> } };
const engine = new BackupArtifactVerifierEngine({
  candidateInboxRoot: required("VERIFIER_CANDIDATE_INBOX_ROOT"), verifierStagingRoot: required("VERIFIER_STAGING_ROOT"), verifierCanonicalRoot: required("VERIFIER_CANONICAL_ROOT"),
  verifierPrincipalId: required("VERIFIER_PRINCIPAL_ID"), verifierCertificateFingerprint: required("VERIFIER_CERTIFICATE_FINGERPRINT"), proofPrivateKeyPem: readFileSync(required("VERIFIER_SIGNING_KEY_FILE"), "utf8"),
  maxFileBytes: Number(process.env.VERIFIER_MAX_FILE_BYTES ?? 1_073_741_824), maxTotalBytes: Number(process.env.VERIFIER_MAX_TOTAL_BYTES ?? 4_294_967_296), maxConcurrent: 1,
});
const admission = ArtifactVerifierAdmissionWorker.fromEnvironment();
const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
async function once() {
  const rows = await db.$queryRaw(Prisma.sql`SELECT * FROM "backup_claim_workflow_outbox"(${workerId}, ${"backup.canonical-published"}, ${60})`) as any[];
  if (rows.length !== 1) return false;
  const event = rows[0];
  try {
    const binding = event.payload;
    if (!binding?.canonicalSetId || !binding?.captureJobId || !binding?.manifestSha256) throw new Error("invalid canonical-publication outbox payload");
    await admission.processTrustedTask({ binding, candidateName: binding.canonicalSetId }, (trusted: any, candidateName: string) => engine.verify(trusted, candidateName));
    await db.$queryRaw(Prisma.sql`SELECT "backup_ack_workflow_outbox"(${event.id}, ${event.claimToken})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "verifier dispatch failed";
    await db.$queryRaw(Prisma.sql`SELECT "backup_retry_workflow_outbox"(${event.id}, ${event.claimToken}, ${message}, ${30})`);
  }
  return true;
}
async function main() { for (;;) { if (!await once()) await delay(Number(process.env.VERIFIER_POLL_MS ?? 1000)); } }
main().catch(async error => { console.error(error instanceof Error ? error.message : "verifier dispatcher failed"); await db.$disconnect(); process.exit(1); });
process.on("SIGTERM", () => db.$disconnect().finally(() => process.exit(0)));
