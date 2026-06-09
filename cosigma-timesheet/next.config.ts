import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project; a parent lockfile exists in the
  // monorepo and would otherwise be inferred as the root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
