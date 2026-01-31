import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Bare Naked Pet Co. Brand Colors
        brand: {
          50: '#fdfaf5',
          100: '#fbf5eb',
          200: '#f7eed9',
          300: '#f0e3c4',
          400: '#EFE6CB', // Light cream - secondary
          500: '#e5d9b5',
          600: '#d4c99c',
          700: '#c4b984',
          800: '#a89a6b',
          900: '#8a7d57',
          950: '#6e6346',
        },
        bark: {
          50: '#faf6f2',
          100: '#f5ebe2',
          200: '#e8d5c5',
          300: '#d9bba3',
          400: '#c49b7a',
          500: '#3F1D0B', // PRIMARY - Dark brown
          600: '#381a0a',
          700: '#301609',
          800: '#281307',
          900: '#200f06',
          950: '#180c04',
        },
        cream: {
          50: '#fdfcf9',
          100: '#F7F1E0', // Card backgrounds
          200: '#EFE6CB', // Page background
          300: '#e5d9b5',
          400: '#d9c99c',
          500: '#ccb983',
          600: '#b9a36c',
          700: '#a58d58',
          800: '#8a7549',
          900: '#705f3c',
          950: '#524530',
        },
        bone: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#888888',
          600: '#666666',
          700: '#444444',
          800: '#2d2d2d',
          900: '#1a1a1a',
          950: '#0a0a0a',
        },
      },
      fontFamily: {
        display: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
export default config
