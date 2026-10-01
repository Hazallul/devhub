import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import Modal from '../ui/Modal';
import { Avatar, Segmented } from '../ui/primitives';
import { FieldError, Required } from '../forms/FormModals';
import { useUsers, useMe, useCreateTask, useProjects, useAllTasks } from '../../hooks/api';
import type { TaskInput } from '../../hooks/api';
import { TASK_PRIORITY, TASK_PRIORITIES } from '../../lib/meta';
import { firstName, toIsoDay, trLower } from '../../lib/format';
import type { TaskPriority, User } from '../../types';

/** Proje alanı: AUTO = kişinin o anki projesi, NONE = projesiz, diğerleri proje id'si. */
const AUTO = '';
const NONE = 'none';

const schema = z.object({
  content: z.string().trim().min(3, 'Görevi en az 3 karakterle tanımlayın.').max(1000, 'En fazla 1000 karakter.'),
  description: z.string().max(4000, 'En fazla 4000 karakter.'),
  userIds: z.array(z.number()).min(1, 'En az bir kişi seçin.'),
  priority: z.enum(['DUSUK', 'ORTA', 'YUKSEK']),
  dueDate: z.string(),
  project: z.string(),
});
type Form = z.infer<typeof schema>;

interface Props { open: boolean; onClose: () => void; defaultUserId?: number; defaultProjectId?: number }

/**
 * Görev oluşturma. Yönetici bir veya birden fazla kişiye aynı görevi atayabilir (her kişiye ayrı görev oluşur);
 * proje seçilirse kişi listesi o projenin ekibine daralır. Çalışan yalnızca kendine görev ekler.
 */
export default function TaskFormModal({ open, onClose, defaultUserId, defaultProjectId }: Props) {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const create = useCreateTask();
  const { data: projects } = useProjects();
  const [showDescription, setShowDescription] = useState(false);

  const defaults = (): Form => ({
    content: '',
    description: '',
    userIds: defaultUserId ? [defaultUserId] : isAdmin ? [] : [me.id],
    priority: 'ORTA',
    dueDate: '',
    project: isAdmin && defaultProjectId ? String(defaultProjectId) : AUTO,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (!open) return;
    reset(defaults());
    setShowDescription(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultUserId, defaultProjectId, me.id, isAdmin, reset]);

  const userIds = watch('userIds');
  const project = watch('project');
  const selectedProject = projects?.find(p => String(p.id) === project) ?? null;
  const count = userIds.length;
  const onlySelf = count === 1 && userIds[0] === me.id;

  const onSubmit = handleSubmit(async v => {
    const body: TaskInput = {
      userIds: v.userIds,
      content: v.content,
      description: v.description.trim() || undefined,
      priority: v.priority,
      dueDate: v.dueDate || undefined,
    };
    if (isAdmin && v.project !== AUTO) body.projectId = v.project === NONE ? null : Number(v.project);
    await create.mutateAsync(body);
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={isAdmin ? 'lg' : 'md'}
      title={isAdmin && !onlySelf ? 'Görev Ata' : 'Yeni Görev'}
      description={isAdmin ? 'Bir veya birden fazla kişiye atayın; her kişinin listesine ayrı bir görev olarak düşer.' : 'Kendi görev listenize yeni bir madde ekleyin.'}
      onSubmit={onSubmit}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={create.isPending} className="btn-primary">
          {create.isPending ? 'Kaydediliyor…' : count > 1 ? `${count} kişiye ata` : isAdmin && !onlySelf ? 'Görevi Ata' : 'Görevi Ekle'}
        </button>
      </>}
    >
      <div className="space-y-6">
        <div>
          <label htmlFor="task-content" className="label">Görev<Required /></label>
          <textarea
            id="task-content"
            data-autofocus
            rows={2}
            placeholder="Örn: Ödeme servisinde hata loglarını incele"
            aria-invalid={!!errors.content}
            aria-describedby="task-content-err"
            className="input resize-none"
            {...register('content')}
          />
          <FieldError id="task-content-err" message={errors.content?.message} />

          <AnimatePresence initial={false} mode="wait">
            {showDescription ? (
              <motion.div key="desc" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <label htmlFor="task-desc" className="label mt-4">Açıklama</label>
                <textarea
                  id="task-desc"
                  rows={4}
                  autoFocus
                  placeholder="Kabul kriterleri, bağlantılar, notlar…"
                  aria-describedby="task-desc-err"
                  className="input resize-y min-h-[96px]"
                  {...register('description')}
                />
                <FieldError id="task-desc-err" message={errors.description?.message} />
              </motion.div>
            ) : (
              <motion.button key="add" type="button" onClick={() => setShowDescription(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-theme-deep hover:underline underline-offset-4 rounded-lg">
                <Plus size={14} weight="bold" /> Açıklama ekle
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {isAdmin && (
          <>
            <div>
              <label htmlFor="task-project" className="label">Proje</label>
              <select id="task-project" className="input" {...register('project')}>
                <option value={AUTO}>Kişinin kendi projesi (otomatik)</option>
                {projects?.filter(p => p.status !== 'TAMAMLANDI' || String(p.id) === project).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value={NONE}>Projesiz</option>
              </select>
              <p className="text-xs text-theme-muted font-medium mt-1.5 ml-1">
                {selectedProject
                  ? 'Görev bu projeye bağlanır; aşağıdaki liste projenin ekibini gösterir.'
                  : project === NONE ? 'Görev herhangi bir projeye bağlanmaz.' : 'Görev, atanan kişinin şu anki projesine bağlanır.'}
              </p>
            </div>

            <AssigneePicker
              key={selectedProject?.id ?? project}
              value={userIds}
              onChange={ids => setValue('userIds', ids, { shouldValidate: !!errors.userIds })}
              projectName={selectedProject?.name ?? null}
              error={errors.userIds?.message}
            />
          </>
        )}

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <span className="label" id="task-priority-label">Öncelik</span>
            <Segmented<TaskPriority>
              label="Öncelik"
              layoutId="task-priority"
              value={watch('priority')}
              onChange={v => setValue('priority', v)}
              options={TASK_PRIORITIES.map(p => ({ value: p, label: TASK_PRIORITY[p].label }))}
            />
          </div>
          <div>
            <label htmlFor="task-due" className="label">Son tarih</label>
            <input id="task-due" type="date" min={toIsoDay(new Date())} className="input" {...register('dueDate')} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Çoklu kişi seçici (proje değişince key ile sıfırlanır). Proje seçiliyse yalnızca o projenin ekibi listelenir ("Tüm çalışanlar" ile genişler).
 * Her satırda kişinin açık görev sayısı görünür; iş yükü atama anında görülsün diye.
 */
function AssigneePicker({ value, onChange, projectName, error }: {
  value: number[]; onChange: (ids: number[]) => void; projectName: string | null; error?: string;
}) {
  const { data: users } = useUsers();
  const { data: tasks } = useAllTasks();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const openCount = useMemo(() => {
    const m = new Map<number, number>();
    tasks?.forEach(t => { if (t.status !== 'TAMAMLANDI') m.set(t.userId, (m.get(t.userId) ?? 0) + 1); });
    return m;
  }, [tasks]);

  const selected = new Set(value);
  const scoped = projectName && !showAll;
  const q = trLower(query.trim());
  const visible = (users ?? [])
    .filter(u => !scoped || u.currentProject === projectName)
    .filter(u => !q || trLower(`${u.fullName} ${u.jobTitle ?? ''} ${u.currentProject ?? ''}`).includes(q))
    .sort((a, b) => Number(a.role === 'ADMIN') - Number(b.role === 'ADMIN') || a.fullName.localeCompare(b.fullName, 'tr'));
  const allVisibleSelected = visible.length > 0 && visible.every(u => selected.has(u.id));
  const chosen = (users ?? []).filter(u => selected.has(u.id));

  const toggle = (id: number) => onChange(selected.has(id) ? value.filter(x => x !== id) : [...value, id]);
  const toggleVisible = () => {
    const ids = new Set(visible.map(u => u.id));
    onChange(allVisibleSelected ? value.filter(x => !ids.has(x)) : [...new Set([...value, ...ids])]);
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-2">
        <span className="label mb-0" id="assignee-label">Atanan kişiler<Required /></span>
        <span className="text-xs font-semibold text-theme-muted tabular" aria-live="polite">{value.length ? `${value.length} kişi seçildi` : 'Kimse seçilmedi'}</span>
      </div>

      {/* Seçilenler: liste filtrelense de seçim görünür kalır */}
      <AnimatePresence initial={false}>
        {chosen.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-1.5 mb-2 overflow-hidden" aria-label="Seçilen kişiler">
            {chosen.map(u => (
              <motion.li key={u.id} layout initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
                <button type="button" onClick={() => toggle(u.id)} className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl bg-theme-lightest border border-theme-light/70 text-xs font-bold text-theme-deep hover:bg-theme-light transition-colors" aria-label={`${u.fullName} seçimini kaldır`}>
                  <Avatar user={u} size="xs" />
                  {firstName(u.fullName)}
                  <X size={11} weight="bold" aria-hidden="true" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <div className={`rounded-3xl border bg-theme-cream/60 ${error ? 'border-clay' : 'border-theme-light/60'}`}>
        <div className="flex items-center gap-2 p-2 border-b border-theme-light/50">
          <div className="relative flex-1">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={scoped ? `${projectName} ekibinde ara…` : 'Kişi, unvan veya proje ara…'}
              aria-label="Kişi ara"
              className="w-full pl-9 pr-3 py-2 rounded-2xl bg-surface border border-theme-light/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-theme-medium"
            />
          </div>
          <button type="button" onClick={toggleVisible} disabled={visible.length === 0} className="btn-ghost min-h-[38px] px-3 text-xs disabled:opacity-40">
            {allVisibleSelected ? 'Seçimi kaldır' : scoped ? 'Tüm ekibi seç' : 'Görünenleri seç'}
          </button>
        </div>

        <ul role="group" aria-labelledby="assignee-label" className="max-h-[232px] overflow-y-auto scrollbar-thin p-1.5">
          {visible.length === 0 && (
            <li className="text-sm text-theme-muted font-medium text-center py-6">
              {scoped ? 'Bu projede henüz kimse yok.' : 'Eşleşen kişi yok.'}
            </li>
          )}
          {visible.map(u => (
            <li key={u.id}>
              <PickerRow user={u} checked={selected.has(u.id)} open={openCount.get(u.id) ?? 0} showProject={!scoped} onToggle={() => toggle(u.id)} />
            </li>
          ))}
        </ul>

        {projectName && (
          <div className="px-3 py-2 border-t border-theme-light/50">
            <button type="button" onClick={() => setShowAll(s => !s)} className="text-xs font-bold text-theme-deep hover:underline underline-offset-4 rounded">
              {showAll ? `Yalnızca ${projectName} ekibini göster` : 'Proje dışından da kişi seç'}
            </button>
          </div>
        )}
      </div>
      <FieldError id="assignee-err" message={error} />
    </div>
  );
}

function PickerRow({ user, checked, open, showProject, onToggle }: { user: User; checked: boolean; open: number; showProject: boolean; onToggle: () => void }) {
  const onLeave = user.status === 'IZINLI';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-2 rounded-2xl text-left transition-colors ${checked ? 'bg-surface shadow-soft' : 'hover:bg-surface/70'}`}
    >
      <span className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-accent border-theme-deep text-white' : 'border-theme-medium bg-surface'}`} aria-hidden="true">
        {checked && <Check size={12} weight="bold" />}
      </span>
      <Avatar user={user} size="xs" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-theme-text truncate">{user.fullName}</span>
        <span className="block text-xs text-theme-muted font-medium truncate">
          {user.jobTitle || (user.role === 'ADMIN' ? 'Yönetici' : 'Çalışan')}
          {showProject && ` · ${user.currentProject ?? 'Boşta'}`}
        </span>
      </span>
      {onLeave && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-clay-soft text-clay-ink shrink-0">İzinli</span>}
      <span className="text-xs font-semibold text-theme-muted tabular shrink-0 w-14 text-right" title="Açık görev sayısı">{open} açık</span>
    </button>
  );
}
