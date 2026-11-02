import { expect, it } from "vitest";
import { errorSignal } from "../src/operations/http-error.filter";

it("operational error signals exclude submitted credentials, identifiers, URLs, and private evidence", () => {
  const request = { method: "POST", route: { path: "/admin/safety/cases/:id/review" },
    originalUrl: "/private?token=synthetic-secret", body: { reason: "private evidence", password: "private password" }, headers: { authorization: "private bearer" } };
  expect(errorSignal(request, 500)).toEqual({ event: "http_server_error", method: "POST", route: "/admin/safety/cases/:id/review", status: 500 });
  expect(JSON.stringify(errorSignal(request, 500))).not.toContain("private");
});
