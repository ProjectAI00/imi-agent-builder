// Ensure Next.js treats this project directory as the tracing root
// to avoid it trying to infer a parent workspace. This silences the
// "inferred workspace root" warning you are seeing at runtime.
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
