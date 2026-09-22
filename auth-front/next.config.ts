import type { NextConfig } from "next";

// `standalone` is what the Dockerfile runs: a self-contained server with only
// the modules it needs. `next dev` ignores it.
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
