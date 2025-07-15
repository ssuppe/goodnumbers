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
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              media-src 'self' https://storage.googleapis.com;
              connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://api.clerk.dev https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com;
              img-src 'self' data: blob:;
              script-src 'self' 'unsafe-eval' 'unsafe-inline';
              style-src 'self' 'unsafe-inline';
              font-src 'self';
            `.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
