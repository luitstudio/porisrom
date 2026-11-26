-- B2 upgrade compatibility: legacy certificates predate registered signing
-- keys. Preserve their immutable identity fields while allowing exactly the
-- one NULL -> key registration transition guarded by the B2 trigger.
DROP TRIGGER "BackupVerifierCertificate_identity_immutable" ON "BackupVerifierCertificate";
CREATE TRIGGER "BackupVerifierCertificate_identity_immutable"
BEFORE UPDATE ON "BackupVerifierCertificate"
FOR EACH ROW EXECUTE FUNCTION "backup_reject_identity_change"('id', 'principalId', 'fingerprint', 'purpose', 'createdAt');

CREATE OR REPLACE FUNCTION "backup_guard_verifier_certificate"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'BackupVerifierCertificate rows are retained and cannot be deleted' USING ERRCODE = '55000'; END IF;
  IF OLD."signingPublicKeyPem" IS NULL AND NEW."signingPublicKeyPem" IS NOT NULL
     AND OLD.status = 'active'::"BackupVerifierCertificateStatus" AND NEW.status = OLD.status
     AND (to_jsonb(NEW) - 'status' - 'revokedAt' - 'revokedBy' - 'revokeReason' - 'signingPublicKeyPem') IS NOT DISTINCT FROM
         (to_jsonb(OLD) - 'status' - 'revokedAt' - 'revokedBy' - 'revokeReason' - 'signingPublicKeyPem') THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'revokedAt' - 'revokedBy' - 'revokeReason') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'revokedAt' - 'revokedBy' - 'revokeReason') THEN RAISE EXCEPTION 'certificate fields other than revocation metadata are immutable' USING ERRCODE = '55000'; END IF;
  IF OLD."status" <> 'active'::"BackupVerifierCertificateStatus" OR NEW."status" <> 'revoked'::"BackupVerifierCertificateStatus" THEN RAISE EXCEPTION 'certificate status may change only once: active -> revoked' USING ERRCODE = '55000'; END IF;
  IF NEW."revokedAt" IS NULL THEN RAISE EXCEPTION 'a revoked certificate requires revokedAt' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
