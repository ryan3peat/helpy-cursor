// hooks/useScrollHeader.ts
// Reusable hook for scroll-triggered header shrink animation
// Based on Visual Design Specification v1.0.0

import { useState, useEffect, useRef, useCallback } from 'react';

interface ScrollHeaderState {
  isScrolled: boolean;
}

interface ScrollHeaderConfig {
  /** Scroll position to trigger collapse (default: 60px) */
  collapseThreshold?: number;
  /** Scroll position to trigger expand (default: 5px) */
  expandThreshold?: number;
  /** Cooldown period after state change in ms (default: 150ms) */
  cooldown?: number;
}

/**
 * Custom hook for scroll-triggered header animations.
 * Uses hysteresis, cooldown, and RAF to prevent jitter from elastic scrolling.
 */
export function useScrollHeader(config: ScrollHeaderConfig = {}): ScrollHeaderState {
  const { 
    collapseThreshold = 60,
    expandThreshold = 35,
    cooldown = 150
  } = config;

  const [isScrolled, setIsScrolled] = useState(false);
  const isLockedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateScrollState = useCallback((newState: boolean) => {
    if (isLockedRef.current) return;
    
    setIsScrolled(prev => {
      if (prev === newState) return prev;
      
      // Lock state changes for cooldown period
      isLockedRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        isLockedRef.current = false;
      }, cooldown);
      
      return newState;
    });
  }, [cooldown]);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;

      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        
        // Ignore negative/elastic scroll
        if (scrollY >= 0) {
          if (scrollY > collapseThreshold) {
            updateScrollState(true);
          } else if (scrollY < expandThreshold) {
            updateScrollState(false);
          }
        }
        
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [collapseThreshold, expandThreshold, updateScrollState]);

  return { isScrolled };
}

export default useScrollHeader;

