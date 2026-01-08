/**
 * UpdateToast Component
 * 
 * Shows a non-blocking floating toast when a new app version is available.
 * Users can tap Update to reload the app, or X to dismiss (will show again on next open).
 * 
 * This toast appears above the bottom nav (z-[55]) but below modals (z-[60]).
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { TranslationDictionary } from '../types';

interface UpdateToastProps {
  isVisible: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  t: TranslationDictionary;
}

const UpdateToast: React.FC<UpdateToastProps> = ({
  isVisible,
  onUpdate,
  onDismiss,
  t
}) => {
  if (!isVisible) return null;

  return createPortal(
    <div 
      className="fixed bottom-24 left-4 right-4 z-[55] animate-slide-up"
      role="alert"
      aria-live="polite"
    >
      <div 
        className="max-w-lg mx-auto bg-primary rounded-xl p-4 relative"
        style={{ boxShadow: '0 8px 32px rgba(62, 175, 210, 0.4)' }}
      >
        
        {/* X button - top right */}
        <button 
          onClick={onDismiss}
          className="absolute top-2.5 right-2.5 p-2 text-white"
          aria-label={t['common.dismiss'] || 'Dismiss'}
        >
          <X size={20} />
        </button>
        
        {/* Content - title left, button right */}
        <div className="flex items-center justify-between pr-10">
          <p className="text-body font-semibold text-white">
            {t['update.new_version_title'] || 'New App Update'}<br />
            {t['update.available'] || 'Available'}
          </p>
          
          <button 
            onClick={onUpdate}
            className="px-5 py-2 bg-white text-primary rounded-xl text-body font-semibold shadow-sm"
          >
            {t['update.update_button'] || 'Update'}
          </button>
        </div>
        
      </div>
    </div>,
    document.body
  );
};

export default UpdateToast;

