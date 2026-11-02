export function sessionReturnUrl(requestUrl: string, path: string) {
  const home = new URL("/", requestUrl);
  const target = new URL(path, home);
  return path.startsWith("/") && target.origin === home.origin && !target.pathname.startsWith("/api/auth/refresh") ? target : home;
}
