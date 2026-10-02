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
        sans: ['"Geist Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      /* Ağırlıklar bir kademe hafif: kalın yazı başlık ve sayılar için, gövde 400/500 (Swiss sadeliği) */
      fontWeight: {
        medium: '500',
        semibold: '560',
        bold: '620',
        extrabold: '700',
      },
      colors: {
        theme: {
          lightest: v('lightest'),
          light: v('light'),
          medium: v('medium'),
          dark: v('dark'),
          // Vurgu metni (bağlantı, seçili menü); koyu temada açık maviye döner. Buton zemini için "accent" kullanılır.
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
        accent: { DEFAULT: v('accent'), hover: v('accent-hover') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft'), line: v('danger-line'), ink: v('danger-ink'), solid: v('danger-solid'), 'solid-hover': v('danger-solid-hover') },
        warn: { DEFAULT: v('warn'), soft: v('warn-soft'), line: v('warn-line'), ink: v('warn-ink') },
        clay: { DEFAULT: v('clay'), soft: v('clay-soft'), line: v('clay-line'), ink: v('clay-ink'), mid: v('clay-mid') },
        good: { DEFAULT: v('good'), soft: v('good-soft'), ink: v('good-ink') },
      },
      /* Gölge neredeyse yok: düz yüzeyde katmanı çizgi ayırır. float = açılır menü/pencere, glow = vurgulanan öğe. */
      boxShadow: {
        'diffusion': '0 1px 2px rgb(var(--shadow) / 0.05)',
        'soft': '0 1px 2px rgb(var(--shadow) / 0.04)',
        'float': '0 12px 32px -8px rgb(var(--shadow) / 0.18), 0 2px 6px rgb(var(--shadow) / 0.06)',
        'glow': '0 0 0 3px rgb(var(--medium) / 0.35)',
      },
      /* Tek köşe ölçeği (sıkı): xl düğme/alan, 2xl kart, 3xl pencere; 4xl eski büyük kartlar için aynı ölçekte kalır */
      borderRadius: {
        'lg': '0.375rem',
        'xl': '0.5rem',
        '2xl': '0.75rem',
        '3xl': '0.875rem',
        '4xl': '1rem',
      },
    },
  },
  plugins: [],
}
