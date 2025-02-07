const defaultTheme = require('tailwindcss/defaultTheme');
const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx,md,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      animation: {
        spin: 'spin 1s linear infinite'
      },
      keyframes: {
        spin: {
          '0%': {
            transform: 'rotate(0deg)'
          },
          '100%': {
            transform: 'rotate(360deg)'
          }
        }
      },
      colors: {
        primary: colors.blue,
        secondary: colors.blue
      },
      fontFamily: {
        sans: [
          'var(--font-custom)',
          ...defaultTheme.fontFamily.sans
        ]
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [require('@tailwindcss/typography'), require("tailwindcss-animate")],
  darkMode: 'class'  // Remove duplicate
};