import { useSyncExternalStore } from 'react';

/**
 * Açık / koyu tema. Tercih cihaza özeldir (localStorage "devhub.theme"); "system" işletim sisteminin ayarını izler.
 * İlk boyamadan önce index.html'deki küçük betik aynı kuralla html'e "dark" sınıfını ekler, sayfa beyaz parlamaz.
 */
export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'devhub.theme';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

let pref: ThemePref = read();

const isDark = (p: ThemePref) => p === 'dark' || (p === 'system' && !!media?.matches);

function apply() {
  const dark = isDark(pref);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#15170F' : '#FBF8EC');
}

media?.addEventListener('change', () => {
  if (pref === 'system') { apply(); listeners.forEach(l => l()); }
});
// Başka sekmede değişirse bu sekme de uysun.
window.addEventListener('storage', e => {
  if (e.key === KEY) { pref = read(); apply(); listeners.forEach(l => l()); }
});

export function setThemePref(next: ThemePref) {
  pref = next;
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch { /* gizli pencere: yalnızca bu oturumda geçerli */ }
  // Renk geçişi kısa bir yumuşatmayla (hareketi azaltmayı seçenlerde anında).
  const root = document.documentElement;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-fade');
    window.setTimeout(() => root.classList.remove('theme-fade'), 320);
  }
  apply();
  listeners.forEach(l => l());
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

/** [tercih, şu an koyu mu] */
export function useTheme(): [ThemePref, boolean] {
  const p = useSyncExternalStore(subscribe, () => pref);
  const dark = useSyncExternalStore(subscribe, () => isDark(pref));
  return [p, dark];
}
