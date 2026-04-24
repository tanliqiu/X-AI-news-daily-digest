import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/digests': ['./data/digests/**'],
  },
}

export default nextConfig
