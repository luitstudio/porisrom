import express from "express";
import { realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { isInside, publicAssetRoots, publicUploadsRoot, validateDocumentStoragePaths } from "./document-storage";

export { publicUploadsRoot } from "./document-storage";

function confinedStatic(root: string): express.RequestHandler {
  const serve = express.static(root, { index: false, dotfiles: "deny", redirect: false });
  return (req, res, next) => {
    void (async () => {
      let key: string;
      try { key = decodeURIComponent(req.path); } catch { return res.sendStatus(404); }
      const parts = key.split("/").filter(Boolean);
      if (key.includes("\\") || key.includes(":") || key.includes("\0") || parts.some(part => part.startsWith("."))) {
        return res.sendStatus(404);
      }
      try {
        const [realRoot, file] = await Promise.all([realpath(root), realpath(resolve(root, ...parts))]);
        if (!isInside(realRoot, file) || !(await stat(file)).isFile()) return res.sendStatus(404);
      } catch {
        return res.sendStatus(404);
      }
      serve(req, res, next);
    })().catch(next);
  };
}

// Shared with HTTP regression tests so bootstrap and tests use identical wiring.
export async function registerPublicUploads(app: { use(path: string, handler: express.RequestHandler): unknown }, config: Record<string, unknown> = process.env) {
  await validateDocumentStoragePaths(config);
  const root = publicUploadsRoot(config);
  // Never mount the shared/legacy parent. Only these dedicated public trees are served.
  app.use("/uploads/profile-photos", confinedStatic(join(root, "profile-photos")));
  app.use("/uploads", confinedStatic(publicAssetRoots(config)[1]));
}
