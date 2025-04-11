/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // reactStrictMode: true, // Example: Add options here if needed
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.devtool = 'eval-source-map';
    }
    return config;
  },
};

module.exports = nextConfig;
