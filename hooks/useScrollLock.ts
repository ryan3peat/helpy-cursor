import { useEffect } from 'react';

export const useScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (isLocked) {
      // Save original style
      const originalStyle = window.getComputedStyle(document.body).overflow;
      // Lock scrolling
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore original style
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isLocked]);
};

