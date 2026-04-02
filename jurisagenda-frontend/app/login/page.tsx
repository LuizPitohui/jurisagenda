'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuth } from '@/store';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email, password }: Form) => {
    setLoading(true);
    try {
      const tokens = await authApi.login(email, password);
      const me     = await authApi.me();
      setUser(me);
      toast.success(`Bem-vindo, ${me.full_name || tokens.user?.full_name}!`);
      router.push('/dashboard');
    } catch {
      toast.error('Credenciais incorretas. Verifique e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1a30 100%)' }}
    >
      {/* Efeitos de fundo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7ab3d8, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Card central */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Card */}
        <div className="rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>

          {/* Header do card */}
          <div className="px-10 pt-10 pb-8 text-center border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Image src="/logo-norte.png" alt="Norte Tech" width={44} height={44} className="object-contain" />
              </div>
            </div>
            <h1 className="font-serif text-2xl font-bold text-white mb-1">JurisAgenda</h1>
            <p className="text-xs tracking-widest uppercase" style={{ color: '#7ab3d8' }}>by Norte Tech</p>
          </div>

          {/* Formulário */}
          <div className="px-10 py-8">
            <div className="mb-7">
              <h2 className="text-lg font-semibold text-white mb-1">Acesso ao sistema</h2>
              <p className="text-sm" style={{ color: '#64748b' }}>Insira suas credenciais para continuar</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* E-mail */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                  E-mail
                </label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com.br"
                  className={cn(
                    'w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all',
                    'focus:ring-2',
                    errors.email ? 'ring-2 ring-red-500' : 'focus:ring-blue-500/40'
                  )}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
              </div>

              {/* Senha */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                  Senha
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={cn(
                      'w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all',
                      'focus:ring-2',
                      errors.password ? 'ring-2 ring-red-500' : 'focus:ring-blue-500/40'
                    )}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                    style={{ color: '#64748b' }}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
                <div className="flex justify-end mt-1">
                  <Link href="/forgot-password" className="text-xs" style={{ color: '#64748b' }}>
                    Esqueceu a senha?
                  </Link>
                </div>
              </div>

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all mt-2 flex items-center justify-center gap-2"
                style={{
                  background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                  color: '#fff',
                  boxShadow: loading ? 'none' : '0 4px 24px rgba(37,99,235,0.35)',
                }}
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Entrando…</>
                  : 'Entrar'
                }
              </button>
            </form>
          </div>

          {/* Footer do card */}
          <div className="px-10 pb-8 text-center">
            <p className="text-xs" style={{ color: '#334155' }}>
              Acesso restrito a usuários autorizados do escritório
            </p>
          </div>
        </div>

        {/* Rodapé externo */}
        <p className="text-center text-xs mt-6" style={{ color: '#1e3a5f' }}>
          © 2026 Norte Tech · JurisAgenda v1.0
        </p>
      </motion.div>
    </div>
  );
}
