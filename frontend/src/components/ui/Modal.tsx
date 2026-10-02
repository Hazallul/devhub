import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { modal } from '../../lib/motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Modal içeriği bir <form> ise burada verilir; başlık ve gövde form içinde kalır. */
  onSubmit?: (e: React.FormEvent) => void;
  footer?: ReactNode;
}

const WIDTH = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl', xl: 'max-w-4xl' };
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, description, children, size = 'md', onSubmit, footer }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // İlk alanı odakla; yoksa paneli.
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current;
      first?.focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open, onClose]);

  const body = (
    <>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-theme-light">
        <div>
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-theme-text">{title}</h2>
          {description && <p className="text-sm text-theme-muted mt-0.5 text-pretty">{description}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Kapat" className="icon-btn w-8 h-8 -mr-2 shrink-0">
          <X size={18} weight="bold" />
        </button>
      </div>
      <div className="px-6 py-5 overflow-y-auto scrollbar-thin flex-1">{children}</div>
      {footer && <div className="px-6 py-4 border-t border-theme-light bg-theme-lightest/40 rounded-b-3xl flex gap-2 justify-end">{footer}</div>}
    </>
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/40"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            variants={modal}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`relative w-full ${WIDTH[size]} bg-surface rounded-3xl shadow-float border border-theme-light max-h-[88vh] flex flex-col outline-none`}
          >
            {onSubmit ? <form onSubmit={onSubmit} className="flex flex-col min-h-0">{body}</form> : body}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
