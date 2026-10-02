import { Sun, Moon, Desktop } from '@phosphor-icons/react';
import { setThemePref, useTheme } from '../../lib/theme';
import type { ThemePref } from '../../lib/theme';

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Açık tema', icon: Sun },
  { value: 'dark', label: 'Koyu tema', icon: Moon },
  { value: 'system', label: 'Sistem ayarını izle', icon: Desktop },
];

/**
 * Oturum açmadan da tema seçilebilsin: açık / koyu / sistem. Tercih cihaza kaydedilir, uygulamanın içindeki ayarla aynıdır.
 * tone="onAccent": mavi zemin üstünde (giriş ekranı); koyu temada zemin griye döndüğü için normal görünüme geçer.
 */
export default function ThemeSwitch({ className = '', tone = 'default' }: { className?: string; tone?: 'default' | 'onAccent' }) {
  const on = tone === 'onAccent';
  const [pref] = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className={`inline-flex items-center gap-0.5 p-0.5 rounded-xl ${on ? 'bg-white/10 border border-white/20 dark:bg-theme-lightest dark:border-theme-light' : 'bg-theme-lightest border border-theme-light'} ${className}`}>
      {OPTIONS.map(o => {
        const active = pref === o.value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={active} aria-label={o.label} title={o.label}
            onClick={() => setThemePref(o.value)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              active
                ? on ? 'bg-white text-accent dark:bg-surface dark:text-theme-text' : 'bg-surface text-theme-text shadow-[0_0_0_1px_rgb(var(--light))]'
                : on ? 'text-white/75 hover:text-white dark:text-theme-muted dark:hover:text-theme-text' : 'text-theme-muted hover:text-theme-text'
            }`}>
            <o.icon size={15} weight={active ? 'fill' : 'regular'} />
          </button>
        );
      })}
    </div>
  );
}
