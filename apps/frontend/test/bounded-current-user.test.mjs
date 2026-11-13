import { describe, expect, it, vi } from "vitest";

import { CurrentUserGateUnavailableError, loadBoundedCurrentUser } from "@/lib/bounded-current-user";

describe("bounded current-user gate", () => {
  it("returns a successfully loaded user", async () => {
    const load = vi.fn(async () => ({ id: "synthetic-user" }));
    await expect(loadBoundedCurrentUser(load, 50)).resolves.toEqual({ id: "synthetic-user" });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("aborts and reports a retryable failure when the request times out", async () => {
    vi.useFakeTimers();
    const load = vi.fn((signal) => new Promise(() => { signal.addEventListener("abort", () => {}); }));
    const result = loadBoundedCurrentUser(load, 50);
    const assertion = expect(result).rejects.toBeInstanceOf(CurrentUserGateUnavailableError);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(load.mock.calls[0][0].aborted).toBe(true);
    vi.useRealTimers();
  });

  it("reruns the loader after a transient failure", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ id: "synthetic-user" });
    await expect(loadBoundedCurrentUser(load, 50)).rejects.toBeInstanceOf(CurrentUserGateUnavailableError);
    await expect(loadBoundedCurrentUser(load, 50)).resolves.toEqual({ id: "synthetic-user" });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
