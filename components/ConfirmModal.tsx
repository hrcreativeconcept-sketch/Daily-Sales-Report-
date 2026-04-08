
import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-elevated overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-900'}`}>
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
          
          <h3 className="text-xl font-heading font-black text-slate-900 mb-2 tracking-tight">{title}</h3>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">{message}</p>
        </div>
        
        <div className="p-4 bg-slate-50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 bg-white border border-slate-200 rounded-xl hover:text-slate-600 transition-all active:scale-95"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-white rounded-xl transition-all active:scale-95 ${
              variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-black'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
