/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        seed: {
          primary: '#78350F', // Marron chaud — CTA, header
          'primary-light': '#A16207', // Marron doux — hover, variantes
          secondary: '#D4A574', // Beige sable — accents, badges
          bg: '#FAF7F2', // Blanc cassé — fond principal
          card: '#F5F0E8', // Beige pâle — fond carte
          text: '#292524', // Brun très foncé — texte principal
          muted: '#78716C', // Gris-brun — texte secondaire
          accent: '#D97706', // Ambre doré — souvenir, moments
          success: '#4D7C0F', // Vert olive — sync OK
          danger: '#B91C1C', // Rouge brique — stop, erreurs
          border: '#D4A574', // Bordure marron léger
        },
      },
      borderRadius: {
        'seed': '6px', // Esthétique bloc-notes carrée
      },
    },
  },
  plugins: [],
}


