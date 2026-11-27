-- Run manually as the controlled migration executor against an identified DB.
-- Passwords are supplied by the operator/secret manager; none are in this file.
-- The script is deliberately not part of application startup.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_db_owner') THEN CREATE ROLE porisrom_db_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_backend_runtime') THEN CREATE ROLE porisrom_backend_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_admission_runtime') THEN CREATE ROLE porisrom_admission_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_verifier_runtime') THEN CREATE ROLE porisrom_verifier_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_finalizer_runtime') THEN CREATE ROLE porisrom_finalizer_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_dispatcher_runtime') THEN CREATE ROLE porisrom_dispatcher_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
END $$;
REVOKE ALL ON SCHEMA public FROM PUBLIC, porisrom_backend_runtime, porisrom_admission_runtime, porisrom_verifier_runtime, porisrom_finalizer_runtime, porisrom_dispatcher_runtime;
GRANT USAGE ON SCHEMA public TO porisrom_backend_runtime, porisrom_admission_runtime, porisrom_finalizer_runtime, porisrom_dispatcher_runtime;
-- Backend Prisma usage inventory: ordinary marketplace/auth/admin models plus
-- coordinator-owned capture lifecycle and canonical publication.  Evidence,
-- verifier/admission registries, and every admission function remain excluded.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "User", "ExternalIdentity", "GoogleLinkIntent", "AuthSession", "FreelancerProfile", "IdentityDocument", "CompanyProfile", "CompanyDocument", "Category", "Skill", "FreelancerCategory", "FreelancerSkill", "CompanyCategory", "PortfolioItem", "AdminActionLog", "StorageMaintenanceWorker", "StorageMaintenanceState", "BackupCaptureRequest", "BackupCaptureJob", "BackupCoordinatorPrincipal", "BackupCoordinatorCertificate", "BackupCanonicalSet", "BackupCoordinatorActionLog", "StorageMaintenanceOperation", "StorageMaintenanceEvent", "Connection", "Conversation", "Message", "WorkAssignment", "WorkAssignmentEvent", "Deliverable", "PaymentVerification", "PaymentClaim", "Review", "Notification", "NotificationReadState", "UserBlock", "SafetyCase", "SafetyCaseEvent", socket_io_attachments
TO porisrom_backend_runtime;
GRANT USAGE, SELECT ON SEQUENCE "socket_io_attachments_id_seq" TO porisrom_backend_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM porisrom_admission_runtime, porisrom_verifier_runtime, porisrom_finalizer_runtime, porisrom_dispatcher_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM porisrom_admission_runtime, porisrom_verifier_runtime, porisrom_finalizer_runtime, porisrom_dispatcher_runtime;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM porisrom_backend_runtime, porisrom_admission_runtime, porisrom_verifier_runtime, porisrom_finalizer_runtime, porisrom_dispatcher_runtime;
-- The admission authority verifies mTLS workload and registered signing-key
-- bindings before calling the SECURITY DEFINER function; these are its only
-- direct table reads.
GRANT SELECT ON "BackupVerifierWorkloadIdentity", "BackupVerifierCertificate" TO porisrom_admission_runtime;
GRANT EXECUTE ON FUNCTION "backup_lock_admission_identity"(TEXT,TEXT,TEXT) TO porisrom_admission_runtime;
GRANT EXECUTE ON FUNCTION "backup_admit_verified_capture_verification"(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,"BackupCaptureClass",TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT) TO porisrom_admission_runtime;
-- Outbox creation is insert-only for the backend. Claim, acknowledgement and
-- retry are fenced SECURITY DEFINER operations for dedicated worker roles.
GRANT INSERT ON "BackupWorkflowOutbox" TO porisrom_backend_runtime;
GRANT EXECUTE ON FUNCTION "backup_finalize_verified_capture"(TEXT,TEXT,TEXT,TEXT) TO porisrom_finalizer_runtime;
GRANT EXECUTE ON FUNCTION "backup_claim_workflow_outbox"(TEXT,TEXT,INTEGER), "backup_ack_workflow_outbox"(TEXT,TEXT), "backup_retry_workflow_outbox"(TEXT,TEXT,TEXT,INTEGER) TO porisrom_dispatcher_runtime, porisrom_finalizer_runtime;
INSERT INTO "BackupAdmissionDatabaseIdentity" ("databaseRoleName",active) VALUES ('porisrom_admission_runtime',true)
ON CONFLICT ("databaseRoleName") DO UPDATE SET active=EXCLUDED.active;
-- After reviewing all application object ownership, transfer protected tables
-- and SECURITY DEFINER functions to porisrom_db_owner. Do not grant that role
-- to any runtime role. Rotate runtime credentials independently after cutover.
