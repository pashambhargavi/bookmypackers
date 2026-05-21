/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for SSE streaming
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};

module.exports = nextConfig;
