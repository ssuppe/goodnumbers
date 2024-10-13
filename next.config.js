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
  compiler: { styledComponents: true },
  rewrites: async () => {
    return [
      {
        source: "/pyapi/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8000/pyapi/:path*"
            : "/api/py/:path*",
      },
      // Add this new rule for your Next.js API routes
      {
        source: "/api/:path*",
        destination: "/api/:path*",
      }
    ]
  },
};
