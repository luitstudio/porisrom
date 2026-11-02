# Private document storage fix — 22 October 2026

Scope: the private local KYC/company document vulnerability in the October 22 audit. Refresh sessions, moderation, payment disputes, and other findings were not changed. This supplements the audit; the audit remains a historical record rather than a new production signoff.

## Result and root cause

The backend storage boundary is fixed and verified with synthetic real-HTTP regressions. Before the fix, six requests returned private bytes with status 200 where 404 was required: percent-encoded KYC/company directory names and traversal variants through the public-photo path. Literal prefix-denial middleware ran before Express static path decoding, and the shared uploads parent contained private files.

The fix removes the parent static mount entirely. New local documents are written to a separate private root. Existing documents remain in place, outside the two specifically served public subtrees. Protected owner/admin handlers continue authorizing access server-side.

## Files changed by this task

All previously dirty/untracked changes were retained; Git diffs against HEAD include earlier work too. This task changed only:

| File | Purpose |
| --- | --- |
| `apps/backend/src/document-storage.ts` | Shared private write/read/remove handling, new-vs-legacy ID resolution, namespace/path confinement, physical root checks, and fallback/config validation. |
| `apps/backend/src/static-uploads.ts` | Shared production/test static registration. Serve only public photo and dedicated public-file roots, with decoded-path and physical-file confinement. Remove obsolete literal-denial helpers. |
| `apps/backend/src/main.ts` | Await the shared safe static registration before listening. |
| `apps/backend/src/app.module.ts` | Compose document storage configuration validation with existing auth configuration validation. Auth rules themselves were not modified. |
| `apps/backend/src/kyc/identity-document.service.ts` | Route local PDF operations through the confined storage helper; retain Cloudinary behavior and owner/admin contracts. |
| `apps/backend/src/profiles/company-document.service.ts` | Same boundary and compatibility handling for company certificate/Aadhaar documents. |
| `apps/backend/.env.example` | Explain the separate new-private and legacy roots, public paths, and production fallback restriction. No actual `.env` values changed. |
| `.gitignore` | Ignore the default new `apps/backend/private-uploads/` directory. |
| `apps/backend/test/private-static-http.spec.ts` | Real Express HTTP regression: encoded/canonical/case/traversal paths, malformed encodings, directory links, missing files, public avatar/logo and unrelated public-file success. |
| `apps/backend/test/private-document-http.spec.ts` | Real Nest routes, JWT verification, roles guards, document services and filesystem: new/legacy owner/admin access, anonymous/wrong-role/other-owner denial, invalid/missing paths, no-store PDF responses, unchanged legacy files. Only DB lookups are replaced by synthetic in-memory records. |
| `apps/backend/test/document-storage.spec.ts` | New private writes, overwrite refusal, traversal/namespace rejection, configuration overlap, junction aliases, missing files and production fail-closed behavior. |
| `apps/backend/test/identity-document.spec.ts` | Adapt new local IDs/root configuration, retain legacy cases, and compare canonical paths on Windows. |
| `apps/backend/test/company-documents.spec.ts` | Verify new private-local IDs and private-root persistence. |
| `apps/backend/test/static-uploads.spec.ts` | Replace the obsolete literal-denial unit assertion with dedicated-public-root checks. |
| This document | Reviewable compatibility plan and verification record. |

## Storage and access boundary

Defaults below are relative to the backend process working directory, normally `apps/backend`:

| Data | Physical path / metadata | Public HTTP behavior |
| --- | --- | --- |
| New local KYC | `private-uploads/kyc-documents/...pdf`; `private-local:kyc-documents/...pdf` | No static route. Owner/admin only. |
| New local company PDF | `private-uploads/company-documents/...pdf`; `private-local:company-documents/...pdf` | No static route. Owner/admin only. |
| Existing local documents | Former root's `kyc-documents/` or `company-documents/`; unchanged `local:...` IDs | No public mount of their parent. Existing protected file handlers resolve these records. |
| Existing/public photos and logos | `uploads/profile-photos/...` | Original `/uploads/profile-photos/...` URLs retained. Cloudinary public photo URLs unchanged. |
| Other deliberately public files | `uploads/public/...` | Served at `/uploads/...`. No blanket serving of the parent `uploads/` directory. |
| Cloudinary PDFs | Existing authenticated delivery and stored IDs | Unchanged protected handler/signed URL behavior. No new provider or credentials required. |

`PRIVATE_DOCUMENT_UPLOAD_DIR` selects the new private root. `KYC_DOCUMENT_UPLOAD_DIR` retains its old meaning only for existing `local:` records; if absent, their root remains `PROFILE_PHOTO_UPLOAD_DIR`, then `./uploads`. `PROFILE_PHOTO_UPLOAD_DIR` also selects the public parent used by the photo writer and the static registrar.

Configuration rejects overlap in either direction between public roots and new/legacy document roots. Startup also resolves existing filesystem ancestors to catch symlink/junction aliases, including missing child directories. Private reads/writes resolve physical paths and require the expected KYC/company namespace. Traversal, encoded path components in stored IDs, backslashes, absolute paths, invalid PDF keys, and Windows stream-style paths are rejected. Public requests decode once, reject unsafe components, and check real file containment before Express static delivery; links escaping a public subtree fail safely.

New files use exclusive creation, POSIX file mode 0600 and directory mode 0700. Deployment filesystem permissions/Windows ACLs must still be configured appropriately. No application boundary is intended to protect against a privileged operator changing filesystem mounts during a request.

Production rejects `KYC_LOCAL_FALLBACK_ENABLED=true` (including supported truthy aliases) during configuration validation. The document services also disable fallback in production even if invoked outside normal bootstrap. Missing production Cloudinary configuration therefore returns 503 instead of writing locally. Development fallback retains its existing default, now with a private destination.

## Compatibility and migration plan

**No existing file was moved, deleted, renamed, or rewritten; no database metadata or migrations were changed or run.** The existing local files and untracked migrations were preserved. Test cleanup affected only test-owned temporary directories/files, never the real uploads tree.

The local directory inventory found `profile-photos`, `kyc-documents`, and `company-documents`, with no top-level files. Known public photo/logo paths are preserved. Arbitrary files in other parts of the former uploads parent intentionally cease to be implicitly public; the parent is no longer a valid public storage location.

Before deploying this change to another environment:

1. Inventory configured roots and existing public URL references without displaying document contents. Preserve any customized old `KYC_DOCUMENT_UPLOAD_DIR`/`PROFILE_PHOTO_UPLOAD_DIR` so legacy records keep resolving.
2. Configure the new private root on a writable, appropriately protected filesystem. Do not place it under either public subtree. In production, keep local fallback disabled; Cloudinary remains the existing provider.
3. Use the new backend registration. Ensure any independent reverse proxy/CDN/webserver does not separately expose the shared uploads parent or private root; repository-level Nest code cannot restrict an independently configured file server.
4. Verify synthetic legacy/new owner/admin access and anonymous denial before serving user traffic. Public photo/logo URLs must remain unchanged.
5. If an external environment has other intended public assets outside `profile-photos`, prepare an explicit mapping to `uploads/public` with the same `/uploads/...` URL suffix. Present the inventory, backup, copy/validation and rollback plan before moving anything. No such move is performed by this patch.
6. Legacy document relocation is optional, not required to close this backend leak: the shared parent is no longer served. Any later relocation requires a separately reviewed backup/copy/checksum/metadata/rollback plan and explicit authorization. Do not simply change legacy root settings or rewrite `local:` IDs.

Custom private paths outside the default ignored directory need deployment-level exclusion from source control and backup/access policies. Existing cleanup/replacement behavior remains; this task did not introduce a broader document-retention or orphan-cleanup system.

## Tests and checks actually run

Working directory for commands below: `apps/backend`, using existing installed binaries. No dependency installation was performed; no scripts were changed. Bare Git access has the previously observed ownership mismatch, so Git inspection uses the command-scoped `-c safe.directory='<USERPROFILE>/Desktop/porisrom'` setting, without altering global configuration.

| Command / check | Result |
| --- | --- |
| Scoped `git status --short` and relevant `git diff -- <paths>` before edits | Passed; existing dirty/untracked work inspected and retained. |
| `.\node_modules\.bin\vitest.CMD run test/private-static-http.spec.ts` against factored original middleware | **Failed as expected:** 6 failures/5 passes, confirming private HTTP responses were 200 before the fix. |
| Targeted document/static/photo run after implementation | **77 tests passed** across 7 files: identity 13, company 5, public-photo 5, static roots 2, private static HTTP 17, protected document HTTP 16, storage config/path checks 19. |
| `.\node_modules\.bin\vitest.CMD run` | **223 tests passed**, 28 files. Includes the existing 171 backend tests plus 52 new tests. |
| `.\node_modules\.bin\eslint.CMD "{src,test}/**/*.ts"` | Passed, exit 0; two existing unused `no-console` eslint-disable warnings in main/bootstrap and admin action logging. |
| `.\node_modules\.bin\tsc.CMD --noEmit --incremental false` | Passed, exit 0. |
| `.\node_modules\.bin\nest.CMD build` | Passed, exit 0. |
| Scoped `git diff --check` at repository root | Passed, exit 0. |
| Inline Node loopback TCP probes on 3000, 3001, 4000, 5433 | All ECONNREFUSED: real marketplace/admin/API/database unavailable to this session. |

The first implementation run caught two Windows short-path-versus-canonical-path assertion failures; the tests now compare real paths. An initial type check caught the registrar's Express-only `use` type; its structural interface now accepts both Nest and Express without changing runtime behavior. Final green checks ran after those corrections and the obsolete-helper cleanup.

Covered HTTP outcomes: private anonymous requests return 404; protected requests without/with invalid JWTs return 401; wrong-role admin requests return 403; another company's document returns 404; malformed stored paths return a generic 503; missing files return 404; legitimate owner/admin access returns 200 PDF with `Cache-Control: private, no-store`. Public avatar, logo, and a separate public-file request return 200. Windows junction tests ran and passed; they were not skipped.

## Remaining verification and scope limits

Live PostgreSQL-backed workflows, deployed Cloudinary upload/delete/signed expiry, real admin proxy/browser PDF viewing, and visible-browser user workflows were **blocked/not run** because the required running environment was unavailable. The HTTP tests used real application handlers and signed synthetic JWTs but an in-memory database fixture; they are not staging validation. No real credentials or document bytes were printed.

No deployment, reverse-proxy configuration, production filesystem/ACL inspection, incident/access-log investigation, database reset, data migration, commit or push was performed. Existing exposure history is unknown. The other P0 audit findings remain unresolved and this fix does not change the overall go-live verdict by itself.
