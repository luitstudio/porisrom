import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("forgot-password page describes verified support recovery without claiming self-service", async () => {
  const source = await readFile(
    new URL("../src/app/auth/forgot-password/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /identity verification/i);
  assert.match(source, /support@porisrom\.com/);
  assert.match(source, /will not confirm whether an account exists/i);
  assert.doesNotMatch(source, /coming soon/i);
  assert.doesNotMatch(source, /send reset link/i);
});
