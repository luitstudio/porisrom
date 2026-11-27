# B2 authenticated evidence admission

Proof contract v2 signs canonical UTF-8 JSON with lexicographically sorted keys. It contains the exact three age-encrypted artifacts, lifecycle/canonical-set binding, signing principal and certificate fingerprint. The SHA-256 digest covers the unsigned proof; Ed25519 signs the unsigned proof plus that digest. Unsupported versions, non-safe integer fields, non-NFC strings, unexpected fields, duplicate artifact inventory, malformed base64url signatures, and invalid digests are rejected.

The verifier sends the proof only over TLS 1.3 mutual TLS to the admission authority. The authority maps the authenticated workload certificate fingerprint to a registered workload identity, looks up the separately registered signing public key, verifies the exact canonical bytes, and calls the restricted SQL function in the same serializable transaction. PostgreSQL then locks canonical evidence, principal, and signing certificate in that order before preserving immutable evidence. mTLS and signing identities are distinct registrations.

Only `porisrom_admission_runtime` receives EXECUTE on the protected function. The backend, coordinator, and verifier do not. The dedicated admission credential remains trusted: PostgreSQL cannot verify Ed25519, so compromise of that credential can bypass the authority. A compromised signing verifier can honestly-formatted but dishonest evidence; that is an explicit residual risk.

Existing evidence predating B2 has legacy provenance and must not be treated as B2-authenticated. Certificates without a registered signing public key are ineligible. Key rotation creates a new immutable certificate record and workload mapping; revocation is serialized by SQL locks. Exact retries retain existing idempotency semantics; conflicting retries remain `23505`.

Provisioning is a manual, operator-reviewed lifecycle documented in `deploy/backup-admission-role-provision.sql`; it is not startup automation. Migration and owner credentials are separate from all runtime credentials. Step 6 must preserve admission's canonical-set -> evidence -> principal -> certificate lock order when it introduces finalization serialization.
