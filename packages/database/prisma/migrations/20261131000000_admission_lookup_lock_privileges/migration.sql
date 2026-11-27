-- PostgreSQL requires UPDATE privilege for FOR SHARE row locking. Grant it
-- only to the NOLOGIN definer owner and only on immutable identity columns;
-- fixed SECURITY DEFINER SQL performs no writes and runtime roles cannot
-- assume this owner.
GRANT SELECT ON public."BackupVerifierWorkloadIdentity", public."BackupVerifierPrincipal", public."BackupVerifierCertificate" TO porisrom_admission_lookup_owner;
GRANT UPDATE (fingerprint) ON public."BackupVerifierWorkloadIdentity" TO porisrom_admission_lookup_owner;
GRANT UPDATE (id) ON public."BackupVerifierPrincipal" TO porisrom_admission_lookup_owner;
GRANT UPDATE (fingerprint) ON public."BackupVerifierCertificate" TO porisrom_admission_lookup_owner;
REVOKE ALL ON FUNCTION public."backup_lock_admission_identity"(TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public."backup_lock_admission_identity"(TEXT,TEXT,TEXT) TO porisrom_admission_runtime;
