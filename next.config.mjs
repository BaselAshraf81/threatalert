/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // TypeScript errors are build errors. Fix them; do not suppress them.
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Exclude Firebase functions from Next.js build
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'firebase-functions': 'commonjs firebase-functions',
        'firebase-admin': 'commonjs firebase-admin',
      });
    }
    return config;
  },
}

export default nextConfig
