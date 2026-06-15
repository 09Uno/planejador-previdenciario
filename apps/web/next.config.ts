import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mfaa/prev-engine', '@mfaa/doc-gen'],
};

export default nextConfig;
