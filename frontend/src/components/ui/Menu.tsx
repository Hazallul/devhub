import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Icon } from '@phosphor-icons/react';
import { popover } from '../../lib/motion';

/*
 * Body'ye portal ile açılan menü: kart/konteyner z-index ve overflow çakışmalarından etkilenmez.
 * Konum: bir tetikleyici elemanın altı (anchor) veya fare koordinatı (sağ tık).
 */

export interface MenuPoint { x: number; y: number }

interface MenuProps {
  open: boolean;
  onClose: () => void;
  anchor?: HTMLElement | null;
  point?: MenuPoint | null;
  align?: 'start' | 'end';
  children: ReactNode;
  width?: number;
  label?: string;
}

export function Menu({ open, onClose, anchor, point, align = 'end', children, width = 220, label }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const h = ref.current?.offsetHeight ?? 200;
      let top: number;
      let left: number;
      if (point) {
        top = point.y;
        left = point.x;
      } else if (anchor) {
        const r = anchor.getBoundingClientRect();
        top = r.bottom + 8;
        left = align === 'end' ? r.right - width : r.left;
        if (top + h > window.innerHeight - 12) top = r.top - h - 8;
      } else return;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      top = Math.max(12, Math.min(top, window.innerHeight - h - 12));
      setPos({ top, left });
    };
    place();
    const raf = requestAnimationFrame(() => {
      place();
      // İçerik değişince (ör. alt menüye geçiş) menü ekranın dışına taşmasın.
      if (ref.current) observer.observe(ref.current);
    });
    const observer = new ResizeObserver(place);
    window.addEventListener('resize', place);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener('resize', place); };
  }, [open, anchor, point, align, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); anchor?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
        if (!items.length) return;
        e.preventDefault();
        const idx = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    const onScroll = () => onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    document.getElementById('main-scroll-container')?.addEventListener('scroll', onScroll, { passive: true });
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 20);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      document.getElementById('main-scroll-container')?.removeEventListener('scroll', onScroll);
    };
  }, [open, onClose, anchor]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          aria-label={label}
          variants={popover}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, transformOrigin: 'top' }}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
          className="fixed z-[150] bg-surface rounded-xl shadow-float border border-theme-light p-1"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface MenuItemProps {
  icon?: Icon;
  children: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  active?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
}

export function MenuItem({ icon: IconCmp, children, onSelect, tone = 'default', active, trailing, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={e => { e.stopPropagation(); onSelect(); }}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-lg text-left transition-colors outline-none disabled:opacity-40 ${
        tone === 'danger'
          ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft'
          : active
            ? 'bg-theme-lightest text-theme-deep font-semibold'
            : 'text-theme-text font-medium hover:bg-theme-lightest/70 focus-visible:bg-theme-lightest/70'
      }`}
    >
      {IconCmp && <IconCmp size={16} weight={active ? 'fill' : 'regular'} className="shrink-0" />}
      <span className="flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="eyebrow px-2.5 pt-1.5 pb-1">{children}</p>;
}

export function MenuDivider() {
  return <div className="h-px bg-theme-light my-1 -mx-1" />;
}
