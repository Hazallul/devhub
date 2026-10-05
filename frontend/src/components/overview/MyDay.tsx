import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Plus, Sun, CalendarBlank, Bell, Hourglass, Airplane, CheckSquare, Users, PaperPlaneTilt, ChartPieSlice } from '@phosphor-icons/react';
import { usePendingSurveyCount } from '../../hooks/surveys';
import type { Icon } from '@phosphor-icons/react';
import { DoneToggle } from '../todo/TodoCard';
import TaskChip, { TASK_CARD_SURFACE } from '../todo/TaskChip';
import { inToday } from '../todo/views';
import { useTodoCardMenu } from '../todo/cardMenu';
import { useQuickActions } from '../layout/QuickActions';
import { Skeleton } from '../ui/primitives';
import { useCreateTodo, useTodos, useUpdateTodo } from '../../hooks/todos';
import { useAllTasks, useLeaves, useMe, usePendingPasswordResetCount, usePendingProfileCount } from '../../hooks/api';
import { addDays, dueLabel, firstName, formatDate, toIsoDay } from '../../lib/format';
import type { TodoItem } from '../../types';

/**
 * Genel Bakış'taki "Bugünüm": kişinin bugünkü kişisel kartları ve güne dair kısa özet
 * (yaklaşan görev son tarihleri, bekleyen onaylar, yaklaşan izin ya da izin talebi kısayolu). Kartlar kişiye özeldir; burada da yalnızca sahibi görür.
 */
export default function MyDay() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const navigate = useNavigate();
  const actions = useQuickActions();
  const { data: todos } = useTodos();
  const { data: tasks } = useAllTasks();
  const { data: leaves } = useLeaves();
  const pendingProfiles = usePendingProfileCount(isAdmin).data?.count ?? 0;
  const pendingSurveys = usePendingSurveyCount().data?.count ?? 0;
  const pendingResets = usePendingPasswordResetCount(isAdmin).data?.count ?? 0;
  const update = useUpdateTodo();
  const create = useCreateTodo();
  const cardMenu = useTodoCardMenu();
  const [draft, setDraft] = useState('');

  const now = new Date();
  const today = toIsoDay(now);
  const soon = toIsoDay(addDays(now, 2));
  const items = todos?.items ?? [];
  const todays = items
    .filter(i => inToday(i, today))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') || a.position - b.position);
  const open = todays.filter(i => !i.done);
  const shown = [...open, ...todays.filter(i => i.done)].slice(0, 5);

  const openTodo = (e: { clientX: number; clientY: number }, item?: TodoItem) =>
    navigate(item ? `/todo?item=${item.id}` : '/todo', { state: { origin: { x: e.clientX, y: e.clientY } } });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    create.mutate({ title, dueDate: today });
    setDraft('');
  };

  // ---- Günün özeti
  const myOpenTasks = (tasks ?? []).filter(t => t.userId === me.id && t.status !== 'TAMAMLANDI');
  const overdueTasks = myOpenTasks.filter(t => t.dueDate && t.dueDate < today).length;
  const dueSoon = myOpenTasks.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= soon).length;
  const pendingLeaves = (leaves ?? []).filter(l => l.state === 'BEKLIYOR');
  const myPendingLeaves = pendingLeaves.filter(l => l.userId === me.id).length;
  const nextLeave = (leaves ?? [])
    .filter(l => l.userId === me.id && l.state === 'ONAYLANDI' && l.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const facts: { icon: Icon; label: string; value: string; tone?: 'danger' | 'accent'; to?: string; onSelect?: () => void }[] = [
    {
      icon: CheckSquare, to: '/tasks', label: 'Görev son tarihleri',
      value: overdueTasks > 0 ? `${overdueTasks} gecikmiş${dueSoon ? ` · ${dueSoon} yaklaşıyor` : ''}` : dueSoon > 0 ? `${dueSoon} görev 2 gün içinde` : 'Yaklaşan son tarih yok',
      tone: overdueTasks > 0 ? 'danger' : dueSoon > 0 ? 'accent' : undefined,
    },
    isAdmin
      ? {
        // Profil ve şifre sıfırlama talepleri Kullanıcılar sayfasında; yalnızca onlar bekliyorsa oraya gider.
        icon: Hourglass, to: pendingLeaves.length === 0 && pendingProfiles + pendingResets > 0 ? '/users' : '/leaves', label: 'Onayınızı bekleyenler',
        value: pendingLeaves.length + pendingProfiles + pendingResets === 0 ? 'Bekleyen talep yok'
          : [pendingLeaves.length && `${pendingLeaves.length} izin`, pendingProfiles && `${pendingProfiles} profil`, pendingResets && `${pendingResets} şifre sıfırlama`].filter(Boolean).join(' · '),
        tone: pendingLeaves.length + pendingProfiles + pendingResets > 0 ? 'accent' : undefined,
      }
      : {
        icon: Hourglass, to: '/leaves', label: 'Taleplerim',
        value: myPendingLeaves ? `${myPendingLeaves} izin talebi onay bekliyor` : 'Bekleyen talebiniz yok',
        tone: myPendingLeaves ? 'accent' : undefined,
      },
    // Yanıt bekleyen anket varsa öne çıkar (yoksa satır hiç görünmez).
    ...(pendingSurveys > 0 ? [{ icon: ChartPieSlice, to: '/surveys', label: 'Anket', value: `${pendingSurveys} anket yanıtınızı bekliyor`, tone: 'accent' as const }] : []),
    // İzin bakiyesi burada gösterilmez (yılda bir bakılan bilgi); yalnızca yaklaşan izin ya da talep kısayolu.
    nextLeave
      ? { icon: Airplane, to: '/leaves', label: 'İzin', value: nextLeave.startDate <= today ? `İzindesiniz · ${formatDate(nextLeave.endDate)} tarihine kadar` : `Sıradaki izniniz ${formatDate(nextLeave.startDate)}` }
      : { icon: Airplane, onSelect: () => actions.newLeave(), label: 'İzin', value: 'İzin talebi oluştur' },
  ];

  return (
    <section className="card p-5 mb-8" aria-labelledby="my-day">
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 id="my-day" className="text-base font-semibold flex items-center gap-2">
              <Sun size={20} weight="duotone" className="text-theme-deep" aria-hidden="true" /> Bugünüm
              {todos && todays.length > 0 && <span className="text-sm font-semibold text-theme-muted tabular">{todays.length - open.length}/{todays.length}</span>}
            </h2>
            <button type="button" onClick={e => openTodo(e)} className="btn-ghost min-h-0 h-10 px-3 text-sm">Yapılacaklarım <ArrowRight size={14} weight="bold" /></button>
          </div>

          {!todos ? (
            <div className="space-y-2"><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
          ) : (
            <>
              {shown.length === 0 && <p className="text-sm font-medium text-theme-muted py-3">Bugün için kart yok. Aşağıdan ekleyebilirsin; yalnızca sen görürsün.</p>}
              <ul className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {shown.map(i => {
                    const late = !i.done && i.dueDate! < today ? dueLabel(i.dueDate!) : null;
                    const list = i.listId !== null ? todos.lists.find(l => l.id === i.listId) : undefined;
                    // Kaynak ayrı bölüm açmadan satırda görünür: görev kartı mavi tonlu + kare onay kutusu + "Görev · Proje", gelen kart gönderenin adıyla, kendi notun sade.
                    const isTask = i.taskId !== null;
                    return (
                      <motion.li key={i.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        onContextMenu={e => cardMenu(e, i, { onOpen: () => openTodo(e, i), onSend: () => openTodo(e, i) })}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-colors ${isTask ? TASK_CARD_SURFACE : 'bg-theme-cream/70 border-theme-light/40 hover:border-theme-light'}`}>
                        <DoneToggle square={isTask} done={i.done} onToggle={() => update.mutate({ id: i.id, done: !i.done })} label={i.done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'} />
                        <button type="button" onClick={e => openTodo(e, i)} className="min-w-0 flex-1 text-left rounded-lg">
                          <span className={`block text-sm font-semibold truncate ${i.done ? 'text-theme-muted line-through decoration-theme-medium' : 'text-theme-text'}`}>{i.title}</span>
                        </button>
                        {i.taskId !== null && <TaskChip taskId={i.taskId} />}
                        {i.sentByName && <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-theme-muted shrink-0"><PaperPlaneTilt size={12} weight="bold" aria-hidden="true" /> {firstName(i.sentByName)} gönderdi</span>}
                        {list && list.members.length > 1 && <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-theme-muted shrink-0"><Users size={12} weight="bold" aria-hidden="true" /> {list.name}</span>}
                        {i.dueTime && !i.done && <span className="inline-flex items-center gap-1 text-xs font-bold text-theme-muted tabular shrink-0"><Bell size={12} weight="bold" aria-hidden="true" /> {i.dueTime}</span>}
                        {late && <span className="inline-flex items-center gap-1 text-xs font-bold text-danger shrink-0"><CalendarBlank size={12} weight="bold" aria-hidden="true" /> {late.text}</span>}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
              {todays.length > shown.length && (
                <button type="button" onClick={e => openTodo(e)} className="mt-2 text-xs font-bold text-theme-deep hover:underline underline-offset-4">+{todays.length - shown.length} kart daha</button>
              )}
              <form onSubmit={add} className="flex items-center gap-2.5 mt-3 px-3 py-1.5 rounded-2xl border border-theme-light/60 bg-surface focus-within:border-theme-medium focus-within:ring-2 focus-within:ring-theme-light/60">
                <Plus size={16} weight="bold" className="text-theme-deep shrink-0" aria-hidden="true" />
                <input value={draft} maxLength={300} onChange={e => setDraft(e.target.value)} placeholder="Bugün ne yapacaksın?" aria-label="Bugüne kart ekle"
                  className="flex-1 min-w-0 bg-transparent py-1.5 text-sm font-medium text-theme-text placeholder:text-theme-muted focus:outline-none" />
              </form>
            </>
          )}
        </div>

        <ul className="lg:col-span-2 space-y-2 lg:border-l lg:border-theme-light/40 lg:pl-6 self-center w-full">
          {facts.map(f => (
            <li key={f.label}>
              <button type="button" onClick={() => (f.onSelect ? f.onSelect() : navigate(f.to!))} className="w-full flex items-center gap-3 p-3 rounded-2xl text-left hover:bg-theme-cream transition-colors">
                <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${f.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-theme-lightest text-theme-deep'}`}>
                  <f.icon size={19} weight="duotone" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block eyebrow">{f.label}</span>
                  <span className={`block text-sm font-bold truncate ${f.tone === 'danger' ? 'text-danger' : f.tone === 'accent' ? 'text-theme-deep' : 'text-theme-text'}`}>{f.value}</span>
                </span>
                <ArrowRight size={15} weight="bold" className="text-theme-muted shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
