import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Un seul domaine indexé : www renvoie définitivement vers le domaine principal
  // (évite deux versions du site en concurrence dans Google).
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.serrurerielouisfils.com" }],
        destination: "https://serrurerielouisfils.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
