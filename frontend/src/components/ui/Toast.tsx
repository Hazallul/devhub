import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, Warning, X } from '@phosphor-icons/react';

type Tone = 'success' | 'error';
interface ToastItem { id: number; tone: Tone; message: string }
interface ToastApi { success: (msg: string) => void; error: (msg: string) => void }

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems(list => list.filter(t => t.id !== id)), []);

  const push = useCallback((tone: Tone, message: string) => {
    const id = ++seq.current;
    setItems(list => [...list.slice(-3), { id, tone, message }]);
    // Skill: toast-dismiss 3–5 sn; hatalar biraz daha uzun kalır.
    setTimeout(() => dismiss(id), tone === 'error' ? 5000 : 3200);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: msg => push('success', msg),
    error: msg => push('error', msg),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div aria-live="polite" className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 items-end pointer-events-none">
          <AnimatePresence initial={false}>
            {items.map(t => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
                role={t.tone === 'error' ? 'alert' : 'status'}
                className={`pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-2xl shadow-float border max-w-sm ${
                  t.tone === 'error' ? 'bg-white border-[#E8C3AE] text-[#7A3E1F]' : 'bg-theme-text border-theme-text text-white'
                }`}
              >
                {t.tone === 'error'
                  ? <Warning size={20} weight="fill" className="shrink-0" />
                  : <CheckCircle size={20} weight="fill" className="shrink-0 text-theme-light" />}
                <span className="text-sm font-medium">{t.message}</span>
                <button onClick={() => dismiss(t.id)} aria-label="Bildirimi kapat" className="p-1.5 rounded-lg opacity-60 hover:opacity-100">
                  <X size={14} weight="bold" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast, ToastProvider içinde kullanılmalı');
  return ctx;
}
