'use client';
import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileText, Upload, Trash2, Download, Search, Loader2, Filter, X, Calendar, FileImage, FileType2, File } from 'lucide-react';
import { toast } from 'sonner';
import { documentsApi, eventsApi } from '@/lib/api';
import { fmtDateTime, fmtFileSize, fmtDate, EVENT_CONFIG, cn } from '@/lib/utils';
import type { Event } from '@/types';

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE_MB = 50;
const EVENT_TYPES = ['AUDIENCIA', 'REUNIAO', 'PRAZO', 'CONTRATO'] as const;
const PAGE_SIZE = 20;

export default function DocumentsPage() {
  const [search, setSearch]               = useState('');
  const [typeFilter, setTypeFilter]       = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [dragging, setDragging]           = useState(false);
  const [page, setPage]                   = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: eventsData, isLoading: loadingEvents } = useQuery({
    queryKey: ['events-docs', search, typeFilter, page],
    queryFn:  () => eventsApi.list({
      search:     search || undefined,
      type:       typeFilter || undefined,
      page_size:  PAGE_SIZE,
      page,
    }),
    placeholderData: (prev) => prev,
  });

  const { data: docs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['documents', selectedEvent?.id],
    queryFn:  () => documentsApi.list(selectedEvent!.id),
    enabled:  !!selectedEvent,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedEvent) throw new Error('Selecione um evento primeiro');
      if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`Máximo ${MAX_SIZE_MB}MB`);
      if (!ACCEPTED_TYPES.includes(file.type))   throw new Error('Tipo não permitido');
      const { upload_url, minio_key } = await documentsApi.requestUpload({
        event_id: selectedEvent.id, file_name: file.name,
        content_type: file.type, file_size: file.size,
      });
      await documentsApi.uploadToMinio(upload_url, file);
      await documentsApi.register({
        event_id: selectedEvent.id, file_name: file.name,
        minio_key, content_type: file.type, file_size: file.size,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents', selectedEvent?.id] }); toast.success('Arquivo enviado!'); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['documents', selectedEvent?.id] }); toast.success('Removido.'); },
    onError:    () => toast.error('Erro ao remover.'),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => uploadMutation.mutate(f));
  };

  const fileIcon = (ct: string) => {
    if (ct === 'application/pdf')  return <FileText size={20} style={{ color: '#dc2626' }} />;
    if (ct.startsWith('image/'))   return <FileImage size={20} style={{ color: '#2563eb' }} />;
    if (ct.includes('word'))       return <FileType2 size={20} style={{ color: '#1e3f5c' }} />;
    return <File size={20} style={{ color: '#a89e90' }} />;
  };

  const events     = eventsData?.results ?? [];
  const totalPages = Math.ceil((eventsData?.count ?? 0) / PAGE_SIZE);
  const cfg        = selectedEvent ? EVENT_CONFIG[selectedEvent.event_type] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex gap-0 h-[calc(100vh-112px)]"
    >

      {/* ── Painel esquerdo: lista de eventos ── */}
      <div className="w-80 shrink-0 flex flex-col border-r" style={{ borderColor: '#e2d9c8' }}>

        {/* Header + filtros */}
        <div className="p-4 border-b space-y-3" style={{ borderColor: '#e2d9c8', background: '#faf8f3' }}>
          <div>
            <h2 className="font-serif text-lg font-bold text-navy-900">Documentos</h2>
            <p className="text-xs mt-0.5" style={{ color: '#a89e90' }}>
              {eventsData?.count ?? 0} eventos encontrados
            </p>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a89e90' }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar evento…"
              className="field-input pl-8 text-xs"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={12} style={{ color: '#a89e90' }} />
              </button>
            )}
          </div>

          {/* Filtro por tipo */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => { setTypeFilter(null); setPage(1); }}
              className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-all',
                !typeFilter ? 'bg-navy-800 text-white border-navy-800' : 'border-cream-300 text-navy-600 hover:border-navy-300'
              )}
            >
              Todos
            </button>
            {EVENT_TYPES.map((t) => {
              const c = EVENT_CONFIG[t];
              return (
                <button
                  key={t}
                  onClick={() => { setTypeFilter(typeFilter === t ? null : t); setPage(1); }}
                  className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-all')}
                  style={typeFilter === t
                    ? { background: c.color, color: '#fff', borderColor: c.color }
                    : { borderColor: '#e2d9c8', color: c.color }
                  }
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de eventos */}
        <div className="flex-1 overflow-y-auto">
          {loadingEvents ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skel h-14 rounded-xl" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <FileText size={32} className="opacity-20 mb-2" style={{ color: '#0e1e2e' }} />
              <p className="text-xs" style={{ color: '#c8bfb2' }}>Nenhum evento encontrado</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f0ebe3' }}>
              {events.map((event) => {
                const c      = EVENT_CONFIG[event.event_type];
                const active = selectedEvent?.id === event.id;
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event as unknown as Event)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors flex items-start gap-3',
                      active ? 'bg-navy-50' : 'hover:bg-cream-50'
                    )}
                    style={active ? { background: c.bg + '60', borderLeft: `3px solid ${c.color}` } : { borderLeft: '3px solid transparent' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold uppercase" style={{ color: c.color }}>{c.label}</span>
                      </div>
                      <p className="text-xs font-semibold text-navy-800 truncate">{event.title}</p>
                      <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: '#a89e90' }}>
                        <Calendar size={9} />
                        {fmtDate(event.start_datetime)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="p-3 border-t flex items-center justify-between" style={{ borderColor: '#e2d9c8' }}>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="text-xs px-3 py-1 rounded-lg border disabled:opacity-40"
              style={{ borderColor: '#e2d9c8' }}
            >
              ← Anterior
            </button>
            <span className="text-xs" style={{ color: '#a89e90' }}>{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="text-xs px-3 py-1 rounded-lg border disabled:opacity-40"
              style={{ borderColor: '#e2d9c8' }}
            >
              Próxima →
            </button>
          </div>
        )}
      </div>

      {/* ── Painel direito: documentos ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedEvent ? (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ background: '#faf8f3' }}>
            <FileText size={56} className="opacity-10 mb-4" style={{ color: '#0e1e2e' }} />
            <p className="font-serif text-xl font-semibold text-navy-800 mb-1">Selecione um evento</p>
            <p className="text-sm" style={{ color: '#a89e90' }}>Escolha um evento à esquerda para gerenciar documentos</p>
          </div>
        ) : (
          <>
            {/* Header do evento selecionado */}
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e2d9c8', background: '#faf8f3' }}>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-bold uppercase" style={{ color: cfg!.color }}>{cfg!.label}</span>
                  <span className="text-xs" style={{ color: '#c8bfb2' }}>·</span>
                  <span className="text-xs" style={{ color: '#a89e90' }}>{fmtDate(selectedEvent.start_datetime)}</span>
                </div>
                <h3 className="font-serif text-lg font-bold text-navy-900">{selectedEvent.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#a89e90' }}>{docs.length} documento{docs.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary btn-sm flex items-center gap-1.5"
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  Enviar arquivo
                </button>
                <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </div>
            </div>

            {/* Drop zone + lista */}
            <div
              className="flex-1 overflow-y-auto p-6"
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            >
              {dragging && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/20 backdrop-blur-sm pointer-events-none">
                  <div className="bg-white rounded-2xl p-8 text-center shadow-xl border-2 border-dashed" style={{ borderColor: '#1e3f5c' }}>
                    <Upload size={40} className="mx-auto mb-3" style={{ color: '#1e3f5c' }} />
                    <p className="font-semibold text-navy-800">Solte para enviar</p>
                  </div>
                </div>
              )}

              {loadingDocs ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="skel h-16 rounded-xl" />)}
                </div>
              ) : docs.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all hover:border-navy-300 hover:bg-cream-50"
                  style={{ borderColor: '#e2d9c8' }}
                >
                  <Upload size={36} className="mx-auto mb-3 opacity-30" style={{ color: '#0e1e2e' }} />
                  <p className="text-sm font-semibold text-navy-800 mb-1">Nenhum documento ainda</p>
                  <p className="text-xs" style={{ color: '#a89e90' }}>Arraste arquivos ou clique para enviar · PDF, Word, JPG, PNG · Máx {MAX_SIZE_MB}MB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
                    >
                      <span className="shrink-0">{fileIcon(doc.content_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy-800 truncate">{doc.file_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#a89e90' }}>
                          {fmtFileSize(doc.file_size)} · {fmtDateTime(doc.created_at)} · {doc.uploaded_by_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={async () => {
                            try { window.open(await documentsApi.download(doc.id), '_blank'); }
                            catch { toast.error('Erro ao baixar.'); }
                          }}
                          className="btn-ghost btn-sm p-2 text-navy-600" title="Baixar"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => { if (confirm('Remover este documento?')) deleteMutation.mutate(doc.id); }}
                          className="btn-ghost btn-sm p-2 text-red-400 hover:bg-red-50" title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
