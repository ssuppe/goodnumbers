/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,


  swcMinify: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'source.unsplash.com',
      },
    ],
  },
  compiler: {     styledComponents: true,   }
};
