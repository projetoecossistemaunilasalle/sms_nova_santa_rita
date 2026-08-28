import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["pino"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/entrar",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
