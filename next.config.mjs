/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `npm run lint` runs separately (and in CI); a lint warning must never block a Vercel deploy.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
