import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Monorepo: the pnpm lockfile lives at the workspace root, not here, so
    // Turbopack's own root inference needs an explicit override.
    root: path.resolve(__dirname, "..", ".."),
  },
};

export default nextConfig;
