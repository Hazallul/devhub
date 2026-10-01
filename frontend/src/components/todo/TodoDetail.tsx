import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Star, FloppyDisk, CalendarBlank, ListBullets, Plus, Trash, PaperPlaneTilt, NoteBlank, Bell, Repeat, CheckSquare, ArrowSquareOut, ChatCircleText } from '@phosphor-icons/react';
import { DoneToggle } from './TodoCard';
import { canDeleteCard, nextMonday, REPEAT, REPEATS } from './views';
import { useQuickActions } from '../layout/QuickActions';
import { useToast } from '../ui/Toast';
import { useUpdateTodo, useDeleteTodo, useAddStep, useUpdateStep, useDeleteStep, useTodoComments, useAddTodoComment, useDeleteTodoComment } from '../../hooks/todos';
import { useMe } from '../../hooks/api';
import { addDays, dueLabel, firstName, formatDate, parseServerDate, timeAgo, toIsoDay } from '../../lib/format';
import type { TodoItem, TodoList, TodoRepeat, TodoStep } from '../../types';

/**
 * Yazı alanları için otomatik kayıt: yazmayı bırakınca (600 ms) kaydeder; alan kapanırken veya
 * panel/sayfa değişirken bekleyen değişikliği hemen yazar. Kullanıcı alana dokunmadıysa hiçbir şey yazmaz.
 */
function useAutosavedText(saved: string, save: (v: string) => void) {
  const [value, setValue] = useState(saved);
  // dirty: kullanıcı bu alanı değiştirdi ve henüz yazılmadı. Yalnızca o zaman kaydedilir; aksi hâlde başka bir üyenin
  // (ya da başka bir sekmenin) yaptığı değişiklik, eski metinle geri yazılıp ezilirdi.
  const dirty = useRef(false);
  const latest = useRef({ value, save });
  useEffect(() => { latest.current = { value, save }; });
  useEffect(() => { if (!dirty.current) setValue(saved); }, [saved]);
  const flush = () => {
    if (!dirty.current) return;
    dirty.current = false;
    latest.current.save(latest.current.value);
  };
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(flush, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (v: string) => { dirty.current = true; setValue(v); };
  /** Yerel değişikliği atar ve kayıtlı değere döner (ör. boş bırakılan başlık). */
  const reset = () => { dirty.current = false; setValue(saved); };
  return { value, change, flush, reset };
}

interface Props { item: TodoItem; lists: TodoList[]; onClose: () => void; onSend: () => void }

/** Kart ayrıntısı. `key={item.id}` ile kullanılır: kart değişince yerel yazı durumu sıfırlanır. */
export default function TodoDetail({ item, lists, onClose, onSend }: Props) {
  const update = useUpdateTodo();
  const remove = useDeleteTodo();
  const { openTask } = useQuickActions();
  const me = useMe();
  const shared = (lists.find(l => l.id === item.listId)?.members.length ?? 1) > 1;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const now = new Date();
  const today = toIsoDay(now);
  const due = item.dueDate && !item.done ? dueLabel(item.dueDate) : null;

  const titleField = useAutosavedText(item.title, v => { if (v.trim() && v.trim() !== item.title) update.mutate({ id: item.id, title: v.trim() }); });
  const noteField = useAutosavedText(item.note ?? '', v => { if ((v.trim() || null) !== item.note) update.mutate({ id: item.id, note: v.trim() || null }); });
  const title = titleField.value;
  const note = noteField.value;

  // Her şey zaten kendiliğinden kaydedilir; bu düğme bekleyen yazıyı hemen yazar, kaydedildiğini bildirir ve ayrıntıyı kapatır.
  const saveNow = () => {
    if (title.trim()) titleField.flush(); else titleField.reset();
    noteField.flush();
    toast.success('Kart kaydedildi');
    onClose();
  };

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  // Tarihsiz kartın saati ve tekrarı olmaz: tarih kalkınca ikisi de kalkar, saat/tekrar seçilince tarih bugüne kurulur.
  const setDue = (dueDate: string | null) => update.mutate(dueDate ? { id: item.id, dueDate } : { id: item.id, dueDate: null, dueTime: null, repeatRule: null });
  const setTime = (dueTime: string | null) => update.mutate({ id: item.id, dueTime, ...(dueTime && !item.dueDate ? { dueDate: today } : {}) });
  const setRepeat = (repeatRule: TodoRepeat | null) => update.mutate({ id: item.id, repeatRule, ...(repeatRule && !item.dueDate ? { dueDate: today } : {}) });
  const quick: { label: string; value: string }[] = [
    { label: 'Bugün', value: today },
    { label: 'Yarın', value: toIsoDay(addDays(now, 1)) },
    { label: 'Haftaya', value: nextMonday(now) },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 pb-4 border-b border-theme-light/40 bg-surface">
        <div className="flex items-start gap-3">
          <span className="mt-1.5">
            <DoneToggle done={item.done} onToggle={() => update.mutate({ id: item.id, done: !item.done })} label={item.done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'} />
          </span>
          <textarea
            value={title}
            rows={1}
            maxLength={300}
            aria-label="Başlık"
            onChange={e => titleField.change(e.target.value.replace(/\n/g, ' '))}
            onBlur={() => { if (!title.trim()) titleField.reset(); else titleField.flush(); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            className={`flex-1 min-w-0 resize-none bg-transparent text-lg font-bold leading-snug rounded-xl px-2 py-1 -mx-2 focus:outline-none focus:bg-theme-cream [field-sizing:content] ${item.done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}
          />
          <button
            type="button"
            onClick={() => update.mutate({ id: item.id, important: !item.important })}
            aria-pressed={item.important}
            aria-label={item.important ? 'Önemli işaretini kaldır' : 'Önemli olarak işaretle'}
            className={`icon-btn w-9 h-9 shrink-0 ${item.important ? 'text-warn hover:text-warn' : ''}`}
          >
            <Star size={18} weight={item.important ? 'fill' : 'bold'} />
          </button>
          <button type="button" onClick={onClose} className="icon-btn w-9 h-9 shrink-0 bg-theme-lightest text-theme-deep hover:bg-theme-light" aria-label="Ayrıntıyı kapat"><X size={16} weight="bold" /></button>
        </div>

        {item.sentByName && (
          <div className="mt-3 rounded-2xl bg-theme-lightest/70 border border-theme-light/70 px-3.5 py-2.5 text-sm">
            <p className="font-bold text-theme-deep flex items-center gap-1.5">
              <PaperPlaneTilt size={14} weight="bold" aria-hidden="true" /> {item.sentByName} gönderdi
              <span className="font-medium text-theme-muted">· {timeAgo(item.createdAt)}</span>
            </p>
            {item.sentMessage && <p className="text-theme-text mt-1 whitespace-pre-wrap break-words">“{item.sentMessage}”</p>}
          </div>
        )}

        {item.taskId !== null && (
          <button type="button" onClick={() => openTask(item.taskId!)} className="mt-3 w-full flex items-center gap-2 rounded-2xl bg-theme-lightest/70 border border-theme-light/70 px-3.5 py-2.5 text-sm font-bold text-theme-deep hover:bg-theme-lightest transition-colors text-left">
            <CheckSquare size={16} weight="bold" aria-hidden="true" />
            <span className="flex-1">Bir DevHub görevine bağlı</span>
            <span className="inline-flex items-center gap-1 text-xs">Görevi aç <ArrowSquareOut size={13} weight="bold" aria-hidden="true" /></span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6">
        <Steps item={item} />

        <section aria-label="Zamanlama" className="space-y-2">
          <div className="px-3.5 py-3 rounded-2xl border bg-surface border-theme-light/50">
            <div className="flex items-center gap-3 text-sm font-semibold">
              <CalendarBlank size={18} weight="bold" className={item.dueDate ? 'text-theme-deep' : 'text-theme-muted'} aria-hidden="true" />
              <label htmlFor={`due-${item.id}`} className={item.dueDate ? 'text-theme-text' : 'text-theme-muted'}>
                {item.dueDate ? <>Tarih: <span className={due?.tone === 'danger' ? 'text-danger' : ''}>{due ? due.text : formatDate(item.dueDate)}</span></> : 'Tarih ekle'}
              </label>
              {item.dueDate && (
                <button type="button" onClick={() => setDue(null)} className="ml-auto text-xs font-bold text-theme-muted hover:text-danger rounded" aria-label="Tarihi kaldır">Kaldır</button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {quick.map(q => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setDue(q.value)}
                  aria-pressed={item.dueDate === q.value}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${item.dueDate === q.value ? 'bg-accent text-white' : 'bg-theme-cream text-theme-deep hover:bg-theme-lightest'}`}
                >
                  {q.label}
                </button>
              ))}
              <input
                id={`due-${item.id}`}
                type="date"
                value={item.dueDate ?? ''}
                onChange={e => setDue(e.target.value || null)}
                className="ml-auto px-2 py-1.5 rounded-xl bg-theme-cream border border-transparent text-xs font-bold text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-theme-light/40">
              <div>
                <label htmlFor={`time-${item.id}`} className="flex items-center gap-1.5 text-[0.6875rem] font-bold text-theme-muted mb-1.5"><Bell size={13} weight="bold" aria-hidden="true" /> Hatırlatma saati</label>
                <input
                  id={`time-${item.id}`}
                  type="time"
                  value={item.dueTime ?? ''}
                  onChange={e => setTime(e.target.value || null)}
                  className="w-full px-2 py-1.5 rounded-xl bg-theme-cream text-xs font-bold text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-medium"
                />
              </div>
              <div>
                <label htmlFor={`repeat-${item.id}`} className="flex items-center gap-1.5 text-[0.6875rem] font-bold text-theme-muted mb-1.5"><Repeat size={13} weight="bold" aria-hidden="true" /> Tekrar</label>
                <select
                  id={`repeat-${item.id}`}
                  value={item.repeatRule ?? ''}
                  onChange={e => setRepeat((e.target.value || null) as TodoRepeat | null)}
                  className="w-full px-2 py-1.5 rounded-xl bg-theme-cream text-xs font-bold text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-medium"
                >
                  <option value="">Tekrarlanmaz</option>
                  {REPEATS.map(r => <option key={r} value={r}>{REPEAT[r].label}</option>)}
                </select>
              </div>
            </div>
            {(item.dueTime || item.repeatRule) && (
              <p className="text-[0.6875rem] font-medium text-theme-muted mt-2 leading-relaxed">
                {item.dueTime && <>Saati gelince bildirim alırsınız. </>}
                {item.repeatRule && <>Tamamlayınca yenisi açılır ({REPEAT[item.repeatRule].next}).</>}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 px-3.5 py-2 rounded-2xl border bg-surface border-theme-light/50 text-sm font-semibold">
            <ListBullets size={18} weight="bold" className="text-theme-muted" aria-hidden="true" />
            <label htmlFor={`list-${item.id}`} className="text-theme-muted">Liste</label>
            <select
              id={`list-${item.id}`}
              value={item.listId ?? ''}
              onChange={e => update.mutate({ id: item.id, listId: e.target.value ? Number(e.target.value) : null })}
              className="ml-auto max-w-[60%] px-2 py-1.5 rounded-xl bg-theme-cream text-sm font-bold text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-medium"
            >
              <option value="">Genel</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </section>

        <section aria-label="Not">
          <label htmlFor={`note-${item.id}`} className="eyebrow flex items-center gap-1.5 mb-2"><NoteBlank size={13} weight="bold" aria-hidden="true" /> Not</label>
          <textarea
            id={`note-${item.id}`}
            value={note}
            maxLength={4000}
            placeholder="Ayrıntı, bağlantı veya hatırlatma yazın…"
            onChange={e => noteField.change(e.target.value)}
            onBlur={noteField.flush}
            className="w-full min-h-[7.5rem] resize-y rounded-2xl bg-surface border border-theme-light/50 px-3.5 py-3 text-sm leading-relaxed text-theme-text placeholder:text-theme-muted/60 focus:outline-none focus:ring-2 focus:ring-theme-medium [field-sizing:content]"
          />
        </section>

        {(shared || item.commentCount > 0) && <Comments item={item} />}
      </div>

      <div className="p-4 border-t border-theme-light/40 bg-surface flex items-center gap-2">
        <p className="text-xs font-semibold text-theme-muted flex-1 min-w-0 truncate">
          {item.done && item.doneAt ? `${item.doneById !== null && item.doneById !== me.id && item.doneByName ? `${firstName(item.doneByName)} tamamladı` : 'Tamamlandı'} · ${timeAgo(item.doneAt)}` : `Oluşturuldu · ${formatDate(toIsoDay(parseServerDate(item.createdAt)))}`}
        </p>
        <button type="button" onClick={onSend} className="icon-btn border border-theme-light/70 text-theme-deep" aria-label="Kartı birine gönder" title="Kartı birine gönder"><PaperPlaneTilt size={17} weight="bold" /></button>
        <button type="button" onClick={saveNow} className="btn-primary min-h-[2.5rem] px-4 text-sm">
          <FloppyDisk size={16} weight="bold" /> Kaydet
        </button>
        {!canDeleteCard(item, lists, me.id) ? null : confirmDelete ? (
          <button type="button" onClick={() => remove.mutate(item.id, { onSuccess: onClose })} className="h-10 px-3 rounded-xl text-xs font-bold bg-danger-soft text-danger hover:bg-clay-soft transition-colors">Silinsin mi?</button>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="icon-btn hover:text-danger hover:bg-danger-soft" aria-label="Kartı sil" title="Kartı sil"><Trash size={18} weight="bold" /></button>
        )}
      </div>
    </div>
  );
}

/** Ortak listedeki kartın yorumları: üyeler yazışır, kişi kendi yorumunu silebilir. */
function Comments({ item }: { item: TodoItem }) {
  const me = useMe();
  const { data: comments } = useTodoComments(item.id, true);
  const add = useAddTodoComment();
  const remove = useDeleteTodoComment();
  const [draft, setDraft] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    add.mutate({ itemId: item.id, body });
    setDraft('');
  };

  return (
    <section aria-label="Yorumlar">
      <p className="eyebrow flex items-center gap-1.5 mb-2"><ChatCircleText size={13} weight="bold" aria-hidden="true" /> Yorumlar {comments && comments.length > 0 && <span className="tabular">({comments.length})</span>}</p>
      {comments && comments.length > 0 && (
        <ul className="space-y-2 mb-2">
          {comments.map(c => (
            <li key={c.id} className="group rounded-2xl bg-surface border border-theme-light/50 px-3.5 py-2.5">
              <p className="flex items-center gap-2 text-xs font-bold text-theme-deep">
                <span className="truncate">{c.userId === me.id ? 'Siz' : c.userName}</span>
                <span className="font-medium text-theme-muted whitespace-nowrap">· {timeAgo(c.createdAt)}</span>
                {c.userId === me.id && (
                  <button type="button" onClick={() => remove.mutate({ itemId: item.id, id: c.id })} className="ml-auto text-theme-muted hover:text-danger opacity-0 group-hover:opacity-100 focus:opacity-100 rounded" aria-label="Yorumu sil" title="Yorumu sil">
                    <Trash size={13} weight="bold" />
                  </button>
                )}
              </p>
              <p className="text-sm text-theme-text mt-1 whitespace-pre-wrap break-words">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl bg-surface border border-theme-light/50 pl-3.5 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-theme-medium">
        <input value={draft} maxLength={1000} onChange={e => setDraft(e.target.value)} placeholder="Yorum yaz…" aria-label="Yorum yaz"
          className="flex-1 min-w-0 bg-transparent py-1.5 text-sm text-theme-text placeholder:text-theme-muted/70 focus:outline-none" />
        <button type="submit" disabled={!draft.trim() || add.isPending} className="icon-btn w-9 h-9 text-theme-deep disabled:opacity-30" aria-label="Yorumu gönder"><PaperPlaneTilt size={16} weight="bold" /></button>
      </form>
    </section>
  );
}

function Steps({ item }: { item: TodoItem }) {
  const add = useAddStep();
  const [draft, setDraft] = useState('');
  const done = item.steps.filter(s => s.done).length;

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    add.mutate({ itemId: item.id, title });
    setDraft('');
  };

  return (
    <section aria-label="Adımlar">
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow">Adımlar</p>
        {item.steps.length > 0 && <p className="text-xs font-bold text-theme-muted tabular">{done}/{item.steps.length}</p>}
      </div>
      {item.steps.length > 0 && (
        <div className="h-1.5 rounded-full bg-theme-lightest overflow-hidden mb-3" aria-hidden="true">
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${(done / item.steps.length) * 100}%` }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />
        </div>
      )}
      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {item.steps.map(s => (
            <motion.li key={s.id} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
              <StepRow itemId={item.id} step={s} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <form onSubmit={e => { e.preventDefault(); submit(); }} className="flex items-center gap-2.5 mt-1 px-2 py-1.5 rounded-xl focus-within:bg-surface border border-transparent focus-within:border-theme-light/60">
        <Plus size={16} weight="bold" className="text-theme-deep shrink-0" aria-hidden="true" />
        <input
          value={draft}
          maxLength={300}
          onChange={e => setDraft(e.target.value)}
          placeholder={item.steps.length ? 'Sonraki adım' : 'Adım ekle'}
          aria-label="Yeni adım"
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-theme-text placeholder:text-theme-muted focus:outline-none"
        />
      </form>
    </section>
  );
}

function StepRow({ itemId, step }: { itemId: number; step: TodoStep }) {
  const update = useUpdateStep();
  const remove = useDeleteStep();
  const [title, setTitle] = useState(step.title);
  const dirty = useRef(false);
  // Kullanıcı yazmıyorken adım başka bir üye tarafından değiştirilirse yeni metni al.
  useEffect(() => { if (!dirty.current) setTitle(step.title); }, [step.title]);

  const save = () => {
    if (!dirty.current) return;
    dirty.current = false;
    const v = title.trim();
    if (!v) setTitle(step.title);
    else if (v !== step.title) update.mutate({ itemId, id: step.id, title: v });
  };

  return (
    <div className="group flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-surface">
      <DoneToggle size="sm" done={step.done} onToggle={() => update.mutate({ itemId, id: step.id, done: !step.done })} label={step.done ? 'Adımı geri al' : 'Adımı tamamla'} />
      <input
        value={title}
        maxLength={300}
        aria-label="Adım"
        onChange={e => { dirty.current = true; setTitle(e.target.value); }}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className={`flex-1 min-w-0 bg-transparent text-sm font-medium focus:outline-none ${step.done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}
      />
      <button type="button" onClick={() => remove.mutate({ itemId, id: step.id })} className="icon-btn w-7 h-7 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger hover:bg-danger-soft" aria-label="Adımı sil">
        <X size={13} weight="bold" />
      </button>
    </div>
  );
}
