/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure the outreach PDFs in /docs are bundled with the send route.
    outputFileTracingIncludes: {
      "/api/internal/outreach/send": ["./docs/**"]
    }
  }
};

export default nextConfig;
