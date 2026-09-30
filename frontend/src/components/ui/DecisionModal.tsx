import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, X } from '@phosphor-icons/react';
import Modal from './Modal';

export type Decision = 'ONAYLANDI' | 'REDDEDILDI';

interface Props {
  /** null: kapalı */
  decision: Decision | null;
  onClose: () => void;
  /** Ne için karar verildiği, ör. "izin talebini" → "İzin talebini onayla" */
  subject: string;
  /** Talebin özeti (kim, ne istiyor) */
  children: ReactNode;
  /** note: talep sahibine gösterilecek açıklama; boşsa undefined */
  onConfirm: (note: string | undefined) => void;
  pending?: boolean;
  /** Onay penceresinin altındaki ek bilgi (ör. "kesinleştirene kadar geri alabilirsiniz") */
  hint?: string;
}

/**
 * Onay/ret kararını açıklamayla birlikte verir (izin talepleri ve profil değişiklikleri).
 * Açıklama isteğe bağlıdır ama ret kararında özellikle teşvik edilir: talep sahibi nedenini görür.
 */
export default function DecisionModal({ decision, onClose, subject, children, onConfirm, pending, hint }: Props) {
  const [note, setNote] = useState('');
  const reject = decision === 'REDDEDILDI';

  useEffect(() => {
    if (decision) setNote('');
  }, [decision]);

  return (
    <Modal
      open={decision !== null}
      onClose={onClose}
      size="sm"
      title={`${subject.charAt(0).toLocaleUpperCase('tr-TR')}${subject.slice(1)} ${reject ? 'reddet' : 'onayla'}`}
      onSubmit={e => { e.preventDefault(); onConfirm(note.trim() || undefined); }}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Vazgeç</button>
        <button type="submit" disabled={pending} className={reject ? 'btn bg-[#9A3B1B] text-white hover:bg-[#7E2F15]' : 'btn-primary'}>
          {reject ? <X size={16} weight="bold" /> : <Check size={16} weight="bold" />}
          {pending ? 'Kaydediliyor…' : reject ? 'Reddet' : 'Onayla'}
        </button>
      </>}
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-theme-cream border border-theme-light/50 p-4">{children}</div>
        <div>
          <label htmlFor="decision-note" className="label">
            {reject ? 'Ret nedeni' : 'Açıklama'} <span className="text-theme-muted font-medium">(isteğe bağlı)</span>
          </label>
          <textarea
            id="decision-note"
            data-autofocus
            rows={3}
            maxLength={500}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={reject ? 'Neden onaylanmadığını yazın; talep sahibi bu açıklamayı görür.' : 'Eklemek istediğiniz bir not varsa yazın; talep sahibi görür.'}
            className="input resize-none"
          />
          {hint && <p className="text-xs text-theme-muted font-medium mt-2 ml-1">{hint}</p>}
        </div>
      </div>
    </Modal>
  );
}
