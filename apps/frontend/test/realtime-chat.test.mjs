import assert from "node:assert/strict";
import test from "node:test";

import { upsertMessageById } from "../src/lib/realtime-message.mjs";

test("realtime messages are deduplicated by message ID", () => {
  const message = { id: "message-1", conversationId: "conversation-1" };
  assert.deepEqual(upsertMessageById([message], message), [message]);
  assert.deepEqual(upsertMessageById([], message), [message]);
});
