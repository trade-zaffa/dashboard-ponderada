/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1e3a5f',
        accent: '#0ea5e9',
      }
    }
  },
  plugins: []
}
