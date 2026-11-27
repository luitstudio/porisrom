CREATE TYPE "BackupVerifierCertificatePurpose" AS ENUM ('artifact_verifier', 'restore_verifier');
CREATE TYPE "BackupVerifierCertificateStatus" AS ENUM ('active', 'revoked');
CREATE TYPE "BackupVerificationResult" AS ENUM ('verified', 'failed', 'incomplete');

CREATE TABLE "BackupVerifierPrincipal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    CONSTRAINT "BackupVerifierPrincipal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupVerifierCertificate" (
    "id" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "purpose" "BackupVerifierCertificatePurpose" NOT NULL,
    "status" "BackupVerifierCertificateStatus" NOT NULL DEFAULT 'active',
    "notBefore" TIMESTAMP(3),
    "notAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokeReason" TEXT,
    CONSTRAINT "BackupVerifierCertificate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BackupVerifierCertificate_revocation_metadata_check" CHECK (
      ("status" = 'active' AND "revokedAt" IS NULL AND "revokedBy" IS NULL AND "revokeReason" IS NULL)
      OR
      ("status" = 'revoked' AND "revokedAt" IS NOT NULL)
    )
);

CREATE TABLE "BackupVerifierDatabaseIdentity" (
    "databaseRoleName" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "purpose" "BackupVerifierCertificatePurpose" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupVerifierDatabaseIdentity_pkey" PRIMARY KEY ("databaseRoleName")
);

CREATE TABLE "BackupCanonicalSet" (
    "id" TEXT NOT NULL,
    "captureJobId" TEXT NOT NULL,
    "captureRequestId" TEXT NOT NULL,
    "captureAttemptId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "backupClass" "BackupCaptureClass" NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "manifestFormatVersion" INTEGER NOT NULL,
    "canonicalStorageKey" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupCanonicalSet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BackupCanonicalSet_manifestFormatVersion_check" CHECK ("manifestFormatVersion" > 0),
    CONSTRAINT "BackupCanonicalSet_manifestSha256_check" CHECK ("manifestSha256" ~ '^[0-9a-f]{64}$'),
    -- This is an opaque logical object-store identifier, never an absolute or
    -- backslash-based filesystem path. The prefix is reserved to this feature.
    CONSTRAINT "BackupCanonicalSet_canonicalStorageKey_check" CHECK (
      "canonicalStorageKey" ~ '^backup-canonical/[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$'
      AND "canonicalStorageKey" NOT LIKE '%..%'
      AND position(chr(92) in "canonicalStorageKey") = 0
    )
);

CREATE TABLE "BackupCaptureVerificationAttempt" (
    "id" TEXT NOT NULL,
    "canonicalSetId" TEXT NOT NULL,
    "captureJobId" TEXT NOT NULL,
    "captureRequestId" TEXT NOT NULL,
    "captureAttemptId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "backupClass" "BackupCaptureClass" NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "verifierPrincipalId" TEXT NOT NULL,
    "verifierCertificateId" TEXT NOT NULL,
    "certificatePurpose" "BackupVerifierCertificatePurpose" NOT NULL DEFAULT 'artifact_verifier',
    "verificationMethod" TEXT NOT NULL,
    "result" "BackupVerificationResult" NOT NULL,
    "resultPayload" JSONB NOT NULL,
    "evidenceSha256" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupCaptureVerificationAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BackupCaptureVerificationAttempt_purpose_check"
      CHECK ("certificatePurpose" = 'artifact_verifier'),
    CONSTRAINT "BackupCaptureVerificationAttempt_manifestSha256_check" CHECK ("manifestSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "BackupCaptureVerificationAttempt_evidenceSha256_check" CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "BackupRestoreVerificationAttempt" (
    "id" TEXT NOT NULL,
    "canonicalSetId" TEXT NOT NULL,
    "captureJobId" TEXT NOT NULL,
    "captureRequestId" TEXT NOT NULL,
    "captureAttemptId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "backupClass" "BackupCaptureClass" NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "verifierPrincipalId" TEXT NOT NULL,
    "verifierCertificateId" TEXT NOT NULL,
    "certificatePurpose" "BackupVerifierCertificatePurpose" NOT NULL DEFAULT 'restore_verifier',
    "verificationMethod" TEXT NOT NULL,
    "result" "BackupVerificationResult" NOT NULL,
    "resultPayload" JSONB NOT NULL,
    "evidenceSha256" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupRestoreVerificationAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BackupRestoreVerificationAttempt_purpose_check"
      CHECK ("certificatePurpose" = 'restore_verifier'),
    CONSTRAINT "BackupRestoreVerificationAttempt_manifestSha256_check" CHECK ("manifestSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "BackupRestoreVerificationAttempt_evidenceSha256_check" CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "BackupCaptureJob_canonicalBinding_key"
  ON "BackupCaptureJob"("id", "requestId", "coordinatorAttemptId", "leaseId", "leaseGeneration", "backupClass");
CREATE UNIQUE INDEX "BackupVerifierCertificate_fingerprint_key"
  ON "BackupVerifierCertificate"("fingerprint");
CREATE UNIQUE INDEX "BackupVerifierCertificate_id_principalId_purpose_key"
  ON "BackupVerifierCertificate"("id", "principalId", "purpose");
CREATE INDEX "BackupVerifierCertificate_principalId_purpose_status_idx"
  ON "BackupVerifierCertificate"("principalId", "purpose", "status");
CREATE UNIQUE INDEX "BackupVerifierDatabaseIdentity_principalId_purpose_key"
  ON "BackupVerifierDatabaseIdentity"("principalId", "purpose");
CREATE UNIQUE INDEX "BackupCanonicalSet_captureJobId_key"
  ON "BackupCanonicalSet"("captureJobId");
CREATE UNIQUE INDEX "BackupCanonicalSet_evidenceBinding_key"
  ON "BackupCanonicalSet"("id", "captureJobId", "captureRequestId", "captureAttemptId", "leaseId", "generation", "backupClass", "manifestSha256");
CREATE UNIQUE INDEX "BackupCanonicalSet_captureBinding_key"
  ON "BackupCanonicalSet"("captureJobId", "captureRequestId", "captureAttemptId", "leaseId", "generation", "backupClass");
CREATE INDEX "BackupCanonicalSet_captureRequestId_idx" ON "BackupCanonicalSet"("captureRequestId");
CREATE UNIQUE INDEX "BackupCaptureVerificationAttempt_idempotency_key"
  ON "BackupCaptureVerificationAttempt"("canonicalSetId", "verifierCertificateId", "idempotencyKey");
CREATE INDEX "BackupCaptureVerificationAttempt_canonicalSetId_verifiedAt_idx"
  ON "BackupCaptureVerificationAttempt"("canonicalSetId", "verifiedAt");
CREATE UNIQUE INDEX "BackupRestoreVerificationAttempt_idempotency_key"
  ON "BackupRestoreVerificationAttempt"("canonicalSetId", "verifierCertificateId", "idempotencyKey");
CREATE INDEX "BackupRestoreVerificationAttempt_canonicalSetId_verifiedAt_idx"
  ON "BackupRestoreVerificationAttempt"("canonicalSetId", "verifiedAt");

ALTER TABLE "BackupVerifierCertificate"
  ADD CONSTRAINT "BackupVerifierCertificate_principalId_fkey"
  FOREIGN KEY ("principalId") REFERENCES "BackupVerifierPrincipal"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "BackupVerifierDatabaseIdentity"
  ADD CONSTRAINT "BackupVerifierDatabaseIdentity_principalId_fkey"
  FOREIGN KEY ("principalId") REFERENCES "BackupVerifierPrincipal"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "BackupCanonicalSet"
  ADD CONSTRAINT "BackupCanonicalSet_captureRequestId_fkey"
  FOREIGN KEY ("captureRequestId") REFERENCES "BackupCaptureRequest"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "BackupCanonicalSet_captureBinding_fkey"
  FOREIGN KEY ("captureJobId", "captureRequestId", "captureAttemptId", "leaseId", "generation", "backupClass")
  REFERENCES "BackupCaptureJob"("id", "requestId", "coordinatorAttemptId", "leaseId", "leaseGeneration", "backupClass")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "BackupCaptureVerificationAttempt"
  ADD CONSTRAINT "BackupCaptureVerificationAttempt_canonicalBinding_fkey"
  FOREIGN KEY ("canonicalSetId", "captureJobId", "captureRequestId", "captureAttemptId", "leaseId", "generation", "backupClass", "manifestSha256")
  REFERENCES "BackupCanonicalSet"("id", "captureJobId", "captureRequestId", "captureAttemptId", "leaseId", "generation", "backupClass", "manifestSha256")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "BackupCaptureVerificationAttempt_principalId_fkey"
  FOREIGN KEY ("verifierPrincipalId") REFERENCES "BackupVerifierPrincipal"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "BackupCaptureVerificationAttempt_certificate_purpose_fkey"
  FOREIGN KEY ("verifierCertificateId", "verifierPrincipalId", "certificatePurpose")
  REFERENCES "BackupVerifierCertificate"("id", "principalId", "purpose")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "BackupRestoreVerificationAttempt"
  ADD CONSTRAINT "BackupRestoreVerificationAttempt_canonicalBinding_fkey"
  FOREIGN KEY ("canonicalSetId", "captureJobId", "captureRequestId", "captureAttemptId", "leaseId", "generation", "backupClass", "manifestSha256")
  REFERENCES "BackupCanonicalSet"("id", "captureJobId", "captureRequestId", "captureAttemptId", "leaseId", "generation", "backupClass", "manifestSha256")
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "BackupRestoreVerificationAttempt_principalId_fkey"
  FOREIGN KEY ("verifierPrincipalId") REFERENCES "BackupVerifierPrincipal"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "BackupRestoreVerificationAttempt_certificate_purpose_fkey"
  FOREIGN KEY ("verifierCertificateId", "verifierPrincipalId", "certificatePurpose")
  REFERENCES "BackupVerifierCertificate"("id", "principalId", "purpose")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE OR REPLACE FUNCTION "backup_reject_update_or_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable; % is forbidden', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION "backup_reject_identity_change"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  field_name text;
BEGIN
  FOREACH field_name IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(NEW) -> field_name) IS DISTINCT FROM (to_jsonb(OLD) -> field_name) THEN
      RAISE EXCEPTION '% identity field "%" is immutable', TG_TABLE_NAME, field_name
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "backup_guard_verifier_certificate"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'BackupVerifierCertificate rows are retained and cannot be deleted'
      USING ERRCODE = '55000';
  END IF;

  IF (to_jsonb(NEW) - 'status' - 'revokedAt' - 'revokedBy' - 'revokeReason')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'revokedAt' - 'revokedBy' - 'revokeReason') THEN
    RAISE EXCEPTION 'certificate fields other than revocation metadata are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD."status" <> 'active'::"BackupVerifierCertificateStatus"
     OR NEW."status" <> 'revoked'::"BackupVerifierCertificateStatus" THEN
    RAISE EXCEPTION 'certificate status may change only once: active -> revoked'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."revokedAt" IS NULL THEN
    RAISE EXCEPTION 'a revoked certificate requires revokedAt' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "BackupCanonicalSet_immutable"
BEFORE UPDATE OR DELETE ON "BackupCanonicalSet"
FOR EACH ROW EXECUTE FUNCTION "backup_reject_update_or_delete"();
CREATE TRIGGER "BackupCaptureVerificationAttempt_immutable"
BEFORE UPDATE OR DELETE ON "BackupCaptureVerificationAttempt"
FOR EACH ROW EXECUTE FUNCTION "backup_reject_update_or_delete"();
CREATE TRIGGER "BackupRestoreVerificationAttempt_immutable"
BEFORE UPDATE OR DELETE ON "BackupRestoreVerificationAttempt"
FOR EACH ROW EXECUTE FUNCTION "backup_reject_update_or_delete"();
CREATE TRIGGER "BackupVerifierPrincipal_identity_immutable"
BEFORE UPDATE ON "BackupVerifierPrincipal"
FOR EACH ROW EXECUTE FUNCTION "backup_reject_identity_change"('id');
CREATE TRIGGER "BackupVerifierCertificate_identity_immutable"
BEFORE UPDATE ON "BackupVerifierCertificate"
FOR EACH ROW EXECUTE FUNCTION "backup_reject_identity_change"('id', 'principalId', 'fingerprint', 'purpose', 'createdAt');
CREATE TRIGGER "BackupVerifierCertificate_revocation_guard"
BEFORE UPDATE OR DELETE ON "BackupVerifierCertificate"
FOR EACH ROW EXECUTE FUNCTION "backup_guard_verifier_certificate"();

-- These are the only intended write entry points for evidence. They bind the
-- calling database login (session_user) to a pre-provisioned verifier
-- principal; request-body principal/certificate values are never accepted.
-- The current Step 3 contract rejects verified results until a later verifier
-- engine supplies and validates a cryptographic proof contract.
CREATE OR REPLACE FUNCTION "backup_admit_capture_verification"(
  p_attempt_id TEXT, p_canonical_set_id TEXT, p_capture_job_id TEXT,
  p_capture_request_id TEXT, p_capture_attempt_id TEXT, p_lease_id TEXT,
  p_generation INTEGER, p_backup_class "BackupCaptureClass",
  p_manifest_sha256 TEXT, p_certificate_fingerprint TEXT,
  p_verification_method TEXT, p_result "BackupVerificationResult",
  p_result_payload JSONB, p_evidence_sha256 TEXT, p_idempotency_key TEXT
) RETURNS TABLE("attemptId" TEXT, idempotent BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  bound_principal_id TEXT; canonical "BackupCanonicalSet"%ROWTYPE;
  certificate "BackupVerifierCertificate"%ROWTYPE;
  existing "BackupCaptureVerificationAttempt"%ROWTYPE;
BEGIN
  SELECT "principalId" INTO bound_principal_id FROM public."BackupVerifierDatabaseIdentity"
    WHERE "databaseRoleName" = session_user AND purpose = 'artifact_verifier'
      AND active = true;
  IF bound_principal_id IS NULL THEN RAISE EXCEPTION 'unbound artifact verifier database identity' USING ERRCODE = '42501'; END IF;
  IF p_result = 'verified' THEN RAISE EXCEPTION 'verified evidence is disabled until proof validation exists' USING ERRCODE = '42501'; END IF;
  SELECT * INTO canonical FROM public."BackupCanonicalSet" WHERE id = p_canonical_set_id FOR UPDATE;
  IF NOT FOUND OR canonical."captureJobId" <> p_capture_job_id OR canonical."captureRequestId" <> p_capture_request_id
    OR canonical."captureAttemptId" <> p_capture_attempt_id OR canonical."leaseId" <> p_lease_id
    OR canonical.generation <> p_generation OR canonical."backupClass" <> p_backup_class
    OR canonical."manifestSha256" <> p_manifest_sha256 THEN RAISE EXCEPTION 'canonical evidence binding mismatch' USING ERRCODE = '23514'; END IF;
  PERFORM id FROM public."BackupCaptureVerificationAttempt" WHERE "canonicalSetId" = p_canonical_set_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."BackupVerifierPrincipal" WHERE id = bound_principal_id AND active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'inactive verifier principal' USING ERRCODE = '42501'; END IF;
  SELECT * INTO certificate FROM public."BackupVerifierCertificate"
    WHERE fingerprint = p_certificate_fingerprint AND "principalId" = bound_principal_id
      AND purpose = 'artifact_verifier' AND status = 'active'
      AND ("notBefore" IS NULL OR "notBefore" <= CURRENT_TIMESTAMP)
      AND ("notAfter" IS NULL OR "notAfter" > CURRENT_TIMESTAMP)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ineligible artifact verifier certificate' USING ERRCODE = '42501'; END IF;
  SELECT * INTO existing FROM public."BackupCaptureVerificationAttempt"
    WHERE "canonicalSetId" = p_canonical_set_id AND "verifierCertificateId" = certificate.id
      AND "idempotencyKey" = p_idempotency_key;
  IF FOUND THEN
    IF existing."captureJobId" = p_capture_job_id AND existing."captureRequestId" = p_capture_request_id
      AND existing."captureAttemptId" = p_capture_attempt_id AND existing."leaseId" = p_lease_id
      AND existing.generation = p_generation AND existing."backupClass" = p_backup_class
      AND existing."manifestSha256" = p_manifest_sha256 AND existing."verificationMethod" = p_verification_method
      AND existing.result = p_result AND existing."resultPayload" = p_result_payload
      AND existing."evidenceSha256" = p_evidence_sha256 THEN
      RETURN QUERY SELECT existing.id, true; RETURN;
    END IF;
    RAISE EXCEPTION 'conflicting capture evidence idempotency key' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public."BackupCaptureVerificationAttempt"
    (id, "canonicalSetId", "captureJobId", "captureRequestId", "captureAttemptId", "leaseId", generation, "backupClass", "manifestSha256", "verifierPrincipalId", "verifierCertificateId", "certificatePurpose", "verificationMethod", result, "resultPayload", "evidenceSha256", "idempotencyKey")
  VALUES
    (p_attempt_id, p_canonical_set_id, p_capture_job_id, p_capture_request_id, p_capture_attempt_id, p_lease_id, p_generation, p_backup_class, p_manifest_sha256, bound_principal_id, certificate.id, 'artifact_verifier', p_verification_method, p_result, p_result_payload, p_evidence_sha256, p_idempotency_key);
  RETURN QUERY SELECT p_attempt_id, false;
END;
$$;

CREATE OR REPLACE FUNCTION "backup_admit_restore_verification"(
  p_attempt_id TEXT, p_canonical_set_id TEXT, p_capture_job_id TEXT,
  p_capture_request_id TEXT, p_capture_attempt_id TEXT, p_lease_id TEXT,
  p_generation INTEGER, p_backup_class "BackupCaptureClass",
  p_manifest_sha256 TEXT, p_certificate_fingerprint TEXT,
  p_verification_method TEXT, p_result "BackupVerificationResult",
  p_result_payload JSONB, p_evidence_sha256 TEXT, p_idempotency_key TEXT
) RETURNS TABLE("attemptId" TEXT, idempotent BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  bound_principal_id TEXT; canonical "BackupCanonicalSet"%ROWTYPE;
  certificate "BackupVerifierCertificate"%ROWTYPE;
  existing "BackupRestoreVerificationAttempt"%ROWTYPE;
BEGIN
  SELECT "principalId" INTO bound_principal_id FROM public."BackupVerifierDatabaseIdentity"
    WHERE "databaseRoleName" = session_user AND purpose = 'restore_verifier'
      AND active = true;
  IF bound_principal_id IS NULL THEN RAISE EXCEPTION 'unbound restore verifier database identity' USING ERRCODE = '42501'; END IF;
  IF p_result = 'verified' THEN RAISE EXCEPTION 'verified evidence is disabled until proof validation exists' USING ERRCODE = '42501'; END IF;
  SELECT * INTO canonical FROM public."BackupCanonicalSet" WHERE id = p_canonical_set_id FOR UPDATE;
  IF NOT FOUND OR canonical."captureJobId" <> p_capture_job_id OR canonical."captureRequestId" <> p_capture_request_id
    OR canonical."captureAttemptId" <> p_capture_attempt_id OR canonical."leaseId" <> p_lease_id
    OR canonical.generation <> p_generation OR canonical."backupClass" <> p_backup_class
    OR canonical."manifestSha256" <> p_manifest_sha256 THEN RAISE EXCEPTION 'canonical evidence binding mismatch' USING ERRCODE = '23514'; END IF;
  PERFORM id FROM public."BackupRestoreVerificationAttempt" WHERE "canonicalSetId" = p_canonical_set_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."BackupVerifierPrincipal" WHERE id = bound_principal_id AND active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'inactive verifier principal' USING ERRCODE = '42501'; END IF;
  SELECT * INTO certificate FROM public."BackupVerifierCertificate"
    WHERE fingerprint = p_certificate_fingerprint AND "principalId" = bound_principal_id
      AND purpose = 'restore_verifier' AND status = 'active'
      AND ("notBefore" IS NULL OR "notBefore" <= CURRENT_TIMESTAMP)
      AND ("notAfter" IS NULL OR "notAfter" > CURRENT_TIMESTAMP)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ineligible restore verifier certificate' USING ERRCODE = '42501'; END IF;
  SELECT * INTO existing FROM public."BackupRestoreVerificationAttempt"
    WHERE "canonicalSetId" = p_canonical_set_id AND "verifierCertificateId" = certificate.id
      AND "idempotencyKey" = p_idempotency_key;
  IF FOUND THEN
    IF existing."captureJobId" = p_capture_job_id AND existing."captureRequestId" = p_capture_request_id
      AND existing."captureAttemptId" = p_capture_attempt_id AND existing."leaseId" = p_lease_id
      AND existing.generation = p_generation AND existing."backupClass" = p_backup_class
      AND existing."manifestSha256" = p_manifest_sha256 AND existing."verificationMethod" = p_verification_method
      AND existing.result = p_result AND existing."resultPayload" = p_result_payload
      AND existing."evidenceSha256" = p_evidence_sha256 THEN
      RETURN QUERY SELECT existing.id, true; RETURN;
    END IF;
    RAISE EXCEPTION 'conflicting restore evidence idempotency key' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public."BackupRestoreVerificationAttempt"
    (id, "canonicalSetId", "captureJobId", "captureRequestId", "captureAttemptId", "leaseId", generation, "backupClass", "manifestSha256", "verifierPrincipalId", "verifierCertificateId", "certificatePurpose", "verificationMethod", result, "resultPayload", "evidenceSha256", "idempotencyKey")
  VALUES
    (p_attempt_id, p_canonical_set_id, p_capture_job_id, p_capture_request_id, p_capture_attempt_id, p_lease_id, p_generation, p_backup_class, p_manifest_sha256, bound_principal_id, certificate.id, 'restore_verifier', p_verification_method, p_result, p_result_payload, p_evidence_sha256, p_idempotency_key);
  RETURN QUERY SELECT p_attempt_id, false;
END;
$$;

-- Deployment must provision distinct NOLOGIN/LOGIN role ownership and grant
-- EXECUTE on exactly one matching function to each verifier runtime login.
-- The coordinator/finalizer runtime role receives no EXECUTE grant and no DML
-- privilege on evidence. The security owner, not any runtime role, owns these
-- tables and functions; otherwise PostgreSQL owners could bypass triggers.
REVOKE ALL ON "BackupCanonicalSet", "BackupCaptureVerificationAttempt", "BackupRestoreVerificationAttempt", "BackupVerifierDatabaseIdentity" FROM PUBLIC;
REVOKE ALL ON FUNCTION "backup_reject_update_or_delete"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "backup_reject_identity_change"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "backup_guard_verifier_certificate"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "backup_admit_capture_verification"(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, "BackupCaptureClass", TEXT, TEXT, TEXT, "BackupVerificationResult", JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION "backup_admit_restore_verification"(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, "BackupCaptureClass", TEXT, TEXT, TEXT, "BackupVerificationResult", JSONB, TEXT, TEXT) FROM PUBLIC;
