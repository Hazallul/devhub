/** Renkler index.css'teki CSS değişkenlerinden gelir (":root" açık, "html.dark" koyu tema); "R G B" biçimi saydamlık (/40) desteği için. */
const v = name => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
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
          lightest: v('lightest'),
          light: v('light'),
          medium: v('medium'),
          dark: v('dark'),
          // Paletin koyu tonu: vurgulu metin (koyu temada açık zeytine döner). Buton zemini için "accent" kullanılır.
          deep: v('deep'),
          cream: v('cream'),
          text: v('text'),
          muted: v('muted'),
        },
        /** Kart/panel zemini (eski bg-white) */
        surface: v('surface'),
        /** Her iki temada da koyu kalan zemin: araç ipuçları, kod blokları, perde (backdrop), koyu bildirim */
        ink: v('ink'),
        /** Beyaz yazılı birincil buton zemini (4.5:1 kontrast her iki temada) */
        accent: v('accent'),
        danger: { DEFAULT: v('danger'), soft: v('danger-soft'), line: v('danger-line'), ink: v('danger-ink'), solid: v('danger-solid'), 'solid-hover': v('danger-solid-hover') },
        warn: { DEFAULT: v('warn'), soft: v('warn-soft'), line: v('warn-line'), ink: v('warn-ink') },
        clay: { DEFAULT: v('clay'), soft: v('clay-soft'), line: v('clay-line'), ink: v('clay-ink'), mid: v('clay-mid') },
        good: { DEFAULT: v('good'), soft: v('good-soft'), ink: v('good-ink') },
      },
      boxShadow: {
        'diffusion': '0 20px 40px -15px rgba(0,0,0,0.05)',
        'soft': '0 8px 30px rgba(0,0,0,0.03)',
        'float': '0 10px 40px rgb(var(--shadow) / 0.12)',
        'glow': '0 0 0 4px rgb(var(--medium) / 0.25), 0 0 24px rgb(var(--medium) / 0.45)',
      },
      borderRadius: {
        '4xl': '2.5rem',
      },
    },
  },
  plugins: [],
}
