import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PencilSimple, FloppyDisk, Trash, X, CalendarBlank, Check, ChatCircleText, TextAlignLeft } from '@phosphor-icons/react';
import type { Task } from '../../types';
import { PriorityBadge } from '../ui/primitives';
import { useUpdateTask, useDeleteTask } from '../../hooks/api';
import { useQuickActions } from '../layout/QuickActions';
import { dueLabel } from '../../lib/format';

interface TaskRowProps {
  task: Task;
  canEdit: boolean;
  showOwner?: React.ReactNode;
}

export default function TaskRow({ task, canEdit, showOwner }: TaskRowProps) {
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const { openTask } = useQuickActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const done = task.status === 'TAMAMLANDI';
  const due = task.dueDate && !done ? dueLabel(task.dueDate) : null;

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const save = () => {
    const content = draft.trim();
    if (!content || content === task.content) { setEditing(false); setDraft(task.content); return; }
    update.mutate({ id: task.id, content }, { onSuccess: () => setEditing(false) });
  };

  const toggleDone = () => {
    if (!canEdit) return;
    update.mutate({ id: task.id, status: done ? 'YAPILACAK' : 'TAMAMLANDI' });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.14 } }}
      className="group flex items-center gap-3 p-3 rounded-2xl bg-surface border border-theme-light/40 hover:border-theme-light transition-colors"
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={toggleDone}
        disabled={!canEdit}
        aria-label={done ? 'Görevi yeniden aç' : 'Görevi tamamlandı olarak işaretle'}
        aria-pressed={done}
        className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-colors ${
          done ? 'bg-accent border-theme-deep text-white' : 'border-theme-medium hover:border-theme-deep bg-surface'
        } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <AnimatePresence>
          {done && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
              <Check size={14} weight="bold" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            autoFocus
            aria-label="Görev içeriği"
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') { setEditing(false); setDraft(task.content); }
            }}
            className="w-full px-2.5 py-1.5 -ml-1 rounded-xl bg-theme-lightest/60 border border-theme-light focus:outline-none focus:ring-2 focus:ring-theme-medium text-sm font-medium text-theme-text"
          />
        ) : (
          <button
            type="button"
            onClick={() => openTask(task.id)}
            title="Ayrıntıyı aç"
            className={`block w-full text-left text-sm font-medium leading-snug transition-colors rounded-md hover:underline decoration-theme-medium underline-offset-4 ${done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}
          >
            {task.content}
          </button>
        )}
        {(showOwner || task.priority || due || task.description || task.commentCount) && !editing && (
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {showOwner}
            {task.priority && !done && <PriorityBadge priority={task.priority} />}
            {due && (
              <span className={`inline-flex items-center gap-1 text-[0.6875rem] font-bold ${due.tone === 'danger' ? 'text-danger' : due.tone === 'warn' ? 'text-theme-deep' : 'text-theme-muted'}`}>
                <CalendarBlank size={12} weight="bold" aria-hidden="true" /> {due.text}
              </span>
            )}
            {task.description && <TextAlignLeft size={13} weight="bold" className="text-theme-muted" aria-label="Açıklaması var" />}
            {!!task.commentCount && (
              <span className="inline-flex items-center gap-0.5 text-[0.6875rem] font-bold text-theme-muted tabular" aria-label={`${task.commentCount} yorum`}>
                <ChatCircleText size={13} weight="bold" aria-hidden="true" /> {task.commentCount}
              </span>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <div className={`shrink-0 flex items-center gap-1 transition-opacity ${editing || confirmDelete ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
          {editing ? (
            <>
              <button type="button" onClick={save} disabled={update.isPending} className="icon-btn w-9 h-9 text-theme-deep" aria-label="Kaydet" title="Kaydet (Enter)">
                <FloppyDisk size={18} weight="bold" />
              </button>
              <button type="button" onClick={() => { setEditing(false); setDraft(task.content); }} className="icon-btn w-9 h-9" aria-label="Vazgeç" title="Vazgeç (Esc)">
                <X size={16} weight="bold" />
              </button>
            </>
          ) : confirmDelete ? (
            <button
              type="button"
              onClick={() => remove.mutate(task.id)}
              className="h-9 px-3 rounded-xl text-xs font-bold bg-danger-soft text-danger hover:bg-clay-soft transition-colors"
            >
              Silinsin mi?
            </button>
          ) : (
            <>
              <button type="button" onClick={() => { setDraft(task.content); setEditing(true); }} className="icon-btn w-9 h-9" aria-label="Düzenle" title="Düzenle">
                <PencilSimple size={17} weight="bold" />
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)} className="icon-btn w-9 h-9 hover:text-danger hover:bg-danger-soft" aria-label="Sil" title="Sil">
                <Trash size={17} weight="bold" />
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
