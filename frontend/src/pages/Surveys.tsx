import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChartPieSlice, Plus, LockSimple, Users, CalendarBlank, CheckCircle, ArrowRight, PencilSimple, Copy } from '@phosphor-icons/react';
import { useMe } from '../hooks/api';
import { useSurveys, type SurveySummary } from '../hooks/surveys';
import { EmptyState, PageHeader, Segmented, Skeleton } from '../components/ui/primitives';
import { useContextMenu, usePageMenu } from '../components/layout/ContextMenu';
import { timeAgo } from '../lib/format';
import { SURVEY_STATE, closesText } from '../lib/surveys';

type Tab = 'OPEN' | 'DRAFT' | 'CLOSED';

/** Anket listesi. Çalışan: yanıt bekleyenler en üstte. Yönetici: açık / taslak / kapanan sekmeleri ve katılım oranı. */
export default function Surveys() {
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const navigate = useNavigate();
  const menu = useContextMenu();
  const { data, isLoading } = useSurveys();
  const [tab, setTab] = useState<Tab>('OPEN');

  usePageMenu(isAdmin ? [{ label: 'Yeni anket', icon: Plus, onSelect: () => navigate('/surveys/yeni') }] : []);

  const groups = useMemo(() => {
    const list = data ?? [];
    return {
      waiting: list.filter(s => s.state === 'ACIK' && s.recipient && !s.responded),
      answered: list.filter(s => s.responded && s.state === 'ACIK'),
      OPEN: list.filter(s => s.state === 'ACIK'),
      DRAFT: list.filter(s => s.state === 'TASLAK'),
      CLOSED: list.filter(s => s.state === 'KAPALI'),
    };
  }, [data]);

  const rowMenu = (s: SurveySummary) => [
    { label: s.state === 'TASLAK' ? 'Düzenle' : 'Aç', icon: s.state === 'TASLAK' ? PencilSimple : ArrowRight, onSelect: () => navigate(s.state === 'TASLAK' ? `/surveys/${s.id}/duzenle` : `/surveys/${s.id}`) },
    isAdmin && { label: 'Kopyasını oluştur', icon: Copy, onSelect: () => navigate(`/surveys/yeni?kopya=${s.id}`) },
  ];

  const list = (items: SurveySummary[], empty: { title: string; description: string }) => items.length === 0 ? (
    <div className="card"><EmptyState icon={ChartPieSlice} title={empty.title} description={empty.description}
      action={isAdmin && tab === 'OPEN' ? <Link to="/surveys/yeni" className="btn-primary">Yeni anket</Link> : undefined} /></div>
  ) : (
    <ul className="card divide-y divide-theme-light">
      {items.map(s => <SurveyRow key={s.id} s={s} admin={isAdmin} onContextMenu={e => menu(e, { label: s.title, items: rowMenu(s) })} />)}
    </ul>
  );

  return (
    <div className="pb-10">
      <PageHeader title="Anketler"
        description={isAdmin ? 'Ekibe anket gönderin, katılımı ve sonuçları takip edin.' : 'Size gönderilen anketler. Yanıtlamanız birkaç dakika sürer.'}
        actions={isAdmin ? <Link to="/surveys/yeni" className="btn-primary"><Plus size={16} weight="bold" /> Yeni anket</Link> : undefined} />

      {isLoading ? (
        <div className="card divide-y divide-theme-light">{[0, 1, 2].map(i => <div key={i} className="p-4"><Skeleton className="h-12" /></div>)}</div>
      ) : isAdmin ? (
        <>
          <div className="mb-4">
            <Segmented<Tab> label="Anket durumu" layoutId="survey-tab" value={tab} onChange={setTab}
              options={[{ value: 'OPEN', label: 'Açık', count: groups.OPEN.length }, { value: 'DRAFT', label: 'Taslaklar', count: groups.DRAFT.length }, { value: 'CLOSED', label: 'Kapanan', count: groups.CLOSED.length }]} />
          </div>
          {list(groups[tab], tab === 'OPEN'
            ? { title: 'Açık anket yok', description: 'Yeni bir anket hazırlayıp ekibe gönderin.' }
            : tab === 'DRAFT' ? { title: 'Taslak yok', description: 'Kaydedip yayınlamadığınız anketler burada durur.' }
            : { title: 'Kapanan anket yok', description: 'Son tarihi geçen ya da kapattığınız anketler burada.' })}
        </>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-theme-text mb-2">Yanıtınızı bekleyenler</h2>
            {groups.waiting.length === 0
              ? <p className="card px-4 py-6 text-sm text-theme-muted text-center">Yanıt bekleyen anket yok.</p>
              : <ul className="card divide-y divide-theme-light">{groups.waiting.map(s => <SurveyRow key={s.id} s={s} admin={false} />)}</ul>}
          </section>
          {(groups.answered.length > 0 || groups.CLOSED.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-theme-text mb-2">Diğer anketler</h2>
              <ul className="card divide-y divide-theme-light">{[...groups.answered, ...groups.CLOSED].map(s => <SurveyRow key={s.id} s={s} admin={false} />)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SurveyRow({ s, admin, onContextMenu }: { s: SurveySummary; admin: boolean; onContextMenu?: (e: React.MouseEvent) => void }) {
  const st = SURVEY_STATE[s.state];
  const rate = s.recipientCount ? s.respondedCount / s.recipientCount : 0;
  const to = admin && s.state === 'TASLAK' ? `/surveys/${s.id}/duzenle` : `/surveys/${s.id}`;
  const waiting = !admin && s.state === 'ACIK' && !s.responded;
  return (
    <li onContextMenu={onContextMenu}>
      <Link to={to} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-theme-lightest/50 transition-colors">
        <ChartPieSlice size={20} className={waiting ? 'text-accent' : 'text-theme-muted'} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-theme-text">{s.title}</p>
          <p className="text-xs text-theme-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>{s.questionCount} soru</span>
            {s.anonymous && <span className="inline-flex items-center gap-1"><LockSimple size={11} weight="bold" aria-hidden="true" /> Anonim</span>}
            {admin && <span className="inline-flex items-center gap-1"><Users size={11} weight="bold" aria-hidden="true" /> {s.audienceLabel}</span>}
            {s.state !== 'TASLAK' && <span className="inline-flex items-center gap-1"><CalendarBlank size={11} weight="bold" aria-hidden="true" /> {closesText(s)}</span>}
            {s.state === 'TASLAK' && <span>{timeAgo(s.createdAt)} oluşturuldu</span>}
          </p>
        </div>
        {admin && s.state !== 'TASLAK' && (
          <div className="w-40" title={`${s.respondedCount} / ${s.recipientCount} kişi yanıtladı`}>
            <div className="flex justify-between text-xs text-theme-muted mb-1"><span>Katılım</span><span className="tabular text-theme-text font-medium">{s.respondedCount}/{s.recipientCount}</span></div>
            <div className="h-1.5 rounded-full bg-theme-lightest overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${rate * 100}%` }} /></div>
          </div>
        )}
        {!admin && s.responded && <span className="inline-flex items-center gap-1 text-xs font-medium text-good-ink"><CheckCircle size={14} weight="fill" aria-hidden="true" /> Yanıtladınız</span>}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
        {waiting && <span className="btn-primary min-h-[2rem] px-3 text-xs">Yanıtla</span>}
      </Link>
    </li>
  );
}
