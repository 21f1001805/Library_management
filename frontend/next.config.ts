import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The repo root (one level up) still has an npm lockfile for its own root-level
  // devDependencies (Playwright) — pin Turbopack's root to this package explicitly so it
  // doesn't guess wrong from that sibling lockfile.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
