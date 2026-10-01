import { useSyncExternalStore } from 'react';

/**
 * Sunucudan anlık olaylar (GET /api/events, Server-Sent Events). EventSource Authorization başlığı gönderemediği için
 * akış fetch ile okunur. Bağlantı koparsa artan aralıklarla (1 sn → 30 sn) yeniden bağlanılır.
 * Bağlıyken ekranlar düzenli sorgulama yapmaz (bkz. livePoll); bağlantı yoksa eski 20–30 sn'lik yoklamaya döner.
 */

export type RealtimeStatus = 'connecting' | 'live' | 'offline';
export type RealtimeEvent =
  | { type: 'invalidate'; keys: string[] }
  | { type: 'notification'; data: unknown }
  | { type: 'ready' };

/** Bu sekmenin kimliği: kendi yaptığı değişikliğin duyurusu ona geri gönderilmez (X-Client-Id). */
export const CLIENT_ID = (() => {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
})();

const API = 'http://localhost:8081/api';

let status: RealtimeStatus = 'connecting';
const listeners = new Set<() => void>();
const setStatus = (s: RealtimeStatus) => {
  if (s === status) return;
  status = s;
  listeners.forEach(l => l());
};

export const isLive = () => status === 'live';
export const useRealtimeStatus = () =>
  useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => status);
export const onRealtimeStatus = (cb: (s: RealtimeStatus) => void) => {
  const l = () => cb(status);
  listeners.add(l);
  return () => { listeners.delete(l); };
};

/** refetchInterval için: canlı bağlantı varken yoklama yok, yoksa verilen aralıkla. */
export const livePoll = (ms: number) => () => (isLive() ? false : ms);

/** Akışı açar; dönen fonksiyon kapatır. onEvent her olayda çağrılır. */
export function connectRealtime(onEvent: (e: RealtimeEvent) => void): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retry = 0;
  let timer: number | undefined;

  const schedule = () => {
    if (stopped) return;
    const delay = Math.min(30_000, 1000 * 2 ** retry) + Math.random() * 500;
    retry++;
    timer = window.setTimeout(run, delay);
  };

  const run = async () => {
    const token = localStorage.getItem('token');
    if (stopped || !token) return;
    controller = new AbortController();
    try {
      const res = await fetch(`${API}/events?client=${CLIENT_ID}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (res.status === 401) { setStatus('offline'); stopped = true; return; } // oturum bitti: axios yakalayıp girişe yönlendirir
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let cut: number;
        while ((cut = buffer.search(/\r?\n\r?\n/)) >= 0) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut).replace(/^\r?\n\r?\n/, '');
          const evt = parse(block);
          if (!evt) continue;
          if (evt.type === 'ready') { retry = 0; setStatus('live'); }
          onEvent(evt);
        }
      }
      throw new Error('akış kapandı');
    } catch {
      if (stopped) return;
      setStatus('offline');
      schedule();
    }
  };

  const onOnline = () => { if (!stopped && status === 'offline') { window.clearTimeout(timer); retry = 0; controller?.abort(); run(); } };
  window.addEventListener('online', onOnline);
  setStatus('connecting');
  run();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    window.removeEventListener('online', onOnline);
    controller?.abort();
    setStatus('connecting');
  };
}

function parse(block: string): RealtimeEvent | null {
  let name = 'message';
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith(':')) continue; // yorum (sunucunun "ping"i)
    if (line.startsWith('event:')) name = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (!data.length) return null;
  try {
    const body = JSON.parse(data.join('\n'));
    if (name === 'invalidate') return { type: 'invalidate', keys: Array.isArray(body.keys) ? body.keys : [] };
    if (name === 'notification') return { type: 'notification', data: body };
    if (name === 'ready') return { type: 'ready' };
  } catch { /* bozuk olay yok sayılır */ }
  return null;
}
