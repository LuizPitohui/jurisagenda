'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, Plus, Pencil, Trash2, Loader2, X, KeyRound, User, Tv } from 'lucide-react';
import { toast } from 'sonner';
import { accountsApi } from '@/lib/api';
import { useAuth } from '@/store';
import { cn } from '@/lib/utils';
import { AvatarUpload } from '@/components/ui/AvatarUpload';
import type { User as UserType } from '@/types';

// Antecedência padrão TV — salva no localStorage
const TV_DEFAULTS_KEY = 'juris-tv-defaults';
const getTVDefaults = () => {
  try { return JSON.parse(localStorage.getItem(TV_DEFAULTS_KEY) ?? '{}'); } catch { return {}; }
};
const saveTVDefaults = (v: any) => localStorage.setItem(TV_DEFAULTS_KEY, JSON.stringify(v));

const ROLES: Record<string, string> = {
  ADMIN: 'Administrador',
  LAWYER: 'Advogado',
  SECRETARY: 'Secretária',
  TV_OPERATOR: 'Operador de TV',
};

const createSchema = z.object({
  email:            z.string().email('E-mail inválido'),
  full_name:        z.string().min(2, 'Nome obrigatório'),
  oab_number:       z.string().optional(),
  role:             z.string(),
  password:         z.string().min(8, 'Mínimo 8 caracteres'),
  password_confirm: z.string(),
}).refine(d => d.password === d.password_confirm, { message: 'Senhas não conferem', path: ['password_confirm'] });

const pwdSchema = z.object({
  old_password:         z.string().min(1, 'Obrigatório'),
  new_password:         z.string().min(8, 'Mínimo 8 caracteres'),
  new_password_confirm: z.string(),
}).refine(d => d.new_password === d.new_password_confirm, { message: 'Senhas não conferem', path: ['new_password_confirm'] });

const profileSchema = z.object({
  full_name:  z.string().min(2, 'Nome obrigatório'),
  oab_number: z.string().optional(),
});

type CreateForm  = z.infer<typeof createSchema>;
type PwdForm     = z.infer<typeof pwdSchema>;
type ProfileForm = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab]           = useState<'users' | 'profile' | 'tv'>('profile');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser]     = useState<UserType | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn:  accountsApi.list,
    enabled:  tab === 'users',
  });

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { role: 'LAWYER' } });
  const pwdForm    = useForm<PwdForm>({ resolver: zodResolver(pwdSchema) });
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user?.full_name ?? '', oab_number: user?.oab_number ?? '' },
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => accountsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuário criado!'); setShowCreate(false); createForm.reset(); },
    onError: () => toast.error('Erro ao criar usuário.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => accountsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuário atualizado!'); setEditUser(null); },
    onError: () => toast.error('Erro ao atualizar.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => accountsApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuário desativado.'); },
    onError: () => toast.error('Erro ao desativar.'),
  });

  const pwdMutation = useMutation({
    mutationFn: (d: PwdForm) => accountsApi.changePassword(d),
    onSuccess: () => { toast.success('Senha alterada!'); pwdForm.reset(); },
    onError: () => toast.error('Senha atual incorreta.'),
  });

  const profileMutation = useMutation({
    mutationFn: (d: ProfileForm) => accountsApi.updateMe(d),
    onSuccess: (updated) => { setUser(updated); toast.success('Perfil atualizado!'); },
    onError: () => toast.error('Erro ao atualizar perfil.'),
  });

  const users = usersData?.results ?? [];
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-navy-900">Configurações</h2>
        <p className="text-sm mt-1" style={{ color: '#a89e90' }}>Gerencie seu perfil e usuários do sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: '#e2d9c8' }}>
        {[
          { key: 'profile', label: 'Meu Perfil', icon: User },
          { key: 'tv',      label: 'Painel TV',  icon: Tv   },
          ...(isAdmin ? [{ key: 'users', label: 'Usuários', icon: Users }] : []),
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              tab === key ? 'border-navy-800 text-navy-900' : 'border-transparent text-navy-400 hover:text-navy-700'
            )}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── Perfil ── */}
      {tab === 'profile' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-4 pb-2 border-b" style={{ borderColor: '#e2d9c8' }}>
              <AvatarUpload />
              <div>
                <p className="font-semibold text-navy-800">{user?.full_name}</p>
                <p className="text-xs" style={{ color: '#a89e90' }}>{user?.email}</p>
              </div>
            </div>
            <h3 className="font-semibold text-navy-800">Dados pessoais</h3>
            <form onSubmit={profileForm.handleSubmit(d => profileMutation.mutate(d))} className="space-y-4">
              <div>
                <label className="field-label">Nome completo</label>
                <input {...profileForm.register('full_name')} className="field-input" />
                {profileForm.formState.errors.full_name && <p className="field-error">{profileForm.formState.errors.full_name.message}</p>}
              </div>
              <div>
                <label className="field-label">Número OAB</label>
                <input {...profileForm.register('oab_number')} className="field-input" placeholder="SP 123456" />
              </div>
              <div>
                <label className="field-label">E-mail</label>
                <input value={user?.email ?? ''} disabled className="field-input opacity-50" />
              </div>
              <div>
                <label className="field-label">Perfil</label>
                <input value={ROLES[user?.role ?? ''] ?? user?.role} disabled className="field-input opacity-50" />
              </div>
              <button type="submit" disabled={profileMutation.isPending} className="btn-primary w-full">
                {profileMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Salvar alterações'}
              </button>
            </form>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-navy-800 flex items-center gap-2"><KeyRound size={16} /> Alterar senha</h3>
            <form onSubmit={pwdForm.handleSubmit(d => pwdMutation.mutate(d))} className="space-y-4">
              <div>
                <label className="field-label">Senha atual</label>
                <input {...pwdForm.register('old_password')} type="password" className="field-input" />
                {pwdForm.formState.errors.old_password && <p className="field-error">{pwdForm.formState.errors.old_password.message}</p>}
              </div>
              <div>
                <label className="field-label">Nova senha</label>
                <input {...pwdForm.register('new_password')} type="password" className="field-input" />
                {pwdForm.formState.errors.new_password && <p className="field-error">{pwdForm.formState.errors.new_password.message}</p>}
              </div>
              <div>
                <label className="field-label">Confirmar nova senha</label>
                <input {...pwdForm.register('new_password_confirm')} type="password" className="field-input" />
                {pwdForm.formState.errors.new_password_confirm && <p className="field-error">{pwdForm.formState.errors.new_password_confirm.message}</p>}
              </div>
              <button type="submit" disabled={pwdMutation.isPending} className="btn-primary w-full">
                {pwdMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Alterar senha'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Painel TV ── */}
      {tab === 'tv' && (
        <div className="card p-6 max-w-md space-y-5">
          <h3 className="font-semibold text-navy-800 flex items-center gap-2"><Tv size={16} /> Antecedência padrão</h3>
          <p className="text-xs" style={{ color: '#6b8099' }}>
            Define o valor padrão de antecedência ao criar novos eventos com TV habilitada.
          </p>
          <div className="flex gap-3 items-center">
            <input
              type="number"
              min="0"
              defaultValue={getTVDefaults().value ?? 15}
              id="tv-advance-value"
              className="field-input w-24 text-center"
            />
            <select
              defaultValue={getTVDefaults().unit ?? 'MINUTES'}
              id="tv-advance-unit"
              className="field-input flex-1"
            >
              <option value="MINUTES">Minutos</option>
              <option value="HOURS">Horas</option>
              <option value="DAYS">Dias</option>
            </select>
          </div>
          <button
            onClick={() => {
              const value = parseInt((document.getElementById('tv-advance-value') as HTMLInputElement).value);
              const unit  = (document.getElementById('tv-advance-unit') as HTMLSelectElement).value;
              saveTVDefaults({ value, unit });
              toast.success('Antecedência padrão salva!');
            }}
            className="btn-primary w-full"
          >
            Salvar
          </button>
        </div>
      )}

      {/* ── Usuários ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Novo usuário
            </button>
          </div>

          <div className="card divide-y" style={{ borderColor: '#e2d9c8' }}>
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-4 p-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: '#1e3f5c' }}>
                  {u.full_name?.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase() ?? '??'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-800 truncate">{u.full_name}</p>
                  <p className="text-xs" style={{ color: '#a89e90' }}>{u.email} · {ROLES[u.role] ?? u.role}</p>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500')}>
                  {u.is_active ? 'Ativo' : 'Inativo'}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setEditUser(u)} className="btn-ghost btn-sm p-2"><Pencil size={13} /></button>
                  {u.id !== user?.id && (
                    <button onClick={() => { if (confirm(`Desativar ${u.full_name}?`)) deactivateMutation.mutate(u.id); }}
                      className="btn-ghost btn-sm p-2 text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal criar usuário */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-navy-800">Novo usuário</h3>
              <button onClick={() => setShowCreate(false)}><X size={16} /></button>
            </div>
            <form onSubmit={createForm.handleSubmit(d => createMutation.mutate(d))} className="space-y-3">
              {[
                { name: 'full_name', label: 'Nome completo', type: 'text' },
                { name: 'email', label: 'E-mail', type: 'email' },
                { name: 'oab_number', label: 'OAB (opcional)', type: 'text' },
                { name: 'password', label: 'Senha', type: 'password' },
                { name: 'password_confirm', label: 'Confirmar senha', type: 'password' },
              ].map(({ name, label, type }) => (
                <div key={name}>
                  <label className="field-label">{label}</label>
                  <input {...createForm.register(name as any)} type={type} className="field-input" />
                  {(createForm.formState.errors as any)[name] && (
                    <p className="field-error">{(createForm.formState.errors as any)[name]?.message}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="field-label">Perfil</label>
                <select {...createForm.register('role')} className="field-input">
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
                  {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar usuário */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-navy-800">Editar usuário</h3>
              <button onClick={() => setEditUser(null)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="field-label">Nome completo</label>
                <input defaultValue={editUser.full_name ?? ''} id="edit-name" className="field-input" />
              </div>
              <div>
                <label className="field-label">OAB</label>
                <input defaultValue={editUser.oab_number ?? ''} id="edit-oab" className="field-input" />
              </div>
              <div>
                <label className="field-label">Perfil</label>
                <select defaultValue={editUser.role} id="edit-role" className="field-input">
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditUser(null)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={() => updateMutation.mutate({ id: editUser.id, data: {
                    full_name:  (document.getElementById('edit-name') as HTMLInputElement).value,
                    oab_number: (document.getElementById('edit-oab') as HTMLInputElement).value,
                    role:       (document.getElementById('edit-role') as HTMLSelectElement).value,
                  }})}
                  disabled={updateMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
