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
      'encoding': 'encoding',
      'lz4': 'lz4'
    }];

    // Add fallbacks for non-server environment
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        crypto: false,
        'lz4': false,
        'xxhash': false
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

    // Ignore native modules
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    // Add rule to ignore problematic modules
    config.module.rules.push({
      test: /\.(node|lz4|xxhash)$/,
      use: 'null-loader',
      resource: {
        not: [/node_modules/]
      }
    });

    return config;
  },
};

module.exports = nextConfig;