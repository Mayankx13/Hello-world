/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export — outputs to /out (we move to /docs after build for GitHub Pages)
  output: 'export',
  trailingSlash: true,
  images: {
    // Required for static export — disables next/image runtime optimization
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

module.exports = nextConfig;
