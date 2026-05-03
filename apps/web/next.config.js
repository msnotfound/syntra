/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@syntra/ui', '@syntra/shared', '@syntra/db', '@syntra/llm'],
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'mongodb-memory-server'],
  },
};

module.exports = nextConfig;
