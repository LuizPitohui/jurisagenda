'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileText, Upload, Trash2, Download, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { documentsApi, eventsApi } from '@/lib/api';
import { fmtDateTime, fmtFileSize, EVENT_CONFIG, cn } from '@/lib/utils';


const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_SIZE_MB = 50;

export default function DocumentsPage() {
  const [eventSearch, setEventSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [dragging, setDragging]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: eventsData } = useQuery({
    queryKey: ['events', eventSearch],
    queryFn:  () => eventsApi.list({ search: eventSearch }),
  });

  const { data: docs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['documents', selectedEventId],
    queryFn:  () => documentsApi.list(selectedEventId!),
    enabled:  !!selectedEventId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedEventId) throw new Error('Selecione um evento primeiro');
      if (file.size > MAX_SIZE_MB * 1024 * 1024)
        throw new Error(`Arquivo muito grande. Máximo: ${MAX_SIZE_MB}MB`);
      if (!ACCEPTED_TYPES.includes(file.type))
        throw new Error('Tipo de arquivo não permitido');

      const { upload_url } = await documentsApi.requestUpload({
        event_id:     selectedEventId,
        file_name:    file.name,
        content_type: file.type,
        file_size:    file.size,
      });

      await documentsApi.uploadToMinio(upload_url, file);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', selectedEventId] });
      toast.success('Arquivo enviado com sucesso!');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao enviar arquivo.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', selectedEventId] });
      toast.success('Documento removido.');
    },
    onError: () => toast.error('Erro ao remover documento.'),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => uploadMutation.mutate(file));
  };

  const getFileIcon = (contentType: string) => {
    if (contentType === 'application/pdf')    return '📄';
    if (contentType.startsWith('image/'))     return '🖼️';
    if (contentType.includes('word'))         return '📝';
    return '📎';
  };

  const events = eventsData?.results ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="font-serif text-2xl font-bold text-navy-900">Documentos</h2>
        <p className="text-sm mt-1" style={{ color: '#a89e90' }}>
          Gerencie arquivos vinculados aos eventos
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* ── Coluna esquerda: seleção de evento ── */}
        <div className="space-y-3">
          <div>
            <label className="field-label">Selecionar Evento</label>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: '#a89e90' }}
              />
              <input
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Buscar evento…"
                className="field-input pl-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: '#c8bfb2' }}>
                Nenhum evento encontrado
              </p>
            ) : (
              events.map((event) => {
                const cfg    = EVENT_CONFIG[event.event_type];
                const active = selectedEventId === event.id;
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border-2 transition-all text-xs',
                      active
                        ? 'border-navy-700 bg-navy-50'
                        : 'border-transparent hover:border-cream-300 bg-white'
                    )}
                    style={active ? { borderColor: cfg.color + '66', background: cfg.bg + '40' } : {}}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-[10px] font-bold uppercase"
                        style={{ color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className={cn(
                      'font-semibold truncate',
                      active ? 'text-navy-900' : 'text-navy-700'
                    )}>
                      {event.title}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Coluna direita: documentos ── */}
        <div className="col-span-2 space-y-4">
          {!selectedEventId ? (
            <div
              className="card p-16 text-center h-full flex flex-col items-center justify-center"
              style={{ background: '#faf8f3' }}
            >
              <FileText
                size={48}
                className="mb-4 opacity-20"
                style={{ color: '#0e1e2e' }}
              />
              <p className="font-serif text-lg font-semibold text-navy-800 mb-1">
                Selecione um evento
              </p>
              <p className="text-sm" style={{ color: '#a89e90' }}>
                Escolha um evento à esquerda para ver e enviar documentos
              </p>
            </div>
          ) : (
            <>
              {/* Área de upload */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={()  => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer',
                  'transition-all duration-200',
                  dragging
                    ? 'border-navy-500 bg-navy-50'
                    : 'border-cream-300 hover:border-navy-300 hover:bg-cream-50'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />

                {uploadMutation.isPending ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2
                      size={32}
                      className="animate-spin"
                      style={{ color: '#1e3f5c' }}
                    />
                    <p className="text-sm font-semibold text-navy-800">
                      Enviando…
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload
                      size={32}
                      style={{ color: dragging ? '#1e3f5c' : '#c8bfb2' }}
                    />
                    <p className="text-sm font-semibold text-navy-800">
                      {dragging ? 'Solte para enviar' : 'Arraste arquivos ou clique para selecionar'}
                    </p>
                    <p className="text-xs" style={{ color: '#a89e90' }}>
                      PDF, Word, JPG, PNG · Máximo {MAX_SIZE_MB}MB por arquivo
                    </p>
                  </div>
                )}
              </div>

              {/* Lista de documentos */}
              {loadingDocs ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="card p-4 flex gap-3">
                      <div className="skel w-8 h-8 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="skel h-4 w-48" />
                        <div className="skel h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : docs.length === 0 ? (
                <p
                  className="text-sm text-center py-6"
                  style={{ color: '#c8bfb2' }}
                >
                  Nenhum documento enviado ainda
                </p>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card p-4 flex items-center gap-3"
                    >
                      {/* Ícone */}
                      <span className="text-2xl shrink-0">
                        {getFileIcon(doc.content_type)}
                      </span>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy-800 truncate">
                          {doc.file_name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#a89e90' }}>
                          {fmtFileSize(doc.file_size)} · {fmtDateTime(doc.created_at)} · {doc.uploaded_by_name}
                        </p>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={documentsApi.downloadUrl(doc.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost btn-sm p-2 text-navy-600"
                          title="Baixar"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={() => {
                            if (confirm('Remover este documento?')) {
                              deleteMutation.mutate(doc.id);
                            }
                          }}
                          className="btn-ghost btn-sm p-2 text-red-400 hover:bg-red-50"
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}