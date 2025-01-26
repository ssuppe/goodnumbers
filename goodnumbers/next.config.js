module.exports = {
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
};

/** @type {import('next').NextConfig} */
