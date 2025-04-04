const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  compiler: { styledComponents: true },
  productionBrowserSourceMaps: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  webpack: (config, { isServer }) => {
    // Add the source directories to module resolution paths
    config.resolve.modules.unshift(path.resolve(__dirname, 'src'), path.resolve(__dirname, 'src/oref0-autotune/lib'));

    // Enable more flexible module resolution for mixed CommonJS/ESM code
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    };

    // Help with node module resolution for CommonJS modules
    if (isServer) {
      config.externals = ['../meal/history', ...config.externals];
    }

    return config;
  },
};

module.exports = nextConfig;
