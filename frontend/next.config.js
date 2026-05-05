/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // O cache em disco do webpack corrompre no WSL com filesystem NTFS (/mnt/c/).
    // Em dev, usamos cache apenas em memória para evitar race conditions.
    if (dev) {
      config.cache = { type: 'memory' }
    }
    return config
  },
}

module.exports = nextConfig
