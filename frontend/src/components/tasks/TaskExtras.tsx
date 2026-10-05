import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare, Square, Trash, DotsSixVertical, Plus, Tag, Check, Paperclip, UploadSimple, FileText, FilePdf, FileZip, FileXls, FileDoc,
  Lock, LockOpen, X, ArrowSquareOut, MagnifyingGlass, ImageSquare,
} from '@phosphor-icons/react';
import api, { errorMessage } from '../../services/api';
import Combobox from '../ui/Combobox';
import Modal from '../ui/Modal';
import { Menu } from '../ui/Menu';
import { useToast } from '../ui/Toast';
import { useQuickActions } from '../layout/QuickActions';
import { useAllTasks, useMe } from '../../hooks/api';
import {
  useAddDependency, useAddSubtask, useCreateLabel, useDeleteAttachment, useDeleteSubtask, useDependencies, useLabels, useRemoveDependency,
  useReorderSubtasks, useSetTaskLabels, useSubtasks, useAttachments, useUpdateSubtask, useUploadAttachment, type AttachmentScope,
} from '../../hooks/taskExtras';
import { LABEL_COLORS } from '../../lib/labels';
import { TASK_STATUS } from '../../lib/meta';
import { downloadFile, fileSize } from '../../lib/download';
import { timeAgo, trLower } from '../../lib/format';
import type { AttachmentInfo, Label, Subtask, Task, TaskRef } from '../../types';

// ======================================================================= kart rozetleri

/** Etiket çipleri (kartlarda ve tabloda). max aşılırsa "+n". */
export function LabelChips({ ids, max = 3, className = '' }: { ids?: number[]; max?: number; className?: string }) {
  const { data: labels } = useLabels();
  if (!ids?.length || !labels) return null;
  const byId = new Map(labels.map(l => [l.id, l]));
  const list = ids.map(id => byId.get(id)).filter((l): l is Label => !!l);
  if (!list.length) return null;
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      {list.slice(0, max).map(l => <span key={l.id} className={`label-chip ${LABEL_COLORS[l.color].cls}`}>{l.name}</span>)}
      {list.length > max && <span className="text-[0.6875rem] text-theme-muted" title={list.slice(max).map(l => l.name).join(', ')}>+{list.length - max}</span>}
    </span>
  );
}

/** Kartın altındaki küçük göstergeler: alt görev ilerlemesi, ek sayısı, bekleme kilidi. */
export function TaskBadges({ task, className = '' }: { task: Task; className?: string }) {
  const waiting = task.openBlockerIds?.length ?? 0;
  const total = task.subtasksTotal ?? 0;
  const files = task.attachmentCount ?? 0;
  if (!waiting && !total && !files) return null;
  return (
    <span className={`inline-flex items-center gap-2 text-xs text-theme-muted ${className}`}>
      {waiting > 0 && task.status !== 'TAMAMLANDI' && (
        <span className="inline-flex items-center gap-0.5 font-medium text-warn-ink" title={`${waiting} görevin bitmesini bekliyor; o zamana kadar başlatılamaz`}>
          <Lock size={12} weight="bold" aria-hidden="true" /> Bekliyor
        </span>
      )}
      {total > 0 && (
        <span className={`inline-flex items-center gap-0.5 tabular ${task.subtasksDone === total ? 'text-good-ink' : ''}`} title={`${task.subtasksDone} / ${total} alt görev tamamlandı`}>
          <CheckSquare size={12} weight="bold" aria-hidden="true" /> {task.subtasksDone}/{total}
        </span>
      )}
      {files > 0 && (
        <span className="inline-flex items-center gap-0.5 tabular" title={`${files} dosya eki`}>
          <Paperclip size={12} weight="bold" aria-hidden="true" /> {files}
        </span>
      )}
    </span>
  );
}

// ======================================================================= etiket seçici

export function LabelPicker({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const { data: labels } = useLabels();
  const setLabels = useSetTaskLabels();
  const create = useCreateLabel();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = task.labelIds ?? [];

  useEffect(() => {
    if (!anchor) return;
    setQuery('');
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [anchor]);

  const q = trLower(query.trim());
  const shown = (labels ?? []).filter(l => !q || trLower(l.name).includes(q));
  const exact = (labels ?? []).some(l => trLower(l.name) === q);
  const toggle = (id: number) => setLabels.mutate({ taskId: task.id, labelIds: selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id] });
  const createAndAdd = () => {
    const name = query.trim();
    if (!name) return;
    create.mutate({ name }, { onSuccess: l => { setLabels.mutate({ taskId: task.id, labelIds: [...selected, l.id] }); setQuery(''); } });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <LabelChips ids={selected} max={8} />
      {canEdit && (
        <button type="button" onClick={e => setAnchor(anchor ? null : e.currentTarget)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-theme-light px-1.5 py-px text-[0.6875rem] font-medium text-theme-muted hover:text-theme-text hover:border-theme-dark/40 transition-colors">
          <Tag size={12} weight="bold" aria-hidden="true" /> {selected.length ? 'Düzenle' : 'Etiket ekle'}
        </button>
      )}
      {!canEdit && !selected.length && <span className="text-sm text-theme-muted font-normal">Etiket yok</span>}
      <Menu open={!!anchor} onClose={() => setAnchor(null)} anchor={anchor} align="start" width={260} label="Etiketler">
        <div className="relative p-1">
          <MagnifyingGlass size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} maxLength={40} placeholder="Etiket ara ya da oluştur"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (q && !exact) createAndAdd(); else if (shown[0]) toggle(shown[0].id); } }}
            className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-theme-lightest text-sm text-theme-text placeholder:text-theme-muted focus:outline-none focus:bg-surface border border-transparent focus:border-theme-light" />
        </div>
        <div className="max-h-64 overflow-y-auto scrollbar-thin py-1">
          {shown.map(l => {
            const on = selected.includes(l.id);
            return (
              <button key={l.id} type="button" role="menuitem" onClick={() => toggle(l.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm hover:bg-theme-lightest/70 focus-visible:bg-theme-lightest/70 outline-none">
                <span className={`w-2.5 h-2.5 rounded-full label-dot ${LABEL_COLORS[l.color].cls}`} aria-hidden="true" />
                <span className="flex-1 truncate">{l.name}</span>
                {on && <Check size={14} weight="bold" className="text-theme-deep" aria-label="seçili" />}
              </button>
            );
          })}
          {q && !exact && (
            <button type="button" role="menuitem" onClick={createAndAdd} disabled={create.isPending}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm text-theme-deep hover:bg-theme-lightest/70 outline-none">
              <Plus size={14} weight="bold" aria-hidden="true" /> "{query.trim()}" etiketini oluştur
            </button>
          )}
          {!shown.length && !q && <p className="px-2.5 py-2 text-xs text-theme-muted">Henüz etiket yok. Yazarak ilk etiketi oluşturun.</p>}
        </div>
      </Menu>
    </div>
  );
}

// ======================================================================= alt görevler

export function Subtasks({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const { data: items, isLoading } = useSubtasks(task.id);
  const add = useAddSubtask(task.id);
  const update = useUpdateSubtask(task.id);
  const remove = useDeleteSubtask(task.id);
  const reorder = useReorderSubtasks(task.id);
  const [order, setOrder] = useState<Subtask[]>([]);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (items) setOrder(items); }, [items]);

  const done = order.filter(s => s.done).length;
  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    add.mutate(v, { onSuccess: () => { setDraft(''); inputRef.current?.focus(); } });
  };

  return (
    <section aria-labelledby={`subtasks-${task.id}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 id={`subtasks-${task.id}`} className="eyebrow">Alt görevler</h3>
        {order.length > 0 && <span className="text-xs text-theme-muted tabular">{done}/{order.length} tamamlandı</span>}
      </div>
      {order.length > 0 && (
        <div className="h-1 rounded-full bg-theme-lightest overflow-hidden mb-2" aria-hidden="true">
          <motion.div className="h-full bg-good rounded-full" initial={false} animate={{ width: `${(done / order.length) * 100}%` }} />
        </div>
      )}
      {isLoading ? null : (
        <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-0.5">
          {order.map(s => (
            <SubtaskRow key={s.id} item={s} canEdit={canEdit}
              onToggle={() => update.mutate({ id: s.id, done: !s.done })}
              onRename={title => update.mutate({ id: s.id, title })}
              onDelete={() => remove.mutate(s.id)}
              onDragEnd={() => { const ids = order.map(x => x.id); if (items && ids.join() !== items.map(x => x.id).join()) reorder.mutate(ids); }} />
          ))}
        </Reorder.Group>
      )}
      {canEdit && (
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <Plus size={14} className="text-theme-muted shrink-0" aria-hidden="true" />
          <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} maxLength={300}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') { e.stopPropagation(); setDraft(''); } }}
            placeholder="Alt görev ekle (Enter)" aria-label="Yeni alt görev"
            className="flex-1 min-w-0 bg-transparent py-1.5 text-sm text-theme-text placeholder:text-theme-muted focus:outline-none border-b border-transparent focus:border-theme-light" />
        </div>
      )}
      {!canEdit && order.length === 0 && !isLoading && <p className="text-sm text-theme-muted">Alt görev yok.</p>}
    </section>
  );
}

function SubtaskRow({ item, canEdit, onToggle, onRename, onDelete, onDragEnd }: {
  item: Subtask; canEdit: boolean; onToggle: () => void; onRename: (t: string) => void; onDelete: () => void; onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const save = () => {
    setEditing(false);
    const v = title.trim();
    if (v && v !== item.title) onRename(v);
    else setTitle(item.title);
  };
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} onDragEnd={onDragEnd}
      className="group flex items-center gap-2 rounded-lg px-1 py-1 bg-surface hover:bg-theme-lightest/60">
      {canEdit && (
        <button type="button" onPointerDown={e => controls.start(e)} className="cursor-grab active:cursor-grabbing text-theme-muted opacity-0 group-hover:opacity-100 focus:opacity-100 touch-none" aria-label="Sırayı değiştirmek için sürükleyin">
          <DotsSixVertical size={14} weight="bold" />
        </button>
      )}
      <button type="button" onClick={onToggle} disabled={!canEdit} aria-pressed={item.done} aria-label={item.done ? 'Tamamlanmadı yap' : 'Tamamlandı yap'}
        className={`shrink-0 ${item.done ? 'text-good' : 'text-theme-muted hover:text-theme-text'} disabled:cursor-default`}>
        {item.done ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
      </button>
      {editing ? (
        <input value={title} autoFocus onChange={e => setTitle(e.target.value)} onBlur={save} maxLength={300}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); setTitle(item.title); setEditing(false); } }}
          className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none border-b border-theme-light" />
      ) : (
        <span onDoubleClick={() => canEdit && setEditing(true)} title={item.done && item.doneByName ? `${item.doneByName} tamamladı` : canEdit ? 'Düzenlemek için çift tıklayın' : undefined}
          className={`flex-1 min-w-0 text-sm break-words ${item.done ? 'text-theme-muted line-through decoration-theme-light' : 'text-theme-text'}`}>
          {item.title}
        </span>
      )}
      {canEdit && !editing && (
        <button type="button" onClick={onDelete} className="icon-btn w-7 h-7 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger" aria-label={`${item.title}: sil`} title="Sil">
          <Trash size={13} />
        </button>
      )}
    </Reorder.Item>
  );
}

// ======================================================================= bağımlılıklar

export function Dependencies({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const { data } = useDependencies(task.id);
  const { data: tasks } = useAllTasks();
  const add = useAddDependency(task.id);
  const remove = useRemoveDependency(task.id);
  const { openTask } = useQuickActions();
  const blockedBy = data?.blockedBy ?? [];
  const blocking = data?.blocking ?? [];
  const linked = new Set([task.id, ...blockedBy.map(r => r.id), ...blocking.map(r => r.id)]);
  const options = useMemo(() => (tasks ?? [])
    .filter(t => !linked.has(t.id) && t.status !== 'TAMAMLANDI')
    .map(t => ({ value: String(t.id), label: t.content, hint: TASK_STATUS[t.status ?? 'YAPILACAK'].label })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [tasks, data]);
  const waiting = blockedBy.filter(r => r.status !== 'TAMAMLANDI').length;

  if (!canEdit && !blockedBy.length && !blocking.length) return null;
  return (
    <section aria-labelledby={`deps-${task.id}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 id={`deps-${task.id}`} className="eyebrow">Bağımlılıklar</h3>
        {waiting > 0 && task.status !== 'TAMAMLANDI' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warn-ink"><Lock size={12} weight="bold" aria-hidden="true" /> {waiting} görev bitmeden başlanamaz</span>
        )}
      </div>
      {blockedBy.length > 0 && <RefList title="Önce bitmesi gerekenler" refs={blockedBy} canRemove={canEdit} onRemove={id => remove.mutate(id)} onOpen={openTask} />}
      {blocking.length > 0 && <RefList title="Bu görevi bekleyenler" refs={blocking} onOpen={openTask} />}
      {canEdit && (
        <div className="mt-2">
          <Combobox label="Bu görevden önce bitmesi gereken görev" value="" onChange={v => v && add.mutate(Number(v))} width={360}
            placeholder="+ Önce bitmesi gereken görevi seç" searchPlaceholder="Görev ara" emptyText="Uygun görev yok" options={options} />
          <p className="text-xs text-theme-muted mt-1">Seçilen görev tamamlanmadan bu görev "Devam ediyor"a alınamaz. Bitince size bildirim gelir.</p>
        </div>
      )}
    </section>
  );
}

function RefList({ title, refs, canRemove, onRemove, onOpen }: { title: string; refs: TaskRef[]; canRemove?: boolean; onRemove?: (id: number) => void; onOpen: (id: number) => void }) {
  return (
    <div className="mb-2">
      <p className="text-xs text-theme-muted mb-1">{title}</p>
      <ul className="rounded-xl border border-theme-light divide-y divide-theme-light">
        {refs.map(r => {
          const meta = TASK_STATUS[r.status];
          const done = r.status === 'TAMAMLANDI';
          return (
            <li key={r.id} className="group flex items-center gap-2 px-3 py-2">
              {done ? <LockOpen size={14} className="text-good shrink-0" aria-label="Tamamlandı" /> : <meta.icon size={14} weight="bold" className={`shrink-0 ${meta.className}`} aria-label={meta.label} />}
              <button type="button" onClick={() => onOpen(r.id)} className="flex-1 min-w-0 text-left text-sm truncate hover:underline underline-offset-4" title="Görevi aç">
                <span className={done ? 'text-theme-muted line-through decoration-theme-light' : 'text-theme-text'}>{r.content}</span>
              </button>
              <span className="text-xs text-theme-muted shrink-0 truncate max-w-[8rem]">{r.userName ?? 'Atanmamış'}</span>
              {canRemove && onRemove && (
                <button type="button" onClick={() => onRemove(r.id)} className="icon-btn w-7 h-7 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Bağımlılığı kaldır" title="Bağımlılığı kaldır">
                  <X size={13} weight="bold" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ======================================================================= dosya ekleri

const isImage = (a: AttachmentInfo) => a.contentType.startsWith('image/');

function fileIcon(a: AttachmentInfo) {
  if (a.contentType === 'application/pdf') return FilePdf;
  if (a.contentType.includes('zip')) return FileZip;
  if (a.contentType.includes('sheet') || a.contentType.includes('excel') || a.contentType === 'text/csv') return FileXls;
  if (a.contentType.includes('word')) return FileDoc;
  return FileText;
}

/** Görsel önizleme: dosya oturumla indirilip tarayıcıda geçici adres olarak gösterilir. */
function useAttachmentUrl(a: AttachmentInfo | null) {
  return useQuery({
    queryKey: ['attachment-blob', a?.id],
    enabled: !!a && isImage(a),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    queryFn: async () => URL.createObjectURL((await api.get<Blob>(`/attachments/${a!.id}`, { responseType: 'blob' })).data),
  }).data;
}

export function Attachments({ task }: { task: Task }) {
  const me = useMe();
  return <AttachmentPanel scope="tasks" id={task.id} canDelete={a => me.role === 'ADMIN' || a.uploaderId === me.id || task.userId === me.id} />;
}

/**
 * Dosya ekleri (görev ve destek talebi ortak): sürükle-bırak, seçme, Ctrl+V ile ekran görüntüsü yapıştırma,
 * görsellerde küçük önizleme ve büyütme, diğer dosyalar indirilir.
 */
export function AttachmentPanel({ scope, id, canDelete }: { scope: AttachmentScope; id: number; canDelete: (a: AttachmentInfo) => boolean }) {
  const { data: files } = useAttachments(scope, id);
  const upload = useUploadAttachment(scope, id);
  const remove = useDeleteAttachment();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<AttachmentInfo | null>(null);

  const send = (list: FileList | File[]) => Array.from(list).forEach(f => upload.mutate(f));

  // Ekran görüntüsü yapıştırma: çekmece açıkken bir yazı alanında değilken Ctrl+V.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const pasted = Array.from(e.clipboardData?.files ?? []);
      if (!pasted.length) return;
      e.preventDefault();
      send(pasted.map((f, i) => (f.name === 'image.png' ? new File([f], `ekran-goruntusu-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}${i ? `-${i}` : ''}.png`, { type: f.type }) : f)));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, id]);

  const download = (a: AttachmentInfo) => downloadFile(`/attachments/${a.id}`, a.fileName).catch(e => toast.error(errorMessage(e)));

  return (
    <section aria-labelledby={`files-${scope}-${id}`}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); setOver(false); send(e.dataTransfer.files); } }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 id={`files-${scope}-${id}`} className="eyebrow">Dosyalar</h3>
        <button type="button" onClick={() => input.current?.click()} disabled={upload.isPending}
          className="inline-flex items-center gap-1 text-xs font-medium text-theme-deep hover:underline underline-offset-4 rounded">
          <UploadSimple size={13} weight="bold" aria-hidden="true" /> {upload.isPending ? 'Yükleniyor…' : 'Dosya ekle'}
        </button>
        <input ref={input} type="file" multiple className="hidden" onChange={e => { if (e.target.files) send(e.target.files); e.target.value = ''; }} />
      </div>
      <div className={`rounded-xl border border-dashed transition-colors ${over ? 'border-accent bg-accent/[0.05]' : 'border-theme-light'} ${files?.length ? 'p-2' : 'p-4'}`}>
        {files?.length ? (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <AnimatePresence initial={false}>
              {files.map(a => (
                <motion.li key={a.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="group relative rounded-lg border border-theme-light bg-surface overflow-hidden">
                  <button type="button" onClick={() => (isImage(a) ? setPreview(a) : download(a))} className="block w-full text-left" title={isImage(a) ? 'Büyüt' : 'İndir'}>
                    <Thumb a={a} />
                    <span className="block px-2 py-1.5">
                      <span className="block text-xs font-medium text-theme-text truncate">{a.fileName}</span>
                      <span className="block text-[0.6875rem] text-theme-muted truncate">{fileSize(a.sizeBytes)} · {timeAgo(a.createdAt)}</span>
                    </span>
                  </button>
                  {canDelete(a) && (
                    <button type="button" onClick={() => remove.mutate(a.id)} aria-label={`${a.fileName}: sil`} title="Sil"
                      className="absolute top-1 right-1 w-7 h-7 rounded-md bg-surface/90 border border-theme-light text-theme-muted hover:text-danger flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <Trash size={13} />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <p className="text-sm text-theme-muted text-center">
            Dosyayı buraya sürükleyin, <button type="button" onClick={() => input.current?.click()} className="text-theme-deep font-medium hover:underline underline-offset-4">seçin</button> ya da ekran görüntüsünü Ctrl+V ile yapıştırın.
            <span className="block text-xs mt-1">Görsel, PDF, Office belgesi, metin, zip · en fazla 10 MB</span>
          </p>
        )}
      </div>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.fileName ?? ''} size="xl"
        footer={preview && <>
          <button type="button" onClick={() => download(preview)} className="btn-secondary"><ArrowSquareOut size={16} /> İndir</button>
          <button type="button" onClick={() => setPreview(null)} className="btn-primary">Kapat</button>
        </>}>
        {preview && <PreviewImage a={preview} />}
      </Modal>
    </section>
  );
}

function Thumb({ a }: { a: AttachmentInfo }) {
  const url = useAttachmentUrl(a);
  if (isImage(a)) {
    return (
      <span className="block aspect-[4/3] bg-theme-lightest">
        {url ? <img src={url} alt={a.fileName} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-theme-muted"><ImageSquare size={22} /></span>}
      </span>
    );
  }
  const IconCmp = fileIcon(a);
  return <span className="flex aspect-[4/3] items-center justify-center bg-theme-lightest text-theme-muted"><IconCmp size={28} /></span>;
}

function PreviewImage({ a }: { a: AttachmentInfo }) {
  const url = useAttachmentUrl(a);
  return url ? <img src={url} alt={a.fileName} className="max-h-[70vh] w-auto mx-auto rounded-lg" /> : <div className="h-64" />;
}

