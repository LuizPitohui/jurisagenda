'use client';
import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { accountsApi } from '@/lib/api';
import { useAuth } from '@/store';

export function AvatarUpload() {
  const { user, setUser, setAvatar, avatarUrl } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => accountsApi.uploadAvatar(file),
    onSuccess: (data) => {
      setPreview(data.avatar_url);
      setAvatar(data.avatar_url);
      if (user) setUser({ ...user, avatar_key: data.avatar_key } as any);
      toast.success('Avatar atualizado!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Erro ao enviar imagem.';
      toast.error(msg);
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    mutation.mutate(file);
    e.target.value = '';
  };

  const initials = user?.full_name
    ?.split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?';

  // preview tem prioridade (recém enviado), depois avatarUrl persistido no store
  const avatarSrc = preview ?? avatarUrl;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden font-bold text-xl text-white shrink-0"
          style={{ background: '#1e3f5c' }}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={mutation.isPending}
          className="absolute inset-0 rounded-2xl flex items-center justify-center
                     bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          {mutation.isPending
            ? <Loader2 size={20} className="text-white animate-spin" />
            : <Camera size={20} className="text-white" />
          }
        </button>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={mutation.isPending}
        className="text-xs font-semibold transition-colors"
        style={{ color: '#4a7fa8' }}
      >
        {mutation.isPending ? 'Enviando…' : 'Alterar foto'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
