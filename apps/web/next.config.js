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
    // aws4 is an optional MongoDB AWS auth dep — not needed, suppress the warning
    config.resolve.alias = { ...config.resolve.alias, aws4: false };
    return config;
  },
};

module.exports = nextConfig;
