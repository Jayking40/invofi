import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
    }
    // Task 15: @invofi/sdk is consumed from source via tsconfig paths, so its
    // `@stellar/stellar-sdk` import must resolve to THIS app's copy (the SDK's
    // own node_modules isn't installed in CI). Pin it for webpack too.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@stellar/stellar-sdk': path.resolve(__dirname, 'node_modules/@stellar/stellar-sdk'),
    };
    return config;
  },
};

export default nextConfig;
