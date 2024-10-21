/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['img.logo.dev', 'img.clerk.com', 'cdn.brandfetch.io', 'cdn.worldvectorlogo.com'],
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
        crypto: false,
      };
    }
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    config.module.rules.push({
      test: /\.html$/,
      use: ['html-loader'],
    });
    return config;
  },
};

module.exports = nextConfig;