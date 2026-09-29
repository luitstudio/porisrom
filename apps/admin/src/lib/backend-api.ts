const LOCAL_BACKEND_URL = "http://localhost:4000";

function getBackendUrl() {
  const configuredUrl = process.env.BACKEND_URL?.trim();
  if (configuredUrl) return configuredUrl;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BACKEND_URL must be configured in production");
  }
  return LOCAL_BACKEND_URL;
}

export class BackendApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type BackendFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string;
};

function extractMessage(data: unknown): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message: unknown }).message;
    if (Array.isArray(message)) return String(message[0]);
    if (typeof message === "string") return message;
  }
  return "Request failed";
}

export async function backendFetch<T = unknown>(
  path: string,
  options: BackendFetchOptions = {},
): Promise<T> {
  const res = await fetch(`${getBackendUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new BackendApiError(res.status, extractMessage(data));
  }

  return data as T;
}
