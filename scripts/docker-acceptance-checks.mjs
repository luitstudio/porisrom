import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { request } from "node:https";
import { createHash } from "node:crypto";
export async function runChecks({ mode, state, docker, compose, evidence, repo }) {
  if (mode === "preservation") {
    const baseline = JSON.parse(await readFile(join(repo, "tmp/docker-resource-baseline-2026-10-29.json"), "utf8"));
    const networkPreflightLog = (await readdir(evidence)).filter((name) => /^resource-network-inventory-\d+-[a-f0-9]+\.log$/.test(name)).sort().at(-1);
    const continuationNetworks = new Map(networkPreflightLog ? (await readFile(join(evidence, networkPreflightLog), "utf8")).trim().split("\n").map((line) => {
      const [id, name] = line.trim().split(/\s+/); return [name, id];
    }) : []);
    const results = [];
    for (const item of baseline.containers) {
      const format = '{"id":{{json .Id}},"name":{{json .Name}},"status":{{json .State.Status}},"image":{{json .Config.Image}},"startedAt":{{json .State.StartedAt}}}';
      const current = JSON.parse(await docker(["inspect", "--format", format, item.id], `preserve-container-${item.name}`, true));
      results.push({ kind: "container", name: item.name, passed: current.id.startsWith(item.id) && current.name === `/${item.name}` && current.image === item.image && current.status === (item.status.startsWith("Up") ? "running" : "exited"), startedAt: current.startedAt });
    }
    for (const item of baseline.networks) {
      const id = await docker(["network", "inspect", "--format", "{{.Id}}", item.name], `preserve-network-${item.name}`, true);
      // Desktop was restarted by the operator between the original inventory
      // and this continuation. Compare daemon-managed networks to the latest
      // current preflight, while retaining the original ID drift as evidence.
      const expected = ["bridge", "host", "none"].includes(item.name) ? continuationNetworks.get(item.name) ?? item.id : item.id;
      results.push({ kind: "network", name: item.name, passed: id.startsWith(expected), originalId: item.id, continuationId: expected, changedBeforeContinuation: expected !== item.id, preflightLog: networkPreflightLog });
    }
    for (const item of baseline.volumes) {
      const name = await docker(["volume", "inspect", "--format", "{{.Name}}", item.name], `preserve-volume-${item.name}`, true);
      results.push({ kind: "volume", name: item.name, passed: name === item.name });
    }
    for (const item of baseline.images) {
      const id = await docker(["image", "inspect", "--format", "{{.Id}}", item.image], `preserve-image-${item.id}`, true);
      results.push({ kind: "image", name: item.image, passed: id.replace(/^sha256:/, "").startsWith(item.id) });
    }
    await writeFile(join(evidence, `unrelated-resource-preservation-${Date.now()}.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ resources: results.length, passed: results.filter((r) => r.passed).length }));
    if (results.some((r) => !r.passed)) throw Error("Pre-existing resource changed; inspect evidence before making a preservation claim");
  } else if (mode === "migration-checksums") {
    const sql = 'SELECT json_agg(t ORDER BY migration_name)::text FROM (SELECT migration_name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NULL AS not_rolled_back FROM "_prisma_migrations") t';
    const rows = JSON.parse(await docker([...compose, "exec", "--no-TTY", "postgres", "psql", "-U", "acceptance", "-d", state.database, "-At", "-c", sql], "read-isolated-migration-checksums", true));
    const results = [];
    for (const row of rows) {
      if (!/^[0-9]{14}_[a-z0-9_]+$/.test(row.migration_name)) throw Error("Unexpected migration name");
      const file = await readFile(join(repo, "packages/database/prisma/migrations", row.migration_name, "migration.sql"));
      results.push({ name: row.migration_name, passed: row.finished && row.not_rolled_back && createHash("sha256").update(file).digest("hex") === row.checksum });
    }
    await writeFile(join(evidence, "migration-checksums.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ migrations: results.length, passed: results.filter((r) => r.passed).length }));
    if (!results.length || results.some((r) => !r.passed)) throw Error("Migration checksum verification failed");
  } else if (mode === "http") {
    const address = await docker([...compose, "port", "proxy", "8443"], "identify-loopback-ingress", true);
    if (!/^127\.0\.0\.1:\d+$/.test(address)) throw Error("Expected loopback-only task ingress");
    const ca = await readFile(join(state.root, "tls/cert.pem"));
    const probe = (host, path, headers = {}, method = "GET") => new Promise((done, reject) => {
      const req = request({ hostname: "127.0.0.1", port: Number(address.split(":")[1]), servername: "api.porisrom.test", ca, path, method,
        headers: { Host: `${host}:8443`, ...headers }, timeout: 10000 }, (res) => {
        res.resume(); res.on("end", () => done({ status: res.statusCode, origin: res.headers["access-control-allow-origin"] }));
      });
      req.on("error", reject); req.on("timeout", () => req.destroy(Error("HTTPS probe timed out"))); req.end();
    });
    const results = [];
    for (const [host, path] of [["api-a.porisrom.test", "/health/ready"], ["api-b.porisrom.test", "/health/ready"], ["marketplace.porisrom.test", "/auth/login"], ["admin.porisrom.test", "/login"]]) {
      const result = await probe(host, path); results.push({ name: `${host}${path}`, status: result.status, passed: result.status === 200 });
    }
    const denied = await probe("unknown.porisrom.test", "/"); results.push({ name: "Unknown ingress host rejected", status: denied.status, passed: denied.status === 421 });
    for (const origin of ["https://marketplace.porisrom.test:8443", "https://untrusted.example.test"]) {
      const result = await probe("api.porisrom.test", "/auth/me", { Origin: origin, "Access-Control-Request-Method": "GET" }, "OPTIONS");
      results.push({ name: `Exact CORS policy: ${origin}`, passed: origin.includes("marketplace") ? result.origin === origin : result.origin === undefined });
    }
    await writeFile(join(evidence, "https-probes.json"), JSON.stringify({ applicationTlsValidationEnabled: true, results }, null, 2));
    console.log(JSON.stringify(results)); if (results.some((r) => !r.passed)) throw Error("HTTPS probe failed");
  } else if (mode === "build-browser") {
    await docker(["build", "--progress=plain", "--file", "deploy/Dockerfile.acceptance-browser", "--tag", `${state.project}:browser`, "."], "build-browser", true);
  } else if (mode === "seed") {
    const source = await readFile(join(repo, "deploy/acceptance-seed.cjs"), "utf8");
    const result = await docker([...compose, "exec", "--no-TTY", "--env", `PORISROM_ACCEPTANCE_SEED_SUFFIX=-${Date.now()}`, "api-a", "node", "-e", source], "seed-synthetic-fixtures");
    await writeFile(join(state.root, "fixture.json"), result, { mode: 0o600 });
  } else if (["browser", "browser-ui"].includes(mode)) {
    const fixture = JSON.parse(await readFile(join(state.root, "fixture.json"), "utf8"));
    const envFile = join(state.root, "browser.env");
    await writeFile(envFile, `ACCEPTANCE_FIXTURE=${JSON.stringify(fixture)}\n`, { mode: 0o600 });
    await docker(["run", "--name", `${state.project}-browser-${Date.now()}`, "--label", `com.porisrom.acceptance=${state.project}`, "--network", `${state.project}_default`,
      "--memory", "1g", "--cpus", "1", "--shm-size", "512m", "--env-file", envFile, ...(mode === "browser-ui" ? ["--env", "ACCEPTANCE_UI_ONLY=true"] : []), "--volume", `${evidence}:/results`, `${state.project}:browser`], mode === "browser-ui" ? "browser-ui-checks" : "browser-checks");
  } else if (["regressions", "diagnose-regressions"].includes(mode)) {
    const pg = await docker([...compose, "ps", "--quiet", "postgres"], "identify-owned-test-postgres", true);
    if (!/^[a-f0-9]{12,64}$/.test(pg)) throw Error("Task PostgreSQL container not found");
    const owner = await docker(["inspect", "--format", '{{index .Config.Labels "com.docker.compose.project"}}', pg], "verify-postgres-ownership", true);
    if (owner !== state.project) throw Error("Refusing a different project's PostgreSQL container");
    const envFile = join(state.root, "regressions.env");
    const url = `postgresql://acceptance:${state.password}@127.0.0.1:5432/${state.database}`;
    await writeFile(envFile, `NODE_ENV=test\nDATABASE_URL=${url}\n` + ["AUTH", "MODERATION", "ADMIN", "SAFETY", "CLUSTER"].map((name) => `PORISROM_${name}_TEST_DATABASE_URL=${url}\n`).join(""), { mode: 0o600 });
    const name = `${state.project}-regressions-${Date.now()}`;
    try {
      const command = mode === "diagnose-regressions"
        ? ["--workdir", "/app/apps/backend", "--entrypoint", "node", `${state.project}:acceptance-tests`, "node_modules/vitest/vitest.mjs", "run", "test/admin-disputes-postgres.spec.ts", "test/realtime-cluster-postgres.spec.ts", "--maxWorkers=1"]
        : ["--entrypoint", "node", `${state.project}:acceptance-tests`, "/app/scripts/verify-release.mjs", "--test-workers=1"];
      await docker(["run", "--name", name, "--label", `com.porisrom.acceptance=${state.project}`, "--network", `container:${pg}`, "--memory", "2g", "--cpus", "2", "--env-file", envFile,
        ...command], mode === "diagnose-regressions" ? "diagnose-backend-regressions" : "container-regressions", true);
    } finally {
      if (mode === "regressions") {
        await docker(["cp", `${name}:/app/tmp/release-verification.json`, join(evidence, `regression-results-${name}.json`)], "copy-regression-summary", true).catch(() => {});
        await docker(["cp", `${name}:/app/tmp/backend-tests.json`, join(evidence, `backend-tests-${name}.json`)], "copy-regression-tests", true).catch(() => {});
      }
    }
  } else if (mode === "lifecycle") {
    const fingerprints = ["User", "Message", "PaymentClaim", "AdminActionLog"].map((table) =>
      `(SELECT json_build_object('count', count(*), 'digest', md5(COALESCE(string_agg(to_jsonb(t)::text, '' ORDER BY id), ''))) FROM "${table}" t)`);
    const sql = `SELECT json_build_array(${fingerprints.join(",")})::text`;
    const counts = () => docker([...compose, "exec", "--no-TTY", "postgres", "psql", "-U", "acceptance", "-d", state.database, "-At", "-c", sql], `data-fingerprint-${Date.now()}`, true);
    const before = await counts(); const ids = {};
    const services = ["api-a", "api-b", "frontend", "admin", "proxy", "postgres"];
    for (const service of services) ids[service] = await docker([...compose, "ps", "--quiet", service], `identify-${service}`, true);
    const started = Date.now(); await docker([...compose, "stop", "--timeout", "20", ...services], "graceful-stop");
    const exits = {};
    for (const [service, id] of Object.entries(ids)) {
      const details = JSON.parse(await docker(["inspect", "--format", "{{json .State}}", id], `exit-${service}`, true));
      exits[service] = { exitCode: details.ExitCode, oomKilled: details.OOMKilled };
      if (details.OOMKilled || ![0, 143].includes(details.ExitCode)) throw Error(`Unexpected shutdown for ${service}`);
    }
    await docker([...compose, "start", "--wait", "--wait-timeout", "180", ...services], "restart-application-containers");
    for (const [service, id] of Object.entries(ids)) {
      if (await docker([...compose, "ps", "--quiet", service], `verify-restarted-${service}`, true) !== id) throw Error(`Container identity changed for ${service}`);
    }
    const after = await counts(); if (after !== before) throw Error("Persistent business data changed during restart");
    await writeFile(join(evidence, "lifecycle.json"), JSON.stringify({ gracefulExit: exits, retainedSameContainerIds: true, businessCountsUnchanged: true, businessRowDigestsUnchanged: true, durationMs: Date.now() - started }, null, 2));
  } else if (mode === "images") {
    for (const target of ["backend", "frontend", "admin", "migrate"]) {
      await docker(["image", "inspect", "--format", '{{json .Id}} {{json .Config.User}} {{json .Config.Cmd}} {{json .Size}}', `${state.project}:${target}`], `image-${target}`);
      if (target !== "migrate") {
        await docker(["run", "--name", `${state.project}-inventory-${target}-${Date.now()}`, "--label", `com.porisrom.acceptance=${state.project}`, "--network", "none", "--entrypoint", "sh", `${state.project}:${target}`, "-c",
          "test $(id -u) -ne 0 && test ! -d /app/.turbo && find /app -type f \\( -name '.env' -o -name '.env.*' -o -name '*.key' -o -name '*.pem' -o -name '*.p12' -o -name '*.pfx' \\) > /tmp/sensitive-files && test ! -s /tmp/sensitive-files && echo nonroot-and-sensitive-file-checks-passed"], `image-files-${target}`);
      }
    }
  } else throw Error("Unknown acceptance operation");
}
