import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, "..", ".."),
  distDir: process.env.PORISROM_NEXT_DEV_DIST_DIR ?? ".next",
  experimental: {
    serverActions: {
      // Onboarding uploads selected files through Server Actions before
      // proxying them to the backend; five allowed 1 MB PDFs need multipart headroom.
      bodySizeLimit: "8mb",
    },
  },
  turbopack: {
    // Monorepo: the pnpm lockfile lives at the workspace root, not here, so
    // Turbopack's own root inference needs an explicit override.
    root: path.resolve(__dirname, "..", ".."),
  },
};

export default nextConfig;
