import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Database, DownloadSimple, ArrowCounterClockwise, Trash, UploadSimple, ClockCounterClockwise, Warning, CheckCircle, FolderOpen, DotsThree,
} from '@phosphor-icons/react';
import { useMe } from '../hooks/api';
import { useBackups, useCreateBackup, useDeleteBackup, useRestoreBackup, useUploadBackup, type Backup } from '../hooks/backups';
import { PageHeader, Skeleton, EmptyState } from '../components/ui/primitives';
import Modal from '../components/ui/Modal';
import { Menu, MenuItem, MenuDivider } from '../components/ui/Menu';
import { useContextMenu, usePageMenu } from '../components/layout/ContextMenu';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../services/api';
import { downloadFile, fileSize } from '../lib/download';
import { parseServerDate, timeAgo } from '../lib/format';

const CONFIRM = 'GERİ YÜKLE';

const KIND_TONE: Record<Backup['kind'], string> = {
  OTOMATIK: 'bg-theme-lightest text-theme-text/80 border-theme-light',
  ELLE: 'bg-accent/[0.07] text-accent border-accent/25',
  GERI_YUKLEME_ONCESI: 'bg-warn-soft text-warn-ink border-warn-line',
  YUKLENEN: 'bg-theme-lightest text-theme-text/80 border-theme-light',
};

const dateTime = (iso: string) =>
  parseServerDate(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Yönetici: veritabanı yedekleri. Elle yedek, indirme, dosyadan yükleme, geri yükleme ve silme. */
export default function Backups() {
  const me = useMe();
  if (me.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <BackupsPage />;
}

function BackupsPage() {
  const { data, isLoading } = useBackups();
  const create = useCreateBackup();
  const upload = useUploadBackup();
  const remove = useDeleteBackup();
  const toast = useToast();
  const menu = useContextMenu();
  const fileInput = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState<Backup | null>(null);
  const [deleting, setDeleting] = useState<Backup | null>(null);
  const [rowMenu, setRowMenu] = useState<{ backup: Backup; anchor: HTMLElement } | null>(null);

  const items = data?.items ?? [];
  const download = (b: Backup) => downloadFile(`/admin/backups/${b.name}/download`, b.name).catch(e => toast.error(errorMessage(e)));
  const pickFile = () => fileInput.current?.click();

  usePageMenu([
    { label: 'Şimdi yedek al', icon: Database, onSelect: () => create.mutate(), disabled: create.isPending },
    { label: 'Yedek dosyası yükle', icon: UploadSimple, onSelect: pickFile },
  ]);

  const rowItems = (b: Backup) => [
    { label: 'İndir', icon: DownloadSimple, onSelect: () => download(b) },
    { label: 'Bu yedeğe geri dön', icon: ArrowCounterClockwise, onSelect: () => setRestoring(b), disabled: !b.restorable },
    'divider' as const,
    { label: 'Sil', icon: Trash, tone: 'danger' as const, onSelect: () => setDeleting(b) },
  ];

  const next = data?.nextAutomaticAt ? parseServerDate(data.nextAutomaticAt) : null;
  const nextText = !data ? '' : !data.lastAutomaticAt ? 'İlk otomatik yedek birkaç dakika içinde alınacak'
    : next && next.getTime() <= Date.now() ? 'Sıradaki otomatik yedek bir saat içinde alınacak'
    : `Sıradaki otomatik yedek ${timeAgo(data.nextAutomaticAt!)}`;

  return (
    <div>
      <PageHeader
        title="Yedekler"
        description="Bütün veriler (kullanıcılar, görevler, izinler, dokümanlar, loglar) tek dosyada yedeklenir. Bir şey ters giderse yedeğe geri dönebilirsiniz."
        actions={<>
          <button type="button" onClick={pickFile} disabled={upload.isPending} className="btn-ghost">
            <UploadSimple size={17} weight="bold" /> {upload.isPending ? 'Yükleniyor…' : 'Dosya yükle'}
          </button>
          <button type="button" onClick={() => create.mutate()} disabled={create.isPending} className="btn-primary">
            <Database size={17} weight="bold" /> {create.isPending ? 'Yedek alınıyor…' : 'Şimdi yedek al'}
          </button>
        </>}
      />
      <input ref={fileInput} type="file" accept=".gz,application/gzip" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />

      <section className="card p-5 mb-6 grid gap-5 md:grid-cols-3" aria-label="Otomatik yedek">
        <Fact icon={ClockCounterClockwise} label="Otomatik yedek" value={data ? `${data.intervalDays} günde bir` : '…'}
          hint={data ? `En yeni ${data.keepAuto} otomatik yedek saklanır; elle alınanlar siz silene kadar kalır.` : undefined} />
        <Fact icon={CheckCircle} label="Son otomatik yedek" value={data?.lastAutomaticAt ? timeAgo(data.lastAutomaticAt) : 'Henüz yok'}
          hint={data?.lastAutomaticAt ? dateTime(data.lastAutomaticAt) : undefined} />
        <Fact icon={FolderOpen} label="Nerede saklanıyor" value="devhub/backups klasörü"
          hint={nextText} />
      </section>

      {isLoading ? (
        <div className="card divide-y divide-theme-light">{[0, 1, 2].map(i => <div key={i} className="p-4"><Skeleton className="h-10" /></div>)}</div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Database} title="Henüz yedek yok" description="İlk yedeği şimdi alın; otomatik yedek de birkaç dakika içinde başlar."
            action={<button type="button" onClick={() => create.mutate()} className="btn-primary">Şimdi yedek al</button>} />
        </div>
      ) : (
        <ul className="card divide-y divide-theme-light" aria-label="Yedekler">
          {items.map(b => (
            <li key={b.name} onContextMenu={e => menu(e, { label: dateTime(b.createdAt), items: rowItems(b) })}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-theme-lightest/50 transition-colors">
              <Database size={20} className="text-theme-muted shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-theme-text">{dateTime(b.createdAt)}</p>
                <p className="text-xs text-theme-muted mt-0.5">
                  {timeAgo(b.createdAt)} · {fileSize(b.sizeBytes)}{b.createdBy ? ` · ${b.createdBy}` : ''}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${KIND_TONE[b.kind]}`}>{b.kindLabel}</span>
              {!b.restorable && (
                <span className="text-xs text-warn-ink flex items-center gap-1" title="Bu yedek uygulamanın başka bir sürümünde alındı; indirilebilir ama geri yüklenemez.">
                  <Warning size={14} weight="bold" aria-hidden="true" /> Eski sürüm
                </span>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <button type="button" onClick={() => download(b)} className="icon-btn" aria-label="İndir" title="İndir"><DownloadSimple size={18} /></button>
                <button type="button" onClick={e => setRowMenu({ backup: b, anchor: e.currentTarget })} className="icon-btn" aria-label="Diğer işlemler" title="Diğer işlemler">
                  <DotsThree size={20} weight="bold" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Menu open={!!rowMenu} onClose={() => setRowMenu(null)} anchor={rowMenu?.anchor} label="Yedek işlemleri">
        {rowMenu && <>
          <MenuItem icon={DownloadSimple} onSelect={() => { download(rowMenu.backup); setRowMenu(null); }}>İndir</MenuItem>
          <MenuItem icon={ArrowCounterClockwise} disabled={!rowMenu.backup.restorable} onSelect={() => { setRestoring(rowMenu.backup); setRowMenu(null); }}>Bu yedeğe geri dön</MenuItem>
          <MenuDivider />
          <MenuItem icon={Trash} tone="danger" onSelect={() => { setDeleting(rowMenu.backup); setRowMenu(null); }}>Sil</MenuItem>
        </>}
      </Menu>

      <RestoreModal backup={restoring} onClose={() => setRestoring(null)} />

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Yedek silinsin mi?" size="sm"
        description={deleting ? `${dateTime(deleting.createdAt)} tarihli yedek kalıcı olarak silinecek.` : undefined}
        footer={<>
          <button type="button" onClick={() => setDeleting(null)} className="btn-ghost">Vazgeç</button>
          <button type="button" disabled={remove.isPending} className="btn-danger"
            onClick={() => deleting && remove.mutate(deleting.name, { onSuccess: () => setDeleting(null) })}>Sil</button>
        </>}>
        <p className="text-sm text-theme-muted">Silmeden önce dosyayı indirip başka bir yerde saklayabilirsiniz.</p>
      </Modal>
    </div>
  );
}

function Fact({ icon: IconCmp, label, value, hint }: { icon: typeof Database; label: string; value: string; hint?: string }) {
  return (
    <div className="flex gap-3 min-w-0">
      <IconCmp size={20} className="text-theme-muted shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-theme-muted">{label}</p>
        <p className="text-sm font-semibold text-theme-text">{value}</p>
        {hint && <p className="text-xs text-theme-muted mt-1 text-pretty">{hint}</p>}
      </div>
    </div>
  );
}

/** Geri yükleme bütün veriyi değiştirir: ne olacağı açıkça yazılır ve kişiden onay ifadesini yazması istenir. */
function RestoreModal({ backup, onClose }: { backup: Backup | null; onClose: () => void }) {
  const restore = useRestoreBackup();
  const [text, setText] = useState('');
  const ok = text.trim().toLocaleUpperCase('tr-TR') === CONFIRM;
  const close = () => { setText(''); onClose(); };
  return (
    <Modal open={!!backup} onClose={close} title="Bu yedeğe geri dönülsün mü?" size="sm"
      onSubmit={e => { e.preventDefault(); if (backup && ok) restore.mutate({ name: backup.name, confirm: CONFIRM }); }}
      footer={<>
        <button type="button" onClick={close} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={!ok || restore.isPending} className="btn-danger">
          {restore.isPending ? 'Geri yükleniyor…' : 'Geri yükle'}
        </button>
      </>}>
      {backup && (
        <div className="space-y-4 text-sm">
          <p className="text-theme-text">
            Bütün veriler <strong className="font-semibold">{dateTime(backup.createdAt)}</strong> anındaki haline döner. O zamandan sonra yapılan
            değişiklikler (yeni görevler, izinler, yorumlar) silinir.
          </p>
          <ul className="space-y-1.5 text-theme-muted">
            <li className="flex gap-2"><CheckCircle size={16} className="shrink-0 mt-0.5 text-good" aria-hidden="true" /> Başlamadan önce şimdiki durumun yedeği alınır; gerekirse oradan geri dönebilirsiniz.</li>
            <li className="flex gap-2"><Warning size={16} className="shrink-0 mt-0.5 text-warn-ink" aria-hidden="true" /> Herkesin oturumu kapanır; yeniden giriş yapılır.</li>
          </ul>
          <div>
            <label htmlFor="restore-confirm" className="label">Onaylamak için <strong>{CONFIRM}</strong> yazın</label>
            <input id="restore-confirm" value={text} onChange={e => setText(e.target.value)} autoComplete="off" className="input" autoFocus />
          </div>
        </div>
      )}
    </Modal>
  );
}
