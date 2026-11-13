import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type LocalGoogleAuthDiagnostic = {
  event: "google_identity_token_missing" | "google_identity_exchange_rejected";
  category?: string;
  status?: number;
};

const diagnosticsPath = path.join(process.cwd(), ".local-diagnostics", "google-oauth-diagnostics.log");

// Development-only and deliberately allowlisted: never pass errors, requests,
// accounts, or provider data to this local file.
export async function writeLocalGoogleAuthDiagnostic(diagnostic: LocalGoogleAuthDiagnostic) {
  if (process.env.NODE_ENV === "production") return;

  const entry = JSON.stringify({ timestamp: new Date().toISOString(), ...diagnostic });
  try {
    await mkdir(path.dirname(diagnosticsPath), { recursive: true });
    await appendFile(diagnosticsPath, `${entry}\n`, { encoding: "utf8" });
  } catch {
    // Diagnostics must never affect authentication decisions.
  }
}
