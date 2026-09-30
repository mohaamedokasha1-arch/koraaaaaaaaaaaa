import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // KoraScore navy design system
        navy: {
          950: '#070d1a',
          900: '#0b1424',
          850: '#0e1a30',
          800: '#12213c',
          700: '#1a2f52',
          600: '#23406e',
          500: '#2f5391',
          400: '#4f78b8',
          300: '#7ba1d4',
          200: '#aec6e8',
          100: '#d7e4f5',
        },
        live: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
        pitch: '#22c55e',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Kufi Arabic',
          'Noto Sans Arabic',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.35)',
        lift: '0 6px 18px rgba(0,0,0,0.35)',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        pulseDot: 'pulseDot 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
