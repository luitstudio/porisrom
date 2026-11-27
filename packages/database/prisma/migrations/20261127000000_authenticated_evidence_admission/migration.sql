-- B2: only the admission authority can call the cryptographically protected
-- entry point. PostgreSQL still cannot verify Ed25519: its credential is TCB.
ALTER TABLE "BackupVerifierCertificate" ADD COLUMN "signingPublicKeyPem" TEXT;
ALTER TABLE "BackupVerifierCertificate" ADD CONSTRAINT "BackupVerifierCertificate_signingPublicKeyPem_check"
  CHECK ("signingPublicKeyPem" IS NULL OR "signingPublicKeyPem" LIKE '-----BEGIN PUBLIC KEY-----%');

CREATE TABLE "BackupAdmissionDatabaseIdentity" (
  "databaseRoleName" TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "BackupVerifierWorkloadIdentity" (
  fingerprint TEXT PRIMARY KEY,
  "principalId" TEXT NOT NULL REFERENCES "BackupVerifierPrincipal"(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  purpose "BackupVerifierCertificatePurpose" NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("principalId", purpose, fingerprint)
);

CREATE OR REPLACE FUNCTION "backup_admit_verified_capture_verification"(
  p_attempt_id TEXT, p_canonical_set_id TEXT, p_capture_job_id TEXT,
  p_capture_request_id TEXT, p_capture_attempt_id TEXT, p_lease_id TEXT,
  p_generation INTEGER, p_backup_class "BackupCaptureClass",
  p_manifest_sha256 TEXT, p_certificate_fingerprint TEXT,
  p_verification_method TEXT, p_proof JSONB, p_signature TEXT,
  p_evidence_sha256 TEXT, p_idempotency_key TEXT
) RETURNS TABLE("attemptId" TEXT, idempotent BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  canonical public."BackupCanonicalSet"%ROWTYPE;
  certificate public."BackupVerifierCertificate"%ROWTYPE;
  existing public."BackupCaptureVerificationAttempt"%ROWTYPE;
BEGIN
  PERFORM 1 FROM public."BackupAdmissionDatabaseIdentity" WHERE "databaseRoleName" = session_user AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'unbound admission service database identity' USING ERRCODE = '42501'; END IF;
  SELECT * INTO canonical FROM public."BackupCanonicalSet" WHERE id = p_canonical_set_id FOR UPDATE;
  IF NOT FOUND OR canonical."captureJobId" <> p_capture_job_id OR canonical."captureRequestId" <> p_capture_request_id
    OR canonical."captureAttemptId" <> p_capture_attempt_id OR canonical."leaseId" <> p_lease_id
    OR canonical.generation <> p_generation OR canonical."backupClass" <> p_backup_class
    OR canonical."manifestSha256" <> p_manifest_sha256 THEN RAISE EXCEPTION 'canonical evidence binding mismatch' USING ERRCODE = '23514'; END IF;
  IF p_proof IS NULL OR jsonb_typeof(p_proof) <> 'object' OR p_proof->>'proofVersion' <> '2'
    OR p_proof->>'verificationMethod' <> 'independent-artifact-ed25519-v2' OR p_proof->>'result' <> 'verified'
    OR p_verification_method <> p_proof->>'verificationMethod' OR p_proof->>'canonicalSetId' <> p_canonical_set_id
    OR p_proof->>'captureJobId' <> p_capture_job_id OR p_proof->>'captureRequestId' <> p_capture_request_id
    OR p_proof->>'captureAttemptId' <> p_capture_attempt_id OR p_proof->>'leaseId' <> p_lease_id
    OR p_proof->>'generation' <> p_generation::TEXT OR p_proof->>'backupClass' <> p_backup_class::TEXT
    OR p_proof->>'manifestSha256' <> p_manifest_sha256 OR p_proof->>'canonicalStorageKey' <> canonical."canonicalStorageKey"
    OR p_proof->>'verifierCertificateFingerprint' <> p_certificate_fingerprint
    OR p_proof->>'evidenceSha256' <> p_evidence_sha256 OR p_proof->>'idempotencyKey' <> p_idempotency_key
    OR p_proof->>'signature' <> p_signature OR p_signature !~ '^[A-Za-z0-9_-]{86}$'
    OR jsonb_typeof(p_proof->'artifactHashes') <> 'object'
    OR NOT (p_proof->'artifactHashes' ?& ARRAY['database.dump.age','production_public_assets.tar.age','production_private_documents.tar.age'])
    OR (SELECT count(*) FROM jsonb_object_keys(p_proof->'artifactHashes')) <> 3
    OR EXISTS (SELECT 1 FROM jsonb_each_text(p_proof->'artifactHashes') AS h(k,v) WHERE v !~ '^[0-9a-f]{64}$')
  THEN RAISE EXCEPTION 'verified proof is incomplete or does not bind immutable evidence' USING ERRCODE = '23514'; END IF;
  PERFORM id FROM public."BackupCaptureVerificationAttempt" WHERE "canonicalSetId" = p_canonical_set_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."BackupVerifierPrincipal" WHERE id = p_proof->>'verifierPrincipalId' AND active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'inactive verifier principal' USING ERRCODE = '42501'; END IF;
  SELECT * INTO certificate FROM public."BackupVerifierCertificate" WHERE fingerprint = p_certificate_fingerprint
    AND "principalId" = p_proof->>'verifierPrincipalId' AND purpose = 'artifact_verifier' AND status = 'active'
    AND ("notBefore" IS NULL OR "notBefore" <= CURRENT_TIMESTAMP) AND ("notAfter" IS NULL OR "notAfter" > CURRENT_TIMESTAMP) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ineligible artifact verifier certificate' USING ERRCODE = '42501'; END IF;
  SELECT * INTO existing FROM public."BackupCaptureVerificationAttempt" WHERE "canonicalSetId" = p_canonical_set_id AND "verifierCertificateId" = certificate.id AND "idempotencyKey" = p_idempotency_key;
  IF FOUND THEN
    IF existing."captureJobId" = p_capture_job_id AND existing."captureRequestId" = p_capture_request_id AND existing."captureAttemptId" = p_capture_attempt_id AND existing."leaseId" = p_lease_id AND existing.generation = p_generation AND existing."backupClass" = p_backup_class AND existing."manifestSha256" = p_manifest_sha256 AND existing."verificationMethod" = p_verification_method AND existing.result = 'verified' AND existing."resultPayload" = p_proof AND existing."evidenceSha256" = p_evidence_sha256 THEN RETURN QUERY SELECT existing.id, true; RETURN; END IF;
    RAISE EXCEPTION 'conflicting capture evidence idempotency key' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public."BackupCaptureVerificationAttempt" (id,"canonicalSetId","captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","verifierPrincipalId","verifierCertificateId","certificatePurpose","verificationMethod",result,"resultPayload","evidenceSha256","idempotencyKey")
  VALUES (p_attempt_id,p_canonical_set_id,p_capture_job_id,p_capture_request_id,p_capture_attempt_id,p_lease_id,p_generation,p_backup_class,p_manifest_sha256,p_proof->>'verifierPrincipalId',certificate.id,'artifact_verifier',p_verification_method,'verified',p_proof,p_evidence_sha256,p_idempotency_key);
  RETURN QUERY SELECT p_attempt_id, false;
END;
$$;
REVOKE ALL ON "BackupAdmissionDatabaseIdentity" FROM PUBLIC;
REVOKE ALL ON "BackupVerifierWorkloadIdentity" FROM PUBLIC;
REVOKE ALL ON FUNCTION "backup_admit_verified_capture_verification"(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,"BackupCaptureClass",TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT) FROM PUBLIC;
