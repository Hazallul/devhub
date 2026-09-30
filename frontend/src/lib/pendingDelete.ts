import { useSyncExternalStore } from 'react';

/*
 * "Geri al" süreli silme: kayıt ekrandan hemen kalkar ama sunucudan birkaç saniye sonra silinir.
 * Bu sürede kullanıcı bildirimdeki "Geri al"a basarsa hiçbir şey silinmez. Sekme kapanırsa da silinmez (güvenli taraf).
 * Anahtarlar "todo:12", "task:5" biçimindedir; listeyi getiren hook'lar bekleyen kayıtları süzer.
 */

let pending: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function set(next: Set<string>) {
  pending = next;
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Silinmek üzere bekleyen (ekranda gizlenen) kayıtların anahtarları */
export function usePendingDeletes() {
  return useSyncExternalStore(subscribe, () => pending);
}

export const UNDO_MS = 5000;

/**
 * run: sunucudaki gerçek silme; settled: silme bittikten (başarılı ya da hatalı) sonra verinin tazelenmesi.
 * Dönen işlev silmeyi iptal eder (süre dolmadıysa).
 */
export function scheduleDelete(key: string, run: () => Promise<unknown>, settled: (error?: unknown) => Promise<unknown> | void) {
  set(new Set(pending).add(key));
  const release = () => {
    const next = new Set(pending);
    next.delete(key);
    set(next);
  };
  const timer = setTimeout(async () => {
    let error: unknown;
    try { await run(); } catch (e) { error = e; }
    try { await settled(error); } finally { release(); }
  }, UNDO_MS);
  return () => { clearTimeout(timer); release(); };
}
