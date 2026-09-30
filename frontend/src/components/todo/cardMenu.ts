import { ArrowSquareOut, CheckCircle, ArrowCounterClockwise, Star, Sun, SunHorizon, CalendarX, PaperPlaneTilt, Trash } from '@phosphor-icons/react';
import { useContextMenu } from '../layout/ContextMenu';
import { useDeleteTodoWithUndo, useTodos, useUpdateTodo } from '../../hooks/todos';
import { useMe } from '../../hooks/api';
import { canDeleteCard } from './views';
import { addDays, toIsoDay } from '../../lib/format';
import type { TodoItem } from '../../types';

/** Kartların sağ tık menüsü (liste, haftalık plan ve tarihsiz bölmesinde ortak). */
export function useTodoCardMenu() {
  const menu = useContextMenu();
  const update = useUpdateTodo();
  const remove = useDeleteTodoWithUndo();
  const me = useMe();
  const lists = useTodos().data?.lists ?? [];

  return (e: React.MouseEvent, item: TodoItem, handlers: { onOpen: () => void; onSend: () => void }) => {
    const now = new Date();
    const today = toIsoDay(now);
    const tomorrow = toIsoDay(addDays(now, 1));
    menu(e, {
      label: 'Kart',
      items: [
        { label: 'Ayrıntıyı aç', icon: ArrowSquareOut, onSelect: handlers.onOpen },
        item.done
          ? { label: 'Tamamlanmadı yap', icon: ArrowCounterClockwise, onSelect: () => update.mutate({ id: item.id, done: false }) }
          : { label: 'Tamamlandı yap', icon: CheckCircle, onSelect: () => update.mutate({ id: item.id, done: true }) },
        { label: item.important ? 'Önemli işaretini kaldır' : 'Önemli yap', icon: Star, onSelect: () => update.mutate({ id: item.id, important: !item.important }) },
        'divider',
        item.dueDate !== today && { label: 'Bugüne al', icon: Sun, onSelect: () => update.mutate({ id: item.id, dueDate: today }) },
        item.dueDate !== tomorrow && { label: 'Yarına al', icon: SunHorizon, onSelect: () => update.mutate({ id: item.id, dueDate: tomorrow }) },
        !!item.dueDate && { label: 'Tarihi kaldır', icon: CalendarX, onSelect: () => update.mutate({ id: item.id, dueDate: null, dueTime: null, repeatRule: null }) },
        'divider',
        { label: 'Birine gönder…', icon: PaperPlaneTilt, onSelect: handlers.onSend },
        canDeleteCard(item, lists, me.id) && { label: 'Kartı sil', icon: Trash, tone: 'danger', onSelect: () => remove(item.id) },
      ],
    });
  };
}
