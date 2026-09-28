/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f4f7fa',
          100: '#e8eef4',
          200: '#d3dee8',
          300: '#a9bccf',
          400: '#7492ac',
          500: '#4a6b8a',
          600: '#2f5175',
          700: '#1d3a5c',
          800: '#122741',
          900: '#0b1526',
          950: '#060d18',
        },
        teal: {
          accent: '#0d9488',
          soft: '#e6f5f4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,21,38,0.05), 0 8px 24px -12px rgba(11,21,38,0.12)',
        pop: '0 2px 6px rgba(11,21,38,0.08), 0 16px 40px -16px rgba(11,21,38,0.25)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        dash: {
          to: { 'stroke-dashoffset': '0' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        dash: 'dash 1.2s ease-out both',
      },
    },
  },
  plugins: [],
}
