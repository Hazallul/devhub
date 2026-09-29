import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info } from '@phosphor-icons/react';
import Modal from '../ui/Modal';
import { Segmented } from '../ui/primitives';
import {
  useUsers, useMe, useCreateTask, useCreateProject, useAssignProject, useCreateLeave, useCreateAnnouncement,
} from '../../hooks/api';
import { TASK_PRIORITY, TASK_PRIORITIES, PROJECT_STATUS, PROJECT_STATUSES, LEAVE_TYPE, LEAVE_TYPES } from '../../lib/meta';
import { leaveDays, leaveDaysLabel, toIsoDay } from '../../lib/format';
import type { TaskPriority, ProjectStatus, LeaveType, User } from '../../types';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-xs font-semibold text-[#9A3B1B] mt-1.5 ml-1">{message}</p>;
}

function Required() {
  return <span className="text-[#9A3B1B]" aria-hidden="true"> *</span>;
}

// ---------------- Görev ----------------
const taskSchema = z.object({
  content: z.string().trim().min(3, 'Görevi en az 3 karakterle tanımlayın.').max(1000, 'En fazla 1000 karakter.'),
  userId: z.number({ error: 'Bir kişi seçin.' }).int().positive('Bir kişi seçin.'),
  priority: z.enum(['DUSUK', 'ORTA', 'YUKSEK']),
  dueDate: z.string(),
});
type TaskForm = z.infer<typeof taskSchema>;

export function TaskFormModal({ open, onClose, defaultUserId }: { open: boolean; onClose: () => void; defaultUserId?: number }) {
  const me = useMe();
  const { data: users } = useUsers();
  const create = useCreateTask();
  const isAdmin = me.role === 'ADMIN';

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { content: '', userId: defaultUserId ?? me.id, priority: 'ORTA', dueDate: '' },
  });

  useEffect(() => {
    if (open) reset({ content: '', userId: defaultUserId ?? me.id, priority: 'ORTA', dueDate: '' });
  }, [open, defaultUserId, me.id, reset]);

  const assignee = users?.find(u => u.id === watch('userId'));

  const onSubmit = handleSubmit(async values => {
    await create.mutateAsync({ ...values, dueDate: values.dueDate || undefined });
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAdmin && assignee && assignee.id !== me.id ? 'Görev Ata' : 'Yeni Görev'}
      description={isAdmin ? 'Görevi bir ekip üyesine atayın; kişinin görev listesine düşer.' : 'Kendi görev listenize yeni bir madde ekleyin.'}
      onSubmit={onSubmit}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={create.isPending} className="btn-primary">{create.isPending ? 'Ekleniyor…' : 'Görevi Ekle'}</button>
      </>}
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="task-content" className="label">Görev<Required /></label>
          <textarea
            id="task-content"
            data-autofocus
            rows={3}
            placeholder="Örn: Ödeme servisinde hata loglarını incele"
            aria-invalid={!!errors.content}
            aria-describedby="task-content-err"
            className="input resize-none"
            {...register('content')}
          />
          <FieldError id="task-content-err" message={errors.content?.message} />
        </div>

        {isAdmin && (
          <div>
            <label htmlFor="task-user" className="label">Atanan kişi<Required /></label>
            <select id="task-user" className="input" {...register('userId', { valueAsNumber: true })}>
              {users?.map(u => <option key={u.id} value={u.id}>{u.fullName}{u.jobTitle ? ` · ${u.jobTitle}` : ''}</option>)}
            </select>
            {assignee?.status === 'IZINLI' && (
              <p className="text-xs font-semibold text-theme-deep mt-2 ml-1 flex items-center gap-1.5">
                <Info size={14} weight="bold" /> {assignee.fullName} şu an izinli.
              </p>
            )}
          </div>
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

// ---------------- Proje ----------------
const projectSchema = z.object({
  name: z.string().trim().min(2, 'Proje adı en az 2 karakter olmalı.').max(100, 'En fazla 100 karakter.'),
  description: z.string().max(500, 'En fazla 500 karakter.'),
  deadline: z.string(),
  status: z.enum(['PLANLAMA', 'AKTIF', 'BEKLEMEDE', 'TAMAMLANDI']),
});
type ProjectForm = z.infer<typeof projectSchema>;

export function ProjectFormModal({ open, onClose, assignUser }: { open: boolean; onClose: () => void; assignUser?: User | null }) {
  const create = useCreateProject();
  const assign = useAssignProject();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: '', description: '', deadline: '', status: 'PLANLAMA' },
  });

  useEffect(() => {
    if (open) reset({ name: '', description: '', deadline: '', status: 'PLANLAMA' });
  }, [open, reset]);

  const onSubmit = handleSubmit(async values => {
    const project = await create.mutateAsync({
      ...values,
      description: values.description || undefined,
      deadline: values.deadline || undefined,
    });
    if (assignUser) await assign.mutateAsync({ userId: assignUser.id, project: project.name });
    onClose();
  });

  const pending = create.isPending || assign.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yeni Proje"
      description="Sisteme yeni bir proje ekleyin; ardından ekip üyelerini atayabilirsiniz."
      onSubmit={onSubmit}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={pending} className="btn-primary">{pending ? 'Oluşturuluyor…' : 'Projeyi Oluştur'}</button>
      </>}
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="project-name" className="label">Proje adı<Required /></label>
          <input id="project-name" data-autofocus placeholder="Örn: Yapay Zeka Entegrasyonu" aria-invalid={!!errors.name} aria-describedby="project-name-err" className="input" {...register('name')} />
          <FieldError id="project-name-err" message={errors.name?.message} />
        </div>
        <div>
          <label htmlFor="project-desc" className="label">Açıklama</label>
          <textarea id="project-desc" rows={3} placeholder="Projenin amacı ve kapsamı" className="input resize-none" {...register('description')} />
          <FieldError id="project-desc-err" message={errors.description?.message} />
        </div>
        <div className="grid sm:grid-cols-[1fr_auto] gap-5">
          <div>
            <label htmlFor="project-deadline" className="label">Teslim tarihi</label>
            <input id="project-deadline" type="date" className="input" {...register('deadline')} />
          </div>
        </div>
        <div>
          <span className="label">Aşama</span>
          <Segmented<ProjectStatus>
            label="Proje aşaması"
            layoutId="project-status"
            value={watch('status')}
            onChange={v => setValue('status', v)}
            options={PROJECT_STATUSES.map(s => ({ value: s, label: PROJECT_STATUS[s].label }))}
          />
        </div>
        {assignUser && (
          <p className="text-sm text-theme-deep font-semibold bg-theme-lightest/60 p-3.5 rounded-2xl border border-theme-light/50 flex items-center gap-2">
            <Info size={16} weight="bold" /> {assignUser.fullName} otomatik olarak bu projeye atanacak.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ---------------- İzin ----------------
const leaveSchema = z.object({
  type: z.enum(['YILLIK', 'HASTALIK', 'MAZERET']),
  startDate: z.string().min(1, 'Başlangıç tarihi seçin.'),
  endDate: z.string().min(1, 'Bitiş tarihi seçin.'),
  note: z.string().max(300, 'En fazla 300 karakter.'),
}).refine(v => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
  path: ['endDate'],
  message: 'Bitiş tarihi başlangıçtan önce olamaz.',
}).refine(v => !v.startDate || !v.endDate || v.endDate < v.startDate || leaveDays(v.startDate, v.endDate).workdays > 0, {
  path: ['endDate'],
  message: 'Seçilen tarihler yalnızca hafta sonuna denk geliyor; en az bir iş günü seçin.',
});
type LeaveForm = z.infer<typeof leaveSchema>;

/** forUser verilirse (yönetici, durum menüsünden İzinli seçimi) o kişi adına doğrudan onaylı kayıt açılır. */
export function LeaveFormModal({ open, onClose, forUser }: { open: boolean; onClose: () => void; forUser?: User | null }) {
  const create = useCreateLeave();
  const today = toIsoDay(new Date());
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: 'YILLIK', startDate: today, endDate: today, note: '' },
  });

  useEffect(() => {
    if (open) reset({ type: 'YILLIK', startDate: today, endDate: today, note: '' });
  }, [open, reset, today]);

  const start = watch('startDate');
  const end = watch('endDate');
  const dayLabel = useMemo(() => {
    if (!start || !end || end < start || leaveDays(start, end).workdays === 0) return null;
    return leaveDaysLabel(start, end);
  }, [start, end]);

  const onSubmit = handleSubmit(async values => {
    await create.mutateAsync({ ...values, note: values.note || undefined, userId: forUser?.id });
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={forUser ? `${forUser.fullName} için izin` : 'İzin Talebi'}
      description={forUser
        ? 'Kayıt doğrudan onaylanır ve izin takviminde görünür; bugünü kapsıyorsa kişi hemen “İzinli” olur.'
        : 'Talebiniz yönetici onayına gider; onaylandığında durumunuz otomatik olarak “İzinli” olur.'}
      onSubmit={onSubmit}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={create.isPending} className="btn-primary">
          {create.isPending ? 'Kaydediliyor…' : forUser ? 'İzni Kaydet' : 'Talebi Gönder'}
        </button>
      </>}
    >
      <div className="space-y-5">
        <div>
          <span className="label">İzin türü</span>
          <Segmented<LeaveType>
            label="İzin türü"
            layoutId="leave-type"
            value={watch('type')}
            onChange={v => setValue('type', v)}
            options={LEAVE_TYPES.map(t => ({ value: t, label: LEAVE_TYPE[t].label }))}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="leave-start" className="label">Başlangıç<Required /></label>
            <input id="leave-start" data-autofocus type="date" className="input" aria-describedby="leave-start-err" {...register('startDate', {
              onChange: e => { if (end < e.target.value) setValue('endDate', e.target.value); },
            })} />
            <FieldError id="leave-start-err" message={errors.startDate?.message} />
          </div>
          <div>
            <label htmlFor="leave-end" className="label">Bitiş<Required /></label>
            <input id="leave-end" type="date" min={start} className="input" aria-describedby="leave-end-err" {...register('endDate')} />
            <FieldError id="leave-end-err" message={errors.endDate?.message} />
          </div>
        </div>
        {dayLabel && (
          <p className="text-sm font-semibold text-theme-deep -mt-1 ml-1">{dayLabel}</p>
        )}
        <div>
          <label htmlFor="leave-note" className="label">Not</label>
          <textarea id="leave-note" rows={2} placeholder="Yöneticiniz için kısa bir açıklama (isteğe bağlı)" className="input resize-none" {...register('note')} />
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Duyuru ----------------
const announcementSchema = z.object({
  title: z.string().trim().min(3, 'Başlık en az 3 karakter olmalı.').max(120),
  content: z.string().trim().min(10, 'İçerik en az 10 karakter olmalı.').max(1000),
  pinned: z.boolean(),
});
type AnnouncementForm = z.infer<typeof announcementSchema>;

export function AnnouncementFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateAnnouncement();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AnnouncementForm>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', content: '', pinned: false },
  });

  useEffect(() => {
    if (open) reset({ title: '', content: '', pinned: false });
  }, [open, reset]);

  const onSubmit = handleSubmit(async values => {
    await create.mutateAsync(values);
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Duyuru Yayınla"
      description="Duyuru tüm çalışanların Genel Bakış ekranında görünür."
      onSubmit={onSubmit}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={create.isPending} className="btn-primary">{create.isPending ? 'Yayınlanıyor…' : 'Yayınla'}</button>
      </>}
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="ann-title" className="label">Başlık<Required /></label>
          <input id="ann-title" data-autofocus className="input" aria-describedby="ann-title-err" {...register('title')} />
          <FieldError id="ann-title-err" message={errors.title?.message} />
        </div>
        <div>
          <label htmlFor="ann-content" className="label">İçerik<Required /></label>
          <textarea id="ann-content" rows={4} className="input resize-none" aria-describedby="ann-content-err" {...register('content')} />
          <FieldError id="ann-content-err" message={errors.content?.message} />
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input type="checkbox" className="w-5 h-5 rounded-md accent-theme-deep" {...register('pinned')} />
          <span className="text-sm font-semibold text-theme-text">Üste sabitle</span>
        </label>
      </div>
    </Modal>
  );
}
