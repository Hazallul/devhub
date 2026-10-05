import { useCallback, useState } from 'react';
import type { User } from '../types';

export type GroupBy = 'NONE' | 'DEPARTMENT' | 'PROJECT';

export const NO_DEPARTMENT = 'Departmansız';
export const NO_PROJECT_GROUP = 'Projesiz';

/** Kişinin hangi gruba düştüğü (grup adı). */
export function groupKeyOf(u: User, by: GroupBy) {
  if (by === 'DEPARTMENT') return u.department || NO_DEPARTMENT;
  if (by === 'PROJECT') return u.currentProject || NO_PROJECT_GROUP;
  return '';
}

/** Şirketteki departmanlar (alfabetik). */
export function departmentsOf(users: User[] | undefined) {
  return [...new Set((users ?? []).map(u => u.department).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, 'tr'));
}

/**
 * Listeyi gruplara böler; grup sırası alfabetik, "Departmansız"/"Projesiz" en sonda. Grup içi sıra korunur.
 */
export function groupItems<T>(items: T[], keyOf: (item: T) => string): { key: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = keyOf(it);
    const list = map.get(k);
    if (list) list.push(it);
    else map.set(k, [it]);
  }
  const last = (k: string) => (k === NO_DEPARTMENT || k === NO_PROJECT_GROUP ? 1 : 0);
  return [...map.entries()]
    .sort(([a], [b]) => last(a) - last(b) || a.localeCompare(b, 'tr'))
    .map(([key, list]) => ({ key, items: list }));
}

/** Kalıcı ayar (localStorage): erişilemezse varsayılanla çalışır. */
export function usePersisted<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
  });
  const set = useCallback((v: T) => {
    setValue(v);
    try { localStorage.setItem(key, v); } catch { /* yok sayılır */ }
  }, [key]);
  return [value, set];
}

/** Hangi grupların kapalı olduğu; sayfa yenilense de hatırlanır. */
export function useCollapsedGroups(storageKey: string) {
  const [closed, setClosed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]') as string[]); } catch { return new Set(); }
  });
  const toggle = useCallback((key: string) => {
    setClosed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* yok sayılır */ }
      return next;
    });
  }, [storageKey]);
  const setAll = useCallback((keys: string[], open: boolean) => {
    const next = open ? new Set<string>() : new Set(keys);
    setClosed(next);
    try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* yok sayılır */ }
  }, [storageKey]);
  return { isClosed: (key: string) => closed.has(key), toggle, setAll, anyClosed: closed.size > 0 };
}
