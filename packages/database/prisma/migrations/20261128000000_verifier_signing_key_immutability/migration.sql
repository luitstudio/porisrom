-- B2 key binding: a signing key is part of the immutable certificate identity.
-- Legacy rows may be registered once from NULL; replacement requires a new
-- certificate row, preserving evidence provenance and transaction binding.
CREATE OR REPLACE FUNCTION "backup_verifier_certificate_signing_key_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."signingPublicKeyPem" IS NOT NULL
     AND NEW."signingPublicKeyPem" IS DISTINCT FROM OLD."signingPublicKeyPem" THEN
    RAISE EXCEPTION 'BackupVerifierCertificate signing key is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD."signingPublicKeyPem" IS NULL AND NEW."signingPublicKeyPem" IS NOT NULL
     AND NEW.status <> 'active'::"BackupVerifierCertificateStatus" THEN
    RAISE EXCEPTION 'signing key registration requires an active certificate' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "BackupVerifierCertificate_signing_key_immutable"
BEFORE UPDATE ON "BackupVerifierCertificate"
FOR EACH ROW EXECUTE FUNCTION "backup_verifier_certificate_signing_key_guard"();
