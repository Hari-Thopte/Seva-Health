/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  // Expose SESSION_SECRET to the Edge runtime (proxy.js).
  // This does NOT make it available to the browser — Edge runtime vars
  // are only readable server-side in proxy/middleware code.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/env
  env: {
    SESSION_SECRET: process.env.SESSION_SECRET,
  },
};

export default nextConfig;
