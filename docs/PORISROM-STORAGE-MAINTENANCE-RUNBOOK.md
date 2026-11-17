# Storage maintenance gate

This gate coordinates only storage mutations for backup capture. It does not stop the backend, block normal profile/document reads, or authorize a production restore/cutover.

## Operator workflow

An active administrator uses the authenticated `/admin/storage-maintenance` operations:

1. `POST /enable` closes admission for identity documents, company documents, profile photos, local-file writes/removals, and Cloudinary upload/destroy/cleanup work. It returns `draining` if any already-admitted mutation exists, otherwise `quiescent`.
2. Poll `GET /admin/storage-maintenance`. A backup is permitted only when `backupSafe=true`, `mode=quiescent`, and active, failed, and fenced operation counts are all zero.
3. An active administrator acquires `POST /capture/acquire` before any backup process starts. The response contains a durable UUID and maintenance generation. While held, `backupSafe=false`, storage writes remain blocked, and `POST /disable` is rejected.
4. A future restricted backup coordinator must carry that exact lease ID and generation, record its result using `POST /capture/outcome`, then require an administrator to release it. Successful outcomes use `POST /capture/release`; failed or uncertain outcomes require the separate audited `POST /capture/recover` action.
5. Do not release a lease on timeout, process restart, or backup failure. A crash leaves the lease held; inspect the capture outcome and use audited recovery. Only after the lease has been released may an active administrator call `POST /disable` with a recorded reason.

The gate is durable in PostgreSQL. A global metadata-driven backend guard rejects the marked upload routes before multipart processing while maintenance is active; the coordinator then performs the authoritative admission. Admission and activation lock the singleton state row with `FOR UPDATE`; a storage mutation first commits its operation record, then begins provider/local I/O. Therefore activation either sees an admitted operation and drains it, or commits first and rejects that new mutation with a sanitized `503`.

## Failure and restart handling

There is no timeout-based release. Backend restart, process crash, provider failure, or backup failure never reopens storage writes automatically.

An operation that fails while the gate is draining changes the state to `recovery_required`; it is **not backup-safe**. A process crash leaves its active operation durable and keeps the gate draining. An `active` operation is never eligible for ordinary reconciliation, even when its heartbeat is old or its process appears stopped: an already-dispatched Cloudinary request or filesystem syscall cannot be reliably cancelled by PostgreSQL.

To recover an active operation, an active administrator must first call `POST /operations/:operationId/fence` with a reason. This increments the durable worker fence epoch, marks every active operation owned by that worker as `fenced`, and forces `recovery_required`. A fenced worker's lease is checked before each Cloudinary/local side effect and before completion, so it cannot make the window quiescent. Fencing is not proof that a request already dispatched to a provider did not complete.

Only after the provider/local/DB result has been inspected may the operator reconcile a `failed` or `fenced` operation:

1. Inspect the operation ID and reconcile the actual provider/local/DB state outside this endpoint.
2. `POST /operations/:operationId/reconcile` with an explicit reason and outcome (`confirmed_complete`, `confirmed_not_started`, or `provider_reconciled`). This records operation ID, operator ID, reason, and outcome, and leaves the state `recovery_required`.
3. When no active, failed, or fenced operation remains, `POST /acknowledge-quiescent` with a reason. Only this separate audited acknowledgement can change `recovery_required` to `quiescent`.

Every enable, disable, reconcile, and acknowledgement transaction rechecks that the operator remains an active administrator and writes the existing `AdminActionLog` plus a storage-maintenance event. Do not use break-glass acknowledgement to guess at an unknown Cloudinary result; keep the state `recovery_required` until the asset and its database reference have been reconciled.

Capture lease acquisition, outcome recording, release, and recovery use the same active-admin recheck and audit pattern. A lease is generation-bound, so an ID from an earlier maintenance window cannot modify a later one. The lease is deliberately a coordination primitive only in this phase: backup scripts are not yet authorized to call these endpoints and must not be run until a restricted coordinator integration is separately approved.

## Scope

The coordinator wraps all current storage mutation entry points:

- freelancer identity-document upload/replacement and its local/Cloudinary cleanup;
- company-document upload/replacement, database-reference commit, and old local/Cloudinary cleanup;
- freelancer profile photo and company logo upload, including versioned Cloudinary/local asset creation, profile URL/storage-ID persistence, replacement cleanup, and compensating rollback.

Authenticated document downloads and other reads are deliberately not wrapped and remain available. Future code must place any new direct local-storage write/remove or Cloudinary upload/destroy operation inside `StorageMutationCoordinator.run` before it performs I/O.

For profile photos and logos, the profile service owns the coordinator boundary; the storage service is deliberately ungated and may only be called with that operation's lease. A database-reference failure triggers deletion of the newly created version where possible. A prior-version cleanup failure triggers a reference rollback and preserves `recovery_required` through the failed operation. Legacy URL-only profile assets have no safely derivable provider ID and are not deleted automatically.

For company documents, old private objects are deleted only after the replacement database transaction commits. A deletion or compensating-cleanup failure records a sanitized `failureContext` containing the unresolved storage public IDs, fails the durable operation, and requires operator reconciliation before quiescence can be acknowledged. Do not treat a successful new database reference as proof that old-object cleanup completed.
