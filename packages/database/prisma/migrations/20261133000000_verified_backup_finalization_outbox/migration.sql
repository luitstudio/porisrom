-- Step 6: immutable proof-v2 finalization and a fenced transactional outbox.
-- Existing evidence remains immutable and legacy evidence never satisfies the
-- finalization predicate below.
ALTER TYPE "BackupCaptureJobStatus" ADD VALUE IF NOT EXISTS 'finalized';
CREATE TYPE "BackupWorkflowOutboxStatus" AS ENUM ('pending', 'processing', 'delivered', 'failed');

ALTER TABLE "BackupCaptureJob"
  ADD COLUMN "finalizedAt" TIMESTAMPTZ,
  ADD COLUMN "finalizationIdempotencyKey" TEXT,
  ADD COLUMN "finalizedVerificationAttemptId" TEXT;
CREATE UNIQUE INDEX "BackupCaptureJob_finalizationIdempotencyKey_key" ON "BackupCaptureJob"("finalizationIdempotencyKey") WHERE "finalizationIdempotencyKey" IS NOT NULL;
CREATE UNIQUE INDEX "BackupCaptureJob_finalizedVerificationAttemptId_key" ON "BackupCaptureJob"("finalizedVerificationAttemptId") WHERE "finalizedVerificationAttemptId" IS NOT NULL;

CREATE TABLE "BackupCaptureFinalization" (
  "id" TEXT NOT NULL,
  "captureJobId" TEXT NOT NULL,
  "canonicalSetId" TEXT NOT NULL,
  "verificationAttemptId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "manifestSha256" TEXT NOT NULL,
  "verifierPrincipalId" TEXT NOT NULL,
  "verifierCertificateId" TEXT NOT NULL,
  "finalizedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackupCaptureFinalization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BackupCaptureFinalization_manifestSha256_check" CHECK ("manifestSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "BackupCaptureFinalization_captureJobId_key" UNIQUE ("captureJobId"),
  CONSTRAINT "BackupCaptureFinalization_canonicalSetId_key" UNIQUE ("canonicalSetId"),
  CONSTRAINT "BackupCaptureFinalization_verificationAttemptId_key" UNIQUE ("verificationAttemptId"),
  CONSTRAINT "BackupCaptureFinalization_idempotencyKey_key" UNIQUE ("idempotencyKey")
);
ALTER TABLE "BackupCaptureFinalization"
  ADD CONSTRAINT "BackupCaptureFinalization_captureJobId_fkey" FOREIGN KEY ("captureJobId") REFERENCES "BackupCaptureJob"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "BackupCaptureFinalization_canonicalSetId_fkey" FOREIGN KEY ("canonicalSetId") REFERENCES "BackupCanonicalSet"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "BackupCaptureFinalization_verificationAttemptId_fkey" FOREIGN KEY ("verificationAttemptId") REFERENCES "BackupCaptureVerificationAttempt"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "BackupCaptureFinalization_principalId_fkey" FOREIGN KEY ("verifierPrincipalId") REFERENCES "BackupVerifierPrincipal"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "BackupCaptureFinalization_certificateId_fkey" FOREIGN KEY ("verifierCertificateId") REFERENCES "BackupVerifierCertificate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "BackupWorkflowOutbox" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "status" "BackupWorkflowOutboxStatus" NOT NULL DEFAULT 'pending',
  "availableAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMPTZ,
  "lockedBy" TEXT,
  "claimToken" TEXT,
  "lockExpiresAt" TIMESTAMPTZ,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "deliveredAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackupWorkflowOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BackupWorkflowOutbox_attemptCount_check" CHECK ("attemptCount" >= 0),
  CONSTRAINT "BackupWorkflowOutbox_claim_check" CHECK (("status" = 'processing') = ("claimToken" IS NOT NULL AND "lockedBy" IS NOT NULL AND "lockExpiresAt" IS NOT NULL)),
  CONSTRAINT "BackupWorkflowOutbox_eventType_deduplicationKey_key" UNIQUE ("eventType", "deduplicationKey")
);
CREATE INDEX "BackupWorkflowOutbox_status_availableAt_idx" ON "BackupWorkflowOutbox"("status", "availableAt");
CREATE INDEX "BackupWorkflowOutbox_lockExpiresAt_idx" ON "BackupWorkflowOutbox"("lockExpiresAt");

CREATE OR REPLACE FUNCTION "backup_reject_finalization_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'BackupCaptureFinalization rows are immutable' USING ERRCODE = '55000'; END; $$;
CREATE TRIGGER "BackupCaptureFinalization_immutable" BEFORE UPDATE OR DELETE ON "BackupCaptureFinalization" FOR EACH ROW EXECUTE FUNCTION "backup_reject_finalization_mutation"();

-- The evidence function is the sole B2 write entrance. This trigger makes an
-- admitted proof durably dispatchable in its same transaction; legacy rows do
-- not meet the strict proof-v2 predicate and therefore never enter Step 6.
CREATE OR REPLACE FUNCTION "backup_enqueue_admitted_evidence"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.result = 'verified' AND NEW."verificationMethod" = 'independent-artifact-ed25519-v2'
     AND NEW."resultPayload"->>'proofVersion' = '2' THEN
    INSERT INTO public."BackupWorkflowOutbox" ("id","eventType","aggregateId","payload","deduplicationKey")
    VALUES ('outbox:evidence:' || NEW.id, 'backup.evidence-admitted', NEW."canonicalSetId",
      jsonb_build_object('verificationAttemptId', NEW.id, 'canonicalSetId', NEW."canonicalSetId", 'captureJobId', NEW."captureJobId"), NEW.id)
    ON CONFLICT ("eventType", "deduplicationKey") DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "BackupCaptureVerificationAttempt_enqueue_finalization"
AFTER INSERT ON "BackupCaptureVerificationAttempt" FOR EACH ROW EXECUTE FUNCTION "backup_enqueue_admitted_evidence"();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_finalizer_owner') THEN CREATE ROLE porisrom_finalizer_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_finalizer_runtime') THEN CREATE ROLE porisrom_finalizer_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_dispatcher_runtime') THEN CREATE ROLE porisrom_dispatcher_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO porisrom_finalizer_owner;
GRANT SELECT, UPDATE ("captureLeaseId","captureGeneration","captureAcquiredAt","captureAcquiredBy","captureOutcome","captureOutcomeAt","captureOutcomeBy","captureOutcomeReason","captureJobId") ON public."StorageMaintenanceState" TO porisrom_finalizer_owner;
GRANT SELECT, UPDATE (status,"finalizedAt","finalizationIdempotencyKey","finalizedVerificationAttemptId") ON public."BackupCaptureJob" TO porisrom_finalizer_owner;
GRANT SELECT ON public."BackupCaptureRequest", public."BackupCanonicalSet", public."BackupCaptureVerificationAttempt", public."BackupVerifierPrincipal", public."BackupVerifierCertificate" TO porisrom_finalizer_owner;
GRANT UPDATE (id) ON public."BackupCanonicalSet", public."BackupCaptureVerificationAttempt", public."BackupVerifierPrincipal", public."BackupVerifierCertificate" TO porisrom_finalizer_owner;
GRANT INSERT ON public."BackupCaptureFinalization", public."BackupWorkflowOutbox" TO porisrom_finalizer_owner;
GRANT SELECT, UPDATE (status,"lockedAt","lockedBy","claimToken","lockExpiresAt","attemptCount","lastError","availableAt","deliveredAt") ON public."BackupWorkflowOutbox" TO porisrom_finalizer_owner;

CREATE OR REPLACE FUNCTION public."backup_claim_workflow_outbox"(p_worker_id TEXT, p_event_type TEXT, p_lease_seconds INTEGER DEFAULT 60)
RETURNS TABLE("id" TEXT, "payload" JSONB, "claimToken" TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE candidate public."BackupWorkflowOutbox"%ROWTYPE; token TEXT;
BEGIN
  IF p_worker_id IS NULL OR length(p_worker_id) = 0 OR p_lease_seconds < 5 OR p_lease_seconds > 300 THEN RAISE EXCEPTION 'invalid outbox claim' USING ERRCODE='23514'; END IF;
  -- Expired work is fail-closed: only explicit reconciliation may requeue it.
  UPDATE public."BackupWorkflowOutbox" SET status='failed',"lastError"='lease_expired_requires_reconciliation',"lockedAt"=NULL,"lockedBy"=NULL,"claimToken"=NULL,"lockExpiresAt"=NULL
   WHERE status='processing' AND "lockExpiresAt" < CURRENT_TIMESTAMP;
  SELECT * INTO candidate FROM public."BackupWorkflowOutbox"
   WHERE status='pending' AND "eventType"=p_event_type AND "availableAt" <= CURRENT_TIMESTAMP
   ORDER BY "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  token := md5(random()::text || clock_timestamp()::text || candidate.id);
  UPDATE public."BackupWorkflowOutbox" SET status='processing',"lockedAt"=CURRENT_TIMESTAMP,"lockedBy"=p_worker_id,"claimToken"=token,"lockExpiresAt"=CURRENT_TIMESTAMP + make_interval(secs => p_lease_seconds),"attemptCount"="attemptCount"+1,"lastError"=NULL WHERE id=candidate.id;
  RETURN QUERY SELECT candidate.id,candidate.payload,token;
END; $$;

CREATE OR REPLACE FUNCTION public."backup_ack_workflow_outbox"(p_id TEXT, p_claim_token TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public."BackupWorkflowOutbox" SET status='delivered',"deliveredAt"=CURRENT_TIMESTAMP,"lockedAt"=NULL,"lockedBy"=NULL,"claimToken"=NULL,"lockExpiresAt"=NULL
   WHERE id=p_id AND status='processing' AND "claimToken"=p_claim_token AND "lockExpiresAt" >= CURRENT_TIMESTAMP;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale or invalid outbox acknowledgement' USING ERRCODE='42501'; END IF;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public."backup_retry_workflow_outbox"(p_id TEXT, p_claim_token TEXT, p_error TEXT, p_delay_seconds INTEGER DEFAULT 30)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_delay_seconds < 1 OR p_delay_seconds > 3600 THEN RAISE EXCEPTION 'invalid outbox retry delay' USING ERRCODE='23514'; END IF;
  UPDATE public."BackupWorkflowOutbox" SET status='pending',"availableAt"=CURRENT_TIMESTAMP + make_interval(secs => p_delay_seconds),"lastError"=left(coalesce(p_error,''),1024),"lockedAt"=NULL,"lockedBy"=NULL,"claimToken"=NULL,"lockExpiresAt"=NULL
   WHERE id=p_id AND status='processing' AND "claimToken"=p_claim_token AND "lockExpiresAt" >= CURRENT_TIMESTAMP;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale or invalid outbox retry' USING ERRCODE='42501'; END IF;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public."backup_requeue_failed_workflow_outbox"(p_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public."BackupWorkflowOutbox" SET status='pending',"availableAt"=CURRENT_TIMESTAMP,"lastError"=NULL WHERE id=p_id AND status='failed';
  IF NOT FOUND THEN RAISE EXCEPTION 'only failed outbox work may be reconciled' USING ERRCODE='42501'; END IF;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public."backup_finalize_verified_capture"(p_job_id TEXT, p_canonical_set_id TEXT, p_verification_attempt_id TEXT, p_idempotency_key TEXT)
RETURNS TABLE("finalizationId" TEXT, idempotent BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE state public."StorageMaintenanceState"%ROWTYPE; job public."BackupCaptureJob"%ROWTYPE; canonical public."BackupCanonicalSet"%ROWTYPE; evidence public."BackupCaptureVerificationAttempt"%ROWTYPE; certificate public."BackupVerifierCertificate"%ROWTYPE; existing public."BackupCaptureFinalization"%ROWTYPE; result_id TEXT;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) = 0 THEN RAISE EXCEPTION 'finalization idempotency key is required' USING ERRCODE='23514'; END IF;
  -- Coordinator order is state -> job -> request.  The B2 shared evidence
  -- suffix is canonical -> evidence -> principal -> certificate.
  SELECT * INTO state FROM public."StorageMaintenanceState" WHERE id='storage' FOR UPDATE;
  SELECT * INTO job FROM public."BackupCaptureJob" WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'capture job not found' USING ERRCODE='23503'; END IF;
  PERFORM id FROM public."BackupCaptureRequest" WHERE id=job."requestId" FOR UPDATE;
  SELECT * INTO canonical FROM public."BackupCanonicalSet" WHERE id=p_canonical_set_id FOR UPDATE;
  SELECT * INTO evidence FROM public."BackupCaptureVerificationAttempt" WHERE id=p_verification_attempt_id FOR UPDATE;
  IF NOT FOUND OR canonical."captureJobId" <> job.id OR evidence."canonicalSetId" <> canonical.id
     OR evidence."captureJobId" <> job.id OR evidence."manifestSha256" <> canonical."manifestSha256"
     OR evidence.result <> 'verified' OR evidence."verificationMethod" <> 'independent-artifact-ed25519-v2'
     OR evidence."resultPayload"->>'proofVersion' <> '2' THEN RAISE EXCEPTION 'evidence is not eligible for verified finalization' USING ERRCODE='42501'; END IF;
  PERFORM id FROM public."BackupVerifierPrincipal" WHERE id=evidence."verifierPrincipalId" AND active=true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verifier principal is inactive' USING ERRCODE='42501'; END IF;
  SELECT * INTO certificate FROM public."BackupVerifierCertificate" WHERE id=evidence."verifierCertificateId" AND "principalId"=evidence."verifierPrincipalId" AND purpose='artifact_verifier' AND status='active' AND "signingPublicKeyPem" IS NOT NULL AND ("notBefore" IS NULL OR "notBefore"<=CURRENT_TIMESTAMP) AND ("notAfter" IS NULL OR "notAfter">CURRENT_TIMESTAMP) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verifier certificate is ineligible' USING ERRCODE='42501'; END IF;
  SELECT * INTO existing FROM public."BackupCaptureFinalization" WHERE "captureJobId"=job.id FOR UPDATE;
  IF FOUND THEN
    IF existing."canonicalSetId"=canonical.id AND existing."verificationAttemptId"=evidence.id AND existing."idempotencyKey"=p_idempotency_key THEN RETURN QUERY SELECT existing.id, true; RETURN; END IF;
    RAISE EXCEPTION 'conflicting finalization for capture job' USING ERRCODE='23505';
  END IF;
  IF job.status <> 'reported' OR job."resultOutcome" <> 'succeeded' OR state."captureJobId" <> job.id OR state."captureLeaseId" <> job."leaseId" OR state."captureGeneration" <> job."leaseGeneration" OR state.generation <> job."leaseGeneration" THEN RAISE EXCEPTION 'capture lease is no longer finalizable' USING ERRCODE='42501'; END IF;
  result_id := 'finalization:' || p_idempotency_key;
  INSERT INTO public."BackupCaptureFinalization" (id,"captureJobId","canonicalSetId","verificationAttemptId","idempotencyKey","manifestSha256","verifierPrincipalId","verifierCertificateId") VALUES (result_id,job.id,canonical.id,evidence.id,p_idempotency_key,canonical."manifestSha256",evidence."verifierPrincipalId",evidence."verifierCertificateId");
  UPDATE public."BackupCaptureJob" SET status='finalized',"finalizedAt"=CURRENT_TIMESTAMP,"finalizationIdempotencyKey"=p_idempotency_key,"finalizedVerificationAttemptId"=evidence.id WHERE id=job.id;
  UPDATE public."StorageMaintenanceState" SET "captureLeaseId"=NULL,"captureGeneration"=NULL,"captureAcquiredAt"=NULL,"captureAcquiredBy"=NULL,"captureOutcome"=NULL,"captureOutcomeAt"=NULL,"captureOutcomeBy"=NULL,"captureOutcomeReason"=NULL,"captureJobId"=NULL WHERE id='storage';
  INSERT INTO public."BackupWorkflowOutbox" (id,"eventType","aggregateId",payload,"deduplicationKey") VALUES ('outbox:finalization:' || result_id,'backup.capture-finalized',job.id,jsonb_build_object('finalizationId',result_id,'captureJobId',job.id),result_id);
  RETURN QUERY SELECT result_id, false;
END; $$;
ALTER FUNCTION public."backup_finalize_verified_capture"(TEXT,TEXT,TEXT,TEXT) OWNER TO porisrom_finalizer_owner;
REVOKE ALL ON FUNCTION public."backup_finalize_verified_capture"(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public."backup_finalize_verified_capture"(TEXT,TEXT,TEXT,TEXT) TO porisrom_finalizer_runtime;
ALTER FUNCTION public."backup_claim_workflow_outbox"(TEXT,TEXT,INTEGER) OWNER TO porisrom_finalizer_owner;
ALTER FUNCTION public."backup_ack_workflow_outbox"(TEXT,TEXT) OWNER TO porisrom_finalizer_owner;
ALTER FUNCTION public."backup_retry_workflow_outbox"(TEXT,TEXT,TEXT,INTEGER) OWNER TO porisrom_finalizer_owner;
ALTER FUNCTION public."backup_requeue_failed_workflow_outbox"(TEXT) OWNER TO porisrom_finalizer_owner;
REVOKE ALL ON FUNCTION public."backup_claim_workflow_outbox"(TEXT,TEXT,INTEGER), public."backup_ack_workflow_outbox"(TEXT,TEXT), public."backup_retry_workflow_outbox"(TEXT,TEXT,TEXT,INTEGER), public."backup_requeue_failed_workflow_outbox"(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public."backup_claim_workflow_outbox"(TEXT,TEXT,INTEGER), public."backup_ack_workflow_outbox"(TEXT,TEXT), public."backup_retry_workflow_outbox"(TEXT,TEXT,TEXT,INTEGER) TO porisrom_dispatcher_runtime;
GRANT EXECUTE ON FUNCTION public."backup_claim_workflow_outbox"(TEXT,TEXT,INTEGER), public."backup_ack_workflow_outbox"(TEXT,TEXT), public."backup_retry_workflow_outbox"(TEXT,TEXT,TEXT,INTEGER) TO porisrom_finalizer_runtime;
