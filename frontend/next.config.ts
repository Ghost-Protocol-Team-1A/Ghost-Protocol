import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Evidence uploads pass through a server action; match the API's MAX_UPLOAD_MB default.
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
