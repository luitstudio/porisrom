import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const diagnosticsPath = path.join(process.cwd(), ".local-diagnostics", "google-oauth-diagnostics.log");

type GoogleAuthRequest = {
  method: string;
  route?: { path?: unknown };
};

// Development-only and deliberately allowlisted: never write request bodies,
// headers, cookies, provider responses, or exception details.
export async function writeLocalGoogleAuthDenial(request: GoogleAuthRequest, status: number) {
  if (process.env.NODE_ENV === "production") return;
  if (request.method !== "POST" || request.route?.path !== "/auth/google") return;

  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event: "http_request_denied",
    method: "POST",
    route: "/auth/google",
    status,
  });
  try {
    await mkdir(path.dirname(diagnosticsPath), { recursive: true });
    await appendFile(diagnosticsPath, `${entry}\n`, { encoding: "utf8" });
  } catch {
    // Diagnostics must never affect an HTTP response.
  }
}
