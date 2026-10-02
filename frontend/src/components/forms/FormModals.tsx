import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info } from '@phosphor-icons/react';
import Modal from '../ui/Modal';
import { Segmented } from '../ui/primitives';
import {
  useMe, useCreateProject, useAssignProject, useCreateLeave, useCreateAnnouncement, useHolidayMap, useLeaveBalances,
} from '../../hooks/api';
import { PROJECT_STATUS, PROJECT_STATUSES, LEAVE_TYPE, LEAVE_TYPES } from '../../lib/meta';
import { leaveDays, leaveDaysLabel, toIsoDay } from '../../lib/format';
import type { ProjectStatus, LeaveType, User } from '../../types';

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-xs font-semibold text-danger mt-1.5 ml-1">{message}</p>;
}

export function Required() {
  return <span className="text-danger" aria-hidden="true"> *</span>;
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
      title="Yeni proje"
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
});
type LeaveForm = z.infer<typeof leaveSchema>;

/** forUser verilirse (yönetici, durum menüsünden İzinli seçimi) o kişi adına doğrudan onaylı kayıt açılır. */
export function LeaveFormModal({ open, onClose, forUser }: { open: boolean; onClose: () => void; forUser?: User | null }) {
  const create = useCreateLeave();
  const me = useMe();
  const holidays = useHolidayMap();
  const { data: balances } = useLeaveBalances();
  const today = toIsoDay(new Date());
  const { register, handleSubmit, reset, watch, setValue, setError, formState: { errors } } = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: 'YILLIK', startDate: today, endDate: today, note: '' },
  });

  useEffect(() => {
    if (open) reset({ type: 'YILLIK', startDate: today, endDate: today, note: '' });
  }, [open, reset, today]);

  const start = watch('startDate');
  const end = watch('endDate');
  const type = watch('type');
  const requested = start && end && end >= start ? leaveDays(start, end, holidays.set).workdays : null;
  const dayLabel = useMemo(() => {
    if (!start || !end || end < start || requested === 0) return null;
    return leaveDaysLabel(start, end, holidays.set);
  }, [start, end, requested, holidays.set]);

  // Yıllık izin bakiyesi (bu yıl): bekleyen talepler de düşülür; sunucu da aynı kuralla kontrol eder.
  const target = forUser ?? me;
  const balance = balances?.find(b => b.userId === target.id);
  const available = balance ? balance.remaining - balance.pending : null;
  const overBalance = type === 'YILLIK' && available !== null && requested !== null && requested > available;

  const onSubmit = handleSubmit(async values => {
    if (leaveDays(values.startDate, values.endDate, holidays.set).workdays === 0) {
      setError('endDate', { message: 'Seçilen tarihler hafta sonu veya resmi tatile denk geliyor; en az bir iş günü seçin.' });
      return;
    }
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
        <button type="submit" disabled={create.isPending || overBalance} className="btn-primary">
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
            <input id="leave-start" data-autofocus type="date" min={!forUser && type !== 'HASTALIK' ? today : undefined} className="input" aria-describedby="leave-start-err" {...register('startDate', {
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
        {!forUser && type === 'HASTALIK' && <p className="text-xs font-medium text-theme-muted -mt-2 ml-1">Hastalık izni geçmiş tarihli de bildirilebilir.</p>}
        {dayLabel && (
          <p className="text-sm font-semibold text-theme-deep -mt-1 ml-1">{dayLabel}</p>
        )}
        {type === 'YILLIK' && balance && (
          <div className={`rounded-2xl p-3.5 text-sm border ${overBalance ? 'bg-danger-soft border-danger-line text-danger-ink' : 'bg-theme-cream border-theme-light/60 text-theme-text'}`} role={overBalance ? 'alert' : undefined}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="font-semibold">{forUser ? `${forUser.fullName.split(' ')[0]} için` : 'Bu yıl'} kullanılabilir yıllık izin</span>
              <span className="font-bold tabular">{Math.max(available ?? 0, 0)} / {balance.entitlement} iş günü</span>
            </div>
            <p className="text-xs mt-1 opacity-80">
              {balance.used} gün kullanıldı{balance.pending ? ` · ${balance.pending} gün onay bekliyor` : ''}
              {requested ? ` · bu talep ${requested} gün${overBalance ? ' - bakiye yetersiz' : `, sonrasında ${Math.max((available ?? 0) - requested, 0)} gün kalır`}` : ''}
            </p>
          </div>
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
      title="Duyuru yayınla"
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
