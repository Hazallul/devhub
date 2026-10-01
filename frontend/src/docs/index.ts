import type { Icon } from '@phosphor-icons/react';
import { RocketLaunch, GitBranch, TreeStructure, ShieldCheck, Info, Lightbulb, Warning, WarningOctagon, HourglassMedium, CheckCircle, XCircle, X } from '@phosphor-icons/react';
import { slugify } from '../lib/format';
import type { DocNode, DocRevisionStatus } from '../types';

/*
 * Dokümantasyon: dokümanlar veritabanındadır ve sitedeki editörle yazılır (hooks/docs.ts). Bu dosya yalnızca
 * kategorileri ve içerikle ilgili ortak yardımcıları tutar. Kategori listesi sunucudaki DocContent.CATEGORIES ile aynı olmalı.
 */

export interface DocCategory { id: string; name: string; icon: Icon }

export const DOC_CATEGORIES: DocCategory[] = [
  { id: 'baslarken', name: 'Başlarken', icon: RocketLaunch },
  { id: 'surecler', name: 'Süreçler', icon: GitBranch },
  { id: 'mimari', name: 'Mimari', icon: TreeStructure },
  { id: 'kalite', name: 'Kalite ve Operasyon', icon: ShieldCheck },
];

export const categoryName = (id: string) => DOC_CATEGORIES.find(c => c.id === id)?.name ?? id;

export const readMinutes = (plainText: string) => Math.max(1, Math.round(plainText.split(' ').length / 200));

export type CalloutKind = 'NOT' | 'IPUCU' | 'UYARI' | 'ONEMLI';

/** Bilgi kutuları: editör ve okuma görünümü aynı görünümü kullanır. Renk tek başına anlam taşımaz, etiket ve ikon her zaman var. */
export const CALLOUT: Record<CalloutKind, { label: string; icon: Icon; className: string; iconClass: string; hint: string }> = {
  NOT: { label: 'Not', icon: Info, className: 'bg-theme-lightest/70 border-theme-light', iconClass: 'text-theme-deep', hint: 'Ek bilgi' },
  IPUCU: { label: 'İpucu', icon: Lightbulb, className: 'bg-[#F1F5E6] border-[#C5D89D]', iconClass: 'text-[#5E7D2C]', hint: 'İşi kolaylaştıran öneri' },
  UYARI: { label: 'Uyarı', icon: Warning, className: 'bg-[#F7ECD0] border-[#E8D39C]', iconClass: 'text-[#6E5210]', hint: 'Dikkat edilmesi gereken' },
  ONEMLI: { label: 'Önemli', icon: WarningOctagon, className: 'bg-[#FBEDE5] border-[#EFC9B5]', iconClass: 'text-[#9A3B1B]', hint: 'Atlanmaması gereken kural' },
};
export const CALLOUT_KINDS = Object.keys(CALLOUT) as CalloutKind[];

/** Kod bloklarında seçilebilen diller (sunucu yalnızca biçimi denetler). */
export const CODE_LANGS: { id: string; label: string }[] = [
  { id: 'bash', label: 'Terminal' },
  { id: 'cmd', label: 'CMD' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'sql', label: 'SQL' },
  { id: 'java', label: 'Java' },
  { id: 'ts', label: 'TypeScript' },
  { id: 'tsx', label: 'TSX' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'http', label: 'HTTP' },
  { id: 'properties', label: 'Properties' },
  { id: 'text', label: 'Düz metin' },
];
export const langLabel = (id: unknown) => CODE_LANGS.find(l => l.id === id)?.label ?? (typeof id === 'string' && id ? id : 'Kod');

/** Bir düğümün düz metni */
export function nodeText(n: DocNode): string {
  if (n.type === 'text') return n.text ?? '';
  return (n.content ?? []).map(nodeText).join(n.type === 'paragraph' || n.type === 'heading' ? '' : ' ');
}

export interface OutlineItem { id: string; text: string; level: number }

/** Başlıklar ve sayfa içi bağlantı id'leri (aynı başlık iki kez geçerse -2, -3 eklenir). Okuma görünümü de aynı sırayı kullanır. */
export function docOutline(doc: DocNode | null | undefined): OutlineItem[] {
  const used = new Map<string, number>();
  return (doc?.content ?? []).filter(n => n.type === 'heading').map(h => {
    const text = nodeText(h).trim();
    const base = slugify(text) || 'baslik';
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return { id: count ? `${base}-${count + 1}` : base, text, level: Number(h.attrs?.level ?? 2) };
  });
}

/** Bağlantı yalnızca güvenli şemalarla açılır (sunucu da aynısını denetler). */
export function safeHref(href: unknown): string | null {
  if (typeof href !== 'string') return null;
  const h = href.trim();
  return /^(https?:\/\/|mailto:|tel:|#)/i.test(h) || (h.startsWith('/') && !h.startsWith('//')) ? h : null;
}

/** Boş doküman (editörün başlangıcı) */
export const EMPTY_DOC: DocNode = { type: 'doc', content: [{ type: 'paragraph' }] };

/** Önerinin durumu: etiket + ikon (renk tek başına anlam taşımaz). */
export const REVISION_STATUS: Record<DocRevisionStatus, { label: string; icon: Icon; className: string }> = {
  BEKLIYOR: { label: 'Onay bekliyor', icon: HourglassMedium, className: 'bg-theme-lightest text-theme-deep' },
  ONAYLANDI: { label: 'Yayınlandı', icon: CheckCircle, className: 'bg-[#F1F5E6] text-[#3F5A1A]' },
  REDDEDILDI: { label: 'Reddedildi', icon: XCircle, className: 'bg-[#FBEDE5] text-[#9A3B1B]' },
  GERI_CEKILDI: { label: 'Geri çekildi', icon: X, className: 'bg-theme-cream text-theme-muted' },
};
