import type { Icon } from '@phosphor-icons/react';

/** Bugün panosunun ve liste görünümünün bölümü: başlık satırı + ince çizgiyle ayrılan satırlar. */
export function Panel({ title, icon: PanelIcon, count, tone, action, children, className = '' }: {
  title: string; icon: Icon; count?: number; tone?: 'danger'; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section aria-label={title} className={`card overflow-hidden flex flex-col ${className}`}>
      <header className="flex items-center gap-2 pl-3.5 pr-2 h-11 shrink-0 border-b border-theme-light">
        <PanelIcon size={16} weight="bold" className={tone === 'danger' ? 'text-danger' : 'text-theme-muted'} aria-hidden="true" />
        <h2 className="text-sm font-semibold text-theme-text">{title}</h2>
        {count !== undefined && count > 0 && <span className="text-xs tabular text-theme-muted">{count}</span>}
        <div className="ml-auto flex items-center gap-1">{action}</div>
      </header>
      {children}
    </section>
  );
}

/** Bölüm içindeki alt grup başlığı (Gecikmiş, Yarın, Bu hafta…) */
export function GroupLabel({ children, count, tone }: { children: React.ReactNode; count?: number; tone?: 'danger' }) {
  return (
    <p className={`px-3.5 pt-2.5 pb-1 text-xs font-medium ${tone === 'danger' ? 'text-danger' : 'text-theme-muted'}`}>
      {children}{count !== undefined && <span className="tabular"> · {count}</span>}
    </p>
  );
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-theme-muted text-center text-balance">{children}</p>;
}
