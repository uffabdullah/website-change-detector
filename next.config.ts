import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium", "pngjs", "pixelmatch"],
  poweredByHeader: false,
};

export default nextConfig;
