import { useSyncExternalStore } from 'react';

/**
 * Sunucudan anlık olaylar (GET /api/events, Server-Sent Events). EventSource Authorization başlığı gönderemediği için
 * akış fetch ile okunur. Bağlantı koparsa artan aralıklarla (1 sn → 30 sn) yeniden bağlanılır.
 * Bağlıyken ekranlar düzenli sorgulama yapmaz (bkz. livePoll); bağlantı yoksa eski 20–30 sn'lik yoklamaya döner.
 *
 * Tarayıcı aynı sunucuya en fazla 6 bağlantı açar; her sekme kendi akışını tutsaydı 6 sekmede (ya da geri tuşu
 * önbelleğinde bekleyen eski sayfalarla) diğer istekler sıraya girip asılı kalırdı. Bu yüzden:
 * - Sekmeler tek akışı paylaşır: Web Locks ile seçilen bir sekme akışı açar, olayları BroadcastChannel ile
 *   diğerlerine dağıtır; o sekme kapanınca kilit serbest kalır ve sıradaki sekme devralır.
 * - Sayfa önbelleğe girerken (pagehide) akış kapanır, geri dönünce (pageshow) yeniden açılır.
 */

export type RealtimeStatus = 'connecting' | 'live' | 'offline';
export type RealtimeEvent =
  | { type: 'invalidate'; keys: string[] }
  | { type: 'notification'; data: unknown }
  | { type: 'ready' };

const randomId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

/** Bu sekmenin kimliği: kendi yaptığı değişikliğin duyurusu ona geri gönderilmez (X-Client-Id). */
export const CLIENT_ID = randomId();
/**
 * Paylaşılan akışın kimliği. Sekme kimliğinden farklıdır: akış bütün sekmeler adına açıldığı için hiçbir sekmenin
 * değişikliği akıştan düşürülmez (değişikliği yapan sekme de fazladan bir yenileme alır, zararsız).
 */
const STREAM_ID = randomId();

const API = 'http://localhost:8081/api';
const LOCK = 'devhub-realtime';

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

type Message = { type: 'event'; event: RealtimeEvent } | { type: 'status'; status: RealtimeStatus } | { type: 'hello' };

/** Akışı açar (ya da açık olan paylaşılan akışa katılır); dönen fonksiyon kapatır. onEvent her olayda çağrılır. */
export function connectRealtime(onEvent: (e: RealtimeEvent) => void): () => void {
  let stopped = false;
  let leader = false;
  let session: (() => void) | null = null;
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(LOCK) : null;
  const canShare = !!channel && typeof navigator !== 'undefined' && !!navigator.locks;

  if (channel) {
    channel.onmessage = (m: MessageEvent<Message>) => {
      const msg = m.data;
      if (leader) {
        // Yeni açılan sekme durumu sorar.
        if (msg?.type === 'hello') channel.postMessage({ type: 'status', status } satisfies Message);
        return;
      }
      if (msg?.type === 'event') onEvent(msg.event);
      else if (msg?.type === 'status') setStatus(msg.status);
    };
  }

  const start = () => {
    if (stopped || session) return;
    setStatus('connecting');
    if (!canShare) {
      leader = true;
      const stop = openStream(onEvent, () => {});
      session = () => { stop(); session = null; leader = false; };
      return;
    }
    const lockAbort = new AbortController();
    let stopStream: (() => void) | null = null;
    let releaseLock = () => {};
    const held = new Promise<void>(resolve => { releaseLock = resolve; });
    channel!.postMessage({ type: 'hello' } satisfies Message);
    navigator.locks.request(LOCK, { signal: lockAbort.signal }, async () => {
      if (stopped) return;
      leader = true;
      stopStream = openStream(
        e => { onEvent(e); channel!.postMessage({ type: 'event', event: e } satisfies Message); },
        s => channel!.postMessage({ type: 'status', status: s } satisfies Message),
      );
      await held; // kilit bu sekme kapanana ya da sayfa önbelleğe girene kadar tutulur
    }).catch(() => { /* bekleme iptal edildi */ });
    session = () => {
      lockAbort.abort();
      stopStream?.();
      releaseLock();
      session = null;
      leader = false;
    };
  };

  const onPageHide = () => session?.();
  const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) start(); };
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  start();

  return () => {
    stopped = true;
    session?.();
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    channel?.close();
    setStatus('connecting');
  };
}

/** Tek bir SSE akışını açık tutar (koparsa yeniden bağlanır); dönen fonksiyon kapatır. */
function openStream(onEvent: (e: RealtimeEvent) => void, onStatus: (s: RealtimeStatus) => void): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retry = 0;
  let timer: number | undefined;
  const set = (s: RealtimeStatus) => { setStatus(s); onStatus(s); };

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
      const res = await fetch(`${API}/events?client=${STREAM_ID}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (res.status === 401) {
        // Token yenilendiyse (bu tarayıcıda şifre değişti) yenisiyle tekrar dene; değilse oturum kapandı (başka yerde şifre değişti,
        // hesap pasifleşti, süre doldu): giriş ekranına dön.
        if (localStorage.getItem('token') !== token) { schedule(); return; }
        set('offline');
        stopped = true;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') window.location.assign('/login');
        return;
      }
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
          if (evt.type === 'ready') { retry = 0; set('live'); }
          onEvent(evt);
        }
      }
      throw new Error('akış kapandı');
    } catch {
      if (stopped) return;
      set('offline');
      schedule();
    }
  };

  const onOnline = () => { if (!stopped && status === 'offline') { window.clearTimeout(timer); retry = 0; controller?.abort(); run(); } };
  window.addEventListener('online', onOnline);
  run();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    window.removeEventListener('online', onOnline);
    controller?.abort();
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
