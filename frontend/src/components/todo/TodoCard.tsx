import { AnimatePresence, motion } from 'framer-motion';
import { Check, Star, CalendarBlank, ListChecks, NoteBlank, PaperPlaneTilt, Repeat, User, ChatCircleText } from '@phosphor-icons/react';
import TaskChip from './TaskChip';
import { useUpdateTodo } from '../../hooks/todos';
import { useMe } from '../../hooks/api';
import { dueLabel, firstName } from '../../lib/format';
import { REPEAT } from './views';
import { useTodoCardMenu } from './cardMenu';
import type { TodoItem } from '../../types';

/** Yuvarlak işaret kutusu: kart ve ayrıntı panelinde ortak. */
/** square: DevHub görevine bağlı kart (görevler kare onay kutusuyla, kişisel notlar yuvarlakla ayırt edilir) */
export function DoneToggle({ done, onToggle, size = 'md', label, square }: { done: boolean; onToggle: () => void; size?: 'sm' | 'md'; label: string; square?: boolean }) {
  const box = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onToggle(); }}
      aria-pressed={done}
      aria-label={label}
      className={`${box} shrink-0 ${square ? 'rounded-md' : 'rounded-full'} border-2 flex items-center justify-center transition-colors ${
        done ? 'bg-accent border-theme-deep text-white' : 'border-theme-medium bg-surface hover:border-theme-deep hover:bg-theme-lightest'
      }`}
    >
      <AnimatePresence initial={false}>
        {done && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 24 }}>
            <Check size={size === 'sm' ? 11 : 13} weight="bold" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

interface Props {
  item: TodoItem;
  selected: boolean;
  /** Akıllı görünümlerde kartın hangi listede olduğu gösterilir */
  listName?: string;
  /** Ortak listede kartı başkası eklediyse o kişinin adı */
  ownerLabel?: string;
  onSelect: () => void;
  onSend: () => void;
  /** Sürükleme tutamacı (yalnızca sıralanabilir görünümlerde) */
  handle?: React.ReactNode;
}

export default function TodoCard({ item, selected, listName, ownerLabel, onSelect, onSend, handle }: Props) {
  const update = useUpdateTodo();
  const menu = useTodoCardMenu();
  const me = useMe();
  // Ortak listede kartı başkası tamamladıysa kim olduğu yazar.
  const doneBy = item.done && item.doneById !== null && item.doneById !== me.id && item.doneByName ? firstName(item.doneByName) : null;
  const due = item.dueDate && !item.done ? dueLabel(item.dueDate) : null;
  const stepsDone = item.steps.filter(s => s.done).length;
  const hasMeta = listName || due || item.steps.length > 0 || item.note || item.sentByName || ownerLabel || doneBy || item.commentCount > 0 || item.repeatRule || item.taskId !== null;

  return (
    <div
      onContextMenu={e => menu(e, item, { onOpen: onSelect, onSend })}
      className={`group relative flex items-center gap-2.5 pl-3 pr-1.5 py-2 transition-colors ${
        selected ? 'bg-accent/[0.07] shadow-[inset_2px_0_0_rgb(var(--accent))]' : item.taskId !== null ? 'bg-accent/[0.05] hover:bg-accent/[0.09]' : 'hover:bg-theme-lightest/60'
      }`}
    >
      {handle}
      <DoneToggle size="sm" square={item.taskId !== null} done={item.done} onToggle={() => update.mutate({ id: item.id, done: !item.done })} label={item.done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'} />

      <button type="button" onClick={onSelect} aria-expanded={selected} className="min-w-0 flex-1 text-left rounded-xl py-0.5">
        <span className="flex items-center gap-2">
          {!item.seen && <span className="w-2 h-2 rounded-full bg-danger-solid shrink-0" aria-label="Yeni" />}
          <span className={`block text-sm font-medium leading-snug break-words ${item.done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}>{item.title}</span>
        </span>
        {hasMeta && (
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-xs text-theme-muted">
            {item.taskId !== null && <TaskChip taskId={item.taskId} />}
            {item.sentByName && <span className="inline-flex items-center gap-1 text-theme-deep"><PaperPlaneTilt size={12} weight="bold" aria-hidden="true" /> {firstName(item.sentByName)} gönderdi</span>}
            {listName && <span>{listName}</span>}
            {ownerLabel && <span className="inline-flex items-center gap-1"><User size={12} weight="bold" aria-hidden="true" /> {ownerLabel} ekledi</span>}
            {due && (
              <span className={`inline-flex items-center gap-1 ${due.tone === 'danger' ? 'text-danger font-medium' : due.tone === 'warn' ? 'text-theme-deep' : ''}`}>
                <CalendarBlank size={12} weight="bold" aria-hidden="true" /> {due.text}{item.dueTime && <span className="tabular"> · {item.dueTime}</span>}
              </span>
            )}
            {item.repeatRule && <span className="inline-flex items-center gap-1"><Repeat size={12} weight="bold" aria-hidden="true" /> {REPEAT[item.repeatRule].label}</span>}
            {item.steps.length > 0 && <span className="inline-flex items-center gap-1 tabular"><ListChecks size={13} weight="bold" aria-hidden="true" /> {stepsDone}/{item.steps.length}</span>}
            {item.note && <NoteBlank size={13} weight="bold" aria-label="Notu var" />}
            {item.commentCount > 0 && <span className="inline-flex items-center gap-1 tabular"><ChatCircleText size={13} weight="bold" aria-label="Yorum" /> {item.commentCount}</span>}
            {doneBy && <span className="inline-flex items-center gap-1 text-theme-deep"><Check size={12} weight="bold" aria-hidden="true" /> {doneBy} tamamladı</span>}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => update.mutate({ id: item.id, important: !item.important })}
        aria-pressed={item.important}
        aria-label={item.important ? 'Önemli işaretini kaldır' : 'Önemli olarak işaretle'}
        className={`icon-btn w-8 h-8 shrink-0 ${item.important ? 'text-warn hover:text-warn' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
      >
        <Star size={16} weight={item.important ? 'fill' : 'bold'} />
      </button>
    </div>
  );
}
