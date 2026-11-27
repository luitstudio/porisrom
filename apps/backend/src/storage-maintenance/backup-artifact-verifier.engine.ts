import { createHash, createPrivateKey, createPublicKey, randomUUID, sign, verify } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, lstat, mkdir, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { BACKUP_ARTIFACT_INVENTORY, BACKUP_PROOF_METHOD, BACKUP_PROOF_VERSION, canonicalJson } from "@porisrom/shared-types";

const artifacts = BACKUP_ARTIFACT_INVENTORY;
const expectedFiles = new Set([...artifacts, "manifest.sha256", "metadata", "INTEGRITY_VERIFIED"]);
const requiredMetadata = ["set_id", "class", "capture_job_id", "capture_request_id", "lease_id", "generation", "attempt_id", "state"] as const;

export type ArtifactVerificationBinding = {
  canonicalSetId: string; captureJobId: string; captureRequestId: string; captureAttemptId: string;
  leaseId: string; generation: number; backupClass: "daily" | "weekly" | "monthly";
  manifestFormatVersion: number; manifestSha256: string; canonicalStorageKey: string;
};

export type ArtifactVerifierConfig = {
  candidateInboxRoot: string; verifierStagingRoot: string; verifierCanonicalRoot: string;
  verifierPrincipalId: string; verifierCertificateFingerprint: string; proofPrivateKeyPem: string;
  maxFileBytes: number; maxTotalBytes: number; maxConcurrent: number;
};

export type ArtifactVerificationProof = ArtifactVerificationBinding & {
  proofVersion: 2; verificationMethod: "independent-artifact-ed25519-v2"; result: "verified";
  verifiedAt: string; artifactHashes: Record<string, string>; evidenceSha256: string;
  idempotencyKey: string; verifierPrincipalId: string; verifierCertificateFingerprint: string; signature: string;
};

/**
 * A filesystem-only worker core.  Callers supply a canonical binding from a
 * trusted worker queue; it deliberately has no coordinator, lease, scheduler,
 * Prisma, or finalization dependency.
 */
export class BackupArtifactVerifierEngine {
  private running = 0;
  constructor(private readonly config: ArtifactVerifierConfig) {}

  async verify(binding: ArtifactVerificationBinding, candidateName: string): Promise<ArtifactVerificationProof> {
    if (this.running >= this.config.maxConcurrent) throw new ArtifactVerificationError("capacity", "Verifier concurrency limit reached");
    this.running++;
    try { return await this.verifyOne(binding, candidateName); }
    finally { this.running--; }
  }

  private async verifyOne(binding: ArtifactVerificationBinding, candidateName: string) {
    validateBinding(binding); validateCandidateName(candidateName);
    const source = within(this.config.candidateInboxRoot, candidateName);
    const canonical = within(this.config.verifierCanonicalRoot, binding.canonicalSetId);
    const staging = within(this.config.verifierStagingRoot, `.verify-${binding.canonicalSetId}-${randomUUID()}`);
    await assertDirectory(source); await assertNotExists(canonical); await mkdir(this.config.verifierStagingRoot, { recursive: true });
    await mkdir(staging, { recursive: false });
    try {
      const sourceInventory = await inventory(source);
      assertInventory(sourceInventory);
      const metadata = parseMetadata(await readRegularText(source, "metadata"));
      assertMetadata(metadata, binding, candidateName);
      const manifestText = await readRegularText(source, "manifest.sha256");
      const manifest = parseManifest(manifestText);
      const manifestSha256 = await hashFile(within(source, "manifest.sha256"));
      if (manifestSha256 !== binding.manifestSha256) throw new ArtifactVerificationError("binding", "Manifest digest does not match canonical binding");
      const sourceFacts = new Map<string, FileFact>(); const artifactHashes: Record<string, string> = {};
      let total = 0;
      for (const name of artifacts) {
        const sourcePath = within(source, name); const before = await fileFact(sourcePath);
        if (before.size > this.config.maxFileBytes || (total += before.size) > this.config.maxTotalBytes) throw new ArtifactVerificationError("limit", "Artifact size limit exceeded");
        const actual = await hashFile(sourcePath); if (actual !== manifest.get(name)) throw new ArtifactVerificationError("hash", `Artifact digest mismatch: ${name}`);
        sourceFacts.set(name, before); artifactHashes[name] = actual;
        await copyRegularFile(sourcePath, within(staging, name), before);
      }
      await copyRegularFile(within(source, "manifest.sha256"), within(staging, "manifest.sha256"), await fileFact(within(source, "manifest.sha256")));
      await copyRegularFile(within(source, "metadata"), within(staging, "metadata"), await fileFact(within(source, "metadata")));
      // Legacy marker is copied as an opaque compatibility artifact; never trusted as proof.
      await copyRegularFile(within(source, "INTEGRITY_VERIFIED"), within(staging, "INTEGRITY_VERIFIED"), await fileFact(within(source, "INTEGRITY_VERIFIED")));
      for (const name of artifacts) {
        if ((await hashFile(within(staging, name))) !== artifactHashes[name]) throw new ArtifactVerificationError("staging", `Staged artifact changed: ${name}`);
        if (!sameFact(sourceFacts.get(name)!, await fileFact(within(source, name)))) throw new ArtifactVerificationError("toctou", `Source artifact changed during verification: ${name}`);
      }
      if ((await hashFile(within(source, "manifest.sha256"))) !== manifestSha256) throw new ArtifactVerificationError("toctou", "Source manifest changed during verification");
      const proof = this.proof(binding, artifactHashes);
      await durableWrite(within(staging, "verification-proof.json"), canonicalJson(proof));
      await syncDirectory(staging); await assertNotExists(canonical); await mkdir(this.config.verifierCanonicalRoot, { recursive: true });
      await rename(staging, canonical); await syncDirectory(this.config.verifierCanonicalRoot);
      return proof;
    } catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  private proof(binding: ArtifactVerificationBinding, artifactHashes: Record<string, string>): ArtifactVerificationProof {
    const unsigned = { ...binding, proofVersion: BACKUP_PROOF_VERSION, verificationMethod: BACKUP_PROOF_METHOD, result: "verified" as const,
      verifiedAt: new Date().toISOString(), artifactHashes, idempotencyKey: `artifact:${binding.canonicalSetId}:${binding.manifestSha256}`,
      verifierPrincipalId: this.config.verifierPrincipalId, verifierCertificateFingerprint: this.config.verifierCertificateFingerprint };
    const evidenceSha256 = sha256(canonicalJson(unsigned));
    const signature = sign(null, Buffer.from(canonicalJson({ ...unsigned, evidenceSha256 })), createPrivateKey(this.config.proofPrivateKeyPem)).toString("base64url");
    return { ...unsigned, evidenceSha256, signature };
  }
}

export class ArtifactVerificationError extends Error { constructor(readonly code: string, message: string) { super(message); } }
type FileFact = { dev: number; ino: number; size: number; mtimeMs: number };

function validateBinding(binding: ArtifactVerificationBinding) {
  if (!binding.canonicalSetId || !binding.captureJobId || !binding.captureRequestId || !Number.isInteger(binding.generation) || binding.generation < 1 ||
    !/^[a-f0-9]{64}$/.test(binding.manifestSha256) || binding.manifestFormatVersion !== 1 || !/^backup-canonical\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(binding.canonicalStorageKey) || binding.canonicalStorageKey.includes("..") || binding.canonicalStorageKey.includes("\\")) throw new ArtifactVerificationError("binding", "Invalid canonical verification binding");
}
function validateCandidateName(value: string) { if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new ArtifactVerificationError("path", "Unsafe candidate identifier"); }
function within(root: string, child: string) { const value = resolve(root, child); if (relative(resolve(root), value).startsWith(".." + sep) || relative(resolve(root), value) === "..") throw new ArtifactVerificationError("path", "Path escaped configured root"); return value; }
async function assertDirectory(path: string) { const value = await lstat(path); if (!value.isDirectory() || value.isSymbolicLink()) throw new ArtifactVerificationError("inventory", "Candidate is not a regular directory"); }
async function assertNotExists(path: string) { try { await access(path, fsConstants.F_OK); throw new ArtifactVerificationError("conflict", "Canonical identity already exists"); } catch (error) { if (error instanceof ArtifactVerificationError) throw error; } }
async function inventory(root: string) { const entries = await readdir(root, { withFileTypes: true }); if (entries.some(entry => !entry.isFile() || entry.isSymbolicLink())) throw new ArtifactVerificationError("inventory", "Candidate contains unsafe filesystem object"); return new Set(entries.map(entry => entry.name)); }
function assertInventory(actual: Set<string>) { if (actual.size !== expectedFiles.size || [...actual].some(name => !expectedFiles.has(name))) throw new ArtifactVerificationError("inventory", "Candidate inventory is incomplete or unexpected"); }
async function readRegularText(root: string, name: string) { const path = within(root, name); await fileFact(path); return readFile(path, "utf8"); }
function parseMetadata(text: string) { const out = new Map<string, string>(); for (const line of text.split("\n")) { if (!line) continue; const match = /^([a-z_]+)=(.*)$/.exec(line.replace(/\r$/, "")); if (!match || out.has(match[1])) throw new ArtifactVerificationError("metadata", "Malformed metadata"); out.set(match[1], match[2]); } return out; }
function assertMetadata(metadata: Map<string, string>, binding: ArtifactVerificationBinding, candidateName: string) { for (const key of requiredMetadata) if (!metadata.get(key)) throw new ArtifactVerificationError("metadata", `Missing metadata: ${key}`); if (metadata.get("set_id") !== candidateName || metadata.get("class") !== binding.backupClass || metadata.get("capture_job_id") !== binding.captureJobId || metadata.get("capture_request_id") !== binding.captureRequestId || metadata.get("attempt_id") !== binding.captureAttemptId || metadata.get("lease_id") !== binding.leaseId || metadata.get("generation") !== String(binding.generation) || metadata.get("state") !== "created") throw new ArtifactVerificationError("binding", "Metadata does not match canonical binding"); }
function parseManifest(text: string) { const values = new Map<string, string>(); const lines = text.replace(/\r\n/g, "\n").split("\n").filter(Boolean); if (lines.length !== artifacts.length) throw new ArtifactVerificationError("manifest", "Manifest inventory is invalid"); for (const line of lines) { const match = /^([a-f0-9]{64}) {2}([A-Za-z0-9._-]+)$/.exec(line); if (!match || !artifacts.includes(match[2] as typeof artifacts[number]) || values.has(match[2])) throw new ArtifactVerificationError("manifest", "Malformed manifest"); values.set(match[2], match[1]); } if (values.size !== artifacts.length) throw new ArtifactVerificationError("manifest", "Manifest is incomplete"); return values; }
async function fileFact(path: string): Promise<FileFact> { const value = await lstat(path); if (!value.isFile() || value.isSymbolicLink()) throw new ArtifactVerificationError("inventory", "Unsafe artifact object"); return { dev: value.dev, ino: value.ino, size: value.size, mtimeMs: value.mtimeMs }; }
function sameFact(left: FileFact, right: FileFact) { return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeMs === right.mtimeMs; }
async function hashFile(path: string) { const handle = await open(path, "r"); try { const hash = createHash("sha256"); const buffer = Buffer.allocUnsafe(1024 * 1024); for (;;) { const { bytesRead } = await handle.read(buffer, 0, buffer.length, null); if (!bytesRead) break; hash.update(buffer.subarray(0, bytesRead)); } return hash.digest("hex"); } finally { await handle.close(); } }
async function copyRegularFile(source: string, target: string, before: FileFact) { if (!sameFact(before, await fileFact(source))) throw new ArtifactVerificationError("toctou", "Source changed before copy"); await copyFile(source, target, fsConstants.COPYFILE_EXCL); await syncFile(target); }
async function durableWrite(path: string, value: string) { await writeFile(path, value, { flag: "wx", mode: 0o600 }); await syncFile(path); }
async function syncFile(path: string) {
  const handle = await open(path, "r");
  try { await handle.sync(); }
  catch (error: any) {
    // Some Windows/overlay filesystems reject fsync. Atomic rename and all
    // integrity rechecks still apply, but callers must not claim portable
    // power-loss durability on such a filesystem.
    if (!["EPERM", "EINVAL", "ENOTSUP"].includes(error?.code)) throw error;
  } finally { await handle.close(); }
}
async function syncDirectory(path: string) { try { const handle = await open(path, "r"); try { await handle.sync(); } finally { await handle.close(); } } catch { /* Some platforms cannot fsync directories; rename remains same-filesystem atomic. */ } }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function verifyProofSignature(proof: ArtifactVerificationProof, publicKeyPem: string) { const { signature, ...unsigned } = proof; try { return verify(null, Buffer.from(canonicalJson(unsigned)), createPublicKey(publicKeyPem), Buffer.from(signature, "base64url")); } catch { return false; } }
