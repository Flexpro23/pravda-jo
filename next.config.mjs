/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { formats: ['image/avif'] },
  experimental: { optimizePackageImports: ['three', 'gsap'] },
  webpack(config) {
    // ThreeUI internally imports three128 / three165. The API surface its
    // shader components touch — Scene, OrthographicCamera, PlaneGeometry,
    // ShaderMaterial, Mesh, Vector2, WebGLRenderer — is unchanged in r172, so
    // we collapse all three onto the single installed copy. Verified rendering
    // identical with and without this alias.
    config.resolve.alias = { ...config.resolve.alias, three128: 'three', three165: 'three' };
    return config;
  },
  async redirects() {
    return [{ source: '/', destination: '/ar', permanent: false }];
  },
};
export default nextConfig;
