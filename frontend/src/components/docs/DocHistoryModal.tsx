import { useState } from 'react';
import { ArrowLeft, ArrowCounterClockwise, Eye } from '@phosphor-icons/react';
import Modal from '../ui/Modal';
import { Skeleton } from '../ui/primitives';
import DocContent from './DocContent';
import { useDocHistory, useDocRevision, useSubmitDoc } from '../../hooks/docs';
import { useToast } from '../ui/Toast';
import { errorMessage } from '../../services/api';
import { parseServerDate } from '../../lib/format';
import type { DocDetail } from '../../types';

const dateTime = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Yayınlanmış sürümler; biri açılıp okunabilir, yönetici eski bir sürümü geri yükleyebilir (yeni bir sürüm olarak). */
export default function DocHistoryModal({ doc, open, onClose, isAdmin }: { doc: DocDetail; open: boolean; onClose: () => void; isAdmin: boolean }) {
  const { data: history, isLoading } = useDocHistory(doc.slug, open);
  const [viewing, setViewing] = useState<number | null>(null);
  const { data: rev } = useDocRevision(viewing);
  const submit = useSubmitDoc();
  const toast = useToast();
  const versionOf = (id: number) => (history ? history.length - history.findIndex(h => h.id === id) : 0);

  const restore = () => {
    if (!rev?.content) return;
    submit.mutate(
      {
        docId: doc.id, baseVersion: doc.version, force: true, title: rev.title, summary: rev.summary ?? '', category: rev.category, tags: rev.tags,
        content: rev.content, note: `Sürüm ${versionOf(rev.id)} geri yüklendi`,
      },
      {
        onSuccess: () => { toast.success(`Sürüm ${versionOf(rev.id)} geri yüklendi`); setViewing(null); onClose(); },
        onError: err => toast.error(errorMessage(err)),
      },
    );
  };

  const close = () => { setViewing(null); onClose(); };

  return (
    <Modal open={open} onClose={close} size={viewing ? 'xl' : 'lg'} title={viewing ? `Sürüm ${versionOf(viewing)}` : 'Sürüm geçmişi'}
      description={viewing ? undefined : `${doc.title} · her onaylanan değişiklik yeni bir sürümdür`}>
      {viewing ? (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button type="button" onClick={() => setViewing(null)} className="btn-secondary min-h-[38px] px-3 text-sm"><ArrowLeft size={15} weight="bold" /> Geçmişe dön</button>
            {isAdmin && versionOf(viewing) !== history?.length && (
              <button type="button" onClick={restore} disabled={!rev || submit.isPending} className="btn-primary min-h-[38px] px-3 text-sm">
                <ArrowCounterClockwise size={15} weight="bold" /> Bu sürümü geri yükle
              </button>
            )}
          </div>
          {rev?.content ? (
            <div className="rounded-2xl border border-theme-light/60 p-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <h3 className="text-2xl font-bold mb-1">{rev.title}</h3>
              {rev.summary && <p className="text-theme-muted font-medium mb-4">{rev.summary}</p>}
              <DocContent doc={rev.content} />
            </div>
          ) : <Skeleton className="h-64" />}
        </div>
      ) : isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <ol className="space-y-2">
          {history?.map((h, i) => (
            <li key={h.id} className="flex items-start gap-3 p-3 rounded-2xl border border-theme-light/50">
              <span className={`shrink-0 w-12 text-center text-xs font-bold rounded-lg py-1 ${i === 0 ? 'bg-theme-deep text-white' : 'bg-theme-lightest text-theme-deep'}`}>
                v{history.length - i}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-theme-text">
                  {h.note ?? 'Değişiklik'}
                  {i === 0 && <span className="ml-2 text-[11px] font-bold text-theme-deep">· Şu anki sürüm</span>}
                </p>
                <p className="text-xs text-theme-muted font-semibold mt-0.5">
                  {h.authorName ?? 'Silinmiş kullanıcı'}
                  {h.decidedByName && h.decidedById !== h.authorId && ` · ${h.decidedByName} onayladı`}
                  {h.decidedAt && ` · ${dateTime.format(parseServerDate(h.decidedAt))}`}
                </p>
              </div>
              <button type="button" onClick={() => setViewing(h.id)} className="btn-secondary min-h-[36px] px-3 text-xs shrink-0"><Eye size={14} weight="bold" /> Görüntüle</button>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
