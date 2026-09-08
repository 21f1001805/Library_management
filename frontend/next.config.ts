import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The repo root (one level up) still has an npm lockfile for its own root-level
  // devDependencies (Playwright) — pin Turbopack's root to this package explicitly so it
  // doesn't guess wrong from that sibling lockfile.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Mirrors backend/src/app/main.py's security-headers middleware, applied here instead
  // since these apply to every response (pages and /api Route Handlers alike) rather
  // than being auth-gating logic that belongs in proxy.ts.
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];
    // Only meaningful over HTTPS, and harmful if sent while still on plain HTTP in local
    // development — browsers would refuse http://localhost afterwards.
    if (process.env.APP_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
