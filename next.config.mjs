/** @type {import('next').NextConfig} */
const nextConfig = {
  // Defaults to .next, which is what App Hosting resolves and what `npm run
  // build` produces. `npm run build:local` sets NEXT_DIST_DIR so a production
  // build on a developer's machine cannot clobber the running dev server's
  // module graph, which otherwise starts throwing "Cannot find module './NNN.js'".
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
