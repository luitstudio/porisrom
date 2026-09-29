import assert from "node:assert/strict";
import test from "node:test";

import {
  markNotificationRead,
  unreadNotificationCount,
  upsertNotificationById,
} from "../src/lib/notification-state.mjs";

test("notification events are deduplicated and update unread count", () => {
  const unread = { id: "notification-1", isRead: false };
  const deduplicated = upsertNotificationById([unread], unread);
  assert.equal(deduplicated.length, 1);
  assert.equal(unreadNotificationCount(deduplicated), 1);
  assert.equal(unreadNotificationCount(markNotificationRead(deduplicated, unread.id)), 0);
});

test("refresh recovery merges a missed notification without duplicates", () => {
  const existing = { id: "notification-1", isRead: false };
  const missed = { id: "notification-2", isRead: false };
  const merged = upsertNotificationById([existing], missed);
  assert.equal(merged.length, 2);
  assert.equal(upsertNotificationById(merged, missed).length, 2);
});
