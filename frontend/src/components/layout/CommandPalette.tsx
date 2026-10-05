import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Icon } from '@phosphor-icons/react';
import { MagnifyingGlass, Briefcase, ArrowRight, Plus, Airplane, Megaphone, ListDashes, BookOpenText, ListChecks, Sun, Moon, Headset, ChartPieSlice } from '@phosphor-icons/react';
import { setThemePref, useTheme } from '../../lib/theme';
import { DOC_CATEGORIES } from '../../docs';
import { useDocs } from '../../hooks/docs';
import { useUsers, useProjects, useMe } from '../../hooks/api';
import { trLower } from '../../lib/format';
import { Avatar, StatusBadge } from '../ui/primitives';
import { navFor, systemNavFor } from './nav';
import { useQuickActions } from './QuickActions';
import { modal } from '../../lib/motion';
import type { User } from '../../types';

interface Item {
  id: string;
  group: 'Sayfalar' | 'Kişiler' | 'Projeler' | 'Dokümanlar' | 'İşlemler';
  label: string;
  hint?: string;
  icon?: Icon;
  user?: User;
  run: () => void;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [, dark] = useTheme();
  const me = useMe();
  const actions = useQuickActions();
  const { data: users } = useUsers();
  const { data: projects } = useProjects();
  const { data: docs } = useDocs();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const go = (fn: () => void) => () => { onClose(); fn(); };
    const all: Item[] = [
      ...[...navFor(me), ...systemNavFor(me)].map(n => ({ id: `nav-${n.to}`, group: 'Sayfalar' as const, label: n.label, icon: n.icon, run: go(() => navigate(n.to)) })),
      { id: 'nav-/todo', group: 'Sayfalar', label: 'Yapılacaklarım', hint: 'Kişisel alan', icon: ListChecks, run: go(() => navigate('/todo')) },
      { id: 'act-task', group: 'İşlemler', label: 'Yeni görev ekle', icon: Plus, run: go(() => actions.newTask()) },
      { id: 'act-leave', group: 'İşlemler', label: 'İzin talebi oluştur', icon: Airplane, run: go(() => actions.newLeave()) },
      { id: 'act-ticket', group: 'İşlemler', label: 'Destek talebi aç', icon: Headset, run: go(() => navigate('/tickets?yeni=1')) },
      { id: 'act-logs', group: 'İşlemler', label: me.role === 'ADMIN' ? 'Sistem loglarını aç' : 'Ekip akışını aç', icon: ListDashes, run: go(() => actions.openLogs()) },
      ...(me.role === 'ADMIN' ? [
        { id: 'act-project', group: 'İşlemler' as const, label: 'Yeni proje oluştur', icon: Briefcase, run: go(() => actions.newProject()) },
        { id: 'act-ann', group: 'İşlemler' as const, label: 'Duyuru yayınla', icon: Megaphone, run: go(() => actions.newAnnouncement()) },
        { id: 'act-survey', group: 'İşlemler' as const, label: 'Anket oluştur', icon: ChartPieSlice, run: go(() => navigate('/surveys/yeni')) },
      ] : []),
      ...(users ?? []).map(u => ({
        id: `user-${u.id}`, group: 'Kişiler' as const, label: u.fullName, hint: [u.jobTitle, u.currentProject].filter(Boolean).join(' · '),
        user: u, run: go(() => navigate('/team', { state: { highlightUserId: u.id } })),
      })),
      ...(projects ?? []).map(p => ({
        id: `project-${p.id}`, group: 'Projeler' as const, label: p.name, icon: Briefcase,
        run: go(() => navigate('/projects', { state: { openProjectId: p.id } })),
      })),
      { id: 'act-doc', group: 'İşlemler' as const, label: 'Doküman yaz', icon: BookOpenText, run: go(() => navigate('/docs/yeni')) },
      { id: 'act-theme', group: 'İşlemler' as const, label: dark ? 'Açık temaya geç' : 'Koyu temaya geç', hint: 'Görünüm', icon: dark ? Sun : Moon, run: go(() => setThemePref(dark ? 'light' : 'dark')) },
      ...(docs ?? []).map(d => ({
        id: `doc-${d.slug}`, group: 'Dokümanlar' as const, label: d.title, icon: BookOpenText,
        hint: [DOC_CATEGORIES.find(c => c.id === d.category)?.name, ...d.tags].filter(Boolean).join(' · '),
        run: go(() => navigate(`/docs/${d.slug}`)),
      })),
    ];
    const q = trLower(query.trim());
    if (!q) return all.filter(i => i.group !== 'Kişiler' && i.group !== 'Projeler' && i.group !== 'Dokümanlar');
    return all.filter(i => trLower(`${i.label} ${i.hint ?? ''}`).includes(q)).slice(0, 12);
  }, [query, users, projects, docs, me, navigate, onClose, actions, dark]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); items[active]?.run(); }
    if (e.key === 'Escape') onClose();
  };

  let lastGroup = '';

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Hızlı arama"
            variants={modal}
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={onKeyDown}
            className="relative w-full max-w-xl bg-surface rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 border-b border-theme-light/50">
              <MagnifyingGlass size={20} className="text-theme-muted shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Kişi, proje veya işlem ara…"
                aria-label="Ara"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-list"
                aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
                className="flex-1 py-4 bg-transparent outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base font-medium text-theme-text placeholder:text-theme-muted/60"
              />
              <kbd className="text-[0.6875rem] font-bold text-theme-muted bg-theme-lightest px-2 py-1 rounded-lg">Esc</kbd>
            </div>
            <div ref={listRef} id="command-list" role="listbox" className="max-h-[50vh] overflow-y-auto scrollbar-thin p-2">
              {items.length === 0 && (
                <p className="text-sm text-theme-muted text-center py-10">“{query}” için sonuç yok.</p>
              )}
              {items.map((item, i) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                const selected = i === active;
                return (
                  <div key={item.id}>
                    {header && <p className="eyebrow px-3 pt-3 pb-1.5">{header}</p>}
                    <div
                      id={`cmd-${item.id}`}
                      role="option"
                      aria-selected={selected}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={item.run}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${selected ? 'text-theme-text' : 'text-theme-text/90'}`}
                    >
                      {selected && <motion.span layoutId="cmd-active" className="absolute inset-0 bg-theme-lightest rounded-xl" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                      <span className="relative flex items-center gap-3 flex-1 min-w-0">
                        {item.user ? <Avatar user={item.user} size="sm" /> : item.icon && (
                          <span className="w-9 h-9 rounded-xl bg-surface border border-theme-light/60 flex items-center justify-center text-theme-deep shrink-0">
                            <item.icon size={18} weight="duotone" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">{item.label}</span>
                          {item.hint && <span className="block text-xs text-theme-muted truncate">{item.hint}</span>}
                        </span>
                        {item.user && <StatusBadge status={item.user.status} size="sm" />}
                        {selected && <ArrowRight size={16} weight="bold" className="text-theme-deep shrink-0" />}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
