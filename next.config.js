/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push({
      'fs-extra': 'commonjs fs-extra',
      'music-metadata': 'commonjs music-metadata',
    })
    return config
  },
}

module.exports = nextConfig 