import type { NextConfig } from "next";
import { webpack } from "next/dist/compiled/webpack/webpack";

const nextConfig: NextConfig = {
  /* config options here */

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  webpack: (config, { isServer }) => {
    // Ensure environment variables are always available
    config.plugins.push(
      new webpack.DefinePlugin({
        "process.env.JWT_SECRET": JSON.stringify(process.env.JWT_SECRET),
        "process.env.DATABASE_URL": JSON.stringify(process.env.DATABASE_URL),
      })
    );
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        "prisma",
        "@prisma/client",
      ];
    }
    return config;
  },
};

export default nextConfig;
