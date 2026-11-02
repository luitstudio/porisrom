export function backendOrigin(value: string, name: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a valid backend origin`); }
  const local = ["localhost", "::1", "[::1]"].includes(url.hostname) || /^127\./.test(url.hostname) || url.hostname.endsWith(".localhost");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      !["https:", "http:"].includes(url.protocol) ||
      (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || local))) {
    throw new Error(`${name} must be a credential-free HTTPS origin outside localhost in production`);
  }
  return url.origin;
}
