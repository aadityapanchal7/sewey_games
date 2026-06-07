/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pin the workspace root (a stray lockfile in the home dir confuses inference)
  outputFileTracingRoot: import.meta.dirname,
  async headers() {
    return [
      {
        // COOP allows OAuth popups (kept for when auth is added later).
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
