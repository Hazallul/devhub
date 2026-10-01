import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Icon } from '@phosphor-icons/react';
import type { User, UserStatus, TaskPriority } from '../../types';
import { initials } from '../../lib/format';
import { USER_STATUS, TASK_PRIORITY } from '../../lib/meta';

export function Avatar({ user, size = 'md', ring }: { user: Pick<User, 'fullName' | 'avatarColor' | 'status'>; size?: 'xs' | 'sm' | 'md' | 'lg'; ring?: boolean }) {
  const cls = {
    xs: 'w-7 h-7 text-[10px] rounded-lg',
    sm: 'w-9 h-9 text-xs rounded-xl',
    md: 'w-12 h-12 text-base rounded-2xl',
    lg: 'w-20 h-20 text-2xl rounded-3xl',
  }[size];
  const dot = size === 'xs' ? null : user.status ? USER_STATUS[user.status].dot : null;
  return (
    <div className={`relative shrink-0 ${ring ? 'ring-2 ring-white' : ''} ${cls}`}>
      <div
        className={`w-full h-full flex items-center justify-center font-bold text-theme-text ${cls}`}
        style={{ backgroundColor: user.avatarColor || '#C5D89D' }}
        aria-hidden="true"
      >
        {initials(user.fullName)}
      </div>
      {dot && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${dot}`} aria-hidden="true" />
      )}
    </div>
  );
}

export function AvatarStack({ users, max = 4 }: { users: User[]; max?: number }) {
  const extra = users.length - max;
  return (
    <div className="flex -space-x-2">
      {users.slice(0, max).map(u => (
        <div key={u.id} title={u.fullName}><Avatar user={u} size="xs" ring /></div>
      ))}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-lg ring-2 ring-white bg-theme-lightest text-theme-deep text-[10px] font-bold flex items-center justify-center">
          +{extra}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status, interactive, size = 'md' }: { status: UserStatus | null; interactive?: boolean; size?: 'sm' | 'md' }) {
  if (!status) return <span className="text-xs text-theme-muted font-medium">Belirtilmedi</span>;
  const meta = USER_STATUS[status];
  const IconCmp = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full border whitespace-nowrap transition-shadow ${meta.className} ${
      size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-3 py-1.5'
    } ${interactive ? 'hover:shadow-sm' : ''}`}>
      <IconCmp size={size === 'sm' ? 12 : 14} weight="bold" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const meta = TASK_PRIORITY[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.className}`}>
      <meta.icon size={11} weight="fill" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${className}`}>{children}</span>;
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`h-2 rounded-full bg-theme-lightest overflow-hidden ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-theme-medium to-theme-deep origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct / 100 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-theme-text">{title}</h1>
        {description && <p className="text-theme-muted mt-2 font-medium">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: IconCmp, hint, onClick, active }: { label: string; value: ReactNode; icon: Icon; hint?: ReactNode; onClick?: () => void; active?: boolean }) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <span className="w-9 h-9 rounded-xl bg-theme-lightest text-theme-deep flex items-center justify-center">
          <IconCmp size={18} weight="duotone" aria-hidden="true" />
        </span>
      </div>
      <p className="text-3xl font-bold text-theme-text tabular">{value}</p>
      {hint && <div className="text-xs font-medium text-theme-muted">{hint}</div>}
    </>
  );
  const cls = 'card p-5 text-left flex flex-col gap-3 w-full h-full';
  if (!onClick) return <div className={cls}>{content}</div>;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`${cls} cursor-pointer hover:shadow-diffusion transition-shadow ${active ? 'ring-2 ring-theme-deep ring-offset-2 ring-offset-theme-cream' : ''}`}
    >
      {content}
    </motion.button>
  );
}

export function EmptyState({ icon: IconCmp, title, description, action }: { icon: Icon; title: string; description?: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-14 px-6 bg-white/60 rounded-3xl border border-theme-light/60 border-dashed"
    >
      <div className="w-14 h-14 bg-theme-lightest rounded-2xl flex items-center justify-center mx-auto mb-4 text-theme-deep">
        <IconCmp size={28} weight="duotone" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold text-theme-text mb-1">{title}</h3>
      {description && <p className="text-sm text-theme-muted max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </motion.div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-theme-lightest/80 rounded-2xl ${className}`} />;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  layoutId: string;
  label: string;
}

/** Seçili arka plan, seçenekler arasında kayarak geçer. */
export function Segmented<T extends string>({ value, onChange, options, layoutId, label }: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 p-1 bg-white rounded-2xl border border-theme-light/60 shadow-soft">
      {options.map(o => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={`relative px-3.5 py-2 text-sm font-semibold rounded-xl transition-colors min-h-[36px] ${selected ? 'text-theme-text' : 'text-theme-muted hover:text-theme-deep'}`}
          >
            {selected && (
              <motion.span layoutId={layoutId} className="absolute inset-0 bg-theme-lightest rounded-xl border border-theme-light/70" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.label}
              {o.count !== undefined && (
                <span className={`text-[11px] tabular px-1.5 rounded-md ${selected ? 'bg-white text-theme-deep' : 'bg-theme-lightest/70'}`}>{o.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
