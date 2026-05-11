/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export → served by nginx as flat files.
  output: 'export',

  // Each route becomes <route>/index.html (clean URLs behind nginx).
  trailingSlash: false,

  // No image optimizer in static export — use built-in <img> with width/height.
  images: { unoptimized: true },

  // Security: disable powered-by header.
  poweredByHeader: false,

  // Strict mode catches subtle React issues in dev.
  reactStrictMode: true,
};

export default nextConfig;
