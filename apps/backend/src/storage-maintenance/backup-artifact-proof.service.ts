import { ConflictException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { validateBackupArtifactProof, verifyBackupArtifactProof } from "@porisrom/shared-types";

import type { BackupVerifierIdentity } from "./backup-verifier-mtls.guard";
import type { BackupVerifierEvidenceDto } from "./dto/backup-verifier.dto";

/**
 * Validates the verifier-owned, deterministic Ed25519 proof before the evidence
 * service can even attempt verified admission. The verifier alone owns the
 * private key; backend has only its public verification key. Coordinator,
 * scheduler, and finalizer identities receive neither key.
 */
@Injectable()
export class BackupArtifactProofService {
  constructor(private readonly config: ConfigService) {}

  validate(identity: BackupVerifierIdentity, evidence: BackupVerifierEvidenceDto) {
    if (identity.purpose !== "artifact_verifier") throw new ConflictException("Only an artifact verifier can submit an artifact proof");
    const publicKey = this.config.get<string>("BACKUP_ARTIFACT_VERIFIER_PROOF_PUBLIC_KEY_PEM");
    if (!publicKey) throw new ServiceUnavailableException("BACKUP_ARTIFACT_VERIFIER_PROOF_PUBLIC_KEY_PEM is not configured; verified admission is fail-closed");
    let proof;
    try { proof = validateBackupArtifactProof(evidence.proof); }
    catch { throw new ConflictException("Verified evidence requires a complete versioned artifact proof"); }
    if (proof.verifierPrincipalId !== identity.principalId || normalized(proof.verifierCertificateFingerprint) !== normalized(identity.certificateFingerprint)) {
      throw new ConflictException("Proof verifier identity does not match the authenticated mTLS identity");
    }
    if (!evidence.canonicalStorageKey || proof.canonicalStorageKey !== evidence.canonicalStorageKey ||
      proof.canonicalSetId !== evidence.canonicalSetId || proof.captureJobId !== evidence.captureJobId ||
      proof.captureRequestId !== evidence.captureRequestId || proof.captureAttemptId !== evidence.captureAttemptId ||
      proof.leaseId !== evidence.leaseId || proof.generation !== evidence.generation || proof.backupClass !== evidence.backupClass ||
      normalized(proof.manifestSha256) !== normalized(evidence.manifestSha256) || proof.verificationMethod !== evidence.verificationMethod ||
      proof.idempotencyKey !== evidence.idempotencyKey) {
      throw new ConflictException("Proof does not bind to the submitted canonical lifecycle identity");
    }
    const verifiedAt = Date.parse(proof.verifiedAt);
    const maxAge = proofMaxAge(this.config.get<string>("BACKUP_ARTIFACT_VERIFIER_PROOF_MAX_AGE_SECONDS"));
    if (!Number.isFinite(verifiedAt) || verifiedAt > Date.now() + 30_000 || Date.now() - verifiedAt > maxAge * 1000) {
      throw new ConflictException("Proof verification timestamp is invalid or stale");
    }
    if (normalized(evidence.evidenceSha256) !== normalized(proof.evidenceSha256)) {
      throw new ConflictException("Proof evidence digest does not match its canonical payload");
    }
    try { if (!verifyBackupArtifactProof(proof, publicKey)) throw new Error("invalid"); }
    catch { throw new ConflictException("Proof signature is invalid"); }
  }
}

function proofMaxAge(value?: string) { const seconds = Number(value ?? "300"); return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 3600 ? seconds : 300; }
function normalized(value: string) { return value.toLowerCase(); }
