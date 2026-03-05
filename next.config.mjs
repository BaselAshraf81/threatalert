/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // TypeScript errors are build errors. Fix them; do not suppress them.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
