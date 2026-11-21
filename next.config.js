/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle (.next/standalone) used by the Docker image.
  output: 'standalone',
  experimental: {
    // instrumentation.ts: warms the library cache when the server starts
    instrumentationHook: true,
  },
  eslint: {
    // The codebase has pre-existing lint errors; `npm run lint` still reports
    // them, but they shouldn't block production builds.
    ignoreDuringBuilds: true,
  },
  // The Recent page was folded into search ("Recently played"); keep old links working
  async redirects() {
    return [{ source: '/recent', destination: '/', permanent: false }]
  },
  webpack: (config) => {
    config.externals.push({
      'fs-extra': 'commonjs fs-extra',
      'music-metadata': 'commonjs music-metadata',
    })
    return config
  },
}

module.exports = nextConfig
