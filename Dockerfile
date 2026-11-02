# Supply an operator-reviewed immutable digest for an actual release.
ARG NODE_IMAGE=node:24.11.0-bookworm-slim
FROM ${NODE_IMAGE} AS runtime-base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

FROM runtime-base AS dependencies
ENV NODE_ENV=development CI=true
RUN npm install --global pnpm@9.0.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @porisrom/database build

FROM dependencies AS backend-build
RUN pnpm --filter @porisrom/backend build
RUN pnpm --filter @porisrom/backend deploy --prod /out/backend

FROM runtime-base AS backend
COPY --from=backend-build --chown=node:node /out/backend/ ./
RUN mkdir -p /app/runtime/public /app/runtime/private && chown -R node:node /app/runtime
ENV HOST=0.0.0.0 PORT=4000 PROFILE_PHOTO_UPLOAD_DIR=/app/runtime/public PRIVATE_DOCUMENT_UPLOAD_DIR=/app/runtime/private KYC_LOCAL_FALLBACK_ENABLED=false
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

# Migration tooling stays out of application runtimes and never auto-starts.
FROM dependencies AS migrate
WORKDIR /app/packages/database
USER node
ENTRYPOINT ["node", "node_modules/prisma/build/index.js"]
CMD ["migrate", "deploy"]

FROM dependencies AS acceptance-tests
RUN pnpm --filter @porisrom/backend build
CMD ["node", "scripts/verify-release.mjs"]

FROM dependencies AS frontend-build
ARG NEXT_PUBLIC_BACKEND_URL
ARG BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL} BACKEND_URL=${BACKEND_URL}
RUN test -n "$NEXT_PUBLIC_BACKEND_URL" && test -n "$BACKEND_URL" && NODE_ENV=production pnpm --filter @porisrom/frontend build && node scripts/sanitize-standalone.mjs
FROM runtime-base AS frontend
COPY --from=frontend-build --chown=node:node /app/apps/frontend/.next/standalone/ ./
COPY --from=frontend-build --chown=node:node /app/apps/frontend/.next/static/ ./apps/frontend/.next/static/
COPY --from=frontend-build --chown=node:node /app/apps/frontend/public/ ./apps/frontend/public/
WORKDIR /app/apps/frontend
ENV HOSTNAME=0.0.0.0 PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/auth/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

FROM dependencies AS admin-build
ARG BACKEND_URL
ENV BACKEND_URL=${BACKEND_URL}
RUN test -n "$BACKEND_URL" && NODE_ENV=production pnpm --filter @porisrom/admin build && node scripts/sanitize-standalone.mjs
FROM runtime-base AS admin
COPY --from=admin-build --chown=node:node /app/apps/admin/.next/standalone/ ./
COPY --from=admin-build --chown=node:node /app/apps/admin/.next/static/ ./apps/admin/.next/static/
WORKDIR /app/apps/admin
ENV HOSTNAME=0.0.0.0 PORT=3001
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3001/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
