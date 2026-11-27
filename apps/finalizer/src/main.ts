import { Prisma, createPrismaClient } from "@porisrom/database";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const databaseUrl = required("FINALIZER_DATABASE_URL");
const workerId = required("FINALIZER_WORKER_ID");
const pollMs = Number(process.env.FINALIZER_POLL_MS ?? "1000");
if (!Number.isSafeInteger(pollMs) || pollMs < 100 || pollMs > 60_000) throw new Error("FINALIZER_POLL_MS is invalid");
const db = createPrismaClient(databaseUrl);

type Claimed = { id: string; payload: { verificationAttemptId?: string; canonicalSetId?: string; captureJobId?: string }; claimToken: string };
const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function claim(): Promise<Claimed | null> {
  const rows = await db.$queryRaw(Prisma.sql`SELECT * FROM "backup_claim_workflow_outbox"(${workerId}, ${"backup.evidence-admitted"}, ${60})`) as Claimed[];
  return rows.length === 1 ? rows[0] : null;
}
async function acknowledge(id: string, token: string) {
  await db.$queryRaw(Prisma.sql`SELECT "backup_ack_workflow_outbox"(${id}, ${token})`);
}
async function retry(id: string, token: string, error: unknown) {
  const message = error instanceof Error ? error.message : "finalization failed";
  await db.$queryRaw(Prisma.sql`SELECT "backup_retry_workflow_outbox"(${id}, ${token}, ${message}, ${30})`);
}
async function processOne() {
  const event = await claim();
  if (!event) return false;
  const { verificationAttemptId, canonicalSetId, captureJobId } = event.payload ?? {};
  try {
    if (!verificationAttemptId || !canonicalSetId || !captureJobId) throw new Error("invalid evidence-admitted outbox payload");
    await db.$queryRaw(Prisma.sql`SELECT * FROM "backup_finalize_verified_capture"(${captureJobId}, ${canonicalSetId}, ${verificationAttemptId}, ${`finalize:${verificationAttemptId}`})`);
    await acknowledge(event.id, event.claimToken);
  } catch (error) {
    await retry(event.id, event.claimToken, error);
  }
  return true;
}

async function main() {
  for (;;) {
    const processed = await processOne();
    if (!processed) await delay(pollMs);
  }
}
main().catch(async error => { console.error(error instanceof Error ? error.message : "finalizer failed"); await db.$disconnect(); process.exit(1); });
process.on("SIGTERM", () => db.$disconnect().finally(() => process.exit(0)));
