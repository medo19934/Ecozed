/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { from: '#6366f1', to: '#7c3aed', DEFAULT: '#5b5bd6' },
        surface: '#f6f6fb',
        ink: { DEFAULT: '#1e1b3a', muted: '#6b6b86' },
        line: '#e6e6f0',
        success: '#16a34a',
        danger: '#e11d48',
      },
      borderRadius: { '2xl': '20px', '3xl': '28px' },
    },
  },
  plugins: [],
};
