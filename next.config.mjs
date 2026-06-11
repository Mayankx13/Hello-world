/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Mux poster frames, if reels are later served from Mux.
      { protocol: "https", hostname: "image.mux.com" },
    ],
  },
};

export default nextConfig;
