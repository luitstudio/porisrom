const MINIMUM_PRODUCTION_SECRET_LENGTH = 32;
const UNSAFE_EXAMPLE_SECRETS = new Set([
  "change-me",
  "change-me-too",
  "replace-with-a-random-secret",
]);

const LOCAL_ORIGIN_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function frontendOrigins(config: Record<string, unknown> = process.env) {
  const origin = typeof config.FRONTEND_ORIGIN === "string" ? config.FRONTEND_ORIGIN.trim() : "";
  return origin ? origin.split(",").map((value) => value.trim()).filter(Boolean) : "http://localhost:3000";
}

export function validateProductionAuthSecrets(config: Record<string, unknown>) {
  if (config.NODE_ENV !== "production") return config;

  for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    const secret = typeof config[name] === "string" ? config[name].trim() : "";
    if (!secret) {
      throw new Error(`${name} must be configured in production`);
    }
    if (UNSAFE_EXAMPLE_SECRETS.has(secret.toLowerCase()) || secret.toLowerCase().startsWith("replace-with-")) {
      throw new Error(`${name} must not use an example or default value in production`);
    }
    if (secret.length < MINIMUM_PRODUCTION_SECRET_LENGTH) {
      throw new Error(`${name} must be at least ${MINIMUM_PRODUCTION_SECRET_LENGTH} characters in production`);
    }
  }

  const origins = frontendOrigins(config);
  if (origins === "http://localhost:3000") {
    throw new Error("FRONTEND_ORIGIN must be configured in production");
  }

  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error("FRONTEND_ORIGIN must contain valid HTTPS origins in production");
    }

    if (LOCAL_ORIGIN_HOSTS.has(url.hostname)) {
      throw new Error("FRONTEND_ORIGIN must not contain localhost origins in production");
    }
    if (url.protocol !== "https:") {
      throw new Error("FRONTEND_ORIGIN must contain HTTPS origins in production");
    }
  }

  return config;
}
