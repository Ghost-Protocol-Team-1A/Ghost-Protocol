import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production container (see Dockerfile).
  output: "standalone",
  experimental: {
    // Evidence uploads pass through a server action. The API's MAX_UPLOAD_MB is 50; the extra
    // room is for the multipart envelope, so a 50 MB file is refused by the API's clear message
    // rather than by a generic framework error.
    serverActions: { bodySizeLimit: "52mb" },
  },
};

export default nextConfig;
