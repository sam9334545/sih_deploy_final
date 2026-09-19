/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        govNavyDark: '#002244',
        govNavy: '#003366',
        govNavyLight: '#004080',
        govBlueAccent: '#0B5FA5',
        govActiveNav: '#002a54',
        portalBg: '#F4F7FA',
        bannerBg: '#EAF3FA',
        bannerBorder: '#B4D5EE',
        tableHeader: '#0B4D7E',
        lightBorder: '#D6DEE7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
