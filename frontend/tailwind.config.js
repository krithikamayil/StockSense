/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          primary: '#087F5B',
          forest: '#145A43',
          sage: '#E8F3ED',
          light: '#F0F7F3',
          hover: '#066c4d',
        },
        surface: {
          bg: '#F7F9F8',
          card: '#FFFFFF',
          border: '#E5ECE8',
        },
        content: {
          primary: '#182923',
          secondary: '#718078',
          muted: '#9EABA4',
        },
        accent: {
          amber: '#D97706',
          amberBg: '#FEF3C7',
          rose: '#E11D48',
          roseBg: '#FFE4E6',
          blue: '#2563EB',
          blueBg: '#DBEAFE',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
