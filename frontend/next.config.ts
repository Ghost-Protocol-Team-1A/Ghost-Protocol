import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production container (see Dockerfile).
  output: "standalone",
  experimental: {
    // Evidence uploads pass through a server action; match the API's MAX_UPLOAD_MB default.
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
