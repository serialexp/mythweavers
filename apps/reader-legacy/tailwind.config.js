import daisyui from 'daisyui'

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
    container: {
      padding: {
        DEFAULT: '1rem',
        sm: '4rem',
        lg: '6rem',
        xl: '10rem',
        '2xl': '14rem',
      },
      maxWidth: {},
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: ['fantasy', 'forest'],
  },
}
