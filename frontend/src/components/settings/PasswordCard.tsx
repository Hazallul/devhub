import { useState } from 'react';
import { Key, Eye, EyeSlash } from '@phosphor-icons/react';
import { useMe, useChangePassword } from '../../hooks/api';

/** Şifre değiştirme kartı: Ayarlar'da ve ilk girişteki zorunlu şifre değişikliği ekranında ortak. */
export default function PasswordCard() {
  const me = useMe();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8 || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(next) || !/\d/.test(next)) {
      setError('Yeni şifre en az 8 karakter olmalı ve harf ile rakam içermeli.');
      return;
    }
    if (next !== repeat) { setError('Yeni şifreler birbiriyle aynı değil.'); return; }
    setError('');
    change.mutate({ currentPassword: current, newPassword: next }, {
      onSuccess: (user) => {
        setCurrent(''); setNext(''); setRepeat('');
        try { localStorage.setItem('user', JSON.stringify(user)); } catch { /* yok say */ }
      },
    });
  };

  const type = show ? 'text' : 'password';
  return (
    <form onSubmit={submit} className={`card p-6 space-y-4 ${me.mustChangePassword ? 'ring-2 ring-[#E8C3AE]' : ''}`} aria-labelledby="pw-title">
      <div className="flex items-center justify-between">
        <h2 id="pw-title" className="text-lg font-bold tracking-tight flex items-center gap-2"><Key size={20} weight="duotone" className="text-theme-deep" /> Şifre</h2>
        <button type="button" onClick={() => setShow(s => !s)} className="icon-btn w-9 h-9" aria-label={show ? 'Şifreleri gizle' : 'Şifreleri göster'}>
          {show ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
        </button>
      </div>
      {me.mustChangePassword && <p className="text-sm font-semibold text-[#7A3E1F]">Geçici şifreyle giriş yaptınız; lütfen yeni bir şifre belirleyin.</p>}
      <div>
        <label htmlFor="pw-current" className="label">Mevcut şifre</label>
        <input id="pw-current" type={type} autoComplete="current-password" className="input" value={current} onChange={e => setCurrent(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="pw-new" className="label">Yeni şifre</label>
        <input id="pw-new" type={type} autoComplete="new-password" className="input" value={next} onChange={e => setNext(e.target.value)} aria-describedby="pw-help" required />
        <p id="pw-help" className="text-xs text-theme-muted mt-1.5 ml-1">En az 8 karakter; harf ve rakam içermeli.</p>
      </div>
      <div>
        <label htmlFor="pw-repeat" className="label">Yeni şifre (tekrar)</label>
        <input id="pw-repeat" type={type} autoComplete="new-password" className="input" value={repeat} onChange={e => setRepeat(e.target.value)} required />
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-[#9A3B1B]">{error}</p>}
      <button type="submit" disabled={change.isPending || !current || !next || !repeat} className="btn-primary w-full">
        {change.isPending ? 'Değiştiriliyor…' : 'Şifreyi değiştir'}
      </button>
    </form>
  );
}
