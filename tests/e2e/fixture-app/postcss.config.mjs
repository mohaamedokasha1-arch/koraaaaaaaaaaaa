import base from '../../../tailwind.config.ts';
const config = {
  plugins: {
    tailwindcss: { config: { ...base, content: ['../../../src/**/*.{ts,tsx}', './app/**/*.tsx'] } },
    autoprefixer: {},
  },
};
export default config;
