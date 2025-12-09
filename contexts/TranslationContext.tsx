// contexts/TranslationContext.tsx
// Global context to track all translation activity across the app
// Animation shows while ANY translation (static UI or user content) is in progress

import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';

interface TranslationContextType {
  // Is any translation currently in progress?
  isAnyTranslating: boolean;
  // Register a translation in progress (returns an ID to unregister later)
  registerTranslation: () => string;
  // Unregister a completed translation
  unregisterTranslation: (id: string) => void;
  // Set static UI translation state
  setStaticTranslating: (isTranslating: boolean) => void;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export const useTranslationContext = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslationContext must be used within TranslationProvider');
  }
  return context;
};

// Optional hook that returns null if context is not available (for components outside provider)
export const useTranslationContextOptional = () => {
  return useContext(TranslationContext);
};

interface TranslationProviderProps {
  children: React.ReactNode;
}

// Debounce delay before hiding the animation (prevents flicker)
const DEBOUNCE_DELAY = 500; // ms

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  // Use a single boolean state for isAnyTranslating to minimize re-renders
  const [isAnyTranslating, setIsAnyTranslating] = useState(false);
  
  // Track active translations in refs (no re-renders on individual add/remove)
  const activeTranslationsRef = useRef<Set<string>>(new Set());
  const isStaticTranslatingRef = useRef(false);
  const idCounter = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update the boolean state with debounce for turning OFF
  const updateIsAnyTranslating = useCallback(() => {
    const shouldBeTranslating = isStaticTranslatingRef.current || activeTranslationsRef.current.size > 0;
    
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    if (shouldBeTranslating) {
      // Turn ON immediately
      setIsAnyTranslating(true);
    } else {
      // Turn OFF with debounce (prevents flicker between translations)
      debounceTimerRef.current = setTimeout(() => {
        // Double-check that we should still turn off
        const stillShouldBeOff = !isStaticTranslatingRef.current && activeTranslationsRef.current.size === 0;
        if (stillShouldBeOff) {
          setIsAnyTranslating(false);
        }
      }, DEBOUNCE_DELAY);
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Register a new translation in progress
  const registerTranslation = useCallback(() => {
    const id = `translation-${++idCounter.current}`;
    activeTranslationsRef.current.add(id);
    updateIsAnyTranslating();
    return id;
  }, [updateIsAnyTranslating]);

  // Unregister a completed translation
  const unregisterTranslation = useCallback((id: string) => {
    activeTranslationsRef.current.delete(id);
    updateIsAnyTranslating();
  }, [updateIsAnyTranslating]);

  // Set static translation state
  const setStaticTranslating = useCallback((isTranslating: boolean) => {
    isStaticTranslatingRef.current = isTranslating;
    updateIsAnyTranslating();
  }, [updateIsAnyTranslating]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo<TranslationContextType>(() => ({
    isAnyTranslating,
    registerTranslation,
    unregisterTranslation,
    setStaticTranslating,
  }), [isAnyTranslating, registerTranslation, unregisterTranslation, setStaticTranslating]);

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};

export default TranslationContext;
