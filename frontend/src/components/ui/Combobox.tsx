import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CaretDown, Check, MagnifyingGlass, X } from '@phosphor-icons/react';
import { trLower } from '../../lib/format';

export interface ComboOption {
  value: string;
  label: string;
  /** ikinci satır (ör. unvan) */
  hint?: string;
  /** solda gösterilecek öğe (avatar, ikon) */
  leading?: ReactNode;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  /** erişilebilir ad, ör. "Kişi" */
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  /** açılır panelin genişliği */
  width?: number;
  /** Tablo hücresi gibi sık yerlerde çerçevesiz tetikleyici (yalnızca üzerine gelince belirir) */
  bare?: boolean;
}

/** Türkçe karakterleri sadeleştirir: "şen" ile "Şen", "sen" de eşleşsin. */
const fold = (s: string) => trLower(s).replace(/[çğıöşü]/g, ch => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[ch] ?? ch);

/**
 * Tema uyumlu, aranabilir seçim kutusu (yerel <select> yerine). Açılınca üstte arama alanı odaklanır; yazdıkça liste süzülür,
 * ↑/↓ ile gezilir, Enter seçer, Esc kapatır. Panel tetikleyicinin altına (yer yoksa üstüne) portal ile açılır.
 */
export default function Combobox({ value, onChange, options, label, placeholder = 'Seçin', searchPlaceholder = 'Ara…', emptyText = 'Eşleşen sonuç yok', className = '', width = 300, bare = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return options;
    // Başında eşleşenler önce, sonra içinde geçenler
    const starts = options.filter(o => fold(o.label).startsWith(q) || fold(o.label).split(' ').some(w => w.startsWith(q)));
    const rest = options.filter(o => !starts.includes(o) && fold(`${o.label} ${o.hint ?? ''}`).includes(q));
    return [...starts, ...rest];
  }, [options, query]);

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const up = window.innerHeight - r.bottom < 340 && r.top > window.innerHeight - r.bottom;
    setPos(up ? { left, bottom: window.innerHeight - r.top + 6, up } : { left, top: r.bottom + 6, up });
  };

  const openPanel = () => {
    place();
    setQuery('');
    setActive(Math.max(0, options.findIndex(o => o.value === value)));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (o: ComboOption) => {
    onChange(o.value);
    close();
  };

  useLayoutEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    const onScroll = (e: Event) => { if (!panelRef.current?.contains(e.target as Node)) close(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(filtered.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) pick(filtered[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openPanel(); } }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        className={`${bare
          ? 'flex items-center gap-2 text-left cursor-pointer rounded-lg px-2 py-1 text-sm border border-transparent hover:border-theme-light hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-medium'
          : 'input-sm flex items-center gap-2 text-left cursor-pointer'} ${open ? 'ring-4 ring-theme-medium/15 border-theme-medium' : ''} ${className}`}
      >
        {selected?.leading && <span className="shrink-0 flex">{selected.leading}</span>}
        <span className={`flex-1 min-w-0 truncate ${selected ? '' : 'text-theme-muted'}`}>{selected?.label ?? placeholder}</span>
        <CaretDown size={14} weight="bold" className={`shrink-0 text-theme-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.98, transition: { duration: 0.12 } }}
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width, transformOrigin: pos.up ? 'bottom' : 'top' }}
              className="fixed z-[150] bg-surface rounded-xl shadow-float border border-theme-light overflow-hidden flex flex-col"
              onKeyDown={onKey}
            >
              <div className="p-2 border-b border-theme-light/50">
                <div className="relative">
                  <MagnifyingGlass size={15} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    role="combobox"
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                    aria-label={`${label} ara`}
                    className="w-full pl-9 pr-8 py-2 rounded-lg bg-theme-lightest border border-transparent text-sm font-medium text-theme-text placeholder:text-theme-muted focus:outline-none focus:bg-surface focus:border-theme-light"
                  />
                  {query && (
                    <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-theme-muted hover:text-theme-text" aria-label="Aramayı temizle">
                      <X size={13} weight="bold" />
                    </button>
                  )}
                </div>
              </div>
              <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="max-h-[17.5rem] overflow-y-auto scrollbar-thin p-1.5">
                {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-theme-muted font-medium">{emptyText}</li>}
                {filtered.map((o, i) => {
                  const isSel = o.value === value;
                  return (
                    <li
                      key={o.value}
                      id={`${listId}-${i}`}
                      data-i={i}
                      role="option"
                      aria-selected={isSel}
                      onMouseMove={() => setActive(i)}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => pick(o)}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${i === active ? 'bg-theme-lightest' : ''} ${isSel ? 'font-medium text-theme-deep' : 'font-medium text-theme-text'}`}
                    >
                      {o.leading && <span className="shrink-0 flex">{o.leading}</span>}
                      <span className="flex-1 min-w-0">
                        <Highlight text={o.label} query={query} />
                        {o.hint && <span className="block text-xs text-theme-muted font-medium truncate">{o.hint}</span>}
                      </span>
                      {isSel && <Check size={15} weight="bold" className="shrink-0 text-theme-deep" aria-hidden="true" />}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/** Aranan parçayı kalın gösterir (Türkçe karakter farkını yok sayarak). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  const i = q ? fold(text).indexOf(q) : -1;
  if (i < 0) return <span className="block truncate">{text}</span>;
  return (
    <span className="block truncate">
      {text.slice(0, i)}<mark className="bg-theme-medium/20 text-theme-text rounded px-0.5">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}
    </span>
  );
}
