import { useState } from 'react';

/** İlk `limit` satırı gösterir; fazlası "n kart daha" ile açılır (pano kısa kalsın). */
export function useLimited<T>(list: T[], limit: number) {
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, limit);
  const more = list.length > limit ? (
    <button type="button" onClick={() => setAll(a => !a)} className="w-full px-3.5 py-2 text-xs font-medium text-theme-deep text-left border-t border-theme-light hover:bg-theme-lightest/60 transition-colors">
      {all ? 'Daha az göster' : `${list.length - limit} kart daha`}
    </button>
  ) : null;
  return { shown, more };
}
