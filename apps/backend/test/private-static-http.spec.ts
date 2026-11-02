import express from "express";
import { mkdir, mkdtemp, rmdir, symlink, unlink, writeFile } from "node:fs/promises";
import { get, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { registerPublicUploads } from "../src/static-uploads";

describe("private document HTTP boundary", () => {
  let root: string;
  let server: Server;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "porisrom-private-http-"));
    for (const dir of ["kyc-documents", "company-documents", "profile-photos"]) {
      await mkdir(join(root, dir));
      await writeFile(join(root, dir, dir === "profile-photos" ? "avatar.png" : "audit.pdf"),
        dir === "profile-photos" ? Buffer.from([0x89, 0x50, 0x4e, 0x47]) : "%PDF-1.7 synthetic");
    }
    await writeFile(join(root, "profile-photos/logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await mkdir(join(root, "public"));
    await writeFile(join(root, "public/unrelated.txt"), "intended public asset");
    await symlink(join(root, "kyc-documents"), join(root, "profile-photos/outside-link"), "junction");
    const app = express();
    await registerPublicUploads(app, { PROFILE_PHOTO_UPLOAD_DIR: root });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    // Only individually remove synthetic files and directories created by this suite.
    await unlink(join(root, "profile-photos/outside-link"));
    await unlink(join(root, "profile-photos/logo.png"));
    await unlink(join(root, "public/unrelated.txt"));
    await rmdir(join(root, "public"));
    for (const dir of ["kyc-documents", "company-documents", "profile-photos"]) {
      await unlink(join(root, dir, dir === "profile-photos" ? "avatar.png" : "audit.pdf"));
      await rmdir(join(root, dir));
    }
    await rmdir(root);
  });

  function request(path: string) {
    return new Promise<number>((resolve, reject) => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing HTTP test listener");
      get({ hostname: "127.0.0.1", port: address.port, path }, response => {
        response.resume();
        response.once("end", () => resolve(response.statusCode!));
      }).once("error", reject);
    });
  }

  it.each([
    "/uploads/kyc-documents/audit.pdf",
    "/uploads/%6byc-documents/audit.pdf",
    "/uploads/company-documents/audit.pdf",
    "/uploads/%63ompany-documents/audit.pdf",
    "/UPLOADS/KYC-DOCUMENTS/audit.pdf",
    "/uploads/profile-photos/../kyc-documents/audit.pdf",
    "/uploads/profile-photos/%2e%2e/company-documents/audit.pdf",
    "/uploads/profile-photos/%2e%2e%2fkyc-documents/audit.pdf",
    "/uploads/profile-photos/..%5ccompany-documents%5caudit.pdf",
    "/uploads/%256byc-documents/audit.pdf",
    "/uploads/profile-photos/outside-link/audit.pdf",
    "/uploads/profile-photos/%6futside-link/audit.pdf",
    "/uploads/profile-photos/%00audit.pdf",
    "/uploads/profile-photos/%zz/audit.pdf",
    "/uploads/profile-photos/avatar.png:secret",
    "/uploads/profile-photos/missing.png",
  ])("does not serve private bytes anonymously through %s", async path => {
    expect(await request(path)).toBe(404);
  });

  it("preserves intended public profile assets", async () => {
    expect(await request("/uploads/profile-photos/avatar.png")).toBe(200);
    expect(await request("/uploads/profile-photos/logo.png")).toBe(200);
    expect(await request("/uploads/unrelated.txt")).toBe(200);
  });
});
