import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'xl' | 'full';
  noPadding?: boolean;
  disableContentScroll?: boolean;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md', 
  noPadding = false,
  disableContentScroll = false 
}) => {
  if (!isOpen) return null;

  const maxWidthClass = size === 'full' ? 'max-w-[95vw]' : size === 'xl' ? 'max-w-6xl' : 'max-w-lg';
  const maxHeightClass = size === 'full' ? 'h-[96vh]' : 'max-h-[95vh]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/60 backdrop-blur-sm animate-in"
      onClick={onClose}
    >
      <div
        className={`bg-[var(--bg)] w-full ${maxWidthClass} ${maxHeightClass} rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col transition-all duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {/* <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-white/50">
          <h3 className="font-bold text-lg text-text">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors text-muted hover:text-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div> */}

        {/* Content */}
        <div className={`flex-1 min-h-0 ${disableContentScroll ? 'overflow-hidden' : 'overflow-y-auto'} ${noPadding ? 'p-0' : 'p-6'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
