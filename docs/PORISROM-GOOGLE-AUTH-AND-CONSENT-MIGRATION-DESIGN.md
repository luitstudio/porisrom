# Google authentication and consent migration design

**Status:** Approved implementation design for Phase 2. This document records the
schema and account-linking decision before its migration is created. It does not
claim that a live Google OAuth client has been configured or tested.

## Existing constraints

- The backend, not the frontend, owns Porishrom access and refresh tokens and
  persistent `AuthSession` rows.
- Auth.js currently bridges a Credentials login to that backend session model.
- `User.passwordHash` is required and existing password authentication must keep
  working. It will remain required.
- There is no existing external-identity or consent persistence model.

## Proposed migration

Add the following nullable fields to `User`:

- `termsAcceptedAt` and `termsVersion`
- `privacyPolicyAcceptedAt` and `privacyPolicyVersion`

The migration does **not** backfill acceptance for existing accounts. There is no
reliable historic acceptance evidence to backfill. Existing users remain able to
log in; consent can be collected under a separately approved re-consent policy if
the legal owner requires it.

Add an `ExternalIdentity` table with:

- a canonical `userId` foreign key (cascade deletion);
- `provider` (`google` initially);
- `providerSubject`, the Google OpenID Connect `sub` claim;
- `emailAtLink` and `emailVerifiedAt` as minimal audit metadata; and
- creation/update timestamps.

`(provider, providerSubject)` is unique. This is the authoritative mapping; the
email address is never used as a provider identity key. No Google access token,
refresh token, client secret, or raw ID token is stored.

Google-created users retain a non-null `passwordHash`: the backend hashes a
cryptographically random value which is never returned or retained. This avoids a
nullable-password branch throughout the established password-login architecture.
It does not grant password login; only a later, deliberately designed password
set/reset flow could make that possible.

## Account-linking policy

1. The backend verifies the Google ID token with the configured Google client ID,
   and requires a valid issuer, signature, expiry, `sub`, email and
   `email_verified: true`.
2. If the `google` + `sub` identity exists, the backend checks that its Porishrom
   user is active and issues the ordinary backend access/refresh token pair.
3. If no identity exists and its verified email has no Porishrom user, a valid,
   short-lived backend-issued signup intent is required. It carries the selected
   role and both consent versions. The backend creates the user, identity,
   consent evidence and normal `AuthSession` atomically.
4. If no identity exists but the email belongs to a Porishrom user, the request
   is rejected with a link-required response. It never links based on email
   alone, including a verified email.
5. An already authenticated Porishrom user may explicitly call the protected
   linking endpoint. The backend verifies the Google token again, requires the
   verified Google email to equal the account email, and rejects an identity that
   belongs to any other user. Linking is idempotent only for the same user.

This supports new Google signup and login for returning linked users while
requiring proof of control of both accounts before a legacy password account is
linked.

## OAuth and session flow

The existing Auth.js library will use its Google OpenID Connect provider. The
provider callback uses state, PKCE and nonce checks. On a successful callback,
the frontend server sends the callback ID token and any short-lived signup intent
to the backend over the existing server-to-server API path. The backend validates
the token independently and returns the normal Porishrom user and backend token
pair, which Auth.js puts into its existing JWT session callback.

Auth.js does not become the marketplace identity authority, and Google provider
tokens are neither copied to browser-visible session data nor persisted.

## Consent policy implemented by this change

Password and Google registration must both supply affirmative acceptance of the
currently configured Terms and Privacy Policy versions. The backend records each
version and acceptance timestamp while creating the account. Direct API requests
without the required acceptance are rejected.

The initial version identifiers are implementation labels for the existing
published `/terms` document and its privacy section; they are not legal approval
of the document text. A legal owner must approve the actual text, versioning,
effective date and any re-consent policy before a public release.

## Failure behaviour

- Cancelled authorization returns the user to the sign-in or signup screen; no
  Porishrom account or session is created.
- Auth.js rejects invalid/replayed state, PKCE or nonce checks before exchange.
- Invalid ID tokens, a disabled/deleted account, mismatched/link-owned identity,
  expired/invalid signup intent and provider verification failures result in no
  Porishrom session.
- The unique database constraint prevents concurrent duplicate identity creation.

## External configuration still required

- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in the frontend server environment.
- `GOOGLE_CLIENT_ID` in the backend server environment.
- An authorized redirect URI ending in `/api/auth/callback/google` for each
  approved environment.
- Google consent-screen configuration and an authorized test user/client for
  real-provider acceptance.
