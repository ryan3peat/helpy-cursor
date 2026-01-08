import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ToDo from './components/ToDo';
import Meals from './components/Meals';
import Expenses from './components/Expenses';
import Profile from './components/Profile';
import HouseholdInfo from './components/HouseholdInfo';
// IntroAnimation removed - replaced by iOS splash screen + simple fade-in
import { initBadgeTracking, updateBadgeFromData, markAppAsSeen } from './services/appBadgeService';
import Auth from './components/Auth';
import OnboardingOverlay, { OnboardingAction } from './components/OnboardingOverlay';
import InviteSetup from './components/InviteSetup';
// InviteWelcome removed - using Option 2 flow (direct to SignUp via Auth.tsx)
import { ToDoItem, Meal, Expense, User, TranslationDictionary, UserRole } from './types';
import { BASE_TRANSLATIONS } from './constants';
import { detectDeviceLanguage } from './services/languageDetectionService';
import { getStaticTranslations } from './services/translationService';
import { TranslationProvider, useTranslationContext } from './contexts/TranslationContext';
import { DemoModeProvider, useDemoMode } from './contexts/DemoModeContext';
import { supabase } from './services/supabase';
import { useSupabaseReady } from './contexts/SupabaseContext';
import {
  subscribeToCollection,
  addItem,
  updateItem,
  deleteItem,
  saveFamilyNotes,
  subscribeToNotes,
  fetchCollection,
} from './services/supabaseService';
import { initializePushNotifications, autoSubscribeIfNeeded, validateAndSyncSubscription, startPeriodicBatchProcessing, stopPeriodicBatchProcessing, checkNotificationCapability, autoFixNotificationIssues, ensureCurrentSubscriptionSaved, checkForUpdates, applyServiceWorkerUpdate } from './services/pushNotificationService';
import UpdateToast from './components/ui/UpdateToast';
import NotificationPrompt from './components/NotificationPrompt';
import type { EssentialInfo } from '@src/types/essentialInfo';
import type { HouseRoutine } from '@src/types/houseRoutine';
import { 
  subscribeToEssentialInfo,
  createEssentialInfo,
  updateEssentialInfo,
  deleteEssentialInfo,
} from './services/essentialInfoService';
import { 
  subscribeToHouseRoutine,
  createHouseRoutine,
  updateHouseRoutine,
  deleteHouseRoutine,
} from './services/houseRoutineService';
import type { CreateEssentialInfo } from '@src/types/essentialInfo';
import type { CreateHouseRoutine } from '@src/types/houseRoutine';
import { useRealtimeStatus } from './hooks/useRealtimeStatus';

// Loading component for app states
const AppLoading = () => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 page-fade-in auth-gradient-bg">
    {/* Loading bar only - no logo/text to avoid jarring transition from iOS splash */}
    <div className="auth-loading-bar mx-auto">
      <div className="auth-loading-bar-fill" />
    </div>
  </div>
);

// Get a date as YYYY-MM-DD string in LOCAL timezone (not UTC)
// Using toISOString() would convert to UTC which causes date to be wrong after midnight in timezones ahead of UTC
const getLocalDateString = (date: Date = new Date()): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Inner App component that uses the translation context
const AppContent: React.FC = () => {
  const { signOut } = useClerk();
  const { user: clerkUser, isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { setStaticTranslating, isAnyTranslating } = useTranslationContext();
  const isSupabaseReady = useSupabaseReady(); // Wait for authenticated Supabase client
  
  // Demo mode for marketing screenshots
  const { 
    isDemoMode, 
    demoUsers, 
    demoTodoItems, 
    demoMeals, 
    demoExpenses,
    demoFamilyNotes,
    demoFamilyNotesLang,
    demoFamilyNotesTranslations,
    demoEssentialItems,
    demoHouseRoutineItems,
  } = useDemoMode();
  // App fade-in state (replaces old intro animation)
  const [appReady, setAppReady] = useState(false);
  
  // Trigger fade-in after a brief moment (allows splash screen to show)
  useEffect(() => {
    const timer = setTimeout(() => setAppReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  const [activeView, setActiveView] = useState('dashboard');
  const [clerkLoadTimeout, setClerkLoadTimeout] = useState(false);
  const [clerkError, setClerkError] = useState<string | null>(null);
  const [editHelperUserId, setEditHelperUserId] = useState<string | null>(null);
  
  // Generic alert modal state (replaces native alert())
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'success' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'info' });
  
  const showAlert = useCallback((title: string, message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  }, []);

  // PWA Update Toast state
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const updateToastDismissedRef = useRef(false);
  
  // NotificationPrompt visibility state (for coordinating with UpdateToast)
  const [isNotifPromptVisible, setNotifPromptVisible] = useState(false);

  // Listen for service worker update events
  useEffect(() => {
    const handleUpdateAvailable = (e: CustomEvent<{ registration: ServiceWorkerRegistration }>) => {
      console.log('[App] Service worker update available!');
      setSwRegistration(e.detail.registration);
      // Only show toast if user hasn't dismissed it this session
      if (!updateToastDismissedRef.current) {
        setShowUpdateToast(true);
      }
    };

    window.addEventListener('swUpdateAvailable', handleUpdateAvailable as EventListener);
    return () => {
      window.removeEventListener('swUpdateAvailable', handleUpdateAvailable as EventListener);
    };
  }, []);

  // Periodic update checks: on visibility change + every 60 minutes
  useEffect(() => {
    // Check for updates when app comes to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] App visible - checking for updates...');
        checkForUpdates();
      }
    };

    // Check immediately on mount
    checkForUpdates();

    // Check every 60 minutes while app is open
    const intervalId = setInterval(() => {
      console.log('[App] Periodic update check (60 min)...');
      checkForUpdates();
    }, 60 * 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);

  // Handle Update button click
  const handleUpdateApp = useCallback(() => {
    console.log('[App] User clicked Update - applying service worker update...');
    if (swRegistration) {
      applyServiceWorkerUpdate(swRegistration);
    } else {
      // Fallback: just reload if no registration available
      window.location.reload();
    }
  }, [swRegistration]);

  // Handle Dismiss button click
  const handleDismissUpdate = useCallback(() => {
    console.log('[App] User dismissed update toast');
    setShowUpdateToast(false);
    updateToastDismissedRef.current = true;
    // Toast will reappear on next app open (ref resets on page load)
  }, []);

  // debugTheme overlay removed

  // Add timeout fallback if Clerk takes too long to load (10 seconds)
  useEffect(() => {
    if (!clerkLoaded) {
      const timeout = setTimeout(() => {
        console.error('⚠️ [App] Clerk loading timeout - taking longer than 10 seconds');
        console.error('⚠️ [App] Checking for network errors...');
        
        // Check if we can reach Clerk's API
        fetch('https://api.clerk.dev/v1/health', { method: 'HEAD' })
          .then(() => console.log('✅ [App] Can reach Clerk API'))
          .catch((err) => {
            console.error('❌ [App] Cannot reach Clerk API:', err);
            setClerkError('Network error: Cannot connect to Clerk servers. Check your internet connection.');
          });
        
        setClerkLoadTimeout(true);
      }, 10000);
      return () => clearTimeout(timeout);
    } else {
      setClerkLoadTimeout(false);
      setClerkError(null);
    }
  }, [clerkLoaded]);

  // Localization State
  // Initialize language: use saved preference, or detect device language, or default to 'en'
  const [lang, setLang] = useState<string>(() => {
    const saved = localStorage.getItem('helpy_lang');
    if (saved) return saved;
    // Detect device language on first load
    return detectDeviceLanguage();
  });
  const [translations, setTranslations] = useState<TranslationDictionary>(BASE_TRANSLATIONS);
  
  // Set initial static translating state if language is not English
  useEffect(() => {
    if (lang !== 'en') {
      setStaticTranslating(true);
    }
  }, []); // Only on mount
  
  // Load translations when language changes
  // Uses pre-translated strings from Supabase (fast, no AI call)
  useEffect(() => {
    const loadTranslations = async () => {
      // If English, use base translations directly
      if (lang === 'en') {
        setTranslations(BASE_TRANSLATIONS);
        setStaticTranslating(false);
        return;
      }
      
      // Load pre-translated strings from Supabase (or cache)
      setStaticTranslating(true);
      try {
        const translated = await getStaticTranslations(lang);
        setTranslations(translated);
      } catch (error) {
        console.error('Failed to load translations:', error);
        setTranslations(BASE_TRANSLATIONS); // Fallback to English
      } finally {
        setStaticTranslating(false);
      }
    };
    
    loadTranslations();
  }, [lang, setStaticTranslating]);
  
  // Persist language preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('helpy_lang', lang);
  }, [lang]);
  
  // Wrapper for language change that persists to localStorage
  const handleLanguageChange = useCallback((newLang: string) => {
    setLang(newLang);
  }, []);

  // Invite Logic
  const [inviteParams, setInviteParams] = useState<{ hid: string; uid: string } | null>(null);

  const loginProcessedRef = useRef(false);
  
  // Refs to prevent notification check infinite loops
  const notificationCheckInProgressRef = useRef(false);
  const lastNotificationCheckKeyRef = useRef<string | null>(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('helpy_current_session_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState<number>(() => {
    const saved = localStorage.getItem('helpy_onboarding_step');
    return saved ? parseInt(saved, 10) : 1;
  });
  
  // PWA Modal + Onboarding coordination
  // Onboarding should only start AFTER PWA modal is dismissed
  const [pwaModalHandled, setPwaModalHandled] = useState<boolean>(() => {
    // If user has ever dismissed the PWA modal, it's been "handled"
    const dismissCount = localStorage.getItem('helpy_pwa_dismiss_count');
    if (dismissCount && parseInt(dismissCount, 10) > 0) return true;
    // If onboarding is already complete (step 0), no need to wait for PWA modal
    const savedStep = localStorage.getItem('helpy_onboarding_step');
    if (savedStep === '0') return true;
    // Otherwise, wait for Dashboard to signal PWA modal is handled
    return false;
  });
  
  const handlePwaModalDismissed = useCallback(() => {
    if (!pwaModalHandled) {
      setPwaModalHandled(true);
    }
  }, [pwaModalHandled]);

  useEffect(() => {
    localStorage.setItem('helpy_onboarding_step', String(onboardingStep));
  }, [onboardingStep]);

  // Check for invite params and portal return on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const inviteFlag = urlParams.get('invite') || hashParams.get('invite');
    const hid = urlParams.get('hid') || hashParams.get('hid');
    const uid = urlParams.get('uid') || hashParams.get('uid');
    const portalReturn = urlParams.get('portal_return') || hashParams.get('portal_return');
    
    if (inviteFlag === 'true' && hid && uid) {
      setInviteParams({ hid, uid });
    }
    
    // If returning from Stripe portal, navigate to profile view
    // Profile component will handle the portal_return parameter and cancellation detection
    if (portalReturn === 'true' && currentUser) {
      setActiveView('profile');
    }
  }, [currentUser]);

  const handleLogin = useCallback((user: User) => {
    console.log('🔵 [App] handleLogin called with user:', user);
    console.log('🔵 [App] User details:', {
      id: user.id,
      householdId: user.householdId,
      notificationsEnabled: user.notificationsEnabled,
      hasNotificationsEnabled: 'notificationsEnabled' in user
    });
    console.log('🔵 [App] loginProcessedRef.current:', loginProcessedRef.current);
    console.log('🔵 [App] currentUser before update:', currentUser);
    
    if (loginProcessedRef.current) {
      console.log('⚠️ [App] handleLogin blocked by loginProcessedRef');
      return;
    }
    loginProcessedRef.current = true;
    const newUrl = window.location.pathname + window.location.hash.split('?')[0];
    window.history.replaceState({}, document.title, newUrl);
    setInviteParams(null);
    
    console.log('🔵 [App] User details before setCurrentUser:', {
      id: user.id,
      householdId: user.householdId,
      notificationsEnabled: user.notificationsEnabled,
      hasNotificationsEnabled: 'notificationsEnabled' in user,
      userKeys: Object.keys(user)
    });
    
    setCurrentUser(user);
    localStorage.setItem('helpy_current_session_user', JSON.stringify(user));
    setActiveView('dashboard');
    // Mark app as seen for badge tracking
    markAppAsSeen();
    console.log('✅ [App] handleLogin completed, currentUser should be set');
    
    // Note: Notification capability check is handled by the useEffect that watches currentUser
    // No need to duplicate the check here - the useEffect will run when currentUser is set
    setTimeout(() => {
      loginProcessedRef.current = false;
      console.log('✅ [App] loginProcessedRef reset');
    }, 1000);
  }, [currentUser]);

  const handleLogout = useCallback(async () => {
    // Helper function to clear all cached data
    const clearAllCaches = () => {
      localStorage.removeItem('helpy_current_session_user');
      localStorage.removeItem('helpy_cached_users');
      localStorage.removeItem('helpy_cached_todos');
      localStorage.removeItem('helpy_cached_meals');
      localStorage.removeItem('helpy_cached_expenses');
      localStorage.removeItem('helpy_cached_family_notes');
      localStorage.removeItem('helpy_cached_family_notes_lang');
      localStorage.removeItem('helpy_cached_family_notes_translations');
    };

    const resetState = () => {
      loginProcessedRef.current = false;
      setCurrentUser(null);
      clearAllCaches();
      setActiveView('dashboard');
      setUsers([]);
      setTodoItems([]);
      setMeals([]);
      setExpenses([]);
      setFamilyNotes('');
      setFamilyNotesLang(null);
      setFamilyNotesTranslations({});
    };

    try {
      await signOut();
      resetState();
    } catch (error) {
      console.error('Logout error:', error);
      resetState();
    }
  }, [signOut]);

  // Navigation data (e.g., initialSection for ToDo, openAddSheet to auto-open add sheet)
  const [navData, setNavData] = useState<{ section?: string; openAddSheet?: boolean } | null>(null);

  // Navigation
  const handleNavigate = (view: string, data?: { section?: string; openAddSheet?: boolean }) => {
    setActiveView(view);
    setNavData(data ?? null);
    // Scroll to top when navigating to a new view
    // Exception: Meals has its own auto-scroll to Today (see docs/MEALS_SCROLL_FIX.md)
    if (view !== 'meals') {
      window.scrollTo(0, 0);
    }
  };

  // Listen for service worker NAVIGATE messages (from notification clicks)
  // This allows in-app navigation without full page reload, preventing Clerk auth flash
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data?.url) {
        const url = event.data.url as string;
        console.log('[App] Received NAVIGATE message from service worker:', url);
        
        // Parse the hash URL and navigate in-app
        if (url.includes('#todo') || url.includes('todo')) {
          // Extract section if present (e.g., ?section=shopping or ?section=task)
          const sectionMatch = url.match(/section=(\w+)/);
          const section = sectionMatch ? sectionMatch[1] : undefined;
          setActiveView('todo');
          setNavData(section ? { section } : null);
          console.log('[App] Navigating to ToDo', section ? `(section: ${section})` : '');
        } else if (url.includes('#meals') || url.includes('meals')) {
          setActiveView('meals');
          setNavData(null);
          console.log('[App] Navigating to Meals');
        } else if (url.includes('#expenses') || url.includes('expenses')) {
          setActiveView('expenses');
          setNavData(null);
          console.log('[App] Navigating to Expenses');
        } else if (url.includes('#profile') || url.includes('profile')) {
          setActiveView('profile');
          setNavData(null);
          console.log('[App] Navigating to Profile');
        } else {
          // Default to dashboard
          setActiveView('dashboard');
          setNavData(null);
          console.log('[App] Navigating to Dashboard (default)');
        }
        
        // Mark app as seen for badge tracking
        markAppAsSeen();
      }
    };
    
    // Add listener for service worker messages
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);
  
  // Handle edit helper from Helper Management - navigates to Profile and opens edit modal
  const handleEditHelper = (helperId: string) => {
    setEditHelperUserId(helperId);
    setActiveView('profile');
    window.scrollTo(0, 0);
  };

  const advanceOnboarding = (action: OnboardingAction) => {
    if (action.type === 'complete') {
      setOnboardingStep(0);
      return;
    }
    
    if (action.type === 'navigate') {
      handleNavigate(action.target, action.section ? { section: action.section } : undefined);
      // Advance to next step (onboardingStep is 1-based, so increment it)
      setOnboardingStep(prev => prev + 1);
      return;
    }
    
    if (action.type === 'openSheet') {
      // Handle sheet opening if needed
      // For now, just advance the step
      setOnboardingStep(prev => prev + 1);
      return;
    }
    
    // For 'none' action, just advance the step
    setOnboardingStep(prev => prev + 1);
  };

  const skipOnboarding = () => setOnboardingStep(0);

  // Global Data State - With localStorage caching for instant load
  const [users, setUsers] = useState<User[]>(() => {
    const cached = localStorage.getItem('helpy_cached_users');
    return cached ? JSON.parse(cached) : [];
  });
  const [todoItems, setTodoItems] = useState<ToDoItem[]>(() => {
    const cached = localStorage.getItem('helpy_cached_todos');
    return cached ? JSON.parse(cached) : [];
  });
  const [meals, setMeals] = useState<Meal[]>(() => {
    const cached = localStorage.getItem('helpy_cached_meals');
    return cached ? JSON.parse(cached) : [];
  });
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const cached = localStorage.getItem('helpy_cached_expenses');
    return cached ? JSON.parse(cached) : [];
  });
  const [familyNotes, setFamilyNotes] = useState(() => {
    return localStorage.getItem('helpy_cached_family_notes') || '';
  });
  const [familyNotesLang, setFamilyNotesLang] = useState<string | null>(() => {
    return localStorage.getItem('helpy_cached_family_notes_lang') || null;
  });
  const [familyNotesTranslations, setFamilyNotesTranslations] = useState<Record<string, string>>(() => {
    const cached = localStorage.getItem('helpy_cached_family_notes_translations');
    return cached ? JSON.parse(cached) : {};
  });
  const [essentialItems, setEssentialItems] = useState<EssentialInfo[]>([]);
  const [houseRoutineItems, setHouseRoutineItems] = useState<HouseRoutine[]>([]);
  
  // Household limits for family member quota (used by Dashboard)
  const [householdLimits, setHouseholdLimits] = useState<{ maxFamily: number; maxHelpers: number }>({ maxFamily: 3, maxHelpers: 1 });
  
  // Track pending deletions to prevent "ghost returns" from real-time sync
  // Using a ref so it persists across renders without causing re-renders
  const pendingTodoDeletions = useRef<Set<string>>(new Set());

  // ─────────────────────────────────────────────────────────────────
  // Cache Updates - Save to localStorage when data changes
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (users.length > 0 && currentUser?.householdId) {
      localStorage.setItem('helpy_cached_users', JSON.stringify(users));
    }
  }, [users, currentUser?.householdId]);

  useEffect(() => {
    if (todoItems.length > 0 && currentUser?.householdId) {
      localStorage.setItem('helpy_cached_todos', JSON.stringify(todoItems));
    }
  }, [todoItems, currentUser?.householdId]);

  useEffect(() => {
    if (meals.length > 0 && currentUser?.householdId) {
      localStorage.setItem('helpy_cached_meals', JSON.stringify(meals));
    }
  }, [meals, currentUser?.householdId]);

  useEffect(() => {
    if (expenses.length > 0 && currentUser?.householdId) {
      localStorage.setItem('helpy_cached_expenses', JSON.stringify(expenses));
    }
  }, [expenses, currentUser?.householdId]);

  useEffect(() => {
    if (currentUser?.householdId) {
      if (familyNotes) {
        localStorage.setItem('helpy_cached_family_notes', familyNotes);
      }
      if (familyNotesLang) {
        localStorage.setItem('helpy_cached_family_notes_lang', familyNotesLang);
      }
      if (Object.keys(familyNotesTranslations).length > 0) {
        localStorage.setItem('helpy_cached_family_notes_translations', JSON.stringify(familyNotesTranslations));
      }
    }
  }, [familyNotes, familyNotesLang, familyNotesTranslations, currentUser?.householdId]);

  // Sync function for periodic backup fetching
  const syncAllData = useCallback(async () => {
    if (!currentUser?.householdId) return;
    const hid = currentUser.householdId;
    
    console.log('[App] Running periodic sync...');
    
    try {
      // Fetch all collections in parallel (including household limits AND family notes)
      const [usersData, todoData, mealsData, expensesData, householdData] = await Promise.all([
        fetchCollection(hid, 'users'),
        fetchCollection(hid, 'todo_items'),
        fetchCollection(hid, 'meals'),
        fetchCollection(hid, 'expenses'),
        supabase.from('households').select('max_family_members, max_helpers, family_notes, family_notes_lang, family_notes_translations').eq('id', hid).maybeSingle(),
      ]);
      
      // Update state with fresh data
      if (usersData.length > 0) {
        const uniqueUsers = Array.from(new Map(usersData.map(u => [u.id, u])).values());
        setUsers(uniqueUsers as User[]);
      }
      if (todoData) setTodoItems(todoData as ToDoItem[]);
      if (mealsData) setMeals(mealsData as Meal[]);
      if (expensesData) setExpenses(expensesData as Expense[]);
      
      // Update household limits AND family notes (Family Board)
      if (householdData.data) {
        setHouseholdLimits({
          maxFamily: householdData.data.max_family_members ?? 3,
          maxHelpers: householdData.data.max_helpers ?? 1,
        });
        // Sync family notes - fixes Android PWA delay issue where real-time updates were missed
        setFamilyNotes(householdData.data.family_notes || '');
        setFamilyNotesLang(householdData.data.family_notes_lang || null);
        setFamilyNotesTranslations(householdData.data.family_notes_translations || {});
      }
      
      console.log('[App] Periodic sync completed');
    } catch (error) {
      console.error('[App] Periodic sync failed:', error);
    }
  }, [currentUser?.householdId]);

  // Real-time connection status with auto-reconnect and periodic sync
  const { status: realtimeStatus, syncNow } = useRealtimeStatus({
    enablePeriodicSync: true,
    syncInterval: 1 * 60 * 1000, // 1 minute - backup sync if real-time fails
    onSyncRequest: syncAllData,
  });

  // Handle app visibility changes - refetch data when app comes back to foreground
  // This ensures users see fresh data even if subscriptions disconnected while backgrounded
  useEffect(() => {
    if (!currentUser?.householdId) return;

    const handleVisibilityChange = () => {
      // When app becomes visible, check if we need to refresh data
      if (document.visibilityState === 'visible') {
        console.log('[App] 📱 App became visible, checking connection status...');
        
        // If disconnected or connecting, immediately sync data
        if (realtimeStatus === 'disconnected' || realtimeStatus === 'connecting') {
          console.log(`[App] ⚠️ Connection status: ${realtimeStatus} - triggering immediate sync`);
          syncNow();
        } else {
          // Even if connected, do a quick sync to ensure we have latest data
          // This handles cases where subscriptions missed updates while backgrounded
          console.log('[App] ✅ Connection appears active, doing background refresh to catch any missed updates');
          syncAllData();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.householdId, realtimeStatus, syncNow, syncAllData]);

  // Ensure currentUser is always in the users array (for assignee selection)
  useEffect(() => {
    if (currentUser && !users.find(u => u.id === currentUser.id)) {
      setUsers(prev => prev.length > 0 ? prev : [currentUser]);
    }
  }, [currentUser, users]);

  // Initialize push notifications service worker and batch processing
  useEffect(() => {
    initializePushNotifications().catch(err => {
      console.warn('[App] Failed to initialize push notifications:', err);
    });
    
    // Start periodic batch processing as a backup mechanism
    // This ensures notification batches are sent even if pg_cron isn't available
    startPeriodicBatchProcessing();
    
    return () => {
      stopPeriodicBatchProcessing();
    };
  }, []);

  // Initialize app badge tracking (for PWA icon badge)
  useEffect(() => {
    if (!currentUser) return;
    
    // Initialize badge tracking - marks app as seen when opened/visible
    const cleanup = initBadgeTracking(
      currentUser.id,
      () => ({ todoItems, meals, expenses })
    );
    
    return cleanup;
  }, [currentUser?.id]);

  // Update badge when data changes (only when app is in background)
  useEffect(() => {
    if (!currentUser || document.visibilityState === 'visible') return;
    
    // Update badge count when new data arrives while app is backgrounded
    updateBadgeFromData(currentUser.id, todoItems, meals, expenses);
  }, [todoItems.length, meals.length, expenses.length, currentUser?.id]);

  // Auto-subscribe to push notifications if user has them enabled
  // This ensures users with notificationsEnabled=true get subscribed automatically
  // FIX: Use specific dependencies to prevent infinite loops caused by hasPushSubscription updates
  useEffect(() => {
    const userId = currentUser?.id;
    const householdId = currentUser?.householdId;
    const notificationsEnabled = currentUser?.notificationsEnabled;
    const currentHasPushSubscription = currentUser?.hasPushSubscription;
    const userEmail = currentUser?.email;
    
    console.log('[App] Auto-subscribe useEffect triggered', {
      hasCurrentUser: !!currentUser,
      userId,
      householdId,
      notificationsEnabled
    });
    
    if (!userId || !householdId) {
      console.log('[App] Auto-subscribe skipped: missing currentUser or householdId');
      return;
    }
    
    // Create a unique key for this check to prevent duplicate runs
    const checkKey = `${userId}-${householdId}-${notificationsEnabled}`;
    
    // Skip if we already checked with the same parameters
    if (lastNotificationCheckKeyRef.current === checkKey) {
      console.log('[App] Skipping duplicate notification check (same parameters)');
      return;
    }
    
    // Skip if a check is already in progress
    if (notificationCheckInProgressRef.current) {
      console.log('[App] Notification check already in progress, skipping');
      return;
    }
    
    console.log('[App] Checking notification capability...');
    
    // EARLY SYNC CHECK: If browser permission doesn't allow notifications but database
    // says hasPushSubscription=true, this is stale data. Fix it immediately to prevent
    // showing blue bell before the async check completes.
    if (typeof Notification !== 'undefined' && currentHasPushSubscription) {
      const browserPermission = Notification.permission;
      if (browserPermission === 'default' || browserPermission === 'denied') {
        console.log(`[App] 🔧 Early fix: Permission is '${browserPermission}' but hasPushSubscription=true. Correcting stale data.`);
        setCurrentUser(prev => prev ? { ...prev, hasPushSubscription: false } : prev);
      }
    }
    
    // Check REAL notification capability and update UI state accordingly
    // This ensures the bell icon reflects ACTUAL status, not just database flags
    const checkAndUpdateCapability = async () => {
      notificationCheckInProgressRef.current = true;
      lastNotificationCheckKeyRef.current = checkKey;
      
      try {
        // If user disabled notifications, no need to check capability
        if (notificationsEnabled !== true) {
          console.log('[App] Notifications disabled by user preference');
          // Ensure hasPushSubscription is false when notifications are disabled
          if (currentHasPushSubscription) {
            setCurrentUser(prev => prev ? { ...prev, hasPushSubscription: false } : prev);
          }
          return;
        }
        
        // CRITICAL FIX: If permission is granted, ALWAYS ensure current subscription is saved
        // This fixes the "stale subscription" problem where user clears cache
        // and the database has old endpoints that don't work
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          console.log('[App] 🔄 Ensuring current browser subscription is synced to database...');
          console.log('[App] 🔍 Debug: userId =', userId, 'householdId =', householdId, 'email =', userEmail ? userEmail.substring(0, 3) + '***' : 'undefined');
          const synced = await ensureCurrentSubscriptionSaved(userId, householdId, 0, userEmail);
          if (synced) {
            console.log('[App] ✅ Subscription synced successfully');
            setCurrentUser(prev => prev ? { ...prev, hasPushSubscription: true } : prev);
            return; // No need for further checks, we just synced
          } else {
            console.log('[App] ⚠️ Subscription sync failed on initial attempt');
            // Schedule a delayed retry as a fallback (gives more time for service worker)
            console.log('[App] 📅 Scheduling delayed retry in 5 seconds...');
            setTimeout(async () => {
              console.log('[App] ⏰ Delayed retry: Attempting subscription sync again...');
              const delayedSync = await ensureCurrentSubscriptionSaved(userId, householdId, 0, userEmail);
              if (delayedSync) {
                console.log('[App] ✅ Delayed sync succeeded!');
                setCurrentUser(prev => prev ? { ...prev, hasPushSubscription: true } : prev);
              } else {
                console.log('[App] ❌ Delayed sync also failed');
              }
            }, 5000);
          }
        } else {
          console.log('[App] ⏭️ Skipping sync: Notification not defined or permission not granted');
          if (typeof Notification !== 'undefined') {
            console.log('[App] Current permission:', Notification.permission);
          }
        }
        
        // Check actual capability
        const capability = await checkNotificationCapability(userId, householdId);
        
        console.log('[App] Notification capability:', capability);
        
        // Update UI state to reflect REALITY
        const isActuallyCapable = capability.capable;
        
        // Only update if the value actually changed
        if (isActuallyCapable !== currentHasPushSubscription) {
          console.log(`[App] Updating hasPushSubscription: ${currentHasPushSubscription} → ${isActuallyCapable}`);
          setCurrentUser(prev => prev ? { ...prev, hasPushSubscription: isActuallyCapable } : prev);
        }
        
        // If not capable but should be, try to auto-fix
        if (!isActuallyCapable) {
          // Only auto-fix if the reason is something we can fix silently
          if (capability.reason === 'no_browser_subscription' || 
              capability.reason === 'no_database_subscription' ||
              capability.reason === 'subscription_mismatch' ||
              capability.reason === 'no_service_worker') {
            console.log('[App] Attempting auto-fix...');
            const fixed = await autoFixNotificationIssues(userId, householdId);
            if (fixed) {
              console.log('[App] ✅ Auto-fix successful');
              setCurrentUser(prev => prev ? { ...prev, hasPushSubscription: true } : prev);
            } else {
              console.log('[App] ⚠️ Auto-fix failed - user may need to re-toggle');
            }
          } else {
            console.log('[App] ❌ Cannot auto-fix:', capability.reason);
          }
        } else {
          console.log('[App] ✅ Notifications working correctly');
        }
      } catch (err) {
        console.warn('[App] Error checking notification capability:', err);
      } finally {
        notificationCheckInProgressRef.current = false;
      }
    };
    
    checkAndUpdateCapability();
    // FIX: Only depend on specific properties that matter for notifications, NOT the whole object
    // This prevents infinite loops when hasPushSubscription is updated by this very effect
  }, [currentUser?.id, currentUser?.householdId, currentUser?.notificationsEnabled]);

  // Supabase Subscriptions - wait for authenticated client
  useEffect(() => {
    if (!currentUser || !currentUser.householdId) return;
    if (!isSupabaseReady) {
      console.log('[App] ⏳ Waiting for authenticated Supabase client...');
      return;
    }
    console.log('[App] ✅ Supabase ready, setting up subscriptions');
    const hid = currentUser.householdId;
    
    const unsubUsers = subscribeToCollection(hid, 'users', (data) => {
      // Deduplicate users by id to prevent duplicates
      const uniqueUsers = Array.from(new Map(data.map(u => [u.id, u])).values());
      
      // Also deduplicate by name+role+householdId for pending users to prevent race conditions
      const finalUsers = uniqueUsers.reduce((acc: User[], user: User) => {
        const duplicate = acc.find(u => 
          u.name === user.name && 
          u.role === user.role && 
          u.householdId === user.householdId &&
          u.status === 'pending' &&
          u.id !== user.id
        );
        if (!duplicate) {
          acc.push(user);
        } else {
          // Keep the one with the real ID (not temp ID)
          if (!user.id.startsWith('temp-') && duplicate.id.startsWith('temp-')) {
            const index = acc.indexOf(duplicate);
            acc[index] = user;
          }
        }
        return acc;
      }, []);
      
      setUsers(finalUsers as User[]);
    });
    const unsubTodoItems = subscribeToCollection(hid, 'todo_items', (data) => {
      // Filter out items that are pending deletion to prevent "ghost returns"
      // This handles the race condition where real-time fires before delete propagates
      const filteredData = (data as ToDoItem[]).filter(item => !pendingTodoDeletions.current.has(item.id));
      
      // Also merge with any temp items that haven't been saved yet
      setTodoItems(prev => {
        const tempItems = prev.filter(item => item.id.startsWith('temp-') || item.id.startsWith('todo-'));
        // Create a map of real items by their content key for deduplication
        const realItemKeys = new Set(filteredData.map(item => {
          const name = (item.name || '').trim().toLowerCase();
          const category = item.category || '';
          return `${name}|${category}`;
        }));
        // Keep temp items that don't have a corresponding real item yet
        const uniqueTempItems = tempItems.filter(tempItem => {
          const key = `${(tempItem.name || '').trim().toLowerCase()}|${tempItem.category || ''}`;
          return !realItemKeys.has(key);
        });
        return [...filteredData, ...uniqueTempItems];
      });
    });
    const unsubMeals = subscribeToCollection(hid, 'meals', (data) => setMeals(data as Meal[]));
    const unsubExpenses = subscribeToCollection(hid, 'expenses', (data) => setExpenses(data as Expense[]));
    const unsubNotes = subscribeToNotes(hid, (notesData) => {
      setFamilyNotes(notesData.notes);
      setFamilyNotesLang(notesData.notesLang || null);
      setFamilyNotesTranslations(notesData.notesTranslations || {});
    });
    const unsubEssential = subscribeToEssentialInfo(hid, (data) => setEssentialItems(data));
    const unsubHouseRoutine = subscribeToHouseRoutine(hid, (data) => setHouseRoutineItems(data));
    
    return () => {
      unsubUsers();
      unsubTodoItems();
      unsubMeals();
      unsubExpenses();
      unsubNotes();
      unsubEssential();
      unsubHouseRoutine();
    };
  }, [currentUser, isSupabaseReady]);

  // Sync currentUser with users array when user data changes (e.g., role updates)
  // This ensures role changes take effect immediately without requiring logout/login
  useEffect(() => {
    if (currentUser && users.length > 0) {
      const updatedCurrentUser = users.find(u => u.id === currentUser.id);
      if (updatedCurrentUser) {
        // Check if any relevant fields changed
        const hasChanges = 
          updatedCurrentUser.role !== currentUser.role ||
          updatedCurrentUser.name !== currentUser.name ||
          updatedCurrentUser.avatar !== currentUser.avatar ||
          JSON.stringify(updatedCurrentUser.allergies) !== JSON.stringify(currentUser.allergies) ||
          JSON.stringify(updatedCurrentUser.preferences) !== JSON.stringify(currentUser.preferences) ||
          updatedCurrentUser.notificationsEnabled !== currentUser.notificationsEnabled ||
          updatedCurrentUser.hasPushSubscription !== currentUser.hasPushSubscription;
        
        if (hasChanges) {
          setCurrentUser(updatedCurrentUser);
          localStorage.setItem('helpy_current_session_user', JSON.stringify(updatedCurrentUser));
        }
      }
    }
  }, [users]);

  const hid = currentUser?.householdId ?? '';

  // Helper to detect temporary/optimistic IDs that haven't been saved to database yet
  // These IDs are created for optimistic UI updates before real-time sync brings the real UUID
  const isTempId = (id: string): boolean => {
    return id.startsWith('temp-') || id.startsWith('todo-') || /^\d{13,}$/.test(id);
  };

  // ToDo CRUD Handlers
  const handleAddTodoItem = async (item: ToDoItem) => {
    if (!hid) return item;
    
    // Demo mode: skip database, just return the item for UI display
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping todo add to database');
      return item;
    }
    
    const tempId = `todo-${Date.now()}`;
    const newItem = { ...item, id: tempId };
    setTodoItems(prev => [newItem, ...prev]);
    
    // Check if this is a recurring task (has recurrence and frequency is not NONE)
    const isRecurring = item.type === 'task' && 
      item.recurrence && 
      item.recurrence.frequency !== 'NONE';
    
    // If recurring, ONLY create the series - trigger will create instances automatically
    if (isRecurring && item.recurrence) {
      const seriesData = {
        householdId: hid,
        name: item.name,
        category: item.category,
        assigneeId: item.assigneeId,
        dueTime: item.dueTime,
        frequency: item.recurrence.frequency,
        dayOfWeek: item.recurrence.dayOfWeek,
        dayOfMonth: item.recurrence.dayOfMonth,
        startDate: item.dueDate || getLocalDateString(),
        createdBy: currentUser?.id,
      };
      
      const savedSeries = await addItem(hid, 'recurring_series', seriesData);
      console.log('🔄 Created recurring series:', savedSeries?.id);
      
      // The database trigger automatically creates current + next instances
      // Fetch the created instances to update UI
      if (savedSeries?.id) {
        const createdInstances = await supabase
          .from('todo_items')
          .select('*')
          .eq('series_id', savedSeries.id)
          .order('due_date', { ascending: true });
        
        if (createdInstances.data && createdInstances.data.length > 0) {
          // Transform snake_case to camelCase and replace temp item with real instances
          const transformedInstances = createdInstances.data.map(dbItem => ({
            id: dbItem.id,
            householdId: dbItem.household_id,
            type: dbItem.type,
            name: dbItem.name,
            category: dbItem.category,
            completed: dbItem.completed,
            completedAt: dbItem.completed_at,
            assigneeId: dbItem.assignee_id,
            quantity: dbItem.quantity,
            unit: dbItem.unit,
            brand: dbItem.brand,
            dueDate: dbItem.due_date,
            dueTime: dbItem.due_time,
            seriesId: dbItem.series_id,
            isException: dbItem.is_exception,
            originalDueDate: dbItem.original_due_date,
            createdAt: dbItem.created_at,
            createdBy: dbItem.created_by,
            recurrence: item.recurrence, // Keep the recurrence info from original item
            nameLang: dbItem.name_lang,
            nameTranslations: dbItem.name_translations,
          })) as ToDoItem[];
          
          // Remove temp item and add real instances
          setTodoItems(prev => [
            ...transformedInstances,
            ...prev.filter(i => i.id !== tempId)
          ]);
          
          return transformedInstances[0]; // Return first instance
        }
      }
      
      return newItem; // Fallback
    }
    
    // Non-recurring: create the todo item directly
    const itemData = {
      ...item,
      createdBy: currentUser?.id,
    };
    
    const savedItem = await addItem(hid, 'todo_items', itemData);
    
    // Immediately replace temp ID with real ID from database
    // This ensures any subsequent edits use the real ID and get saved properly
    if (savedItem?.id && savedItem.id !== tempId) {
      setTodoItems(prev => prev.map(i => 
        i.id === tempId ? { ...i, id: savedItem.id } : i
      ));
    }
    
    return savedItem || newItem;
  };

  const handleUpdateTodoItem = async (id: string, data: Partial<ToDoItem>) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping todo update to database');
      return;
    }
    
    // Auto-set completedAt when marking item complete/incomplete
    const enhancedData = { ...data };
    if (data.completed === true) {
      enhancedData.completedAt = new Date().toISOString();
    } else if (data.completed === false) {
      enhancedData.completedAt = null; // Clear when uncompleting (null explicitly clears in DB)
    }
    
    // Optimistically update UI
    setTodoItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...enhancedData } : item
    ));
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      console.warn('⚠️ Skipping update for temp item - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'todo_items', id, enhancedData);
    
    // AUTO-CREATE NEXT INSTANCE for recurring tasks when completed
    if (data.completed === true) {
      const item = todoItems.find(i => i.id === id);
      if (item?.recurrence && item.recurrence.frequency !== 'NONE' && item.dueDate) {
        // Calculate next due date based on recurrence
        const currentDate = new Date(item.dueDate + 'T00:00:00');
        let nextDate = new Date(currentDate);
        
        switch (item.recurrence.frequency) {
          case 'DAILY':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
          case 'WEEKLY':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'BIWEEKLY':
            nextDate.setDate(nextDate.getDate() + 14);
            break;
          case 'MONTHLY':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        }
        
        // Format as YYYY-MM-DD
        const nextDueDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
        
        // Create next instance
        const nextItem: ToDoItem = {
          ...item,
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Temp ID
          dueDate: nextDueDateStr,
          completed: false,
          completedAt: undefined,
          createdAt: new Date().toISOString(),
          // Update dayOfWeek/dayOfMonth based on new date
          recurrence: {
            ...item.recurrence,
            dayOfWeek: (item.recurrence.frequency === 'WEEKLY' || item.recurrence.frequency === 'BIWEEKLY') 
              ? nextDate.getDay() : undefined,
            dayOfMonth: item.recurrence.frequency === 'MONTHLY' 
              ? nextDate.getDate() : undefined,
          },
        };
        
        console.log('🔄 Creating next recurring instance:', { from: item.dueDate, to: nextDueDateStr });
        await handleAddTodoItem(nextItem);
      }
    }
  };

  // Update a recurring task with scope options
  // scope: 'this' = only this instance, 'all' = entire series (past and future)
  // virtualDate: if set, this is a virtual instance that needs to be CREATED, not updated
  const handleUpdateRecurringTask = async (
    id: string, 
    data: Partial<ToDoItem>, 
    scope: 'this' | 'all',
    virtualDate?: string
  ) => {
    if (!hid) return;
    
    const item = todoItems.find(i => i.id === id);
    
    // If item not found but we have virtualDate, it's a virtual instance
    // We need to find the source task to get series info
    const sourceTask = item || todoItems.find(i => i.seriesId && i.recurrence?.frequency !== 'NONE');
    
    if (!item && !virtualDate) {
      console.error('Cannot update: item not found and no virtualDate');
      return;
    }
    
    // Get seriesId from existing item or try to find it from source task
    const seriesId = item?.seriesId || sourceTask?.seriesId;
    
    if (!seriesId) {
      // Not a recurring task, just do normal update
      if (item) {
        return handleUpdateTodoItem(id, data);
      }
      return;
    }
    
    console.log(`🔄 Updating recurring task with scope: ${scope}`, { id, data, virtualDate });
    
    switch (scope) {
      case 'this':
        if (virtualDate && !item) {
          // This is a virtual instance - CREATE a new real instance for this date
          const newInstanceData: Partial<ToDoItem> = {
            ...data,
            type: 'task',
            dueDate: virtualDate,
            seriesId: seriesId,
            isException: true,
            originalDueDate: virtualDate,
            completed: false,
          };
          await handleAddTodoItem(newInstanceData as ToDoItem);
        } else if (item) {
          // Real instance - update it
          await handleUpdateTodoItem(id, { ...data, isException: true });
        }
        break;
        
      case 'all': {
        // Update the series template
        const seriesUpdates: Record<string, any> = {};
        if (data.name) seriesUpdates.name = data.name;
        if (data.category) seriesUpdates.category = data.category;
        if (data.assigneeId !== undefined) seriesUpdates.assigneeId = data.assigneeId;
        if (data.dueTime !== undefined) seriesUpdates.dueTime = data.dueTime;
        if (data.recurrence?.frequency) seriesUpdates.frequency = data.recurrence.frequency;
        if (data.recurrence?.dayOfWeek !== undefined) seriesUpdates.dayOfWeek = data.recurrence.dayOfWeek;
        if (data.recurrence?.dayOfMonth !== undefined) seriesUpdates.dayOfMonth = data.recurrence.dayOfMonth;
        
        if (Object.keys(seriesUpdates).length > 0 && seriesId) {
          await updateItem(hid, 'recurring_series', seriesId, seriesUpdates);
        }
        
        // Update all non-exception instances in this series
        // IMPORTANT: Exclude dueDate - each instance keeps its own date!
        const { dueDate: _excludedDate, ...dataWithoutDate } = data;
        const seriesTodo = todoItems.filter(t => t.seriesId === seriesId && !t.isException);
        for (const t of seriesTodo) {
          await handleUpdateTodoItem(t.id, dataWithoutDate);
        }
        break;
      }
    }
  };
  
  // Delete a recurring task with scope options
  // virtualDate: if set, this is a virtual instance
  const handleDeleteRecurringTask = async (id: string, scope: 'this' | 'all', virtualDate?: string) => {
    if (!hid) return;
    
    const item = todoItems.find(i => i.id === id);
    
    // For virtual tasks, find a source task to get series info
    const sourceTask = item || todoItems.find(i => i.seriesId && i.recurrence?.frequency !== 'NONE');
    const seriesId = item?.seriesId || sourceTask?.seriesId;
    
    if (!seriesId) {
      // Not a recurring task
      if (item) {
        return handleDeleteTodoItem(id);
      }
      console.error('Cannot delete: no series found');
      return;
    }
    
    console.log(`🗑️ Deleting recurring task with scope: ${scope}`, { id, virtualDate });
    
    switch (scope) {
      case 'this':
        if (item) {
          // Real instance - delete it
          await handleDeleteTodoItem(id);
        } else if (virtualDate) {
          // Virtual instance - create a "deleted" exception to prevent it from showing
          // We create an instance that's already marked as deleted/completed
          console.log(`Virtual task delete for ${virtualDate} - creating skip record`);
          // For now, we'll just not create anything - the virtual will regenerate
          // A proper solution would require a "skipped_dates" table or similar
          // TODO: Implement proper skip tracking for virtual instances
        }
        break;
        
      case 'all': {
        // Delete entire series and all instances
        // Soft delete the series
        await updateItem(hid, 'recurring_series', seriesId, { 
          deletedAt: new Date().toISOString()
        });
        // Delete all instances
        const allInstances = todoItems.filter(t => t.seriesId === seriesId);
        for (const t of allInstances) {
          await handleDeleteTodoItem(t.id);
        }
        break;
      }
    }
  };

  // Complete a virtual recurring task instance (creates real instance + marks completed in one action)
  const handleCompleteVirtualTask = async (virtualTask: ToDoItem, virtualDate: string) => {
    if (!hid) return;
    
    console.log('✅ Completing virtual task:', { virtualTask, virtualDate });
    
    // Find the series ID from the virtual task or related items
    const seriesId = virtualTask.seriesId || todoItems.find(i => 
      i.recurrence?.frequency !== 'NONE' && 
      i.name === virtualTask.name
    )?.seriesId;
    
    if (!seriesId) {
      console.error('Cannot complete virtual task: no series found');
      return;
    }
    
    // Create a new real instance that's already completed
    // NOTE: Do NOT include recurrence here - that would trigger series creation!
    // The seriesId links this instance to the existing series
    const newInstanceData: Partial<ToDoItem> = {
      type: 'task',
      name: virtualTask.name,
      category: virtualTask.category,
      assigneeId: virtualTask.assigneeId,
      dueDate: virtualDate,
      dueTime: virtualTask.dueTime,
      seriesId: seriesId,
      isException: true,
      originalDueDate: virtualDate,
      completed: true, // Already completed!
      // recurrence intentionally omitted - we're creating an instance, not a new series
    };
    
    await handleAddTodoItem(newInstanceData as ToDoItem);
  };

  const handleDeleteTodoItem = async (id: string) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping todo delete from database');
      return;
    }
    
    // Track this deletion to prevent "ghost returns" from real-time sync
    pendingTodoDeletions.current.add(id);
    
    // Optimistically remove from UI
    setTodoItems(prev => prev.filter(item => item.id !== id));
    
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      console.warn('⚠️ Skipping delete for temp item - not yet saved:', id);
      // Still clear from pending deletions after a brief delay
      setTimeout(() => pendingTodoDeletions.current.delete(id), 500);
      return;
    }
    
    try {
      await deleteItem(hid, 'todo_items', id);
      // Clear from pending deletions after the delete succeeds + brief buffer for real-time
      setTimeout(() => pendingTodoDeletions.current.delete(id), 2000);
    } catch (error) {
      console.error('Failed to delete todo item:', error);
      // On error, clear from pending and restore the item
      pendingTodoDeletions.current.delete(id);
      // Note: Real-time sync will bring the item back automatically
    }
  };

  // Meal CRUD Handlers (with optimistic updates for instant UI)
  const handleAddMeal = async (meal: Meal) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping meal add to database');
      return;
    }
    
    const tempId = `temp-${Date.now()}`;
    const newMeal = { ...meal, id: tempId };
    setMeals(prev => [...prev, newMeal]);  // Optimistic: update UI immediately
    // Include createdBy for notifications
    await addItem(hid, 'meals', { ...meal, createdBy: currentUser?.id });
  };

  const handleUpdateMeal = async (id: string, data: Partial<Meal>) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping meal update to database');
      return;
    }
    
    setMeals(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));  // Optimistic
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      console.warn('⚠️ Skipping update for temp meal - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'meals', id, data);
  };

  const handleDeleteMeal = async (id: string) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping meal delete from database');
      return;
    }
    
    setMeals(prev => prev.filter(m => m.id !== id));  // Optimistic
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      console.warn('⚠️ Skipping delete for temp meal - not yet saved:', id);
      return;
    }
    await deleteItem(hid, 'meals', id);
  };

  // Expense CRUD Handlers (with optimistic updates for instant UI)
  const handleAddExpense = async (expense: Expense): Promise<Expense> => {
    if (!hid) return expense;
    
    // Demo mode: skip database, just return the expense for UI display
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping expense add to database');
      return expense;
    }
    
    const tempId = `temp-${Date.now()}`;
    const newExpense = { ...expense, id: tempId };
    setExpenses(prev => [...prev, newExpense]);  // Optimistic
    
    // Create expense without ID so Supabase generates UUID
    const expenseWithoutId = { ...expense };
    delete expenseWithoutId.id; // Remove ID so Supabase generates UUID
    // Keep createdBy for notifications - expenses table has created_by column (migration 018)
    console.log('[App] Adding expense without ID, will get UUID from DB');
    const savedExpense = await addItem(hid, 'expenses', expenseWithoutId);
    console.log('[App] Expense saved with UUID:', savedExpense.id);
    
    // Return the expense with the actual UUID from database
    return savedExpense as Expense;
  };

  const handleUpdateExpense = async (expense: Expense) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping expense update to database');
      return;
    }
    
    // Exclude createdBy from update - it's a Clerk ID in the app but needs to be UUID in DB
    // The created_by field shouldn't change after creation anyway
    const { id, createdBy, ...data } = expense;
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));  // Optimistic
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      console.warn('⚠️ Skipping update for temp expense - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'expenses', id, data);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping expense delete from database');
      return;
    }
    
    setExpenses(prev => prev.filter(e => e.id !== id));  // Optimistic
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      console.warn('⚠️ Skipping delete for temp expense - not yet saved:', id);
      return;
    }
    await deleteItem(hid, 'expenses', id);
  };

  // User CRUD Handlers (with optimistic updates for instant UI)
  const handleAddUser = async (user: Omit<User, 'id'>): Promise<User | undefined> => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping user add to database');
      return undefined;
    }
    
    // Create temporary ID to prevent duplicates during subscription updates
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempUser: User = { ...user, id: tempId };
    
    // Optimistic update with temporary ID
    setUsers(prev => {
      // Check if user already exists (by name and role to prevent duplicates)
      const exists = prev.some(u => 
        u.name === user.name && 
        u.role === user.role && 
        u.householdId === user.householdId &&
        u.status === 'pending'
      );
      if (exists) return prev;
      return [...prev, tempUser];
    });
    
    try {
      const result = await addItem(hid, 'users', user);
      // Subscription will replace temp user with real user
      return result ? (result as User) : undefined;
    } catch (error) {
      // Remove temp user on error
      setUsers(prev => prev.filter(u => u.id !== tempId));
      throw error;
    }
  };

  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping user update to database');
      return;
    }
    
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));  // Optimistic
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      console.warn('⚠️ Skipping update for temp user - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'users', id, data);
  };

  const handleDeleteUser = async (id: string) => {
    if (!hid || !currentUser) return;

    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping user delete from database');
      return;
    }

    // Skip for temp IDs - user not in database yet
    if (isTempId(id)) {
      console.warn('⚠️ Skipping delete for temp user - not yet saved:', id);
      setUsers(prev => prev.filter(u => u.id !== id));  // Just remove from UI
      return;
    }

    try {
      // Use the new API endpoint that handles different user roles properly
      const apiUrl = import.meta.env?.VITE_API_URL || '';
      const userToDelete = users.find(u => u.id === id);
      if (!userToDelete) return;

      const response = await fetch(`${apiUrl}/api/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: id,
          householdId: hid,
          requesterId: currentUser.id // Pass the logged-in user's ID as requester
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      // Update UI optimistically
      setUsers(prev => prev.filter(u => u.id !== id));

      console.log(`✅ Successfully ${result.operation} user: ${result.removedUser?.name}`);

    } catch (error: any) {
      console.error('Failed to delete user:', error);
      // Revert optimistic update on error
      // Note: In a real app, you'd want to refetch the users list here
      showAlert(
        translations['error.remove_user_title'] || 'Remove User Failed',
        `${translations['error.remove_user'] || 'Failed to remove user'}: ${error.message}`,
        'error'
      );
    }
  };

  // Notes Handler
  const handleSaveFamilyNotes = async (notes: string): Promise<void> => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping family notes save to database');
      return;
    }
    
    const previousNotes = familyNotes; // Store previous value
    const previousLang = familyNotesLang; // Store previous language
    setFamilyNotes(notes); // Optimistic update
    // Set language to current UI language (what user is typing in) for immediate translation support
    // Reset translations when notes change (will be regenerated on display)
    setFamilyNotesLang(lang);
    setFamilyNotesTranslations({});
    
    try {
      // Pass currentUser.id to track who updated for notifications
      await saveFamilyNotes(hid, notes, lang, currentUser?.id);
    } catch (error) {
      console.error('Failed to save notes:', error);
      // Rollback on error
      setFamilyNotes(previousNotes);
      setFamilyNotesLang(previousLang);
      throw error; // Re-throw so Dashboard knows save failed
    }
  };

  // Update notes translations handler
  const handleUpdateNotesTranslations = async (translations: Record<string, string>): Promise<void> => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping notes translations save to database');
      return;
    }
    
    setFamilyNotesTranslations(translations);
    try {
      const { error } = await supabase
        .from('households')
        .update({ family_notes_translations: translations })
        .eq('id', hid);
      if (error) throw error;
    } catch (error) {
      console.error('Failed to update notes translations:', error);
      throw error;
    }
  };

  // Essential Info CRUD Handlers (with optimistic updates for instant UI)
  const handleAddEssentialInfo = async (info: CreateEssentialInfo) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping essential info add to database');
      return;
    }
    
    const tempId = `temp-${Date.now()}`;
    const tempItem: EssentialInfo = {
      ...info,
      id: tempId,
      householdId: hid,
      createdAt: new Date().toISOString(),
    };
    setEssentialItems(prev => [tempItem, ...prev]);  // Optimistic
    try {
      await createEssentialInfo(hid, info);
    } catch (error) {
      console.error('Failed to add essential info:', error);
      setEssentialItems(prev => prev.filter(item => item.id !== tempId));  // Rollback
    }
  };

  const handleUpdateEssentialInfo = async (id: string, data: Partial<CreateEssentialInfo>) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping essential info update to database');
      return;
    }
    
    const previousItems = essentialItems;
    setEssentialItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...data } : item
    ));  // Optimistic
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      console.warn('⚠️ Skipping update for temp essential info - waiting for real ID:', id);
      return;
    }
    try {
      await updateEssentialInfo(hid, id, data);
    } catch (error) {
      console.error('Failed to update essential info:', error);
      setEssentialItems(previousItems);  // Rollback
    }
  };

  const handleDeleteEssentialInfo = async (id: string) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping essential info delete from database');
      return;
    }
    
    const previousItems = essentialItems;
    setEssentialItems(prev => prev.filter(item => item.id !== id));  // Optimistic
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      console.warn('⚠️ Skipping delete for temp essential info - not yet saved:', id);
      return;
    }
    try {
      await deleteEssentialInfo(hid, id);
    } catch (error) {
      console.error('Failed to delete essential info:', error);
      setEssentialItems(previousItems);  // Rollback
    }
  };

  // House Routine CRUD Handlers (with optimistic updates for instant UI)
  const handleAddHouseRoutine = async (item: CreateHouseRoutine) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping house routine add to database');
      return;
    }
    
    const tempId = `temp-${Date.now()}`;
    const tempItem: HouseRoutine = {
      ...item,
      id: tempId,
      householdId: hid,
      createdAt: new Date().toISOString(),
    };
    setHouseRoutineItems(prev => [tempItem, ...prev]);  // Optimistic
    try {
      const saved = await createHouseRoutine(hid, item);
      // Replace the temp item with the saved record
      setHouseRoutineItems(prev => prev.map(i => i.id === tempId ? saved : i));
    } catch (error) {
      console.error('Failed to add house routine:', error);
      setHouseRoutineItems(prev => prev.filter(i => i.id !== tempId));  // Rollback
    }
  };

  const handleUpdateHouseRoutine = async (id: string, data: Partial<CreateHouseRoutine>) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping house routine update to database');
      return;
    }
    
    const previousItems = houseRoutineItems;
    setHouseRoutineItems(prev => prev.map(i => 
      i.id === id ? { ...i, ...data } : i
    ));  // Optimistic
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      console.warn('⚠️ Skipping update for temp house routine - waiting for real ID:', id);
      return;
    }
    try {
      const updated = await updateHouseRoutine(hid, id, data);
      // Ensure state reflects server-mapped data (translations, etc.)
      setHouseRoutineItems(prev => prev.map(i => i.id === id ? updated : i));
    } catch (error) {
      console.error('Failed to update house routine:', error);
      setHouseRoutineItems(previousItems);  // Rollback
    }
  };

  const handleDeleteHouseRoutine = async (id: string) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      console.log('📷 Demo mode: skipping house routine delete from database');
      return;
    }
    
    const previousItems = houseRoutineItems;
    setHouseRoutineItems(prev => prev.filter(i => i.id !== id));  // Optimistic
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      console.warn('⚠️ Skipping delete for temp house routine - not yet saved:', id);
      return;
    }
    try {
      await deleteHouseRoutine(hid, id);
    } catch (error) {
      console.error('Failed to delete house routine:', error);
      setHouseRoutineItems(previousItems);  // Rollback
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard
            todoItems={isDemoMode ? demoTodoItems : todoItems}
            meals={isDemoMode ? demoMeals : meals}
            users={isDemoMode ? demoUsers : users}
            expenses={isDemoMode ? demoExpenses : expenses}
            onNavigate={handleNavigate}
            familyNotes={isDemoMode ? demoFamilyNotes : familyNotes}
            familyNotesLang={isDemoMode ? demoFamilyNotesLang : familyNotesLang}
            familyNotesTranslations={isDemoMode ? demoFamilyNotesTranslations : familyNotesTranslations}
            onUpdateNotes={handleSaveFamilyNotes}
            onUpdateNotesTranslations={handleUpdateNotesTranslations}
            currentUser={isDemoMode ? demoUsers[0] : currentUser!}
            t={translations}
            currentLang={lang}
            onLanguageChange={handleLanguageChange}
            isTranslating={isAnyTranslating}
            onUpdateMeal={handleUpdateMeal}
            realtimeStatus={realtimeStatus}
            onRestartTutorial={() => {
              setOnboardingStep(1);
              setNavData(null);
            }}
            onOpenUserGuide={() => {
              localStorage.setItem('helpy_profile_target_section', 'guide');
              setActiveView('profile');
            }}
            onOpenAddFamily={() => {
              localStorage.setItem('helpy_profile_target_section', 'add_family');
              setActiveView('profile');
            }}
            onSelectFamilyMember={(userId: string) => {
              localStorage.setItem('helpy_profile_edit_user_id', userId);
              setActiveView('profile');
            }}
            householdLimits={householdLimits}
            onUpdateUser={handleUpdateUser}
            isOnboardingActive={onboardingStep > 0 && pwaModalHandled}
            onPwaModalDismissed={handlePwaModalDismissed}
            onTriggerUpdateToast={() => setShowUpdateToast(true)}
          />
        );

      case 'todo':
        return (
          <ToDo
            items={isDemoMode ? demoTodoItems : todoItems}
            users={isDemoMode ? demoUsers : users}
            currentUser={isDemoMode ? demoUsers[0] : currentUser!}
            onAdd={handleAddTodoItem}
            onUpdate={handleUpdateTodoItem}
            onDelete={handleDeleteTodoItem}
            t={translations}
            currentLang={lang}
            initialSection={navData?.section as 'shopping' | 'task' | undefined}
            autoOpenSheet={navData?.openAddSheet}
          />
        );

      case 'meals':
        return (
          <Meals
            meals={isDemoMode ? demoMeals : meals}
            users={isDemoMode ? demoUsers : users}
            currentUser={isDemoMode ? demoUsers[0] : currentUser!}
            onAdd={handleAddMeal}
            onUpdate={handleUpdateMeal}
            onDelete={handleDeleteMeal}
            t={translations}
            currentLang={lang}
          />
        );

      case 'expenses':
        return (
          <Expenses
            expenses={isDemoMode ? demoExpenses : expenses}
            householdId={hid}
            currentUser={isDemoMode ? demoUsers[0] : currentUser}
            onNavigateToPlan={() => handleNavigate('profile')}
            onAdd={handleAddExpense}
            onUpdate={handleUpdateExpense}
            onDelete={handleDeleteExpense}
            t={translations}
            currentLang={lang}
            autoOpenSheet={navData?.openAddSheet}
          />
        );

      case 'info':
        return (
          <HouseholdInfo
            householdId={hid}
            currentUser={isDemoMode ? demoUsers[0] : currentUser!}
            users={isDemoMode ? demoUsers : users}
            essentialItems={isDemoMode ? demoEssentialItems : essentialItems}
            houseRoutineItems={isDemoMode ? demoHouseRoutineItems : houseRoutineItems}
            onAddEssentialInfo={handleAddEssentialInfo}
            onUpdateEssentialInfo={handleUpdateEssentialInfo}
            onDeleteEssentialInfo={handleDeleteEssentialInfo}
            onAddHouseRoutine={handleAddHouseRoutine}
            onUpdateHouseRoutine={handleUpdateHouseRoutine}
            onDeleteHouseRoutine={handleDeleteHouseRoutine}
            t={translations}
            currentLang={lang}
            onNavigateToProfile={() => handleNavigate('profile')}
            onEditHelper={handleEditHelper}
          />
        );

      case 'profile':
        return (
          <Profile
            users={users}
            onAdd={handleAddUser}
            onUpdate={handleUpdateUser}
            onDelete={handleDeleteUser}
            onBack={() => {
              setActiveView('dashboard');
              setEditHelperUserId(null); // Clear edit target when leaving profile
            }}
            currentUser={currentUser!}
            onLogout={handleLogout}
            t={translations}
            currentLang={lang}
            initialEditUserId={editHelperUserId || undefined}
            onRestartTutorial={() => {
              setOnboardingStep(1);
              setActiveView('dashboard');
              // Clear any navigation data to ensure clean restart
              setNavData(null);
            }}
          />
        );

      default:
        return null;
    }
  };

  if (loginProcessedRef.current && !currentUser) {
    return <AppLoading />;
  }

  // CRITICAL: Show loading while Clerk is initializing (after OAuth redirect)
  // Don't make routing decisions until Clerk has finished loading
  if (!clerkLoaded) {
    console.log('🟣 [App] Clerk not loaded yet, showing loading state');
    console.log('🟣 [App] Clerk state details:', { 
      clerkLoaded, 
      isSignedIn, 
      hasClerkUser: !!clerkUser,
      clerkUserId: clerkUser?.id 
    });
    
    // If timeout occurred, show error message
    if (clerkLoadTimeout) {
      return (
        <div className="min-h-screen flex flex-col justify-center items-center p-4 page-fade-in auth-gradient-bg">
          <div className="text-center max-w-md">
            <img 
              src="/helpy-logo-blue.png" 
              alt="Helpy" 
              className="h-14 w-auto mx-auto mb-8"
            />
            <p className="text-lg font-bold mb-2 text-foreground">Loading Timeout</p>
            {clerkError && (
              <p className="text-sm mb-4 text-destructive">{clerkError}</p>
            )}
            <p className="text-sm mb-4 text-muted-foreground">Taking longer than expected to initialize.</p>
            <p className="text-xs text-muted-foreground mb-4">Please check:</p>
            <ul className="text-xs text-muted-foreground text-left list-disc list-inside mb-4 space-y-1">
              <li>Browser console for errors (F12)</li>
              <li>Network connectivity</li>
              <li>Try refreshing the page</li>
            </ul>
            <div className="flex gap-2 justify-center">
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-primary text-white rounded-xl font-semibold"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    return <AppLoading />;
  }

  // OPTION 2: Skip InviteWelcome - go directly to Auth/SignUp for faster flow
  // Auth.tsx will detect invite params and show SignUp component instead of SignIn
  // This reduces the number of pages from 3-4 to 2-3

  // Show InviteSetup for authenticated users with invite params (existing flow)
  // This handles the case where user is already logged in and clicks an invite link
  if (inviteParams && currentUser) {
    return <InviteSetup householdId={inviteParams.hid} userId={inviteParams.uid} onComplete={handleLogin} />;
  }

  // If Clerk user is authenticated but currentUser not set yet, show Auth component
  // This handles the case after OAuth redirect where Clerk is authenticated but App state isn't updated
  if (!currentUser) {
    console.log('🟠 [App] Rendering Auth component - no currentUser');
    console.log('🟠 [App] Clerk state:', { clerkLoaded, isSignedIn, clerkUser: !!clerkUser });
    return (
      <div 
        className={`transition-opacity duration-300 ${appReady ? 'opacity-100' : 'opacity-0'}`}
      >
        <Auth onLogin={handleLogin} t={translations} />
      </div>
    );
  }

  return (
    <div 
      className={`transition-opacity duration-300 ${appReady ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Only show onboarding AFTER PWA modal has been handled */}
      {onboardingStep > 0 && pwaModalHandled && (
        <OnboardingOverlay
          stepIndex={onboardingStep - 1}
          userRole={currentUser.role as UserRole}
          currentPage={activeView}
          currentSection={navData?.section}
          onNext={advanceOnboarding}
          onSkip={skipOnboarding}
          t={translations}
        />
      )}
      <Layout activeView={activeView} onNavigate={handleNavigate} t={translations}>
        {renderView()}
      </Layout>

      {/* NotificationPrompt - shows for first-time PWA users after onboarding */}
      {/* Hidden during onboarding */}
      {currentUser && !(onboardingStep > 0 && pwaModalHandled) && (
        <NotificationPrompt
          currentUser={currentUser}
          t={translations}
          isOnboardingActive={onboardingStep > 0 && pwaModalHandled}
          onVisibilityChange={setNotifPromptVisible}
          onNotificationEnabled={async () => {
            console.log('[App] Notifications enabled via prompt');
            if (currentUser) {
              await handleUpdateUser(currentUser.id, {
                notificationsEnabled: true,
                hasPushSubscription: true
              });
            }
          }}
        />
      )}

      {/* PWA Update Toast - shows when new version is available */}
      {/* Hidden during onboarding AND when NotificationPrompt is visible */}
      <UpdateToast
        isVisible={showUpdateToast && !(onboardingStep > 0 && pwaModalHandled) && !isNotifPromptVisible}
        onUpdate={handleUpdateApp}
        onDismiss={handleDismissUpdate}
        t={translations}
      />

      {/* Generic Alert Modal (replaces native alert()) */}
      {alertModal.isOpen && createPortal(
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <h2 className={`text-title ${alertModal.type === 'error' ? 'text-destructive' : alertModal.type === 'success' ? 'text-primary' : 'text-foreground'}`}>
                {alertModal.title}
              </h2>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-body text-muted-foreground">
                {alertModal.message}
              </p>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border shrink-0">
              <button
                onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                className={`w-full py-3.5 rounded-xl text-body ${
                  alertModal.type === 'error' 
                    ? 'bg-destructive/10 text-destructive' 
                    : alertModal.type === 'success'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                {translations['common.ok'] || 'OK'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

// Main App component that wraps everything with providers
const App: React.FC = () => {
  return (
    <TranslationProvider>
      <DemoModeProvider>
        <AppContent />
      </DemoModeProvider>
    </TranslationProvider>
  );
};

export default App;
