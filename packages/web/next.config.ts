import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@glop/db", "@glop/shared"],
};

export default nextConfig;
