/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@syntra/ui', '@syntra/shared', '@syntra/db', '@syntra/llm'],
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'mongodb-memory-server'],
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

module.exports = nextConfig;
