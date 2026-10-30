import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker image small; Vercel ignores it and uses
  // its own build adapter.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
