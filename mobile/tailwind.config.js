/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary:    '#F97316', // orange-500
        'primary-d':'#EA580C', // orange-600
        accent:     '#14B8A6', // teal-500
        surface:    '#141414',
        card:       '#1E1E1E',
        border:     '#2A2A2A',
      },
    },
  },
  plugins: [],
};
