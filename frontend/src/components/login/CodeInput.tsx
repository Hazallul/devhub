import { useRef } from 'react';

/**
 * 6 haneli doğrulama kodu: her hane ayrı kutu, yazınca sonrakine geçer, Backspace öncekine döner,
 * yapıştırılan kod (boşluklu da olsa) kutulara dağılır. Değer her zaman yalnızca rakamlardan oluşan bir dizedir.
 */
export default function CodeInput({ value, onChange, invalid, disabled, length = 6 }: {
  value: string; onChange: (v: string) => void; invalid?: boolean; disabled?: boolean; length?: number;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const setAt = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').replace(/\D/g, '').slice(0, length));
  };

  const fill = (raw: string, from: number) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) return;
    const next = (value.slice(0, from) + clean).slice(0, length);
    onChange(next);
    refs.current[Math.min(next.length, length - 1)]?.focus();
  };

  return (
    <div className="grid grid-cols-6 gap-2" role="group" aria-label="Doğrulama kodu">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          value={d}
          disabled={disabled}
          autoFocus={i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`${i + 1}. hane`}
          aria-invalid={invalid}
          maxLength={length}
          onFocus={e => e.currentTarget.select()}
          onPaste={e => { e.preventDefault(); fill(e.clipboardData.getData('text'), i); }}
          onChange={e => {
            let v = e.target.value.replace(/\D/g, '');
            // Dolu kutuya yazılan yeni rakam eskisinin yerine geçer (imleç rakamın önünde ya da arkasında olabilir).
            if (v.length === 2 && d) v = v.startsWith(d) ? v.slice(1) : v.slice(0, 1);
            if (v.length > 1) { fill(v, i); return; }
            setAt(i, v);
            if (v && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !d && i > 0) { e.preventDefault(); setAt(i - 1, ''); refs.current[i - 1]?.focus(); }
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
          className={`h-14 w-full rounded-xl border bg-surface text-center text-2xl font-semibold tabular text-theme-text transition-colors focus:outline-none focus:border-theme-medium focus:ring-4 focus:ring-theme-medium/15 disabled:opacity-60 ${
            invalid ? 'border-danger-line bg-danger-soft/40' : d ? 'border-theme-dark/40' : 'border-theme-light'
          }`}
        />
      ))}
    </div>
  );
}
