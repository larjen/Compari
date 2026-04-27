/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Increase proxy timeout to 5 minutes (300000ms) for long-running local AI tasks
    proxyTimeout: 300000,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;