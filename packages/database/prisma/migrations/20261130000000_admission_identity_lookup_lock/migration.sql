-- B2 admission lookup lock. The admission runtime remains read-only; this
-- narrowly scoped definer function obtains the row locks required to bind
-- workload identity and signing key to the same transaction.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_admission_lookup_owner') THEN
    CREATE ROLE porisrom_admission_lookup_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO porisrom_admission_lookup_owner;
GRANT SELECT ON public."BackupVerifierWorkloadIdentity", public."BackupVerifierPrincipal", public."BackupVerifierCertificate" TO porisrom_admission_lookup_owner;
CREATE OR REPLACE FUNCTION public."backup_lock_admission_identity"(
  p_workload_fingerprint TEXT, p_principal_id TEXT, p_certificate_fingerprint TEXT
) RETURNS TABLE("principalId" TEXT, purpose "BackupVerifierCertificatePurpose", "signingPublicKeyPem" TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE workload public."BackupVerifierWorkloadIdentity"%ROWTYPE;
BEGIN
  SELECT * INTO workload FROM public."BackupVerifierWorkloadIdentity"
    WHERE fingerprint = p_workload_fingerprint AND active = true FOR SHARE;
  IF NOT FOUND OR workload."principalId" <> p_principal_id OR workload.purpose <> 'artifact_verifier' THEN
    RAISE EXCEPTION 'authenticated workload is not authorized for proof principal' USING ERRCODE = '42501';
  END IF;
  PERFORM id FROM public."BackupVerifierPrincipal" WHERE id = p_principal_id AND active = true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'inactive verifier principal' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT c."principalId", c.purpose, c."signingPublicKeyPem" FROM public."BackupVerifierCertificate" c
    WHERE c.fingerprint = p_certificate_fingerprint AND c."principalId" = p_principal_id AND c.purpose = 'artifact_verifier'
      AND c.status = 'active' AND (c."notBefore" IS NULL OR c."notBefore" <= CURRENT_TIMESTAMP)
      AND (c."notAfter" IS NULL OR c."notAfter" > CURRENT_TIMESTAMP) FOR SHARE;
END;
$$;
ALTER FUNCTION public."backup_lock_admission_identity"(TEXT,TEXT,TEXT) OWNER TO porisrom_admission_lookup_owner;
REVOKE ALL ON FUNCTION public."backup_lock_admission_identity"(TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public."backup_lock_admission_identity"(TEXT,TEXT,TEXT) TO porisrom_admission_runtime;
