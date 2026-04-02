'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
});
type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: Form) => {
    setLoading(true);
    try {
      await api.post('auth/forgot-password/', { email });
      setSent(true);
    } catch {
      toast.error('Erro ao processar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1a30 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7ab3d8, transparent)', filter: 'blur(80px)' }} />
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
            <p className="text-xs tracking-widest uppercase" style={{ color: '#7ab3d8' }}>Recuperação de senha</p>
          </div>

          <div className="px-10 py-8">
            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4"
              >
                <CheckCircle2 size={48} className="mx-auto" style={{ color: '#22c55e' }} />
                <h2 className="text-lg font-semibold text-white">E-mail enviado</h2>
                <p className="text-sm" style={{ color: '#64748b' }}>
                  Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha em breve.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold mt-4"
                  style={{ color: '#7ab3d8' }}
                >
                  <ArrowLeft size={14} /> Voltar ao login
                </Link>
              </motion.div>
            ) : (
              <>
                <div className="mb-7">
                  <h2 className="text-lg font-semibold text-white mb-1">Esqueceu sua senha?</h2>
                  <p className="text-sm" style={{ color: '#64748b' }}>
                    Informe seu e-mail e enviaremos um link para redefinir sua senha.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                        'w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all focus:ring-2',
                        errors.email ? 'ring-2 ring-red-500' : 'focus:ring-blue-500/40'
                      )}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
                  </div>

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
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Enviando…</> : 'Enviar link de recuperação'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/login" className="inline-flex items-center gap-1.5 text-sm" style={{ color: '#64748b' }}>
                    <ArrowLeft size={13} /> Voltar ao login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
