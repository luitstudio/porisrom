import assert from "node:assert/strict";
import test from "node:test";

import { finalizeStorageMaintenanceHarness, parseStorageMaintenanceHarnessOptions } from "./storage-maintenance-harness-safety.mjs";

test("default mode retains verified cleanup behavior", async () => {
  const calls = [];
  const result = await finalizeStorageMaintenanceHarness({ preserveResources: false, postgresId: "owned", discoverPostgresId: async () => "unexpected", verifyOwnership: async id => calls.push(`verify:${id}`), down: async () => calls.push("down"), removeRoot: async () => calls.push("root") });
  assert.deepEqual(calls, ["verify:owned", "down", "root"]);
  assert.equal(result.cleanup, "verified-project-volume-removed");
});

test("preservation mode skips every destructive cleanup step after successful work", async () => {
  const calls = [];
  const result = await finalizeStorageMaintenanceHarness({ preserveResources: true, postgresId: "owned", discoverPostgresId: async () => "unexpected", verifyOwnership: async () => calls.push("verify"), down: async () => calls.push("down"), removeRoot: async () => calls.push("root") });
  assert.deepEqual(calls, []);
  assert.deepEqual(result, { cleanup: "preserved-by-request", postgresId: "owned" });
});

test("preservation mode also retains resources discovered after a failing provisioning path", async () => {
  const calls = [];
  const result = await finalizeStorageMaintenanceHarness({ preserveResources: true, postgresId: "", discoverPostgresId: async () => "owned-after-failure", verifyOwnership: async () => calls.push("verify"), down: async () => calls.push("down"), removeRoot: async () => calls.push("root") });
  assert.deepEqual(calls, []);
  assert.deepEqual(result, { cleanup: "preserved-by-request", postgresId: "owned-after-failure" });
});

test("default mode refuses cleanup when ownership verification fails", async () => {
  const calls = [];
  await assert.rejects(() => finalizeStorageMaintenanceHarness({ preserveResources: false, postgresId: "ambiguous", discoverPostgresId: async () => "unexpected", verifyOwnership: async () => { throw Error("ownership uncertain"); }, down: async () => calls.push("down"), removeRoot: async () => calls.push("root") }), /ownership uncertain/);
  assert.deepEqual(calls, []);
});

test("unknown options fail closed", () => {
  assert.deepEqual(parseStorageMaintenanceHarnessOptions([]), { preserveResources: false });
  assert.deepEqual(parseStorageMaintenanceHarnessOptions(["--preserve-resources"]), { preserveResources: true });
  assert.throws(() => parseStorageMaintenanceHarnessOptions(["--unsafe"]), /Usage/);
});
