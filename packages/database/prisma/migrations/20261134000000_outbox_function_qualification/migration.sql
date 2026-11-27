-- Qualify outbox columns in SECURITY DEFINER PL/pgSQL.  OUT parameters are
-- variables in PL/pgSQL and must never be allowed to shadow table columns.
CREATE OR REPLACE FUNCTION public."backup_claim_workflow_outbox"(p_worker_id TEXT, p_event_type TEXT, p_lease_seconds INTEGER DEFAULT 60)
RETURNS TABLE("id" TEXT, "payload" JSONB, "claimToken" TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE candidate public."BackupWorkflowOutbox"%ROWTYPE; token TEXT;
BEGIN
  IF p_worker_id IS NULL OR length(p_worker_id) = 0 OR p_lease_seconds < 5 OR p_lease_seconds > 300 THEN RAISE EXCEPTION 'invalid outbox claim' USING ERRCODE='23514'; END IF;
  UPDATE public."BackupWorkflowOutbox" AS o SET status='failed',"lastError"='lease_expired_requires_reconciliation',"lockedAt"=NULL,"lockedBy"=NULL,"claimToken"=NULL,"lockExpiresAt"=NULL WHERE o.status='processing' AND o."lockExpiresAt" < CURRENT_TIMESTAMP;
  SELECT * INTO candidate FROM public."BackupWorkflowOutbox" AS o WHERE o.status='pending' AND o."eventType"=p_event_type AND o."availableAt" <= CURRENT_TIMESTAMP ORDER BY o."createdAt", o.id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  token := md5(random()::text || clock_timestamp()::text || candidate.id);
  UPDATE public."BackupWorkflowOutbox" AS o SET status='processing',"lockedAt"=CURRENT_TIMESTAMP,"lockedBy"=p_worker_id,"claimToken"=token,"lockExpiresAt"=CURRENT_TIMESTAMP + make_interval(secs => p_lease_seconds),"attemptCount"=o."attemptCount"+1,"lastError"=NULL WHERE o.id=candidate.id;
  RETURN QUERY SELECT candidate.id,candidate.payload,token;
END; $$;
CREATE OR REPLACE FUNCTION public."backup_ack_workflow_outbox"(p_id TEXT, p_claim_token TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public."BackupWorkflowOutbox" AS o SET status='delivered',"deliveredAt"=CURRENT_TIMESTAMP,"lockedAt"=NULL,"lockedBy"=NULL,"claimToken"=NULL,"lockExpiresAt"=NULL WHERE o.id=p_id AND o.status='processing' AND o."claimToken"=p_claim_token AND o."lockExpiresAt" >= CURRENT_TIMESTAMP;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale or invalid outbox acknowledgement' USING ERRCODE='42501'; END IF; RETURN true;
END; $$;
CREATE OR REPLACE FUNCTION public."backup_retry_workflow_outbox"(p_id TEXT, p_claim_token TEXT, p_error TEXT, p_delay_seconds INTEGER DEFAULT 30)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_delay_seconds < 1 OR p_delay_seconds > 3600 THEN RAISE EXCEPTION 'invalid outbox retry delay' USING ERRCODE='23514'; END IF;
  UPDATE public."BackupWorkflowOutbox" AS o SET status='pending',"availableAt"=CURRENT_TIMESTAMP + make_interval(secs => p_delay_seconds),"lastError"=left(coalesce(p_error,''),1024),"lockedAt"=NULL,"lockedBy"=NULL,"claimToken"=NULL,"lockExpiresAt"=NULL WHERE o.id=p_id AND o.status='processing' AND o."claimToken"=p_claim_token AND o."lockExpiresAt" >= CURRENT_TIMESTAMP;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale or invalid outbox retry' USING ERRCODE='42501'; END IF; RETURN true;
END; $$;
CREATE OR REPLACE FUNCTION public."backup_requeue_failed_workflow_outbox"(p_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public."BackupWorkflowOutbox" AS o SET status='pending',"availableAt"=CURRENT_TIMESTAMP,"lastError"=NULL WHERE o.id=p_id AND o.status='failed';
  IF NOT FOUND THEN RAISE EXCEPTION 'only failed outbox work may be reconciled' USING ERRCODE='42501'; END IF; RETURN true;
END; $$;
