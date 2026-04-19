import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertTriangle, Users, Info } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isDangerous?: boolean;
}

export const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  variant,
  isDangerous
}: ConfirmationModalProps) => {
  const effectiveVariant = variant || (isDangerous ? 'danger' : 'info');
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 40, rotateX: 15 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0, 
              rotateX: 0,
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 25,
                mass: 1
              }
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.8, 
              y: 40,
              transition: {
                duration: 0.2,
                ease: "easeIn"
              }
            }}
            className="relative w-full max-w-md bg-bg-primary/80 backdrop-blur-2xl p-6 sm:p-10 rounded-[2.5rem] space-y-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-subtle overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative background glow */}
            <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 ${
              effectiveVariant === 'danger' ? 'bg-red-500' : 
              effectiveVariant === 'warning' ? 'bg-amber-500' : 
              'bg-indigo-500'
            }`} />

            <div className="flex flex-col items-center text-center space-y-5 relative z-10">
              <motion.div 
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 15 }}
                className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl ${
                  effectiveVariant === 'danger' ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 
                  effectiveVariant === 'warning' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 
                  'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20'
                }`}
              >
                {effectiveVariant === 'danger' ? <Trash2 size={36} /> : 
                 effectiveVariant === 'warning' ? <AlertTriangle size={36} /> : 
                 <Info size={36} />}
              </motion.div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black tracking-tight text-text-primary leading-tight">{title}</h3>
                <p className="text-text-secondary text-base leading-relaxed max-w-[280px] mx-auto">{message}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: "var(--glass-bg)" }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="flex-1 px-8 py-4 rounded-2xl font-bold text-text-secondary hover:text-text-primary transition-all border border-subtle bg-glass"
              >
                {cancelText}
              </motion.button>
              <motion.button
                whileHover={{ 
                  scale: 1.02, 
                  boxShadow: effectiveVariant === 'danger' ? "0 20px 40px -10px rgba(220,38,38,0.4)" : 
                             effectiveVariant === 'warning' ? "0 20px 40px -10px rgba(217,119,6,0.4)" : 
                             "0 20px 40px -10px rgba(79,70,229,0.4)"
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 px-8 py-4 rounded-2xl font-bold text-white transition-all shadow-xl ${
                  effectiveVariant === 'danger' ? 'bg-red-600 hover:bg-red-500' : 
                  effectiveVariant === 'warning' ? 'bg-amber-600 hover:bg-amber-500' : 
                  'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
