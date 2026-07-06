# @porishrom/backend

Status: not yet scaffolded.

This will be a NestJS application that owns:
- Auth (signup/login/session issuance — JWT + bcrypt)
- All database access via `@porishrom/database` (Prisma, Postgres)
- File upload handling (MinIO, S3-compatible)
- The API consumed by `apps/frontend` and `apps/admin`

Neither `apps/frontend` nor `apps/admin` should ever import `@porishrom/database` directly — this app is the only consumer.
