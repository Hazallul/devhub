import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeSlash, Users, Kanban, CalendarCheck, ShieldCheck, UserCircle, Warning } from '@phosphor-icons/react';
import api, { errorMessage } from '../services/api';
import { getStoredUser, saveSession } from '../lib/session';
import { listContainer, listItem } from '../lib/motion';
import type { LoginResponse } from '../types';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'E-posta zorunludur.').email('Geçerli bir e-posta adresi girin (örn: ad.soyad@devhub.local).'),
  password: z.string().min(1, 'Şifre zorunludur.'),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

const FEATURES = [
  { icon: Users, text: 'Ekibin anlık durumunu tek ekranda görün' },
  { icon: Kanban, text: 'Görevleri panoda sürükleyerek yönetin' },
  { icon: CalendarCheck, text: 'İzin taleplerini onaylayın, takvimi planlayın' },
];

// Yalnızca geliştirmede: seed hesaplarıyla tek tıkla gerçek backend'e giriş (şifre .env.development'ta).
const QUICK_LOGIN_PASSWORD = import.meta.env.DEV ? import.meta.env.VITE_QUICK_LOGIN_PASSWORD as string | undefined : undefined;

const DEMO_ACCOUNTS = [
  { email: 'admin@devhub.local', label: 'Yönetici olarak gir', hint: 'Tüm yetkiler', icon: ShieldCheck },
  { email: 'ali.yilmaz@devhub.local', label: 'Çalışan olarak gir', hint: 'Ali Yılmaz · Team Lead', icon: UserCircle },
];

export default function Login() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  });

  if (getStoredUser()) return <Navigate to="/" replace />;

  const login = async (data: LoginFormInputs) => {
    setErrorMsg('');
    try {
      const response = await api.post<LoginResponse>('/auth/login', data);
      saveSession(response.data.token, response.data.user);
      navigate('/');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setErrorMsg(status === 401 || status === 403 ? 'E-posta veya şifre hatalı. Bilgilerinizi kontrol edip tekrar deneyin.' : errorMessage(err));
    }
  };

  const demoLogin = async (email: string) => {
    setDemoLoading(email);
    await login({ email, password: QUICK_LOGIN_PASSWORD ?? '' });
    setDemoLoading(null);
  };

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.1fr_1fr] bg-theme-cream">
      {/* Marka paneli */}
      <div className="hidden lg:flex relative overflow-hidden bg-accent text-white p-14 flex-col justify-between">
        <motion.div
          aria-hidden="true"
          className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full bg-theme-medium/40 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 0.9, 0.7] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div aria-hidden="true" className="absolute -bottom-40 -left-24 w-[480px] h-[480px] rounded-full bg-theme-light/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 bg-theme-lightest text-theme-deep rounded-2xl flex items-center justify-center font-bold text-xl">D</div>
          <span className="text-2xl font-bold tracking-tight">DevHub</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-5xl font-bold tracking-tight leading-[1.08]">Ekibiniz, projeleriniz ve süreçleriniz tek yerde.</h1>
          <motion.ul variants={listContainer} initial="hidden" animate="visible" className="mt-10 space-y-4">
            {FEATURES.map(f => (
              <motion.li key={f.text} variants={listItem} className="flex items-center gap-4">
                <span className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <f.icon size={22} weight="duotone" />
                </span>
                <span className="text-base font-medium text-white/90">{f.text}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <p className="relative text-sm text-white/60 font-medium">© {new Date().getFullYear()} DevHub · Şirket içi yönetim paneli</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-accent text-white rounded-2xl flex items-center justify-center font-bold text-xl">D</div>
            <span className="text-2xl font-bold tracking-tight">DevHub</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight">Tekrar hoş geldiniz</h2>
          <p className="text-theme-muted mt-2 font-medium">Panele erişmek için oturum açın.</p>

          <form onSubmit={handleSubmit(login)} noValidate className="space-y-5 mt-8">
            <div>
              <label htmlFor="email" className="label">E-posta</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ad.soyad@devhub.local"
                aria-invalid={!!errors.email}
                aria-describedby="email-err"
                className="input"
                {...register('email')}
              />
              {errors.email && <p id="email-err" role="alert" className="text-xs font-semibold text-danger mt-1.5 ml-1">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="label">Şifre</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby="password-err"
                  className="input pr-12"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 icon-btn"
                >
                  {showPassword ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
                </button>
              </div>
              {errors.password && <p id="password-err" role="alert" className="text-xs font-semibold text-danger mt-1.5 ml-1">{errors.password.message}</p>}
            </div>

            {errorMsg && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="flex items-start gap-2.5 bg-danger-soft text-danger-ink p-3.5 rounded-2xl text-sm font-medium">
                <Warning size={18} weight="fill" className="shrink-0 mt-0.5" /> {errorMsg}
              </motion.div>
            )}

            <button disabled={isSubmitting} type="submit" className="btn-primary w-full min-h-[52px] text-base active:scale-[0.99]">
              {isSubmitting && !demoLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="Giriş yapılıyor" /> : 'Giriş Yap'}
            </button>
          </form>

          {QUICK_LOGIN_PASSWORD && (
            <div className="mt-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="h-px flex-1 bg-theme-light" />
                <span className="eyebrow">Hızlı giriş</span>
                <span className="h-px flex-1 bg-theme-light" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {DEMO_ACCOUNTS.map(a => (
                  <motion.button
                    key={a.email}
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={!!demoLoading}
                    onClick={() => demoLogin(a.email)}
                    className="flex items-center gap-3 p-4 rounded-3xl bg-surface border border-theme-light/60 shadow-soft hover:shadow-diffusion hover:border-theme-medium text-left transition-[box-shadow,border-color] disabled:opacity-60"
                  >
                    <span className="w-10 h-10 rounded-xl bg-theme-lightest text-theme-deep flex items-center justify-center shrink-0">
                      {demoLoading === a.email ? <span className="w-4 h-4 border-2 border-theme-deep/30 border-t-theme-deep rounded-full animate-spin" /> : <a.icon size={20} weight="duotone" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{a.label}</span>
                      <span className="block text-xs text-theme-muted truncate">{a.hint}</span>
                    </span>
                  </motion.button>
                ))}
              </div>
              <p className="text-xs text-theme-muted mt-3 text-center">Geliştirme ortamı: seed hesaplarıyla giriş yapar, tüm değişiklikler veritabanına kaydedilir.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
