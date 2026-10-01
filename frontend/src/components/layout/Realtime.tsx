import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X, WifiSlash } from '@phosphor-icons/react';
import { connectRealtime, onRealtimeStatus, useRealtimeStatus } from '../../lib/realtime';
import { useMarkNotificationRead, useUnreadCount } from '../../hooks/api';
import { TYPE_ICON } from './NotificationBell';
import type { AppNotification, NotificationType } from '../../types';

/** Bildirim türüne göre ayrıca tazelenecek ekranlar (sunucunun genel duyurusuna ek; ör. bana gönderilen kart). */
const EXTRA_KEYS: Partial<Record<string, string[]>> = {
  TASK: ['tasks'], TODO: ['todos'], LEAVE: ['leaves', 'users'], DOC: ['docs'], PROFILE: ['profile-requests', 'users'],
  PROJECT: ['projects', 'users'], STATUS: ['users'], ANNOUNCEMENT: ['announcements'], ONBOARDING: ['onboarding'],
};

const SHOW_MS = 7000;

/**
 * Anlık güncellemeler: sunucu akışını açar, gelen "şu değişti" duyurularıyla ilgili ekranları tazeler ve
 * yeni bildirimleri sağ üstte kısa bir kart olarak gösterir. AppLayout içinde bir kez bulunur.
 */
export default function Realtime() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const [notices, setNotices] = useState<AppNotification[]>([]);
  const pending = useRef(new Set<string>());
  const flushTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Duyurular kısa aralıklarla birikip tek seferde uygulanır (aynı anda birden çok değişiklik gelince tek tazeleme).
    const flush = () => {
      const keys = [...pending.current];
      pending.current.clear();
      keys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    };
    const queue = (keys: string[]) => {
      keys.forEach(k => pending.current.add(k));
      window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(flush, 250);
    };

    const stop = connectRealtime(evt => {
      if (evt.type === 'invalidate') queue(evt.keys);
      if (evt.type === 'notification') {
        const n = evt.data as AppNotification;
        queue(['notifications', ...(EXTRA_KEYS[n.type.split('_')[0]] ?? [])]);
        setNotices(list => [...list.filter(x => x.id !== n.id).slice(-2), n]);
      }
    });

    // Bağlantı kopup geri gelince arada kaçan değişiklikler için açık ekranlar bir kez tazelenir;
    // koptuğunda da tazelenir ki yedek yoklama (livePoll) yeniden kurulsun.
    let first = true;
    const off = onRealtimeStatus(s => {
      if (s === 'live' && first) { first = false; return; }
      if (s !== 'connecting') qc.invalidateQueries();
    });
    return () => { stop(); off(); window.clearTimeout(flushTimer.current); };
  }, [qc]);

  const dismiss = (id: number) => setNotices(list => list.filter(n => n.id !== id));
  const open = (n: AppNotification) => {
    dismiss(n.id);
    if (!n.read) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <>
      <TitleBadge />
      {createPortal(
        <div aria-live="polite" className="fixed top-20 right-4 sm:right-6 z-[190] flex flex-col gap-2 items-end pointer-events-none w-[min(380px,calc(100vw-2rem))]">
          <AnimatePresence initial={false}>
            {notices.map(n => <Notice key={n.id} n={n} onOpen={() => open(n)} onClose={() => dismiss(n.id)} />)}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </>
  );
}

function Notice({ n, onOpen, onClose }: { n: AppNotification; onOpen: () => void; onClose: () => void }) {
  const Icon = TYPE_ICON[n.type as NotificationType];
  const [hover, setHover] = useState(false);
  const left = useRef(SHOW_MS);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  // Üzerine gelinince süre durur, ayrılınca kalan süreden devam eder.
  useEffect(() => {
    if (hover) return;
    const started = Date.now();
    const t = window.setTimeout(() => closeRef.current(), left.current);
    return () => { window.clearTimeout(t); left.current -= Date.now() - started; };
  }, [hover]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 32, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role="status"
      className="pointer-events-auto w-full flex items-start gap-3 p-3 pr-2 rounded-2xl bg-surface border border-theme-light/70 shadow-float"
    >
      <button type="button" onClick={onOpen} className="flex items-start gap-3 min-w-0 flex-1 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-medium">
        <span className="w-9 h-9 rounded-xl bg-theme-lightest text-theme-deep flex items-center justify-center shrink-0">
          {Icon && <Icon size={18} weight="duotone" />}
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold leading-snug line-clamp-2">{n.title}</span>
          </span>
          {n.body && <span className="block text-[13px] text-theme-muted leading-snug mt-0.5 line-clamp-2">{n.body}</span>}
          <span className="block text-[11px] font-semibold text-theme-dark mt-1">Şimdi{n.link ? ' · açmak için tıklayın' : ''}</span>
        </span>
      </button>
      <button type="button" onClick={onClose} aria-label="Bildirimi kapat" className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-lightest shrink-0">
        <X size={14} weight="bold" />
      </button>
    </motion.div>
  );
}

/** Sekme başlığında okunmamış bildirim sayısı: "(2) DevHub". */
function TitleBadge() {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = count ? `(${count > 9 ? '9+' : count}) ${base}` : base;
  }, [count]);
  return null;
}

/** Üst barda: bağlantı birkaç saniyeden uzun koparsa görünür (bağlıyken hiçbir şey göstermez). */
export function LiveStatus() {
  const status = useRealtimeStatus();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (status !== 'offline') return;
    const t = window.setTimeout(() => setShow(true), 4000);
    return () => { window.clearTimeout(t); setShow(false); };
  }, [status]);

  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
          role="status"
          title="Sunucuyla anlık bağlantı koptu. Yeniden bağlanılıyor; bu arada veriler yarım dakikada bir tazelenir."
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warn-soft text-warn-ink border border-warn-line"
        >
          <WifiSlash size={14} weight="bold" /> Yeniden bağlanılıyor
        </motion.span>
      )}
    </AnimatePresence>
  );
}
