/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { formats: ['image/avif'] },
  experimental: { optimizePackageImports: ['three', 'gsap'] },
  async redirects() {
    return [{ source: '/', destination: '/ar', permanent: false }];
  },
};
export default nextConfig;
