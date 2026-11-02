import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, "..", ".."),
  distDir: process.env.PORISROM_NEXT_DEV_DIST_DIR ?? ".next",
  turbopack: {
    // Monorepo: the pnpm lockfile lives at the workspace root, not here, so
    // Turbopack's own root inference needs an explicit override.
    root: path.resolve(__dirname, "..", ".."),
  },
};

export default nextConfig;
