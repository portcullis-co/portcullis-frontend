/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['img.logo.dev', 'img.clerk.com', 'cdn.brandfetch.io', 'cdn.worldvectorlogo.com', 'avatars.githubusercontent.com'],
  },
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@clickhouse/client",
      "@google-cloud/bigquery",
      "snowflake-sdk",
      "stream",
      "http",
      "path"
    ],
  },
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        http: false,
        https: false,
        path: false,
        crypto: require.resolve('crypto-browserify'),
        zlib: require.resolve('browserify-zlib'),
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/_inngest/:path*',
        destination: 'http://localhost:8288/:path*',
      },
    ];
  },
};

module.exports = nextConfig;