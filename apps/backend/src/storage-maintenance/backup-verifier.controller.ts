import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";

import { ArtifactVerifierMtlsGuard, RestoreVerifierMtlsGuard } from "./backup-verifier-mtls.guard";
import { BackupVerifierEvidenceService } from "./backup-verifier-evidence.service";
import { BackupVerifierEvidenceDto } from "./dto/backup-verifier.dto";

@Controller("internal/backup-verifier/artifact")
@UseGuards(ArtifactVerifierMtlsGuard)
export class BackupArtifactVerifierController {
  constructor(private readonly evidence: BackupVerifierEvidenceService) {}

  @Post("evidence")
  admit(@Req() request: any, @Body() dto: BackupVerifierEvidenceDto) {
    return this.evidence.admitArtifact(request.backupVerifierIdentity, dto);
  }
}

@Controller("internal/backup-verifier/restore")
@UseGuards(RestoreVerifierMtlsGuard)
export class BackupRestoreVerifierController {
  constructor(private readonly evidence: BackupVerifierEvidenceService) {}

  @Post("evidence")
  admit(@Req() request: any, @Body() dto: BackupVerifierEvidenceDto) {
    return this.evidence.admitRestore(request.backupVerifierIdentity, dto);
  }
}
