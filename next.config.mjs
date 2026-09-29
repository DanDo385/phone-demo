import path from "node:path";
import { fileURLToPath } from "node:url";
import { redirectMap } from "./redirects.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Self-contained server for the VPS (deploy/README.md).
  output: "standalone",
  outputFileTracingRoot: root,
  serverExternalPackages: ["pdf-lib"],
  async redirects() {
    return redirectMap.map(({ source, destination, permanent }) => ({ source, destination, permanent }));
  },
  webpack: (config) => {
    config.resolve.alias["@"] = root;
    return config;
  },
};

export default nextConfig;
