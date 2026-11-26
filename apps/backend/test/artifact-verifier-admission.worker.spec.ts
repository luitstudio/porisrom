import { describe, expect, it } from "vitest";

import { ArtifactVerifierAdmissionWorker } from "../../verifier/src/artifact-verifier-admission.worker";

describe("isolated artifact verifier admission worker", () => {
  it("fails closed without mTLS endpoint material", () => {
    expect(() => ArtifactVerifierAdmissionWorker.fromEnvironment({} as NodeJS.ProcessEnv)).toThrow("ADMISSION_ENDPOINT");
  });
  it("refuses a verifier database credential and insecure endpoint", () => {
    const env = { ADMISSION_ENDPOINT: "http://admission/v1/capture-verifications", VERIFIER_TLS_KEY_FILE: "key", VERIFIER_TLS_CERT_FILE: "cert", VERIFIER_TLS_CA_FILE: "ca", VERIFIER_ARTIFACT_DATABASE_URL: "postgres://forbidden" } as NodeJS.ProcessEnv;
    expect(() => ArtifactVerifierAdmissionWorker.fromEnvironment(env)).toThrow("Verifier must not");
  });
});
