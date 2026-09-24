import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "export",
  trailingSlash: true,
  basePath,
  allowedDevOrigins: ["sage-imac.local"],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
