import { request } from "node:https";
import { readFileSync } from "node:fs";
import type { ArtifactVerificationBinding, ArtifactVerificationProof } from "../../backend/src/storage-maintenance/backup-artifact-verifier.engine";

export type AdmissionClientConfig = { endpoint: string; tlsKeyFile: string; tlsCertFile: string; tlsCaFile: string; tlsServerName?: string };

/** The verifier has no database client: a signed proof travels over mTLS to the independent admission authority. */
export class ArtifactVerifierAdmissionWorker {
  private constructor(private readonly config: AdmissionClientConfig) {}
  static fromEnvironment(env = process.env) {
    const endpoint = env.ADMISSION_ENDPOINT; const tlsKeyFile = env.VERIFIER_TLS_KEY_FILE; const tlsCertFile = env.VERIFIER_TLS_CERT_FILE; const tlsCaFile = env.VERIFIER_TLS_CA_FILE;
    if (!endpoint || !tlsKeyFile || !tlsCertFile || !tlsCaFile) throw new Error("ADMISSION_ENDPOINT and verifier mTLS files are required");
    if (env.VERIFIER_ARTIFACT_DATABASE_URL) throw new Error("Verifier must not be configured with an admission database credential");
    const url = new URL(endpoint); if (url.protocol !== "https:" || url.pathname !== "/v1/capture-verifications") throw new Error("ADMISSION_ENDPOINT must be the HTTPS capture-admission endpoint");
    return new ArtifactVerifierAdmissionWorker({ endpoint, tlsKeyFile, tlsCertFile, tlsCaFile, tlsServerName: env.ADMISSION_TLS_SERVER_NAME });
  }
  async admitVerified(proof: ArtifactVerificationProof) {
    const endpoint = new URL(this.config.endpoint); const body = JSON.stringify(proof);
    return new Promise<{ attemptId: string; idempotent: boolean }>((resolve, reject) => {
      const req = request(endpoint, { method: "POST", servername: this.config.tlsServerName, key: readFileSync(this.config.tlsKeyFile), cert: readFileSync(this.config.tlsCertFile), ca: readFileSync(this.config.tlsCaFile), minVersion: "TLSv1.3", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } }, response => {
        let text = ""; response.setEncoding("utf8"); response.on("data", part => text += part); response.on("end", () => {
          if (response.statusCode !== 201) return reject(new Error(`Admission refused (${response.statusCode})`));
          try { const value = JSON.parse(text); if (!value?.attemptId || typeof value.idempotent !== "boolean") throw new Error("invalid response"); resolve(value); } catch { reject(new Error("Admission returned an invalid response")); }
        });
      }); req.on("error", reject); req.end(body);
    });
  }
  async processTrustedTask(task: { binding: ArtifactVerificationBinding; candidateName: string }, verifyArtifact: (binding: ArtifactVerificationBinding, candidateName: string) => Promise<ArtifactVerificationProof>) {
    if (!task.binding.canonicalSetId || !task.candidateName) throw new Error("Trusted verifier task is incomplete");
    const proof = await verifyArtifact(task.binding, task.candidateName);
    if (proof.canonicalSetId !== task.binding.canonicalSetId || proof.manifestSha256 !== task.binding.manifestSha256) throw new Error("Verifier proof does not match trusted task binding");
    return this.admitVerified(proof);
  }
}
