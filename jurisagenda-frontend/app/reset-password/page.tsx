'use client';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const schema = z.object({
  password:         z.string().min(8, 'Mínimo 8 caracteres'),
  password_confirm: z.string(),
}).refine(d => d.password === d.password_confirm, {
  message: 'As senhas não conferem',
  path: ['password_confirm'],
});
type Form = z.infer<typeof schema>;

function ResetForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  if (!token) {
    return (
      <div className="text-center space-y-4 py-4">
        <AlertCircle size={48} className="mx-auto" style={{ color: '#ef4444' }} />
        <p className="text-white font-semibold">Link inválido</p>
        <p className="text-sm" style={{ color: '#64748b' }}>Este link de recuperação é inválido ou expirou.</p>
        <Link href="/forgot-password" className="text-sm font-semibold" style={{ color: '#7ab3d8' }}>
          Solicitar novo link
        </Link>
      </div>
    );
  }

  const onSubmit = async ({ password }: Form) => {
    setLoading(true);
    try {
      await api.post('auth/reset-password/', { token, password });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Token inválido ou expirado.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 py-4">
        <CheckCircle2 size={48} className="mx-auto" style={{ color: '#22c55e' }} />
        <h2 className="text-lg font-semibold text-white">Senha redefinida!</h2>
        <p className="text-sm" style={{ color: '#64748b' }}>Redirecionando para o login…</p>
      </motion.div>
    );
  }

  return (
    <>
      <div className="mb-7">
        <h2 className="text-lg font-semibold text-white mb-1">Nova senha</h2>
        <p className="text-sm" style={{ color: '#64748b' }}>Escolha uma senha segura com pelo menos 8 caracteres.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {(['password', 'password_confirm'] as const).map((field) => (
          <div key={field}>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#94a3b8' }}>
              {field === 'password' ? 'Nova senha' : 'Confirmar senha'}
            </label>
            <div className="relative">
              <input
                {...register(field)}
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                className={cn(
                  'w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all focus:ring-2',
                  errors[field] ? 'ring-2 ring-red-500' : 'focus:ring-blue-500/40'
                )}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              {field === 'password' && (
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#64748b' }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
            {errors[field] && <p className="text-xs text-red-400 mt-1">{errors[field]?.message}</p>}
          </div>
        ))}

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
          {loading ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : 'Redefinir senha'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1a30 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', filter: 'blur(80px)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>

          <div className="px-10 pt-10 pb-8 text-center border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Image src="/logo-norte.png" alt="Norte Tech" width={44} height={44} className="object-contain" />
              </div>
            </div>
            <h1 className="font-serif text-2xl font-bold text-white mb-1">JurisAgenda</h1>
            <p className="text-xs tracking-widest uppercase" style={{ color: '#7ab3d8' }}>Redefinir senha</p>
          </div>

          <div className="px-10 py-8">
            <Suspense fallback={<div className="text-center text-white">Carregando…</div>}>
              <ResetForm />
            </Suspense>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
