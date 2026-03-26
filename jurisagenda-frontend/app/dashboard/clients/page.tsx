'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Search, Plus, Shield, Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { clientsApi } from '@/lib/api';
import { fmtDate, cn } from '@/lib/utils';
import type { Client } from '@/types';

const schema = z.object({
  full_name:               z.string().min(1, 'Nome obrigatório'),
  cpf_cnpj:                z.string().min(1, 'CPF/CNPJ obrigatório'),
  email:                   z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone:                   z.string().optional(),
  notes:                   z.string().optional(),
  consent_given:           z.boolean().refine((v) => v, 'Consentimento obrigatório'),
  consent_policy_version:  z.string().optional(),
});
type Form = z.infer<typeof schema>;

function ClientCard({ client, onAnonymize }: { client: Client; onAnonymize: (id: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">

          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm text-white"
            style={{ background: '#1e3f5c' }}
          >
            {client.full_name.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-serif font-semibold text-navy-900">
                {client.full_name}
              </h3>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#f0f4f9', color: '#2a567a' }}
              >
                {client.code}
              </span>
            </div>
            <p className="text-xs" style={{ color: '#8a7e70' }}>
              {client.cpf_cnpj}
            </p>
            {client.email && (
              <p className="text-xs mt-0.5" style={{ color: '#a89e90' }}>
                {client.email}
              </p>
            )}
            {client.phone && (
              <p className="text-xs" style={{ color: '#a89e90' }}>
                {client.phone}
              </p>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'badge text-[10px]',
                client.consent_given
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-600 border-red-200'
              )}
            >
              <Shield size={9} />
              {client.consent_given ? 'LGPD OK' : 'Sem consent.'}
            </span>
          </div>

          <p className="text-[10px]" style={{ color: '#c8bfb2' }}>
            Desde {fmtDate(client.created_at)}
          </p>

          <button
            onClick={() => {
              if (confirm(`Anonimizar ${client.full_name}? Esta ação é irreversível.`)) {
                onAnonymize(client.id);
              }
            }}
            className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
          >
            Anonimizar
          </button>
        </div>
      </div>

      {/* Notas */}
      {client.notes && (
        <p
          className="mt-3 text-xs px-3 py-2 rounded-lg"
          style={{ background: '#faf8f3', color: '#8a7e70' }}
        >
          {client.notes}
        </p>
      )}
    </motion.div>
  );
}

export default function ClientsPage() {
  const [search,    setSearch]    = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn:  () => clientsApi.list(search || undefined),
  });

  const clients = data?.results ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (d: Form) => clientsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente cadastrado!');
      setShowForm(false);
      reset();
    },
    onError: () => toast.error('Erro ao cadastrar cliente.'),
  });

  const anonymizeMutation = useMutation({
    mutationFn: (id: string) => clientsApi.anonymize(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Dados anonimizados conforme LGPD.');
    },
    onError: () => toast.error('Erro ao anonimizar cliente.'),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-navy-900">Clientes</h2>
          <p className="text-sm mt-1" style={{ color: '#a89e90' }}>
            Gestão com conformidade LGPD
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary btn-sm gap-1.5"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Novo Cliente'}
        </button>
      </div>

      {/* Formulário de cadastro */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1,  y:  0 }}
          className="card p-6"
        >
          <h3 className="font-serif text-lg font-bold text-navy-900 mb-4">
            Novo Cliente
          </h3>
          <form
            onSubmit={handleSubmit((d) => createMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Nome Completo *</label>
                <input
                  {...register('full_name')}
                  className={cn('field-input', errors.full_name && 'error')}
                  placeholder="João da Silva"
                />
                {errors.full_name && (
                  <p className="field-error">{errors.full_name.message}</p>
                )}
              </div>
              <div>
                <label className="field-label">CPF / CNPJ *</label>
                <input
                  {...register('cpf_cnpj')}
                  className={cn('field-input', errors.cpf_cnpj && 'error')}
                  placeholder="000.000.000-00"
                />
                {errors.cpf_cnpj && (
                  <p className="field-error">{errors.cpf_cnpj.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">E-mail</label>
                <input
                  {...register('email')}
                  type="email"
                  className="field-input"
                  placeholder="cliente@email.com"
                />
              </div>
              <div>
                <label className="field-label">Telefone</label>
                <input
                  {...register('phone')}
                  className="field-input"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div>
              <label className="field-label">Observações</label>
              <textarea
                {...register('notes')}
                rows={2}
                className="field-input resize-none"
                placeholder="Informações adicionais…"
              />
            </div>

            {/* Consentimento LGPD */}
            <div
              className="rounded-xl p-4 border"
              style={{ borderColor: '#e2d9c8', background: '#faf8f3' }}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  {...register('consent_given')}
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded accent-navy-900"
                />
                <div>
                  <p className="text-sm font-semibold text-navy-800">
                    Consentimento LGPD *
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#a89e90' }}>
                    O titular autoriza o tratamento dos seus dados pessoais
                    conforme a Lei nº 13.709/2018 (LGPD) para fins de
                    prestação de serviços jurídicos.
                  </p>
                </div>
              </label>
              {errors.consent_given && (
                <p className="field-error mt-2">{errors.consent_given.message}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); reset(); }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending
                  ? <><Loader2 size={15} className="animate-spin" /> Salvando…</>
                  : 'Cadastrar Cliente'
                }
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: '#a89e90' }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF ou e-mail…"
          className="field-input pl-9"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5 flex gap-4">
              <div className="skel w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skel h-4 w-40" />
                <div className="skel h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div
          className="card p-16 text-center"
          style={{ background: '#faf8f3' }}
        >
          <Users
            size={48}
            className="mx-auto mb-4 opacity-20"
            style={{ color: '#0e1e2e' }}
          />
          <p className="font-serif text-xl font-semibold text-navy-800 mb-2">
            {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </p>
          <p className="text-sm" style={{ color: '#a89e90' }}>
            {search
              ? 'Tente buscar por outro termo'
              : 'Clique em "Novo Cliente" para começar'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onAnonymize={(id) => anonymizeMutation.mutate(id)}
            />
          ))}
        </div>
      )}

    </div>
  );
}