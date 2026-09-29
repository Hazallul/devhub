/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        theme: {
          lightest: "#F6F0D7",
          light: "#C5D89D",
          medium: "#9CAB84",
          dark: "#89986D",
          // Paletin koyu tonu: beyaz yazıyla 4.5:1 kontrast sağlar (butonlar, aktif metin)
          deep: "#5A6647",
          cream: "#FBF8EC",
          text: "#2C2638",
          muted: "#6B6577",
        }
      },
      boxShadow: {
        'diffusion': '0 20px 40px -15px rgba(0,0,0,0.05)',
        'soft': '0 8px 30px rgba(0,0,0,0.03)',
        'float': '0 10px 40px rgba(44,38,56,0.12)',
        'glow': '0 0 0 4px rgba(156,171,132,0.25), 0 0 24px rgba(156,171,132,0.45)',
      },
      borderRadius: {
        '4xl': '2.5rem',
      },
    },
  },
  plugins: [],
}
