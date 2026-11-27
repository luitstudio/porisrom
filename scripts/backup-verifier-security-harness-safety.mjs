export function effectiveEnvironment(baseEnvironment, commandEnvironment = {}) {
  return Object.freeze({ ...baseEnvironment, ...commandEnvironment });
}

export function safeDiagnostic(value) {
  return String(value).replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://[redacted]@");
}

export function assertDisposableOwnerUrl(environment, expectedUrl, selectedPort) {
  if (!/^[1-9][0-9]{3,4}$/.test(selectedPort ?? "") || Number(selectedPort) > 65535) throw Error("Selected harness port is invalid.");
  const value = environment.DATABASE_URL;
  if (value !== expectedUrl) throw Error("Migration DATABASE_URL did not match the validated disposable owner target.");
  const url = new URL(value);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== selectedPort ||
      url.pathname !== "/porisrom_verifier_security_test" || decodeURIComponent(url.username) !== "verifier_test_owner" ||
      decodeURIComponent(url.password) !== "verifier_test_owner_only") {
    throw Error("Migration target is not the disposable verifier owner database.");
  }
  return environment;
}

export function createInvoker({ spawn, baseEnvironment, root, shell }) {
  return (command, args, options = {}) => {
    const environment = effectiveEnvironment(baseEnvironment, options.env);
    const result = spawn(command, args, { cwd: root, shell, encoding: "utf8", maxBuffer: 1024 * 1024, ...options, env: environment });
    const output = safeDiagnostic(((result.stdout ?? "") + (result.stderr ?? "")).trim());
    if (result.error?.code === "ETIMEDOUT" || result.signal) throw Error("Harness command timed out or was interrupted: " + output);
    if (result.status !== 0) throw Error(output || "Harness command failed");
    return output;
  };
}

export function assertFreshDatabaseIdentity(output, { database, owner }) {
  const [actualDatabase, actualOwner, version, userTableCount] = output.trim().split(",");
  if (actualDatabase !== database || actualOwner !== owner || !version.startsWith("16") || userTableCount !== "0") {
    throw Error("Disposable fresh-database identity verification failed.");
  }
}

export function assertHarnessMarkerIdentity(output, { database, owner, runId }) {
  const [actualDatabase, actualOwner, version, actualRunId] = output.trim().split(",");
  if (actualDatabase !== database || actualOwner !== owner || !version.startsWith("16") || actualRunId !== runId) {
    throw Error("Disposable post-migration marker verification failed.");
  }
}
