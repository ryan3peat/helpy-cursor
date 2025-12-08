import { useEffect, useRef } from 'react';

export const useScrollLock = (isLocked: boolean) => {
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (isLocked) {
      // Save current scroll position
      scrollYRef.current = window.scrollY;
      
      // Apply comprehensive scroll lock (fixes iOS Safari keyboard issue)
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.width = '100%';
      
      return () => {
        // Remove scroll lock
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        document.body.style.width = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollYRef.current);
      };
    }
  }, [isLocked]);
};

