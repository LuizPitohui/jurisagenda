'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Scale, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuth } from '@/store';
import { cn } from '@/lib/utils';

const schema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const router  = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email, password }: Form) => {
    setLoading(true);
    try {
      const tokens = await authApi.login(email, password);
      const me     = await authApi.me();
      setUser(me);
      toast.success(`Bem-vindo, ${tokens.user.full_name}!`);
      router.push('/dashboard');
    } catch {
      toast.error('Credenciais incorretas. Verifique e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo decorativo ── */}
      <div
        className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-16"
        style={{ background: 'linear-gradient(145deg, #0e1e2e 0%, #1e3f5c 60%, #2a567a 100%)' }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Círculos decorativos */}
        <div
          className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #2563EB, transparent)' }}
        />
        <div
          className="absolute top-20 -right-16 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #CA8A04, transparent)' }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border:     '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-serif text-2xl font-bold text-white tracking-tight">
              JurisAgenda
            </p>
            <p className="text-xs text-slate-400 tracking-widest uppercase">
              Sistema Jurídico
            </p>
          </div>
        </div>

        {/* Texto central */}
        <div className="relative z-10 space-y-10">
          <div>
            <h1 className="font-serif text-5xl font-bold text-white leading-[1.1] mb-4">
              Agenda jurídica<br />
              <span style={{ color: '#7ab3d8' }}>de alto desempenho</span>
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed max-w-sm">
              Calendário interativo, painel de TV com conformidade LGPD
              e automação completa de follow-ups processuais.
            </p>
          </div>

          <div className="space-y-5">
            {[
              { dot: '#DC2626', text: 'Audiências, Reuniões, Prazos e Contratos em uma visão unificada' },
              { dot: '#2563EB', text: 'Painel de recepção com chamadas por voz (TTS) — LGPD compliant' },
              { dot: '#16A34A', text: 'Follow-up automático com linha do tempo processual' },
            ].map(({ dot, text }, i) => (
              <motion.div
                key={i}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0,   opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-start gap-4"
              >
                <span
                  className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: dot }}
                />
                <p className="text-slate-300 text-sm leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-slate-600 text-xs">
          © 2026 JurisAgenda · v1.0.0 · Confidencial
        </p>
      </div>

      {/* ── Formulário de login ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-cream-50">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[420px]"
        >
          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-12 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-navy-900 flex items-center justify-center">
              <Scale size={18} className="text-white" />
            </div>
            <span className="font-serif text-xl font-bold text-navy-900">
              JurisAgenda
            </span>
          </div>

          <h2 className="font-serif text-3xl font-bold text-navy-900 mb-1">
            Acesso ao sistema
          </h2>
          <p className="text-sm mb-10" style={{ color: '#8a7e70' }}>
            Insira suas credenciais para continuar
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* E-mail */}
            <div>
              <label className="field-label">E-mail</label>
              <input
                {...register('email')}
                type="email"
                placeholder="advogado@escritorio.com.br"
                className={cn('field-input', errors.email && 'error')}
              />
              {errors.email && (
                <p className="field-error">{errors.email.message}</p>
              )}
            </div>

            {/* Senha */}
            <div>
              <label className="field-label">Senha</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••••"
                  className={cn('field-input pr-10', errors.password && 'error')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#8a7e70' }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="field-error">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-12 mt-2 text-base"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Entrando…</>
                : 'Entrar'
              }
            </button>
          </form>

          <p className="text-center text-xs mt-8" style={{ color: '#b0a090' }}>
            Acesso restrito a usuários autorizados do escritório
          </p>
        </motion.div>
      </div>
    </div>
  );
}