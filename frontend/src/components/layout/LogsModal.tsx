import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MagnifyingGlass, ListDashes } from '@phosphor-icons/react';
import Modal from '../ui/Modal';
import { EmptyState, Segmented, Skeleton } from '../ui/primitives';
import { useLogs } from '../../hooks/api';
import { parseLog, trLower } from '../../lib/format';
import { LOG_TYPE } from '../../lib/meta';
import type { ActionLogType } from '../../types';

type Filter = 'ALL' | ActionLogType;

export default function LogsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: logs, isLoading } = useLogs(open);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  const parsed = useMemo(() => (logs ?? []).map(l => ({ ...parseLog(l), id: l.id, actor: l.actorName ?? 'Sistem' })), [logs]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: parsed.length, PROJE: 0, IZIN: 0, GOREV: 0, SISTEM: 0 };
    parsed.forEach(p => { c[p.type] += 1; });
    return c;
  }, [parsed]);

  const q = trLower(search.trim());
  const visible = parsed.filter(l => (filter === 'ALL' || l.type === filter) && (!q || trLower(`${l.text} ${l.actor}`).includes(q)));

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Sistem Logları" description="Proje atamaları, izinler, yeni görev ve projeler kaydedilir.">
      <div className="space-y-4 -mt-2">
        <div className="relative">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" size={18} aria-hidden="true" />
          <input
            type="search"
            data-autofocus
            aria-label="Loglarda ara"
            placeholder="Loglarda ara (örn: Ali, Mobil Uygulama…)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-11"
          />
        </div>
        <Segmented<Filter>
          label="Log türü"
          layoutId="log-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'Tümü', count: counts.ALL },
            { value: 'PROJE', label: 'Proje', count: counts.PROJE },
            { value: 'GOREV', label: 'Görev', count: counts.GOREV },
            { value: 'IZIN', label: 'İzin', count: counts.IZIN },
          ]}
        />

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
        ) : visible.length === 0 ? (
          <EmptyState icon={ListDashes} title="Log bulunamadı" description="Arama veya filtreyi değiştirmeyi deneyin." />
        ) : (
          <ol className="relative pl-6 space-y-3 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-theme-light">
            <AnimatePresence initial={false}>
              {visible.map((log, i) => {
                const meta = LOG_TYPE[log.type];
                return (
                  <motion.li
                    key={log.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    className="relative"
                  >
                    <span className={`absolute -left-6 top-3 w-6 h-6 rounded-lg flex items-center justify-center ring-4 ring-white ${meta.className}`}>
                      <meta.icon size={13} weight="bold" aria-hidden="true" />
                    </span>
                    <div className="ml-3 p-3.5 rounded-2xl bg-theme-cream/60 border border-theme-light/40">
                      <p className="text-sm font-medium text-theme-text leading-relaxed">{log.text}</p>
                      <p className="text-xs font-semibold text-theme-muted mt-1.5 flex items-center gap-2">
                        <span>{meta.label}</span>
                        {log.time && <><span aria-hidden="true">·</span><time>{log.time}</time></>}
                        <span aria-hidden="true">·</span>
                        <span className="text-theme-deep">{log.actor === 'Sistem' ? 'Sistem tarafından' : `${log.actor} tarafından`}</span>
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        )}
      </div>
    </Modal>
  );
}
