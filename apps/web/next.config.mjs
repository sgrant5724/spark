/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@spark/shared", "@spark/db"],
};

export default nextConfig;
