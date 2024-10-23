/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['img.logo.dev', 'img.clerk.com', 'cdn.brandfetch.io', 'cdn.worldvectorlogo.com'],
  },
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Exclude node-gyp and other problematic native modules from webpack processing
    config.externals = [...(config.externals || []), {
      'node-gyp': 'node-gyp',
      'utf-8-validate': 'utf-8-validate',
      'bufferutil': 'bufferutil',
      'encoding': 'encoding'
    }];

    // Add fallbacks for non-server environment
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        crypto: false,
      };
    }

    // Add rules for special file types
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    config.module.rules.push({
      test: /\.html$/,
      use: ['html-loader'],
    });

    config.module.rules.push({
      test: /\.cs$/,
      loader: 'ignore-loader'
    });

    return config;
  },
};

module.exports = nextConfig;