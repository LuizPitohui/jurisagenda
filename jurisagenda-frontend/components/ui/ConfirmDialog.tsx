'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  open:       boolean;
  title:      string;
  message:    string;
  confirmLabel?: string;
  danger?:    boolean;
  loading?:   boolean;
  onConfirm:  () => void;
  onCancel:   () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', danger = false, loading, onConfirm, onCancel }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-navy-950/40 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed z-[60] bg-white dark:bg-[#162030] rounded-2xl shadow-xl border p-6 w-full max-w-sm"
            style={{ borderColor: '#e1e8f0', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
                <AlertTriangle size={18} style={{ color: danger ? '#dc2626' : '#d69e2e' }} />
              </div>
              <div>
                <h3 className="font-semibold text-navy-900 mb-1">{title}</h3>
                <p className="text-sm" style={{ color: '#6b8099' }}>{message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={onCancel} className="btn-secondary btn-sm" disabled={loading}>
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="btn btn-sm text-white"
                style={{ background: danger ? '#dc2626' : '#163352' }}
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
