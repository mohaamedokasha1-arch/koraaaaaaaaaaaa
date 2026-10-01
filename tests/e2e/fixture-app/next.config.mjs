import { fileURLToPath } from 'node:url';
import mainConfig from '../../../next.config.mjs';

// This is an isolated test application, not a route or switch in production.
const fixtureConfig = {
  ...mainConfig,
  turbopack: {
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    resolveAlias: { 'hls.js': './hls-mock.ts' },
  },
};

export default fixtureConfig;
