import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

/**
 * Pragmatic baseline: Next's Core Web Vitals rules (which include the React
 * hooks and accessibility essentials) over the app source and tests. The file
 * exists so `npm run lint` is a real gate in the Phase-8 chain
 * (typecheck → lint → tests → build) instead of being skipped.
 */
export default defineConfig([
  { ignores: ['.next/**', 'node_modules/**', 'public/sw.js'] },
  ...nextVitals,
  {
    rules: {
      // Entities/pages deliberately use plain <a> for OUTBOUND publisher links.
      '@next/next/no-html-link-for-pages': 'off',
      // Deliberate, reviewed patterns: closing the mobile menu when the route
      // changes, and resetting/closing over a debounce timer. Both are external
      // synchronisations (router state / timers), not derived state.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Server-side code (App Router pages and the service layer) runs per
    // request on the server, where reading the clock is exactly what it is
    // supposed to do (freshness windows, "is this match live now?").
    files: ['src/app/**/*.ts', 'src/app/**/*.tsx', 'src/lib/**/*.ts'],
    rules: { 'react-hooks/purity': 'off' },
  },
]);
