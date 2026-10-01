import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  UserPlus, MagnifyingGlass, DotsThree, PencilSimple, Key, Prohibit, ArrowCounterClockwise, Copy, Check, X, ShieldCheck, Warning, Sparkle, ArrowsClockwise, Trash, Flag,
} from '@phosphor-icons/react';
import OnboardingStepsModal from '../components/settings/OnboardingStepsModal';
import { useOnboardingProgress, useOnboardingSteps, useSetUserOnboarding } from '../hooks/onboarding';
import { PageHeader, Segmented, Skeleton, EmptyState, Avatar, Pill } from '../components/ui/primitives';
import { Menu, MenuItem, MenuDivider } from '../components/ui/Menu';
import type { MenuPoint } from '../components/ui/Menu';
import Modal from '../components/ui/Modal';
import DecisionModal from '../components/ui/DecisionModal';
import { usePageMenu } from '../components/layout/ContextMenu';
import type { Decision } from '../components/ui/DecisionModal';
import { ProfileDiff } from '../components/settings/ProfileCard';
import {
  useMe, useAdminUsers, useProjects, useLeaveBalances, useCreateUser, useUpdateUser, useSetUserActive, useResetPassword,
  useProfileRequests, useDecideProfileRequest, useDeleteUser, useDeleteImpact
} from '../hooks/api';
import type { UserInput } from '../hooks/api';
import { formatDate, formatFullDate, leaveEntitlement, seniorityLabel, timeAgo, toIsoDay, trLower } from '../lib/format';
import { listContainer, listItem } from '../lib/motion';
import type { OnboardingProgress, ProfileRequest, Role, User } from '../types';

type Filter = 'ACTIVE' | 'INACTIVE' | 'ALL';

/** Yönetici için kullanıcı yönetimi. */
export default function Users() {
  const me = useMe();
  if (me.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <UsersPage />;
}

function UsersPage() {
  const me = useMe();
  const { data: users, isLoading } = useAdminUsers();
  const { data: balances } = useLeaveBalances();
  const setActive = useSetUserActive();
  const resetPassword = useResetPassword();

  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [menu, setMenu] = useState<{ user: User; point: MenuPoint } | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  usePageMenu([
    { label: 'Yeni kullanıcı', icon: UserPlus, onSelect: () => setEditing('new') },
    { label: 'İşe başlangıç adımları', icon: Flag, onSelect: () => setStepsOpen(true) },
  ]);
  const { data: onboardingProgress } = useOnboardingProgress();
  const setOnboarding = useSetUserOnboarding();
  const progressOf = useMemo(() => new Map((onboardingProgress ?? []).map(p => [p.userId, p])), [onboardingProgress]);
  const [confirm, setConfirm] = useState<{ kind: 'deactivate' | 'reset'; user: User } | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState<{ user: Pick<User, 'fullName' | 'email'>; password: string } | null>(null);

  // Çalışanların ad soyad / unvan değişikliği talepleri
  const { data: profileRequests } = useProfileRequests();
  const decideProfile = useDecideProfileRequest();
  const [deciding, setDeciding] = useState<{ request: ProfileRequest; decision: Decision } | null>(null);
  const pendingRequests = (profileRequests ?? []).filter(r => r.state === 'BEKLIYOR');

  const balanceOf = useMemo(() => new Map((balances ?? []).map(b => [b.userId, b])), [balances]);

  const counts = {
    ACTIVE: users?.filter(u => u.active).length ?? 0,
    INACTIVE: users?.filter(u => !u.active).length ?? 0,
    ALL: users?.length ?? 0,
  };

  const q = trLower(search.trim());
  const visible = (users ?? []).filter(u =>
    (filter === 'ALL' || (filter === 'ACTIVE' ? u.active : !u.active)) &&
    (!q || trLower(`${u.fullName} ${u.email} ${u.jobTitle ?? ''} ${u.currentProject ?? ''}`).includes(q)),
  );

  const doConfirm = () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    if (kind === 'deactivate') {
      setActive.mutate({ id: user.id, active: false }, { onSuccess: () => setConfirm(null) });
    } else {
      resetPassword.mutate(user.id, {
        onSuccess: ({ temporaryPassword }) => {
          setConfirm(null);
          setTempPassword({ user, password: temporaryPassword });
        },
      });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Kullanıcılar"
        description="Çalışan ekleyin, rol ve izin hakkını düzenleyin, ayrılan çalışanların hesabını pasifleştirin."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setStepsOpen(true)} className="btn-secondary" title="Yeni başlayanların Genel Bakış'ta gördüğü adımlar"><Flag size={18} weight="bold" /> Başlangıç adımları</button>
            <button onClick={() => setEditing('new')} className="btn-primary"><UserPlus size={18} weight="bold" /> Yeni Kullanıcı</button>
          </div>
        }
      />

      <AnimatePresence initial={false}>
        {pendingRequests.length > 0 && (
          <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" aria-labelledby="profile-requests-title">
            <div className="mb-8">
              <h2 id="profile-requests-title" className="text-lg font-bold tracking-tight mb-1 flex items-center gap-2">
                Profil Değişikliği Talepleri <Pill className="bg-accent text-white">{pendingRequests.length}</Pill>
              </h2>
              <p className="text-sm text-theme-muted mb-4">Çalışanlar ad soyad ve unvanlarını doğrudan değiştiremez; onayladığınızda değişiklik profile uygulanır.</p>
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {pendingRequests.map(r => {
                    const u = users?.find(x => x.id === r.userId);
                    return (
                      <motion.li key={r.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }} className="card p-4 flex flex-wrap items-center gap-4">
                        {u && <Avatar user={u} size="sm" />}
                        <div className="flex-1 min-w-[13.75rem]">
                          <p className="text-sm font-bold truncate">{u?.fullName ?? r.previousFullName} <span className="font-medium text-theme-muted">· {timeAgo(r.createdAt)}</span></p>
                          <div className="mt-1"><ProfileDiff request={r} /></div>
                        </div>
                        <div className="flex gap-2 shrink-0 ml-auto">
                          <button onClick={() => setDeciding({ request: r, decision: 'REDDEDILDI' })} className="icon-btn border border-theme-light/70 hover:text-danger hover:bg-danger-soft hover:border-transparent" aria-label={`${u?.fullName} talebini reddet`} title="Reddet">
                            <X size={18} weight="bold" />
                          </button>
                          <button onClick={() => setDeciding({ request: r, decision: 'ONAYLANDI' })} className="btn-primary h-10 min-h-0 px-4 text-sm" aria-label={`${u?.fullName} talebini onayla`}>
                            <Check size={16} weight="bold" /> Onayla
                          </button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <DecisionModal
        decision={deciding?.decision ?? null}
        onClose={() => setDeciding(null)}
        subject="profil değişikliğini"
        pending={decideProfile.isPending}
        onConfirm={note => deciding && decideProfile.mutate({ id: deciding.request.id, decision: deciding.decision, note }, { onSuccess: () => setDeciding(null) })}
      >
        {deciding && (
          <>
            <p className="text-sm font-bold text-theme-text mb-1.5">{users?.find(x => x.id === deciding.request.userId)?.fullName ?? deciding.request.previousFullName}</p>
            <ProfileDiff request={deciding.request} />
          </>
        )}
      </DecisionModal>

      <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-center">
        <Segmented<Filter>
          label="Hesap durumu"
          layoutId="users-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ACTIVE', label: 'Aktif', count: counts.ACTIVE },
            { value: 'INACTIVE', label: 'Pasif', count: counts.INACTIVE },
            { value: 'ALL', label: 'Tümü', count: counts.ALL },
          ]}
        />
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" size={18} aria-hidden="true" />
          <input type="search" aria-label="Kullanıcı ara" placeholder="İsim, e-posta, unvan veya proje ara…" value={search} onChange={e => setSearch(e.target.value)} className="input pl-11 shadow-soft" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-3xl" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={UserPlus} title="Kullanıcı bulunamadı" description={filter === 'INACTIVE' ? 'Pasifleştirilmiş hesap yok.' : 'Arama ölçütlerini değiştirin.'} />
      ) : (
        <motion.ul variants={listContainer} initial="hidden" animate="visible" className="space-y-3 pb-10">
          {visible.map(u => {
            const b = balanceOf.get(u.id);
            const seniority = seniorityLabel(u.hireDate);
            return (
              <motion.li
                key={u.id}
                variants={listItem}
                layout="position"
                onContextMenu={e => { e.preventDefault(); setMenu({ user: u, point: { x: e.clientX, y: e.clientY } }); }}
                className={`card p-4 sm:p-5 flex items-center gap-4 ${u.active ? '' : 'opacity-70'}`}
              >
                <Avatar user={u.active ? u : { ...u, status: null }} />
                <div className="min-w-0 flex-1 sm:flex-none sm:w-64">
                  <div className="flex items-center gap-2">
                    <p className="font-bold truncate">{u.fullName}</p>
                    {u.id === me.id && <span className="text-[0.625rem] font-bold uppercase bg-theme-lightest text-theme-deep px-1.5 py-0.5 rounded-md">Sen</span>}
                  </div>
                  <p className="text-xs text-theme-muted font-medium truncate">{u.email}</p>
                </div>
                <div className="hidden md:block w-44 min-w-0">
                  <p className="eyebrow mb-0.5">Unvan · Proje</p>
                  <p className="text-sm font-semibold truncate">{u.jobTitle || '—'}</p>
                  <p className="text-xs text-theme-muted truncate">{u.currentProject || 'Boşta'}</p>
                </div>
                <div className="hidden lg:block w-36">
                  <p className="eyebrow mb-0.5">İşe giriş</p>
                  <p className="text-sm font-semibold">{u.hireDate ? formatDate(u.hireDate) : '—'}</p>
                  {seniority && <p className="text-xs text-theme-muted">{seniority}</p>}
                </div>
                <div className="hidden lg:block w-32">
                  <p className="eyebrow mb-0.5">Yıllık izin</p>
                  {b ? (
                    <p className="text-sm font-semibold tabular">{b.remaining} <span className="text-theme-muted font-medium">/ {b.entitlement} gün</span></p>
                  ) : <p className="text-sm font-semibold tabular">{u.annualLeaveDays} gün</p>}
                  {b && b.pending > 0 && <p className="text-xs text-theme-muted">{b.pending} gün bekliyor</p>}
                  {(!b || b.pending === 0) && u.annualLeaveNextDate && u.annualLeaveDays === 0 && (
                    <p className="text-xs text-theme-muted">{formatFullDate(u.annualLeaveNextDate)}: {u.annualLeaveNextDays} gün</p>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {u.role === 'ADMIN' && <Pill className="bg-accent text-white"><ShieldCheck size={11} weight="bold" /> Yönetici</Pill>}
                  <OnboardingPill progress={progressOf.get(u.id)} active={u.active} />
                  {!u.active && <Pill className="bg-theme-lightest text-theme-muted"><Prohibit size={11} weight="bold" /> Pasif</Pill>}
                  {u.mustChangePassword && u.active && <Pill className="bg-danger-soft text-danger-ink"><Key size={11} weight="bold" /> Geçici şifre</Pill>}
                  <button
                    onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ user: u, point: { x: r.right - 230, y: r.bottom + 8 } }); }}
                    className="icon-btn"
                    aria-label={`${u.fullName} için işlemler`}
                    aria-haspopup="menu"
                  >
                    <DotsThree size={22} weight="bold" />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      <Menu open={!!menu} onClose={() => setMenu(null)} point={menu?.point} width={230} label="Kullanıcı işlemleri">
        {menu && <>
          <MenuItem icon={PencilSimple} onSelect={() => { setEditing(menu.user); setMenu(null); }}>Düzenle</MenuItem>
          <MenuItem icon={Key} disabled={!menu.user.active} onSelect={() => { setConfirm({ kind: 'reset', user: menu.user }); setMenu(null); }}>Şifreyi sıfırla</MenuItem>
          {menu.user.active && (progressOf.has(menu.user.id)
            ? <MenuItem icon={Flag} onSelect={() => { setOnboarding.mutate({ userId: menu.user.id, active: false }); setMenu(null); }}>Başlangıç listesini kaldır</MenuItem>
            : <MenuItem icon={Flag} onSelect={() => { setOnboarding.mutate({ userId: menu.user.id, active: true }); setMenu(null); }}>Başlangıç listesini başlat</MenuItem>)}
          <MenuDivider />
          {menu.user.active ? (
            <MenuItem icon={Prohibit} tone="danger" disabled={menu.user.id === me.id} onSelect={() => { setConfirm({ kind: 'deactivate', user: menu.user }); setMenu(null); }}>
              Hesabı pasifleştir
            </MenuItem>
          ) : (
            <MenuItem icon={ArrowCounterClockwise} onSelect={() => { setActive.mutate({ id: menu.user.id, active: true }); setMenu(null); }}>
              Hesabı aktifleştir
            </MenuItem>
          )}
          {/* Kalıcı silme yalnızca pasif hesaplarda: önce pasifleştir, sonra sil (yanlışlıkla silmeye karşı iki adım). */}
          {!menu.user.active
            ? <MenuItem icon={Trash} tone="danger" onSelect={() => { setDeleting(menu.user); setMenu(null); }}>Kalıcı olarak sil…</MenuItem>
            : menu.user.id !== me.id && <p className="text-[0.6875rem] text-theme-muted font-medium px-3 pt-1 pb-1.5 leading-snug">Silmek için önce hesabı pasifleştirin.</p>}
        </>}
      </Menu>

      <UserFormModal
        target={editing}
        onClose={() => setEditing(null)}
        onCreated={(user, password) => { setEditing(null); setTempPassword({ user, password }); }}
      />

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        size="sm"
        title={confirm?.kind === 'deactivate' ? 'Hesabı pasifleştir' : 'Şifreyi sıfırla'}
        footer={<>
          <button type="button" onClick={() => setConfirm(null)} className="btn-ghost">Vazgeç</button>
          <button type="button" onClick={doConfirm} disabled={setActive.isPending || resetPassword.isPending} className="btn-primary">
            {confirm?.kind === 'deactivate' ? 'Pasifleştir' : 'Geçici şifre oluştur'}
          </button>
        </>}
      >
        {confirm && (
          <p className="text-sm leading-relaxed">
            {confirm.kind === 'deactivate' ? (
              <><strong>{confirm.user.fullName}</strong> artık giriş yapamayacak ve ekip listelerinde görünmeyecek. Görev ve izin geçmişi korunur; hesabı istediğiniz zaman yeniden aktifleştirebilirsiniz.</>
            ) : (
              <><strong>{confirm.user.fullName}</strong> için yeni bir geçici şifre oluşturulacak. Mevcut şifresi geçersiz olur ve ilk girişte şifresini değiştirmesi istenir.</>
            )}
          </p>
        )}
      </Modal>

      <TempPasswordModal value={tempPassword} onClose={() => setTempPassword(null)} />
      <OnboardingStepsModal open={stepsOpen} onClose={() => setStepsOpen(false)} />
      <DeleteUserModal user={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

// ---------------- Kullanıcı formu ----------------
interface FormState { fullName: string; email: string; role: Role; jobTitle: string; hireDate: string; currentProject: string; password: string; onboarding: boolean }
const EMPTY: FormState = { fullName: '', email: '', role: 'EMPLOYEE', jobTitle: '', hireDate: '', currentProject: '', password: '', onboarding: true };

/**
 * Okunması ve söylenmesi kolay başlangıç şifresi, ör. "Zeytin-4821". Herkese aynı sabit şifre (1111 gibi) verilmez:
 * öyle olsaydı yeni açılan her hesaba, sahibi ilk kez girene kadar şirketteki herkes girebilirdi.
 */
function makePassword() {
  const words = ['Zeytin', 'Defne', 'Ceviz', 'Badem', 'Incir', 'Lavanta', 'Kekik', 'Nane', 'Mersin', 'Ihlamur', 'Papatya', 'Sedir'];
  const n = new Uint32Array(2);
  crypto.getRandomValues(n);
  return `${words[n[0] % words.length]}-${String(1000 + (n[1] % 9000))}`;
}

function UserFormModal({ target, onClose, onCreated }: {
  target: User | 'new' | null;
  onClose: () => void;
  onCreated: (user: Pick<User, 'fullName' | 'email'>, password: string) => void;
}) {
  const me = useMe();
  const { data: projects } = useProjects();
  const create = useCreateUser();
  const update = useUpdateUser();
  const isNew = target === 'new';
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!target) return;
    setErrors({});
    setForm(target === 'new' ? { ...EMPTY, hireDate: toIsoDay(new Date()), password: makePassword() } : {
      fullName: target.fullName, email: target.email, role: target.role, jobTitle: target.jobTitle ?? '',
      hireDate: target.hireDate ?? '', currentProject: target.currentProject ?? '', password: '', onboarding: false,
    });
  }, [target]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const leave = leaveEntitlement(form.hireDate || null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (form.fullName.trim().length < 3) errs.fullName = 'Ad soyad en az 3 karakter olmalı.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) errs.email = 'Geçerli bir e-posta adresi girin.';
    if (isNew && !form.hireDate) errs.hireDate = 'Yıllık izin hakkı bu tarihten hesaplanır.';
    if (isNew && (form.password.length < 8 || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(form.password) || !/\d/.test(form.password))) {
      errs.password = 'En az 8 karakter olmalı ve harf ile rakam içermeli.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const body: UserInput = {
      fullName: form.fullName.trim(), email: form.email.trim(), role: form.role, jobTitle: form.jobTitle.trim() || undefined,
      hireDate: form.hireDate || undefined,
    };
    if (isNew) {
      create.mutate({ ...body, currentProject: form.currentProject || undefined, password: form.password, onboarding: form.onboarding }, {
        onSuccess: ({ user, temporaryPassword }) => onCreated(user, temporaryPassword),
      });
    } else if (target) {
      update.mutate({ id: target.id, ...body, hireDate: form.hireDate }, { onSuccess: onClose });
    }
  };

  const editingSelf = target !== 'new' && target?.id === me.id;
  const pending = create.isPending || update.isPending;

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={isNew ? 'Yeni Kullanıcı' : 'Kullanıcıyı Düzenle'}
      description={isNew ? 'Hesap geçici bir şifreyle oluşturulur; kişi ilk girişte şifresini değiştirir.' : undefined}
      onSubmit={submit}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={pending} className="btn-primary">{pending ? 'Kaydediliyor…' : isNew ? 'Kullanıcıyı Oluştur' : 'Kaydet'}</button>
      </>}
    >
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field id="u-name" label="Ad soyad" required error={errors.fullName}>
            <input id="u-name" data-autofocus className="input" value={form.fullName} onChange={e => set('fullName', e.target.value)} autoComplete="off" />
          </Field>
          <Field id="u-email" label="E-posta" required error={errors.email}>
            <input id="u-email" type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} autoComplete="off" placeholder="ad.soyad@devhub.local" />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field id="u-title" label="Unvan">
            <input id="u-title" className="input" value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="Örn: Backend Developer" />
          </Field>
          <div>
            <span className="label">Rol</span>
            <Segmented<Role>
              label="Rol"
              layoutId="user-role"
              value={form.role}
              onChange={v => { if (!editingSelf) set('role', v); }}
              options={[{ value: 'EMPLOYEE', label: 'Çalışan' }, { value: 'ADMIN', label: 'Yönetici' }]}
            />
            {editingSelf && <p className="text-xs text-theme-muted mt-1.5">Kendi yönetici yetkinizi kaldıramazsınız.</p>}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field id="u-hire" label="İşe giriş tarihi" required={isNew} error={errors.hireDate}>
            <input id="u-hire" type="date" className="input" value={form.hireDate} onChange={e => set('hireDate', e.target.value)} />
          </Field>
<div>
            <span className="label">Yıllık izin hakkı</span>
            <p className="input bg-theme-cream/60 flex items-center justify-between gap-2 cursor-default" aria-live="polite">
              <span className="font-bold tabular">{leave ? `${leave.days} gün` : '—'}</span>
              <span className="text-xs font-semibold text-theme-muted">kıdeme göre otomatik</span>
            </p>
          </div>
        </div>
        {leave && (
          <p className="text-sm rounded-2xl p-3.5 bg-theme-lightest/70 border border-theme-light flex items-start gap-2.5">
            <Sparkle size={18} weight="duotone" className="text-theme-deep shrink-0 mt-0.5" />
            <span>
              <strong>{leave.note}.</strong>{' '}
              {leave.next
                ? <>{formatFullDate(leave.next.date)} tarihinde hak kendiliğinden <strong>{leave.next.days} gün</strong> olur.</>
                : 'En yüksek kıdem basamağında.'}
              <span className="block text-xs text-theme-muted mt-1">İş Kanunu: 1 yıldan az 0, 1–5 yıl 14, 5–15 yıl 20, 15 yıl ve üzeri 26 iş günü.</span>
            </span>
          </p>
        )}
        {isNew && (
          <Field id="u-project" label="Proje">
            <select id="u-project" className="input" value={form.currentProject} onChange={e => set('currentProject', e.target.value)}>
              <option value="">Boşta (proje yok)</option>
              {projects?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </Field>
        )}
        {isNew && (
          <Field id="u-password" label="Başlangıç şifresi" required error={errors.password}>
            <div className="flex gap-2">
              <input id="u-password" className="input font-mono tracking-wide" value={form.password} onChange={e => set('password', e.target.value)} autoComplete="off" spellCheck={false} />
              <button type="button" onClick={() => set('password', makePassword())} className="btn-secondary shrink-0 px-3.5" title="Yeni şifre öner">
                <ArrowsClockwise size={17} weight="bold" /> Yenile
              </button>
            </div>
            <p className="text-xs text-theme-muted font-medium mt-1.5 ml-1 leading-relaxed">
              Kişiye bu şifreyi iletin. İlk girişte kendi şifresini belirlemeden uygulamayı kullanamaz. İsterseniz kendiniz de yazabilirsiniz (en az 8 karakter, harf ve rakam).
            </p>
          </Field>
        )}
        {isNew && (
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-theme-cream border border-theme-light/60 cursor-pointer">
            <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[rgb(var(--accent))]" checked={form.onboarding} onChange={e => set('onboarding', e.target.checked)} />
            <span className="text-sm">
              <span className="font-semibold flex items-center gap-1.5"><Flag size={15} weight="bold" className="text-theme-deep" /> İşe başlangıç listesini göster</span>
              <span className="block text-xs text-theme-muted mt-0.5 leading-relaxed">Kişi Genel Bakış'ta ilk günlerinde yapacağı adımları görür (şifre, el kitabı, geliştirme ortamı…). İlerlemesini bu sayfada takip edebilirsiniz.</span>
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
}

function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}{required && <span className="text-danger" aria-hidden="true"> *</span>}</label>
      {children}
      {error && <p role="alert" className="text-xs font-semibold text-danger mt-1.5 ml-1">{error}</p>}
    </div>
  );
}

// ---------------- Geçici şifre ----------------
function TempPasswordModal({ value, onClose }: { value: { user: Pick<User, 'fullName' | 'email'>; password: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (value) setCopied(false); }, [value]);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      open={!!value}
      onClose={onClose}
      size="sm"
      title="Geçici şifre"
      description={value ? `${value.user.fullName} (${value.user.email})` : undefined}
      footer={<button type="button" onClick={onClose} className="btn-primary">Tamam</button>}
    >
      {value && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-2 pl-4 rounded-2xl bg-theme-cream border border-theme-light">
            <code className="flex-1 font-mono text-lg font-bold tracking-wider select-all">{value.password}</code>
            <button type="button" onClick={copy} className="btn-secondary h-10 min-h-0 px-3 text-sm" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={copied ? 'ok' : 'copy'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-1.5">
                  {copied ? <><Check size={16} weight="bold" /> Kopyalandı</> : <><Copy size={16} weight="bold" /> Kopyala</>}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
          <p className="text-sm text-danger-ink bg-danger-soft rounded-2xl p-3.5 flex gap-2">
            <Warning size={18} weight="bold" className="shrink-0 mt-px" />
            Bu şifre yalnızca şimdi gösteriliyor. Kişiye güvenli bir yoldan iletin; ilk girişte değiştirmesi istenecek.
          </p>
        </div>
      )}
    </Modal>
  );
}

// ---------------- Kalıcı silme ----------------
function DeleteUserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { data: impact, isLoading } = useDeleteImpact(user?.id ?? null);
  const remove = useDeleteUser();
  const [typed, setTyped] = useState('');
  useEffect(() => { setTyped(''); }, [user]);
  const ok = !!user && typed.trim().toLocaleLowerCase('tr-TR') === user.fullName.trim().toLocaleLowerCase('tr-TR');
  const rows = impact ? [
    impact.tasks > 0 && `${impact.tasks} görev (geçmiş ve yorumlarıyla)`,
    impact.leaves > 0 && `${impact.leaves} izin kaydı`,
    impact.todos > 0 && `${impact.todos} kişisel yapılacak kartı`,
  ].filter(Boolean) as string[] : [];
  return (
    <Modal
      open={!!user}
      onClose={onClose}
      size="sm"
      title="Hesabı kalıcı olarak sil"
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Vazgeç</button>
        <button type="button" disabled={!ok || remove.isPending} onClick={() => user && remove.mutate(user.id, { onSuccess: onClose })}
          className="btn bg-danger-solid text-white hover:bg-danger-solid-hover disabled:opacity-40">
          <Trash size={16} weight="bold" /> {remove.isPending ? 'Siliniyor…' : 'Kalıcı olarak sil'}
        </button>
      </>}
    >
      {user && (
        <div className="space-y-4 text-sm leading-relaxed">
          <p><strong>{user.fullName}</strong> ({user.email}) hesabı tamamen silinecek. <strong>Bu işlem geri alınamaz.</strong></p>
          {isLoading ? <Skeleton className="h-16" /> : (
            <div className="rounded-2xl bg-danger-soft border border-danger-line p-3.5 text-danger-ink">
              {rows.length > 0
                ? <><p className="font-bold mb-1">Birlikte silinecekler:</p><ul className="list-disc pl-5 space-y-0.5">{rows.map(r => <li key={r}>{r}</li>)}</ul></>
                : <p className="font-semibold">Bu hesaba bağlı görev, izin veya kişisel kart yok.</p>}
              {impact && (impact.sharedListsTransferred > 0 || impact.announcements > 0) && (
                <p className="mt-2 text-xs font-semibold">
                  Korunacaklar: {[impact.sharedListsTransferred > 0 && `${impact.sharedListsTransferred} ortak liste kalan üyelere`, impact.announcements > 0 && `${impact.announcements} duyuru size`].filter(Boolean).join(', ')} devredilir.
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-theme-muted">Sistem loglarında kişinin adı kayıtlı kalır; silme işlemi de kritik olarak loglanır.</p>
          <div>
            <label htmlFor="del-confirm" className="label">Onaylamak için kişinin adını yazın</label>
            <input id="del-confirm" data-autofocus className="input" value={typed} onChange={e => setTyped(e.target.value)} placeholder={user.fullName} autoComplete="off" />
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Satırdaki "Başlangıç 3/8" etiketi; üzerine gelince hangi adımların bittiği görünür. */
function OnboardingPill({ progress, active }: { progress?: OnboardingProgress; active: boolean }) {
  const { data: steps } = useOnboardingSteps(!!progress);
  if (!progress || !active || progress.completedAt) return null;
  const done = new Set(progress.doneStepIds);
  const title = (steps ?? []).map(s => `${done.has(s.id) ? '✓' : '○'} ${s.title}`).join('\n');
  return (
    <span title={title ? `İşe başlangıç\n${title}` : undefined} className="hidden sm:inline-flex">
      <Pill className="bg-theme-lightest text-theme-deep border border-theme-light/70">
        <Flag size={11} weight="bold" /> Başlangıç {progress.done}/{progress.total}
      </Pill>
    </span>
  );
}
