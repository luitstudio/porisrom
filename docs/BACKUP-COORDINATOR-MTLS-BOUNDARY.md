# Backup coordinator mTLS boundary

The `/internal/backup-coordinator/*` API is not a public API and never accepts
application JWTs. It is disabled until both `BACKUP_COORDINATOR_TRUSTED_PROXY_IPS`
and `BACKUP_COORDINATOR_MTLS_PROXY_TOKEN` are configured.

The backend does not terminate mTLS itself. A trusted reverse proxy must be the
only network path to these endpoints and must:

1. require and verify a client certificate against the backup-coordinator CA;
2. reject invalid, expired, or absent client certificates;
3. remove inbound copies of `X-Porisrom-Mtls-Verified`,
   `X-Porisrom-Mtls-Fingerprint`, and `X-Porisrom-Mtls-Proxy-Token` before
   injecting its own values;
4. inject `X-Porisrom-Mtls-Verified: SUCCESS`, the normalized SHA-256 client
   certificate fingerprint, and the configured high-entropy proxy token;
5. connect to the backend only from an address listed in
   `BACKUP_COORDINATOR_TRUSTED_PROXY_IPS`; and
6. block direct client access to the backend listener and to this route.

The proxy token is a backend/proxy trust-boundary credential, not a client
credential. Store it in the platform secret store, rotate it by accepting a
planned maintenance interruption, and never forward it outside the proxy to
backend hop. The mTLS client certificate fingerprint is independently matched
against the durable `BackupCoordinatorCertificate` allowlist. Rotation is
performed by adding a second active certificate, moving the coordinator, then
revoking the old fingerprint. Revocation takes effect on the next request.

The coordinator can only claim, validate, report, and read its own claimed
capture job. It cannot create maintenance, acquire or release leases, recover
maintenance, execute shell commands, choose scripts, or provide filesystem,
Compose, environment, or command arguments. A report records an outcome but
does not release the capture lease; later audited recovery/finalization remains
explicit.
