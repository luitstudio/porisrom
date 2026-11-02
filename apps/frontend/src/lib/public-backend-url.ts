import { backendOrigin } from "./deployment-origin";

const LOCAL_BACKEND_URL = "http://localhost:4000";

/** Browser-only backend URL for Socket.IO. This value is intentionally public. */
export function getPublicBackendUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (configuredUrl) return backendOrigin(configuredUrl, "NEXT_PUBLIC_BACKEND_URL");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_BACKEND_URL must be configured in production");
  }
  return LOCAL_BACKEND_URL;
}
