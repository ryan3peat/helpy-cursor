// components/ui/BottomSheet.tsx
// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL BOTTOM SHEET COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
// 
// This component MUST be used for ALL bottom sheets in the app.
// It uses createPortal to render to document.body, ensuring the sheet
// ALWAYS appears above the bottom navigation bar.
//
// KEYBOARD BEHAVIOR:
// - Uses useKeyboardAwareSheet hook for consistent iOS keyboard handling
// - Automatically scrolls focused inputs into view when keyboard opens
// - CSS scroll-margin ensures inputs stay visible above keyboard
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

import React, { ReactNode, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARD-AWARE SHEET HOOK (inline for simpler imports)
// Ensures consistent keyboard behavior - scrolls focused input into view
// ═══════════════════════════════════════════════════════════════════════════
const useKeyboardAwareSheet = (isOpen: boolean, contentRef: React.RefObject<HTMLDivElement>) => {
  const lastViewportHeight = useRef<number>(0);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Clear any pending scroll timeout to prevent memory leaks
  const clearScrollTimeout = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);

  const scrollFocusedInputIntoView = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement;
    if (!activeElement || !contentRef.current) return;

    // Check if focused element is an input inside our sheet
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName);
    if (!isInput) return;

    // Ensure the input is inside our sheet content
    if (!contentRef.current.contains(activeElement)) return;

    // Clear any pending timeout before setting new one
    clearScrollTimeout();

    // Use a small delay to let keyboard finish animating (iOS needs ~300ms)
    scrollTimeoutRef.current = window.setTimeout(() => {
      // Double-check element is still focused before scrolling
      if (document.activeElement === activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
      scrollTimeoutRef.current = null;
    }, 350);
  }, [contentRef, clearScrollTimeout]);

  useEffect(() => {
    // Clean up timeout when sheet closes
    if (!isOpen) {
      clearScrollTimeout();
      return;
    }

    const viewport = window.visualViewport;
    
    if (viewport) {
      // Store initial viewport height
      lastViewportHeight.current = viewport.height;

      const handleResize = () => {
        // Only trigger scroll when viewport shrinks significantly (keyboard opening)
        if (viewport.height < lastViewportHeight.current * 0.8) {
          scrollFocusedInputIntoView();
        }
        lastViewportHeight.current = viewport.height;
      };

      viewport.addEventListener('resize', handleResize);
      return () => {
        viewport.removeEventListener('resize', handleResize);
        clearScrollTimeout();
      };
    }

    // Fallback for browsers without visualViewport: listen to focus events
    // Scoped to only inputs inside this sheet's contentRef
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      
      // Only handle inputs inside our sheet
      if (!contentRef.current?.contains(target)) return;
      
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) {
        clearScrollTimeout();
        scrollTimeoutRef.current = window.setTimeout(() => {
          // Double-check element is still focused
          if (document.activeElement === target) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }
          scrollTimeoutRef.current = null;
        }, 350);
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => {
      document.removeEventListener('focusin', handleFocus);
      clearScrollTimeout();
    };
  }, [isOpen, scrollFocusedInputIntoView, clearScrollTimeout, contentRef]);
};

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
  // Ref for keyboard-aware scrolling
  const sheetContentRef = useRef<HTMLDivElement>(null);
  
  // Enable keyboard-aware scrolling for inputs (skip for centered modals)
  useKeyboardAwareSheet(isOpen && !centered, sheetContentRef);

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
        ref={sheetContentRef}
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

