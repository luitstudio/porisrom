import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import type { BackupVerifierIdentity, BackupVerifierPurpose } from "./backup-verifier-mtls.guard";
import type { BackupVerifierEvidenceDto } from "./dto/backup-verifier.dto";

@Injectable()
export class BackupVerifierEvidenceService {

  admitArtifact(identity: BackupVerifierIdentity, evidence: BackupVerifierEvidenceDto) {
    return this.admit("artifact_verifier", identity, evidence);
  }

  admitRestore(identity: BackupVerifierIdentity, evidence: BackupVerifierEvidenceDto) {
    return this.admit("restore_verifier", identity, evidence);
  }

  private async admit(_purpose: BackupVerifierPurpose, _identity: BackupVerifierIdentity, _evidence: BackupVerifierEvidenceDto) {
    // This process intentionally has no verifier database credential. Evidence
    // admission happens only in the separately deployed verifier worker.
    throw new ServiceUnavailableException("Verifier admission is isolated from the general backend runtime");
  }
}
