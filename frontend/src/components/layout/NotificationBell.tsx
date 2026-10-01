import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Icon } from '@phosphor-icons/react';
import {
  Bell, CheckSquare, CalendarCheck, CalendarBlank, ArrowCounterClockwise, Briefcase, Lightning, Megaphone, Clock, Checks, CheckCircle, ChatCircleText, ListChecks, IdentificationCard, Alarm, UsersThree, BookOpenText,
} from '@phosphor-icons/react';
import { Menu } from '../ui/Menu';
import { Skeleton } from '../ui/primitives';
import { useNotifications, useUnreadCount, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/api';
import { timeAgo } from '../../lib/format';
import type { AppNotification, NotificationType } from '../../types';

const TYPE_ICON: Record<NotificationType, Icon> = {
  TASK_ASSIGNED: CheckSquare,
  TASK_DUE: Clock,
  TASK_COMPLETED: CheckCircle,
  TASK_COMMENT: ChatCircleText,
  TODO_RECEIVED: ListChecks,
  TODO_REMINDER: Alarm,
  TODO_LIST_ADDED: UsersThree,
  TODO_COMMENT: ChatCircleText,
  DOC_REVISION_REQUESTED: BookOpenText,
  DOC_REVISION_DECIDED: BookOpenText,
  PROFILE_REQUESTED: IdentificationCard,
  PROFILE_DECIDED: IdentificationCard,
  LEAVE_REQUESTED: CalendarBlank,
  LEAVE_DECIDED: CalendarCheck,
  LEAVE_REOPENED: ArrowCounterClockwise,
  PROJECT_ASSIGNED: Briefcase,
  STATUS_CHANGED: Lightning,
  ANNOUNCEMENT: Megaphone,
};


/** Üst bardaki bildirim zili: okunmamış sayısı 30 sn'de bir tazelenir, panel açılınca liste çekilir. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const { data: unread } = useUnreadCount();
  const { data: items, isLoading } = useNotifications(open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const count = unread?.count ?? 0;

  const openItem = (n: AppNotification) => {
    setOpen(false);
    if (!n.read) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <>
      <button
        ref={setAnchor}
        onClick={() => setOpen(o => !o)}
        className="icon-btn relative"
        aria-label={count ? `Bildirimler, ${count} okunmamış` : 'Bildirimler'}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Bildirimler"
      >
        <motion.span
          key={count}
          animate={count ? { rotate: [0, -14, 12, -8, 0] } : undefined}
          transition={{ duration: 0.5 }}
          className="flex"
        >
          <Bell size={20} weight={count ? 'fill' : 'bold'} />
        </motion.span>
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#9A3B1B] text-white text-[10px] font-bold tabular flex items-center justify-center ring-2 ring-theme-cream"
            >
              {count > 9 ? '9+' : count}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <Menu open={open} onClose={() => setOpen(false)} anchor={anchor} width={380} label="Bildirimler">
        <div className="flex items-center justify-between px-3 pt-2 pb-2.5 border-b border-theme-light/50 mb-1">
          <p className="text-sm font-bold text-theme-text">Bildirimler</p>
          {count > 0 && (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              className="text-xs font-bold text-theme-deep hover:underline underline-offset-4 inline-flex items-center gap-1"
            >
              <Checks size={14} weight="bold" /> Tümünü okundu say
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="space-y-2 p-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : !items?.length ? (
            <div className="text-center py-10 px-4">
              <Bell size={28} weight="duotone" className="mx-auto text-theme-medium" />
              <p className="text-sm font-semibold text-theme-text mt-2">Bildirim yok</p>
              <p className="text-xs text-theme-muted mt-1">Size görev atandığında veya izin talebiniz sonuçlandığında burada görünür.</p>
            </div>
          ) : (
            items.map(n => {
              const IconCmp = TYPE_ICON[n.type];
              return (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => openItem(n)}
                  className={`w-full flex gap-3 px-3 py-2.5 rounded-xl text-left transition-colors outline-none hover:bg-theme-lightest/70 focus-visible:bg-theme-lightest/70 ${n.read ? '' : 'bg-theme-cream'}`}
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.read ? 'bg-theme-lightest text-theme-muted' : 'bg-theme-light text-theme-deep'}`}>
                    <IconCmp size={17} weight="bold" aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm leading-snug ${n.read ? 'font-medium text-theme-text/80' : 'font-bold text-theme-text'}`}>{n.title}</span>
                    {n.body && <span className="block text-xs text-theme-muted mt-0.5 line-clamp-2">{n.body}</span>}
                    <span className="block text-[11px] font-semibold text-theme-muted/80 mt-1">
                      {n.actorName ? `${n.actorName} · ` : ''}{timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-theme-deep mt-1.5 shrink-0" aria-label="Okunmadı" />}
                </button>
              );
            })
          )}
        </div>
      </Menu>
    </>
  );
}
