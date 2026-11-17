/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { from: '#5b6db4', to: '#7b649b', DEFAULT: '#5b6db4', soft: '#e9ecf6' },
        surface: '#f2f4f5',
        ink: { DEFAULT: '#1e1b3a', muted: '#6b6b86' },
        line: '#e6e6f0',
        success: '#2fb36d',
        warning: '#f2a33a',
        danger: '#e5484d',
      },
      borderRadius: { '2xl': '16px', '3xl': '20px' },
    },
  },
  plugins: [],
};
