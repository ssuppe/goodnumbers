module.exports = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  compiler: { styledComponents: true },
  rewrites: async () => {
    return [
      {
        source: "/api/py/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8000/api/py/:path*"
            : "/api/",
      }
    ]
  },
};
