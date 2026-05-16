import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack doesn't traverse
  // stray lockfiles in parent directories (which can blow up memory).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
