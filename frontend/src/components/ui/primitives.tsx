import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Icon } from '@phosphor-icons/react';
import type { User, UserStatus, TaskPriority } from '../../types';
import { initials } from '../../lib/format';
import { USER_STATUS, TASK_PRIORITY, avatarBg } from '../../lib/meta';

export function Avatar({ user, size = 'md', ring }: { user: Pick<User, 'fullName' | 'avatarColor' | 'status'>; size?: 'xs' | 'sm' | 'md' | 'lg'; ring?: boolean }) {
  const cls = {
    xs: 'w-6 h-6 text-[0.625rem] rounded-md',
    sm: 'w-8 h-8 text-xs rounded-lg',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-16 h-16 text-xl rounded-2xl',
  }[size];
  const dot = size === 'xs' ? null : user.status ? USER_STATUS[user.status].dot : null;
  return (
    <div className={`relative shrink-0 ${ring ? 'ring-2 ring-surface' : ''} ${cls}`}>
      <div
        className={`w-full h-full flex items-center justify-center font-semibold text-[#1B2433] ${cls}`}
        style={{ backgroundColor: avatarBg(user.avatarColor) }}
        aria-hidden="true"
      >
        {initials(user.fullName)}
      </div>
      {dot && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${dot}`} aria-hidden="true" />
      )}
    </div>
  );
}

export function AvatarStack({ users, max = 4 }: { users: User[]; max?: number }) {
  const extra = users.length - max;
  return (
    // Baş harfler okunsun diye avatarlar üst üste bindirilmez.
    <div className="flex gap-1">
      {users.slice(0, max).map(u => (
        <div key={u.id} title={u.fullName}><Avatar user={u} size="xs" ring /></div>
      ))}
      {extra > 0 && (
        <div className="w-6 h-6 rounded-md ring-2 ring-surface bg-theme-lightest text-theme-muted text-[0.625rem] font-semibold flex items-center justify-center">
          +{extra}
        </div>
      )}
    </div>
  );
}

/** Kullanıcı durumu: köşeli küçük rozet; renk anlam taşır ama her zaman ikon + yazıyla birlikte. */
export function StatusBadge({ status, interactive, size = 'md' }: { status: UserStatus | null; interactive?: boolean; size?: 'sm' | 'md' }) {
  if (!status) return <span className="text-xs text-theme-muted">Belirtilmedi</span>;
  const meta = USER_STATUS[status];
  const IconCmp = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-md border whitespace-nowrap transition-colors ${meta.className} ${
      size === 'sm' ? 'text-[0.6875rem] px-1.5 py-px' : 'text-xs px-2 py-0.5'
    } ${interactive ? 'hover:border-current/40' : ''}`}>
      <IconCmp size={size === 'sm' ? 11 : 13} weight="bold" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Öncelik: yalnızca "Yüksek" renk alır; diğerleri sessiz kalır (her kartta renkli etiket gürültü yapmasın). */
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const meta = TASK_PRIORITY[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-[0.6875rem] font-medium px-1.5 py-px rounded-md ${meta.className}`}>
      <meta.icon size={11} weight="fill" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 text-[0.6875rem] font-medium px-1.5 py-px rounded-md whitespace-nowrap ${className}`}>{children}</span>;
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`h-1.5 rounded-full bg-theme-lightest overflow-hidden ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="h-full rounded-full bg-accent origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct / 100 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/**
 * Sayfa başlığı şablonu (her sayfada aynı): solda başlık + tek satır açıklama, sağda görünüm seçici ve tek ana eylem.
 * Başlığın üstündeki küçük etiket (eyebrow) kaldırıldı; menüde nerede olunduğu zaten belli. Prop geriye uyumluluk için duruyor.
 */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-theme-text">{title}</h1>
        {description && <p className="text-sm text-theme-muted mt-1 max-w-[65ch] text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** Özet sayı: kartsız değil ama sade; ikon etiketin yanında küçük, büyük ikon karosu yok. */
export function StatCard({ label, value, icon: IconCmp, hint, onClick, active }: { label: string; value: ReactNode; icon: Icon; hint?: ReactNode; onClick?: () => void; active?: boolean }) {
  const content = (
    <>
      <p className="flex items-center gap-1.5 text-sm text-theme-muted">
        <IconCmp size={15} weight="regular" aria-hidden="true" />
        {label}
      </p>
      <p className="text-[1.75rem] leading-none font-semibold text-theme-text tabular tracking-tight">{value}</p>
      {hint && <div className="text-xs text-theme-muted">{hint}</div>}
    </>
  );
  const cls = 'card p-4 text-left flex flex-col gap-2.5 w-full h-full';
  if (!onClick) return <div className={cls}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${cls} cursor-pointer transition-colors active:scale-[0.99] ${active ? 'border-theme-medium bg-theme-lightest/60 ring-1 ring-theme-medium' : 'hover:border-theme-dark/30 hover:bg-theme-lightest/40'}`}
    >
      {content}
    </button>
  );
}

/** Boş durum: nasıl doldurulacağını söyleyen kısa davet; kesik çizgili kutu yok. */
export function EmptyState({ icon: IconCmp, title, description, action }: { icon: Icon; title: string; description?: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center py-12 px-6"
    >
      <IconCmp size={28} weight="regular" className="mx-auto mb-3 text-theme-dark" aria-hidden="true" />
      <h3 className="text-base font-semibold text-theme-text">{title}</h3>
      {description && <p className="text-sm text-theme-muted max-w-sm mx-auto mt-1">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </motion.div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-theme-lightest rounded-xl ${className}`} />;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  layoutId: string;
  label: string;
}

/** Segment seçici: gri yuva içinde beyaz seçili parça (standart, tanıdık). */
export function Segmented<T extends string>({ value, onChange, options, layoutId, label }: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-0.5 p-0.5 bg-theme-lightest rounded-xl border border-theme-light/70">
      {options.map(o => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors min-h-[2rem] ${selected ? 'text-theme-text' : 'text-theme-muted hover:text-theme-text'}`}
          >
            {selected && (
              <motion.span layoutId={layoutId} className="absolute inset-0 bg-surface rounded-lg shadow-soft border border-theme-light/80" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.label}
              {o.count !== undefined && (
                <span className="text-[0.6875rem] tabular text-theme-muted">{o.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
