import { fileURLToPath } from "node:url";

const config = {
  resolve: { alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    vitest: fileURLToPath(new URL("../admin/node_modules/vitest/dist/index.js", import.meta.url)),
  } },
  test: { include: ["test/auth-session.test.mjs", "test/auth-proxy.test.mjs", "test/auth-actions.test.mjs", "test/auth-diagnostics.test.mjs", "test/google-link-intent.test.mjs", "test/google-oidc-security.test.mjs", "test/bounded-current-user.test.mjs", "test/deployment-urls.test.mjs", "test/safety-actions.test.mjs", "test/onboarding-retry.test.mjs"] },
};
export default config;
