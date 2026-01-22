/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.{html,js}", "./src/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: 'rgb(0, 102, 214)',
          nav: 'rgb(35, 38, 40)',
          dark: '#1a1a1a',
          red: 'rgb(0, 102, 214)',
          gray: '#f3f4f6',
          accent: '#3B82F6'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
