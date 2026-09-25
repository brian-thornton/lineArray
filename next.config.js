/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle (.next/standalone) used by the Docker image.
  output: 'standalone',
  eslint: {
    // The codebase has pre-existing lint errors; `npm run lint` still reports
    // them, but they shouldn't block production builds.
    ignoreDuringBuilds: true,
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
