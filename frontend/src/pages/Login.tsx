import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Eye, EyeSlash, ShieldCheck, UserCircle, Warning, House, ArrowLeft, CheckCircle, EnvelopeSimple } from '@phosphor-icons/react';
import ThemeSwitch from '../components/login/ThemeSwitch';
import LoginBackdrop from '../components/login/LoginBackdrop';
import CodeInput from '../components/login/CodeInput';
import api, { errorMessage } from '../services/api';
import { getStoredUser, saveSession } from '../lib/session';
import type { LoginResponse } from '../types';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'E-posta zorunludur.').email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(1, 'Şifre zorunludur.'),
});
type LoginFormInputs = z.infer<typeof loginSchema>;

// Yalnızca geliştirmede: seed hesaplarıyla tek tıkla gerçek backend'e giriş (şifre .env.development'ta).
const QUICK_LOGIN_PASSWORD = import.meta.env.DEV ? import.meta.env.VITE_QUICK_LOGIN_PASSWORD as string | undefined : undefined;
const DEMO_ACCOUNTS = [
  { email: 'admin@devhub.local', label: 'Yönetici', hint: 'Tüm yetkiler', icon: ShieldCheck },
  { email: 'ali.yilmaz@devhub.local', label: 'Çalışan', hint: 'Ali Yılmaz, Team Lead', icon: UserCircle },
];

/** Kartın adımları; sıra kayma yönünü belirler (ileri = içerik sola kayar). */
const STEPS = ['login', 'forgot', 'code', 'password', 'sent'] as const;
type Step = typeof STEPS[number];

const EASE = [0.76, 0, 0.24, 1] as const;
const RESEND_SECONDS = 45;

const slide = {
  enter: (d: number) => ({ x: d * 48, opacity: 0, filter: 'blur(6px)' }),
  center: { x: 0, opacity: 1, filter: 'blur(0px)' },
  exit: (d: number) => ({ x: d * -48, opacity: 0, filter: 'blur(6px)' }),
};

/**
 * Giriş ekranı: tek bir cam kart. Şifremi unuttum akışı (e-posta → kod → yeni şifre → yönetici onayı) aynı kartın içinde
 * yana kayarak ilerler, kartın yüksekliği içeriğe yumuşakça uyar. Giriş başarılı olunca sayfa sola sürüklenip çıkar,
 * uygulamanın iskeleti sağdan girer ve ana sayfa açılır.
 */
export default function Login() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  // Yalnızca ilk açılışta: zaten oturum varsa yönlendir (giriş sonrası yönlendirmeyi çıkış animasyonu yapar).
  const [alreadySignedIn] = useState(() => !!getStoredUser());
  const [step, setStep] = useState<Step>('login');
  const [dir, setDir] = useState(1);
  const [leaving, setLeaving] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [code, setCode] = useState('');

  // Yedek: animasyon kareleri durursa (sekme arka planda) yönlendirme yine olur.
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => navigate('/', { replace: true }), 1400);
    return () => window.clearTimeout(t);
  }, [leaving, navigate]);

  if (alreadySignedIn) return <Navigate to="/" replace />;

  const go = (next: Step) => {
    setDir(STEPS.indexOf(next) >= STEPS.indexOf(step) ? 1 : -1);
    setStep(next);
  };

  const signedIn = () => {
    if (reduce) navigate('/', { replace: true });
    else setLeaving(true);
  };

  return (
    <>
      {/* Giriş katmanı: başarılı girişte önce hafifçe tutulur, sonra sola kayıp gider. */}
      <motion.div
        className="fixed inset-0 overflow-hidden"
        animate={leaving ? { x: ['0%', '2%', '-100%'] } : { x: '0%' }}
        transition={leaving ? { duration: 0.95, times: [0, 0.18, 1], ease: EASE } : { duration: 0 }}
        onAnimationComplete={() => { if (leaving) navigate('/', { replace: true }); }}
      >
        <LoginBackdrop />

        <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 h-20">
          <div className="flex items-center gap-2.5 text-white">
            <span className="w-9 h-9 rounded-xl bg-white text-accent flex items-center justify-center shadow-[0_4px_14px_rgb(0_0_0/0.25)]"><House size={18} weight="fill" aria-hidden="true" /></span>
            <span className="text-lg font-semibold tracking-tight [text-shadow:0_1px_12px_rgb(0_0_0/0.35)]">DevHub</span>
          </div>
          <ThemeSwitch tone="onAccent" />
        </header>

        <main className="relative z-10 flex items-center justify-center px-5 pb-20 min-h-[calc(100dvh-5rem)]">
          <motion.div
            layout
            transition={{ layout: { duration: 0.5, ease: EASE } }}
            className="w-full max-w-[25rem] overflow-hidden rounded-[1.75rem] border border-white/50 dark:border-white/10 bg-surface/75 dark:bg-theme-cream/70 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.6),0_2px_8px_rgb(0_0_0/0.08)]"
          >
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.42, ease: EASE }}
                className="p-8 sm:p-9"
              >
                {step === 'login' && <LoginStep initialEmail={resetEmail} onForgot={email => { setResetEmail(email); go('forgot'); }} onSignedIn={signedIn} disabled={leaving} />}
                {step === 'forgot' && <ForgotStep initial={resetEmail} onBack={() => go('login')} onSent={email => { setResetEmail(email); setCode(''); go('code'); }} />}
                {step === 'code' && <CodeStep email={resetEmail} code={code} onCode={setCode} onBack={() => go('forgot')} onVerified={() => go('password')} />}
                {step === 'password' && <PasswordStep email={resetEmail} code={code} onBack={() => go('code')} onDone={() => go('sent')} />}
                {step === 'sent' && <SentStep onLogin={() => go('login')} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </main>
      </motion.div>

      {/* Giriş sonrası sağdan giren uygulama iskeleti: gerçek kabuk aynı yerde açılır, geçiş kesintisiz görünür. */}
      {leaving && (
        <motion.div aria-hidden="true" className="fixed inset-0 flex bg-theme-cream"
          initial={{ x: '100%' }} animate={{ x: ['100%', '102%', '0%'] }} transition={{ duration: 0.95, times: [0, 0.18, 1], ease: EASE }}>
          <div className="hidden lg:block w-64 shrink-0 bg-surface border-r border-theme-light" />
          <div className="flex-1"><div className="h-14 border-b border-theme-light bg-surface/80" /></div>
        </motion.div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- adımlar

function Heading({ title, text, onBack }: { title: string; text?: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="mb-7">
      {onBack && (
        <button type="button" onClick={onBack} className="icon-btn -ml-2 mb-3" aria-label="Geri">
          <ArrowLeft size={18} weight="bold" />
        </button>
      )}
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-theme-text">{title}</h1>
      {text && <p className="text-sm text-theme-muted mt-1.5 text-pretty">{text}</p>}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-center gap-2 bg-danger-soft text-danger-ink border border-danger-line px-3 py-2.5 rounded-xl text-sm">
      <Warning size={17} weight="fill" className="shrink-0" aria-hidden="true" /> {message}
    </div>
  );
}

function Spinner() {
  return <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none" aria-hidden="true" />;
}

/** Göster/gizle düğmeli şifre alanı: react-hook-form kaydıyla ya da kontrollü değerle çalışır. */
function PasswordField({ id, label, autoComplete, value, onChange, registration, invalid, describedBy }: {
  id: string; label: string; autoComplete: string; value?: string; onChange?: (v: string) => void;
  registration?: UseFormRegisterReturn; invalid?: boolean; describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  const bind = registration ?? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) };
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} aria-invalid={invalid} aria-describedby={describedBy}
          className="input pr-12" {...bind} />
        <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'} className="absolute right-1.5 top-1/2 -translate-y-1/2 icon-btn">
          {show ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
        </button>
      </div>
    </div>
  );
}

/** initialEmail: şifremi unuttum adımlarından dönünce e-posta yeniden yazılmasın. */
function LoginStep({ initialEmail, onForgot, onSignedIn, disabled }: { initialEmail: string; onForgot: (email: string) => void; onSignedIn: () => void; disabled: boolean }) {
  const [errorMsg, setErrorMsg] = useState('');
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: initialEmail, password: '' },
  });

  const login = async (data: LoginFormInputs) => {
    setErrorMsg('');
    try {
      const response = await api.post<LoginResponse>('/auth/login', data);
      saveSession(response.data.token, response.data.user);
      onSignedIn();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setErrorMsg(status === 401 || status === 403 ? 'E-posta veya şifre hatalı.' : errorMessage(err));
    }
  };

  const demoLogin = async (email: string) => {
    setDemoLoading(email);
    await login({ email, password: QUICK_LOGIN_PASSWORD ?? '' });
    setDemoLoading(null);
  };

  return (
    <>
      <Heading title="Oturum açın" />
      <form onSubmit={handleSubmit(login)} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="label">E-posta</label>
          <input id="email" type="email" autoComplete="email" placeholder="ad.soyad@devhub.local"
            aria-invalid={!!errors.email} aria-describedby="email-err" className="input" {...register('email')} />
          {errors.email && <p id="email-err" role="alert" className="text-xs font-medium text-danger mt-1.5">{errors.email.message}</p>}
        </div>
        <div>
          <PasswordField id="password" label="Şifre" autoComplete="current-password" registration={register('password')} invalid={!!errors.password} describedBy="password-err" />
          <div className="flex items-start justify-between gap-3 mt-1.5">
            <p id="password-err" role={errors.password ? 'alert' : undefined} className="text-xs font-medium text-danger">{errors.password?.message}</p>
            <button type="button" onClick={() => onForgot(getValues('email') ?? '')} className="shrink-0 text-xs font-medium text-theme-deep hover:underline underline-offset-4">Şifremi unuttum</button>
          </div>
        </div>
        <ErrorBox message={errorMsg} />
        <button disabled={isSubmitting || disabled} type="submit" className="btn-primary w-full min-h-[2.875rem]">
          {isSubmitting && !demoLoading ? <Spinner /> : 'Giriş yap'}
        </button>
      </form>

      {QUICK_LOGIN_PASSWORD && (
        <div className="mt-7 pt-6 border-t border-theme-light grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map(a => (
            <button key={a.email} type="button" disabled={!!demoLoading || disabled} onClick={() => demoLogin(a.email)} title={a.hint}
              className="flex items-center justify-center gap-2 h-10 rounded-xl border border-theme-light bg-surface/60 text-sm font-medium text-theme-text hover:bg-theme-lightest transition-colors disabled:opacity-60">
              {demoLoading === a.email
                ? <span className="w-4 h-4 border-2 border-theme-deep/30 border-t-theme-deep rounded-full animate-spin motion-reduce:animate-none" aria-hidden="true" />
                : <a.icon size={16} className="text-theme-deep" aria-hidden="true" />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ForgotStep({ initial, onBack, onSent }: { initial: string; onBack: () => void; onSent: (email: string) => void }) {
  const [email, setEmail] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!z.string().email().safeParse(value).success) { setError('Geçerli bir e-posta adresi girin.'); return; }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/password-reset/request', { email: value });
      onSent(value);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Heading title="Şifremi unuttum" text="E-postanıza 6 haneli bir kod göndereceğiz." onBack={onBack} />
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="reset-email" className="label">E-posta</label>
          <input id="reset-email" type="email" autoComplete="email" placeholder="ad.soyad@devhub.local" value={email}
            onChange={e => setEmail(e.target.value)} className="input" />
        </div>
        <ErrorBox message={error} />
        <button type="submit" disabled={busy} className="btn-primary w-full min-h-[2.875rem]">{busy ? <Spinner /> : 'Kod gönder'}</button>
      </form>
    </>
  );
}

function CodeStep({ email, code, onCode, onBack, onVerified }: { email: string; code: string; onCode: (c: string) => void; onBack: () => void; onVerified: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const submitted = useRef('');

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait(w => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const verify = async (value: string) => {
    if (value.length !== 6 || busy) return;
    submitted.current = value;
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/password-reset/verify', { email, code: value });
      onVerified();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setWait(RESEND_SECONDS);
    setError('');
    onCode('');
    submitted.current = '';
    try { await api.post('/auth/password-reset/request', { email }); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <>
      <Heading title="Kodu girin" text={<><span className="text-theme-text font-medium">{email}</span> kayıtlıysa bu adrese bir kod gönderdik.</>} onBack={onBack} />
      <form onSubmit={e => { e.preventDefault(); verify(code); }} noValidate className="space-y-4">
        <CodeInput value={code} invalid={!!error} disabled={busy}
          onChange={v => { onCode(v); setError(''); if (v.length === 6 && v !== submitted.current) verify(v); }} />
        <ErrorBox message={error} />
        <button type="submit" disabled={busy || code.length !== 6} className="btn-primary w-full min-h-[2.875rem]">{busy ? <Spinner /> : 'Doğrula'}</button>
      </form>
      <div className="flex items-center justify-between mt-5 text-xs">
        <button type="button" onClick={resend} disabled={wait > 0} className="font-medium text-theme-deep hover:underline underline-offset-4 disabled:text-theme-muted disabled:no-underline tabular">
          {wait > 0 ? `Yeniden gönder (${wait})` : 'Kodu yeniden gönder'}
        </button>
        {import.meta.env.DEV && (
          <a href="http://localhost:8025" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-theme-muted hover:text-theme-text">
            <EnvelopeSimple size={13} weight="bold" aria-hidden="true" /> Test gelen kutusu
          </a>
        )}
      </div>
    </>
  );
}

function PasswordStep({ email, code, onBack, onDone }: { email: string; code: string; onBack: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ruleOk = password.length >= 8 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) && /\d/.test(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleOk) { setError('En az 8 karakter, harf ve rakam içermeli.'); return; }
    if (password !== repeat) { setError('Şifreler aynı değil.'); return; }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/password-reset/complete', { email, code, newPassword: password });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Heading title="Yeni şifre" text="Yönetici onayladığında geçerli olur." onBack={onBack} />
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <PasswordField id="new-password" label="Yeni şifre" autoComplete="new-password" value={password} onChange={setPassword} />
          <p className={`text-xs mt-1.5 transition-colors ${ruleOk ? 'text-good' : 'text-theme-muted'}`}>En az 8 karakter, harf ve rakam</p>
        </div>
        <PasswordField id="repeat-password" label="Yeni şifre (tekrar)" autoComplete="new-password" value={repeat} onChange={setRepeat} />
        <ErrorBox message={error} />
        <button type="submit" disabled={busy} className="btn-primary w-full min-h-[2.875rem]">{busy ? <Spinner /> : 'Onaya gönder'}</button>
      </form>
    </>
  );
}

function SentStep({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="text-center py-2">
      <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 }}
        className="inline-flex w-14 h-14 rounded-2xl bg-good-soft text-good items-center justify-center mb-5">
        <CheckCircle size={30} weight="fill" aria-hidden="true" />
      </motion.span>
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-theme-text">Talebiniz iletildi</h1>
      <p className="text-sm text-theme-muted mt-2 text-balance">Yönetici onayladığında yeni şifrenizle giriş yapabilirsiniz. O zamana kadar eski şifreniz geçerli.</p>
      <button type="button" onClick={onLogin} className="btn-secondary w-full min-h-[2.875rem] mt-7">Girişe dön</button>
    </div>
  );
}
