import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const responseMocks = vi.hoisted(() => ({
  next: vi.fn(() => ({ kind: "next" })),
  redirect: vi.fn((url: URL) => ({ kind: "redirect", url: url.toString() })),
}));

vi.mock("next/server", () => ({ NextResponse: responseMocks }));

import proxy from "./proxy";

function request(pathname: string, hasCookies: boolean) {
  return {
    nextUrl: { pathname },
    url: `http://admin.local${pathname}`,
    cookies: { has: vi.fn(() => hasCookies) },
  } as unknown as NextRequest;
}

describe("admin session routing", () => {
  it("allows login recovery when stale authentication cookies exist", () => {
    const result = proxy(request("/login", true));

    expect(result).toEqual({ kind: "next" });
    expect(responseMocks.redirect).not.toHaveBeenCalled();
  });

  it("still sends unauthenticated protected requests to login", () => {
    const result = proxy(request("/users", false));

    expect(result).toEqual({ kind: "redirect", url: "http://admin.local/login" });
  });
});
