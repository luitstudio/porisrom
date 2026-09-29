import { describe, expect, it } from "vitest";

import { validateProductionAuthSecrets } from "../src/auth/production-auth-config";

const strongAccessSecret = "a".repeat(32);
const strongRefreshSecret = "b".repeat(32);
const productionConfig = {
  NODE_ENV: "production",
  JWT_ACCESS_SECRET: strongAccessSecret,
  JWT_REFRESH_SECRET: strongRefreshSecret,
};

describe("production JWT secret configuration", () => {
  it.each([
    [{ NODE_ENV: "production", JWT_REFRESH_SECRET: strongRefreshSecret }, "JWT_ACCESS_SECRET"],
    [{ NODE_ENV: "production", JWT_ACCESS_SECRET: strongAccessSecret }, "JWT_REFRESH_SECRET"],
  ])("rejects a production configuration with a missing secret", (config, name) => {
    expect(() => validateProductionAuthSecrets(config)).toThrow(`${name} must be configured in production`);
  });

  it.each([
    ["JWT_ACCESS_SECRET", "change-me"],
    ["JWT_REFRESH_SECRET", "change-me-too"],
  ])("rejects known unsafe production value for %s", (name, unsafeSecret) => {
    expect(() => validateProductionAuthSecrets({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: name === "JWT_ACCESS_SECRET" ? unsafeSecret : strongAccessSecret,
      JWT_REFRESH_SECRET: name === "JWT_REFRESH_SECRET" ? unsafeSecret : strongRefreshSecret,
    })).toThrow("must not use an example or default value");
  });

  it("rejects short production secrets", () => {
    expect(() => validateProductionAuthSecrets({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "short-secret",
      JWT_REFRESH_SECRET: strongRefreshSecret,
    })).toThrow("at least 32 characters");
  });

  it("accepts distinct sufficiently strong production secrets", () => {
    const config = { ...productionConfig, FRONTEND_ORIGIN: "https://marketplace.example.com" };
    expect(validateProductionAuthSecrets(config)).toBe(config);
  });

  it("rejects a production configuration with a missing frontend origin", () => {
    expect(() => validateProductionAuthSecrets(productionConfig)).toThrow("FRONTEND_ORIGIN must be configured in production");
  });

  it.each(["http://localhost:3000", "https://localhost:3000", "http://127.0.0.1:3000"])(
    "rejects a localhost production origin: %s",
    (FRONTEND_ORIGIN) => {
      expect(() => validateProductionAuthSecrets({ ...productionConfig, FRONTEND_ORIGIN })).toThrow(
        "FRONTEND_ORIGIN must not contain localhost origins in production",
      );
    },
  );

  it("rejects a non-HTTPS production origin", () => {
    expect(() => validateProductionAuthSecrets({ ...productionConfig, FRONTEND_ORIGIN: "http://marketplace.example.com" })).toThrow(
      "FRONTEND_ORIGIN must contain HTTPS origins in production",
    );
  });

  it("keeps local development configuration usable", () => {
    const config = {
      NODE_ENV: "development",
      JWT_ACCESS_SECRET: "change-me",
      JWT_REFRESH_SECRET: "change-me-too",
      FRONTEND_ORIGIN: "http://localhost:3000",
    };
    expect(validateProductionAuthSecrets(config)).toBe(config);
  });
});
