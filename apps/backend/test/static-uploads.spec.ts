import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { publicAssetRoots } from "../src/document-storage";
import { publicUploadsRoot } from "../src/static-uploads";

describe("static upload boundaries", () => {
  it("registers only dedicated public trees, never the shared uploads parent", () => {
    const parent = publicUploadsRoot({});
    expect(publicAssetRoots({})).toEqual([join(parent, "profile-photos"), join(parent, "public")]);
    expect(publicAssetRoots({})).not.toContain(parent);
  });

  it("keeps a public uploads root for non-KYC public assets", () => {
    expect(publicUploadsRoot()).toMatch(/uploads$/);
  });
});
