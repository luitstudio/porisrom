import { createHash, createPublicKey, verify } from "node:crypto";

/** Version 2 is the first proof format accepted by the admission authority. */
export const BACKUP_PROOF_VERSION = 2 as const;
export const BACKUP_PROOF_METHOD = "independent-artifact-ed25519-v2" as const;
export const BACKUP_ARTIFACT_INVENTORY = ["database.dump.age", "production_public_assets.tar.age", "production_private_documents.tar.age"] as const;

export type BackupArtifactProof = {
  canonicalSetId: string; captureJobId: string; captureRequestId: string; captureAttemptId: string; leaseId: string;
  generation: number; backupClass: "daily" | "weekly" | "monthly"; manifestFormatVersion: number; manifestSha256: string;
  canonicalStorageKey: string; proofVersion: typeof BACKUP_PROOF_VERSION; verificationMethod: typeof BACKUP_PROOF_METHOD;
  result: "verified"; verifiedAt: string; artifactHashes: Record<(typeof BACKUP_ARTIFACT_INVENTORY)[number], string>;
  evidenceSha256: string; idempotencyKey: string; verifierPrincipalId: string; verifierCertificateFingerprint: string; signature: string;
};

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isSafeInteger(value)) throw new Error("Canonical proof numbers must be safe integers"); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  throw new Error("Canonical proof payload has an unsupported value");
}

export function unsignedProof(proof: BackupArtifactProof) { const { signature, ...unsigned } = proof; return unsigned; }
export function proofDigest(proof: Omit<BackupArtifactProof, "signature"> | BackupArtifactProof) { const { evidenceSha256: _digest, signature: _signature, ...unsigned } = proof as BackupArtifactProof; return createHash("sha256").update(canonicalJson(unsigned)).digest("hex"); }
export function signedProofBytes(proof: BackupArtifactProof) { return Buffer.from(canonicalJson(unsignedProof(proof))); }
export function validateBackupArtifactProof(value: unknown): BackupArtifactProof {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Proof must be an object");
  const p = value as Record<string, unknown>;
  const exact = ["canonicalSetId","captureJobId","captureRequestId","captureAttemptId","leaseId","generation","backupClass","manifestFormatVersion","manifestSha256","canonicalStorageKey","proofVersion","verificationMethod","result","verifiedAt","artifactHashes","evidenceSha256","idempotencyKey","verifierPrincipalId","verifierCertificateFingerprint","signature"];
  if (Object.keys(p).length !== exact.length || exact.some(key => !(key in p))) throw new Error("Proof fields are incomplete or ambiguous");
  const strings = exact.filter(key => !["generation","manifestFormatVersion","proofVersion","artifactHashes"].includes(key));
  if (strings.some(key => typeof p[key] !== "string" || !(p[key] as string).normalize("NFC") || (p[key] as string) !== (p[key] as string).normalize("NFC"))) throw new Error("Proof string representation is invalid");
  if (p.proofVersion !== BACKUP_PROOF_VERSION || p.verificationMethod !== BACKUP_PROOF_METHOD || p.result !== "verified" || !Number.isSafeInteger(p.generation) || !Number.isSafeInteger(p.manifestFormatVersion) || !["daily","weekly","monthly"].includes(p.backupClass as string)) throw new Error("Proof version or enum is unsupported");
  if (!isDigest(p.manifestSha256) || !isDigest(p.evidenceSha256) || !isDigest(p.verifierCertificateFingerprint) || !isSignature(p.signature) || !Number.isFinite(Date.parse(p.verifiedAt as string))) throw new Error("Proof cryptographic representation is invalid");
  if (!p.artifactHashes || typeof p.artifactHashes !== "object" || Array.isArray(p.artifactHashes)) throw new Error("Proof artifact inventory is invalid");
  const hashes = p.artifactHashes as Record<string, unknown>;
  if (Object.keys(hashes).length !== BACKUP_ARTIFACT_INVENTORY.length || BACKUP_ARTIFACT_INVENTORY.some(name => !isDigest(hashes[name]))) throw new Error("Proof artifact inventory is invalid");
  const proof = p as unknown as BackupArtifactProof;
  if (proofDigest(proof) !== proof.evidenceSha256.toLowerCase()) throw new Error("Proof digest does not match canonical payload");
  return proof;
}
export function verifyBackupArtifactProof(proof: BackupArtifactProof, publicKeyPem: string) { try { return verify(null, signedProofBytes(proof), createPublicKey(publicKeyPem), Buffer.from(proof.signature, "base64url")); } catch { return false; } }
export function isDigest(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value); }
export function isSignature(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{86}$/.test(value); }
