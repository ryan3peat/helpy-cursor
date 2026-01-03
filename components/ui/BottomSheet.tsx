// components/ui/BottomSheet.tsx
// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL BOTTOM SHEET COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
// 
// This component MUST be used for ALL bottom sheets in the app.
// It uses createPortal to render to document.body, ensuring the sheet
// ALWAYS appears above the bottom navigation bar.
//
// DO NOT create bottom sheets manually with <div className="fixed inset-0...">
// ALWAYS use this component instead.
//
// Usage:
//   <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)}>
//     <BottomSheet.Header>
//       <h2 className="text-title text-foreground">Title</h2>
//     </BottomSheet.Header>
//     <BottomSheet.Body>
//       <p>Content here</p>
//     </BottomSheet.Body>
//     <BottomSheet.Footer>
//       <button>Action</button>
//     </BottomSheet.Footer>
//   </BottomSheet>
//
// Or for simple cases:
//   <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)}>
//     {/* Your content */}
//   </BottomSheet>
//
// ═══════════════════════════════════════════════════════════════════════════

import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg'; // sm = 384px, md = 448px, lg = 512px
  maxHeight?: string; // e.g., '80vh', '70vh'
  showCloseButton?: boolean;
  /** For centered modals instead of bottom sheets */
  centered?: boolean;
}

interface SubComponentProps {
  children: ReactNode;
  className?: string;
}

// Sub-components for structured content
const Header: React.FC<SubComponentProps> = ({ children, className = '' }) => (
  <div className={`pt-6 pb-4 px-5 border-b border-border shrink-0 ${className}`}>
    {children}
  </div>
);

const Body: React.FC<SubComponentProps> = ({ children, className = '' }) => (
  <div className={`p-5 flex-1 overflow-y-auto ${className}`}>
    {children}
  </div>
);

const Footer: React.FC<SubComponentProps> = ({ children, className = '' }) => (
  <div className={`p-5 pb-8 border-t border-border shrink-0 ${className}`}>
    {children}
  </div>
);

// Main BottomSheet component
const BottomSheet: React.FC<BottomSheetProps> & {
  Header: typeof Header;
  Body: typeof Body;
  Footer: typeof Footer;
} = ({
  isOpen,
  onClose,
  children,
  maxWidth = 'lg',
  maxHeight = '80vh',
  showCloseButton = true,
  centered = false,
}) => {
  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }[maxWidth];

  const content = (
    <div 
      className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex ${
        centered ? 'items-center' : 'items-end'
      } justify-center bottom-sheet-backdrop`}
      onClick={(e) => {
        // Close when clicking backdrop (not content)
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      {/* Safe area bottom cover - fills the gap below the sheet */}
      {!centered && (
        <div 
          className="absolute bottom-0 left-0 right-0 bg-card"
          style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
        />
      )}
      
      <div 
        className={`bg-card w-full ${maxWidthClass} ${
          centered ? 'rounded-2xl' : 'rounded-t-2xl'
        } overflow-hidden bottom-sheet-content relative flex flex-col`}
        style={{ 
          maxHeight,
          marginBottom: centered ? 0 : 'env(safe-area-inset-bottom, 34px)',
        }}
      >
        {/* Close Button */}
        {showCloseButton && onClose && (
          <button 
            onClick={onClose}
            className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center right-4 top-4 text-muted-foreground"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}
        
        {children}
      </div>
    </div>
  );

  // CRITICAL: Use createPortal to render to document.body
  // This ensures the sheet is ALWAYS above the bottom navigation bar
  return createPortal(content, document.body);
};

// Attach sub-components
BottomSheet.Header = Header;
BottomSheet.Body = Body;
BottomSheet.Footer = Footer;

export default BottomSheet;

