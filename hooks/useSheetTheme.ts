import { useEffect } from 'react';

/**
 * Hook to dim the iOS status bar when a sheet/modal is open.
 * This updates the theme-color meta tag to simulate the bg-black/30 backdrop
 * covering the status bar area (which CSS backdrop-blur cannot reach).
 */
export function useSheetTheme(isOpen: boolean) {
  useEffect(() => {
    const w = window as any;
    if (typeof w.__helpySetSheetOpen === 'function') {
      w.__helpySetSheetOpen(isOpen);
    }
    
    // Restore on unmount (in case component unmounts while open)
    return () => {
      if (isOpen && typeof w.__helpySetSheetOpen === 'function') {
        w.__helpySetSheetOpen(false);
      }
    };
  }, [isOpen]);
}

