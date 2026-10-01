import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MagnifyingGlass, Plus, X, Timer } from '@phosphor-icons/react';
import { DAY_HOURS, formatDuration, liveSpent, parseHours, remainingSeconds } from '../../lib/effort';
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
  estimate: z.string().refine(v => { const m = parseHours(v); return m !== null && m >= 15 && m <= 400 * 60; },
    'Tahmini süreyi saat olarak girin (en az 0,25, en fazla 400). Örn: 6 ya da 2,5'),
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
    estimate: '',
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
      estimatedMinutes: parseHours(v.estimate)!,
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
                  className="input resize-y min-h-[6rem]"
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

        <EstimateField
          value={watch('estimate')}
          onChange={v => setValue('estimate', v, { shouldValidate: !!errors.estimate })}
          error={errors.estimate?.message}
          register={register('estimate')}
        />

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

const PRESETS = [1, 2, 4, 8, 16, 24, 40];

/** Tahmini iş gücü: saat olarak yazılır ya da hazır değerlerden seçilir (1 iş günü = 8 saat). */
function EstimateField({ value, onChange, error, register }: {
  value: string; onChange: (v: string) => void; error?: string; register: ReturnType<ReturnType<typeof useForm<Form>>['register']>;
}) {
  const minutes = parseHours(value);
  const days = minutes ? minutes / 60 / DAY_HOURS : 0;
  return (
    <div>
      <label htmlFor="task-estimate" className="label flex items-center gap-1.5"><Timer size={16} weight="bold" className="text-theme-deep" /> Tahmini iş gücü<Required /></label>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative sm:w-40 shrink-0">
          <input id="task-estimate" inputMode="decimal" placeholder="Örn: 6" aria-invalid={!!error} aria-describedby="task-estimate-hint task-estimate-err"
            className="input pr-14 tabular" autoComplete="off" {...register} />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-theme-muted pointer-events-none">saat</span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hazır süreler">
          {PRESETS.map(h => {
            const on = minutes === h * 60;
            return (
              <button key={h} type="button" onClick={() => onChange(String(h))} aria-pressed={on}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold tabular border transition-colors ${on ? 'bg-accent text-white border-transparent' : 'border-theme-light/70 text-theme-deep hover:bg-theme-lightest'}`}>
                {h >= DAY_HOURS && h % DAY_HOURS === 0 ? `${h / DAY_HOURS} gün` : `${h} sa`}
              </button>
            );
          })}
        </div>
      </div>
      <p id="task-estimate-hint" className="text-xs text-theme-muted font-medium mt-1.5 ml-1">
        {minutes && minutes >= 15
          ? `≈ ${days >= 1 ? `${String(Math.round(days * 10) / 10).replace('.', ',')} iş günü` : formatDuration(minutes * 60)}. Süre, görev "Devam Ediyor"a alındığında mesai saatlerinde işlemeye başlar.`
          : 'İşin kaç saatlik olduğu. 1 iş günü = 8 saat. Gerçekleşen süre, görev "Devam Ediyor"dayken kendiliğinden ölçülür.'}
      </p>
      <FieldError id="task-estimate-err" message={error} />
    </div>
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

  // Kişinin açık görev sayısı ve kalan tahmini iş (saat): atarken iş yükü görünsün.
  const openCount = useMemo(() => {
    const m = new Map<number, { count: number; seconds: number }>();
    const now = Date.now();
    tasks?.forEach(t => {
      if (t.status === 'TAMAMLANDI') return;
      const cur = m.get(t.userId) ?? { count: 0, seconds: 0 };
      m.set(t.userId, { count: cur.count + 1, seconds: cur.seconds + remainingSeconds(t, liveSpent(t, now)) });
    });
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
          <button type="button" onClick={toggleVisible} disabled={visible.length === 0} className="btn-ghost min-h-[2.375rem] px-3 text-xs disabled:opacity-40">
            {allVisibleSelected ? 'Seçimi kaldır' : scoped ? 'Tüm ekibi seç' : 'Görünenleri seç'}
          </button>
        </div>

        <ul role="group" aria-labelledby="assignee-label" className="max-h-[14.5rem] overflow-y-auto scrollbar-thin p-1.5">
          {visible.length === 0 && (
            <li className="text-sm text-theme-muted font-medium text-center py-6">
              {scoped ? 'Bu projede henüz kimse yok.' : 'Eşleşen kişi yok.'}
            </li>
          )}
          {visible.map(u => (
            <li key={u.id}>
              <PickerRow user={u} checked={selected.has(u.id)} open={openCount.get(u.id) ?? { count: 0, seconds: 0 }} showProject={!scoped} onToggle={() => toggle(u.id)} />
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

function PickerRow({ user, checked, open, showProject, onToggle }: { user: User; checked: boolean; open: { count: number; seconds: number }; showProject: boolean; onToggle: () => void }) {
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
      {onLeave && <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-clay-soft text-clay-ink shrink-0">İzinli</span>}
      <span className="text-right shrink-0 w-20" title="Açık görev sayısı ve kalan tahmini iş">
        <span className="block text-xs font-semibold text-theme-muted tabular">{open.count} açık</span>
        {open.seconds > 0 && <span className="block text-[0.6875rem] font-bold text-theme-deep tabular">{formatDuration(open.seconds, true)} iş</span>}
      </span>
    </button>
  );
}
