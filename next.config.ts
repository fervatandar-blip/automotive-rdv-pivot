import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Garage verification documents (photos, PDFs) exceed the 1MB default.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
