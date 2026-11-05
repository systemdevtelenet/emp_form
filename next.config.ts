import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@supabase/supabase-js"],
  async redirects() {
    // Bookmarks to the former /login route now land on the sign-in page at /.
    return [
      {
        source: "/login",
        destination: "/",
        permanent: false,
      },
    ];
  },
  /* config options here */
  experimental: {
    agentUpgrade: "security",
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
