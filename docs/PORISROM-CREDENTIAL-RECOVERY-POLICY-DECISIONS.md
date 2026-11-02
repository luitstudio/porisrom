# Credential recovery decisions

Prepared 2026-10-28; finalized 2026-10-29, Asia/Calcutta. Status: **DECISION REQUIRED — product or operational policy is undefined.** Credential recovery remains unavailable. This document requests policy approval; it does not authorize implementation, sending recovery messages, password changes or account reactivation.

Current evidence: authentication supports signup/login, atomic refresh/replay protection and session revocation. `/safety/support` creates an authenticated private case with owner/admin history; administrative resolve/dismiss records a reason and audit. It never changes a password, validates identity or unblocks an account. A locked-out user cannot authenticate to submit that case. The forgot-password page describes support rather than promising working self-service reset. No trusted email/identity delivery provider or approved identity-check policy is established in this repository. Cloudinary is file storage, not an identity/recovery provider.

## Approval record

No decisions below are approved by this document. Product owner and security owner must record the selected option, accountable operator, approval date and acceptance evidence. Provider selection also requires infrastructure/privacy approval. Existing owner approval for authenticated support does **not** approve credential recovery.

| ID | Explicit approval question | Options and consequence | Required owner |
| --- | --- | --- | --- |
| R1 | How may an unauthenticated locked-out person contact support? | Approved external support channel; or implement an abuse-limited unauthenticated intake. Current authenticated support cannot fill this role. Do not publish an invented address/contact. | Product + support |
| R2 | What identity evidence proves ownership of an active account? | Verified control of a previously verified contact; or documented manual review with approved independent evidence. Name, public profile, submitted payment reference or a support case alone is insufficient. Define exceptions and rejection/appeal handling. | Security + product |
| R3 | Which trusted delivery/identity provider and verified staging account may be integrated? | No approved provider exists. Supply an approved provider, sending identity/domain, access scope and privacy terms before integration. No speculative vendor recommendation is treated as configuration. | Infrastructure + security/privacy |
| R4 | How are blocked accounts treated? | Keep credential recovery separate from moderation appeal; or allow credential recovery while retaining the block and revoking sessions. Never automatically unban after email/password recovery. | Moderation + security |
| R5 | Can deleted accounts be recovered? | No recovery; or a narrowly documented restoration process with independent identity checks, review authority and data availability requirements. Soft-deleted email/name may no longer identify an owner. Never infer ownership from reused email. | Product + privacy + security |
| R6 | What challenge lifetime, attempts and request limits apply? | Approve a short expiry, per-account and per-origin limits, maximum failed challenges and resend policy based on threat/operational needs. No numeric policy has been approved. | Security + operations |
| R7 | What actions require stronger or dual review? | Define administrator recovery, changed/lost contact details, high-risk accounts and manual overrides. Prevent the reviewer from unilaterally recovering their own admin account. | Security + admin owner |
| R8 | What are the notices, audit access and retention rules? | Owner notice via previously verified contact, private case decision and durable security audit; approve disclosure, escalation destination, holds and retention alongside the data policy. Do not notify a reported user with confidential reporter details. | Product + privacy + security |

## Mandatory implementation requirements after approval

1. Generic request responses and comparable timing must resist account enumeration. Do not reveal blocked/deleted existence, contact details or challenge validity to unauthenticated callers.
2. Generate cryptographically random, purpose-bound recovery challenges; store only a hash and server-side account/purpose/expiry/use state. Never log credentials, raw tokens, complete recovery URLs, documents or provider payloads. Use the approved HTTPS origin, with no caller-controlled redirect destinations.
3. Challenge redemption must atomically require unused/unexpired state and consume it exactly once, including concurrent attempts across instances. Binding must prevent using one account's challenge for another account or for moderation reactivation. Approve challenge lifetime through R6 before implementation.
4. Rate-limit initiation, resend and redemption across instances; make counters durable or use an approved shared service. Add provider abuse controls and failure handling without weakening authentication.
5. Successful sensitive recovery must change the password securely, invalidate relevant sessions/refresh credentials, propagate socket disconnection, and invalidate outstanding challenges. Apply the established password policy. Do not automatically sign in or revive old sessions without an explicit approved design.
6. Required audit persistence and state changes must be atomic. Record actor/reviewer, account/entity, timestamp, operation and minimal reason/outcome without secrets. Failure must not claim recovery succeeded. Manual support closure must remain distinct from credential reset.
7. Test expired/replayed/concurrent challenges, enumeration, quotas, compromised contact changes, blocked/deleted roles, administrator recovery, audit/provider failures, session revocation, cross-instance sockets and multi-tab behavior using synthetic accounts and an authorized provider sandbox.

Production is blocked until a usable, approved recovery/appeal process has been implemented and rehearsed. Synthetic staging may continue with disposable accounts and recovery explicitly unavailable. Recovery must not be enabled by simply changing support-case status or sending a token through logs.
