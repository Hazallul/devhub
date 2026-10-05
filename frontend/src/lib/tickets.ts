import { Wrench, Key, Desktop, DotsThreeCircle, CircleDashed, MagnifyingGlass, ChatCircleDots, CheckCircle, Archive } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { Ticket, TicketPriority, TicketStatus, TicketType } from '../hooks/tickets';
import { parseServerDate } from './format';

/** Şirket içi talep türleri: çalışanın yönetime ilettiği ihtiyaçlar. */
export const TICKET_TYPE: Record<TicketType, { label: string; icon: Icon; hint: string }> = {
  ARIZA: { label: 'Arıza', icon: Wrench, hint: 'Bilgisayar yavaş, test ortamı çöktü, yazıcı çalışmıyor' },
  ERISIM: { label: 'Erişim / yetki', icon: Key, hint: 'VPN, sunucu, repo ya da uygulama erişimi' },
  EKIPMAN: { label: 'Ekipman', icon: Desktop, hint: 'Monitör, klavye, kulaklık, lisans' },
  DIGER: { label: 'Diğer', icon: DotsThreeCircle, hint: 'Yukarıdakilere uymayan her şey' },
};
export const TICKET_TYPES: TicketType[] = ['ARIZA', 'ERISIM', 'EKIPMAN', 'DIGER'];

/** Öncelik rengi her zaman adla birlikte gösterilir. Hedef süre (mesai): Acil 4 sa, Yüksek 1 gün, Normal 3 gün, Düşük 5 gün. */
export const TICKET_PRIORITY: Record<TicketPriority, { label: string; cls: string; sla: string; rank: number }> = {
  ACIL: { label: 'Acil', cls: 'bg-danger-solid text-white border-transparent', sla: '4 iş saati', rank: 0 },
  YUKSEK: { label: 'Yüksek', cls: 'bg-clay-soft text-clay-ink border-clay-line', sla: '1 iş günü', rank: 1 },
  NORMAL: { label: 'Normal', cls: 'bg-theme-lightest text-theme-text/80 border-theme-light', sla: '3 iş günü', rank: 2 },
  DUSUK: { label: 'Düşük', cls: 'bg-surface text-theme-muted border-theme-light', sla: '5 iş günü', rank: 3 },
};
export const TICKET_PRIORITIES: TicketPriority[] = ['ACIL', 'YUKSEK', 'NORMAL', 'DUSUK'];

export const TICKET_STATUS: Record<TicketStatus, { label: string; icon: Icon; cls: string }> = {
  YENI: { label: 'Yeni', icon: CircleDashed, cls: 'text-accent' },
  INCELENIYOR: { label: 'İnceleniyor', icon: MagnifyingGlass, cls: 'text-warn-ink' },
  YANIT_BEKLENIYOR: { label: 'Yanıt bekleniyor', icon: ChatCircleDots, cls: 'text-theme-muted' },
  COZULDU: { label: 'Çözüldü', icon: CheckCircle, cls: 'text-good' },
  KAPANDI: { label: 'Kapandı', icon: Archive, cls: 'text-theme-muted' },
};
export const TICKET_STATUSES: TicketStatus[] = ['YENI', 'INCELENIYOR', 'YANIT_BEKLENIYOR', 'COZULDU', 'KAPANDI'];

export const isOpenTicket = (t: Pick<Ticket, 'status'>) => t.status === 'YENI' || t.status === 'INCELENIYOR' || t.status === 'YANIT_BEKLENIYOR';

/** Çözüm hedefi metni: "2 sa 15 dk kaldı", "1 gün gecikti", "Talep edenden yanıt bekleniyor" … */
export function slaText(t: Ticket, now = Date.now()): { text: string; tone: 'danger' | 'warn' | 'muted' | 'good' } {
  if (t.status === 'COZULDU' || t.status === 'KAPANDI') {
    if (t.resolvedAt && t.dueAt) return parseServerDate(t.resolvedAt) <= parseServerDate(t.dueAt) ? { text: 'Hedef içinde çözüldü', tone: 'good' } : { text: 'Hedef aşılarak çözüldü', tone: 'muted' };
    return { text: TICKET_STATUS[t.status].label, tone: 'muted' };
  }
  if (t.status === 'YANIT_BEKLENIYOR') return { text: 'Talep edenden yanıt bekleniyor', tone: 'muted' };
  if (!t.dueAt) return { text: '-', tone: 'muted' };
  const diff = parseServerDate(t.dueAt).getTime() - now;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const span = h >= 24 ? `${Math.floor(h / 24)} gün${h % 24 ? ` ${h % 24} sa` : ''}` : h > 0 ? `${h} sa${m ? ` ${m} dk` : ''}` : `${m} dk`;
  if (diff < 0) return { text: `${span} gecikti`, tone: 'danger' };
  return { text: `${span} kaldı`, tone: diff < 4 * 3_600_000 ? 'warn' : 'muted' };
}
