import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CaretDown } from '@phosphor-icons/react';

/**
 * Katlanabilir grup başlığı (departman / proje). Liste kartının içinde, satırlarla aynı genişlikte durur; kaydırırken üstte kalır.
 * Sağdaki özet (ör. "3 gecikmiş · 42 sa açık iş") grup kapalıyken de görünür, böylece kapalı grup bile bilgi verir.
 */
export default function GroupHeader({ title, count, open, onToggle, summary, sticky = true }: {
  title: string; count: number; open: boolean; onToggle: () => void; summary?: ReactNode; sticky?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left bg-theme-lightest/80 hover:bg-theme-lightest border-b border-theme-light transition-colors ${sticky ? 'sticky top-0 z-[5] backdrop-blur-sm' : ''}`}
    >
      <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.15 }} className="flex text-theme-muted" aria-hidden="true">
        <CaretDown size={14} weight="bold" />
      </motion.span>
      <span className="text-sm font-semibold text-theme-text">{title}</span>
      <span className="text-xs text-theme-muted tabular">{count} kişi</span>
      {summary && <span className="ml-auto text-xs text-theme-muted flex flex-wrap items-center gap-x-3">{summary}</span>}
    </button>
  );
}
