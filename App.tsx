import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import Layout from './components/Layout';
import Home from './components/Home';
import ToDo from './components/ToDo';
import Meals from './components/Meals';
import Expenses from './components/Expenses';
import Profile from './components/Profile';
import Family from './components/Family';
import Analytics from './components/Analytics';
// IntroAnimation removed - replaced by iOS splash screen + simple fade-in
import { initBadgeTracking, updateBadgeFromData, markAppAsSeen } from './services/appBadgeService';
import Auth from './components/Auth';
import OnboardingOverlay, { OnboardingAction } from './components/OnboardingOverlay';
import InviteSetup from './components/InviteSetup';
// InviteWelcome removed - using Option 2 flow (direct to SignUp via Auth.tsx)
import { ToDoItem, Meal, Expense, User, TranslationDictionary, UserRole, TrialStatus, UsageStatus } from './types';
import { calculateTrialStatus, calculateUsageStatus, incrementAiScanCount } from './services/trialService';
import TrialWarningModal from './components/TrialWarningModal';
import UsageLimitModal from './components/UsageLimitModal';
import { BASE_TRANSLATIONS } from './constants';
import { detectDeviceLanguage } from './services/languageDetectionService';
import { getStaticTranslations } from './services/translationService';
import { TranslationProvider, useTranslationContext } from './contexts/TranslationContext';
import { DemoModeProvider, useDemoMode } from './contexts/DemoModeContext';
import { supabase } from './services/supabase';
import { useSupabaseReady, getAuthenticatedSupabaseClient, useTokenRefreshCount } from './contexts/SupabaseContext';
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
import ErrorBoundary from './components/ui/ErrorBoundary';
import NotificationPrompt from './components/NotificationPrompt';
import SalarySlipReminderPrompt from './components/SalarySlipReminderPrompt';
import type { Place, CreatePlace } from '@src/types/place';
import type { Practice, CreatePractice } from '@src/types/practice';
import type { HelperContract, SalarySlip } from '@src/types/helperManagement';
import { getHelperContracts, getAllSalarySlips, subscribeToHelperContracts, subscribeToSalarySlips } from './services/salarySlipService';
import { 
  subscribeToPlaces,
  createPlace,
  updatePlace,
  deletePlace,
} from './services/placeService';
import { 
  subscribeToPractices,
  createPractice,
  updatePractice,
  deletePractice,
} from './services/practiceService';
import { useRealtimeStatus } from './hooks/useRealtimeStatus';
import { logger } from './utils/logger';

// Loading component for app states
const AppLoading = () => (
  <div 
    className="fixed inset-0 flex flex-col items-center justify-center p-6 auth-gradient-bg overflow-hidden"
    style={{ touchAction: 'none' }}
  >
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
  const tokenRefreshCount = useTokenRefreshCount(); // Triggers data refetch when token is refreshed
  const [pushDataRefreshTrigger, setPushDataRefreshTrigger] = useState(0); // Triggers data refetch when push notification received
  
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
    demoPlaces,
    demoPractices,
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
  
  // SalarySlipReminderPrompt visibility state
  const [isSalaryReminderVisible, setSalaryReminderVisible] = useState(false);

  // Listen for service worker update events
  useEffect(() => {
    const handleUpdateAvailable = (e: CustomEvent<{ registration: ServiceWorkerRegistration }>) => {
      logger.log('[App] Service worker update available!');
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
  // NOTE: Initial check is done AFTER initializePushNotifications() to avoid race condition
  useEffect(() => {
    // Check for updates when app comes to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.log('[App] App visible - checking for updates...');
        checkForUpdates();
      }
    };

    // Check every 60 minutes while app is open
    const intervalId = setInterval(() => {
      logger.log('[App] Periodic update check (60 min)...');
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
    logger.log('[App] User clicked Update - applying service worker update...');
    if (swRegistration) {
      applyServiceWorkerUpdate(swRegistration);
    } else {
      // Fallback: just reload if no registration available
      window.location.reload();
    }
  }, [swRegistration]);

  // Handle Dismiss button click
  const handleDismissUpdate = useCallback(() => {
    logger.log('[App] User dismissed update toast');
    setShowUpdateToast(false);
    updateToastDismissedRef.current = true;
    // Toast will reappear on next app open (ref resets on page load)
  }, []);

  // debugTheme overlay removed

  // Add timeout fallback if Clerk takes too long to load (10 seconds)
  useEffect(() => {
    if (!clerkLoaded) {
      const timeout = setTimeout(() => {
        logger.error('⚠️ [App] Clerk loading timeout - taking longer than 10 seconds');
        logger.error('⚠️ [App] Checking for network errors...');
        
        // Check if we can reach Clerk's API
        fetch('https://api.clerk.dev/v1/health', { method: 'HEAD' })
          .then(() => logger.log('✅ [App] Can reach Clerk API'))
          .catch((err) => {
            logger.error('❌ [App] Cannot reach Clerk API:', err);
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
        logger.error('Failed to load translations:', error);
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
  
  // Session verification state - ensures we verify session BEFORE showing content
  // This is the "at the door" check to catch stale sessions early
  const [sessionVerified, setSessionVerified] = useState(false);

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
    // Otherwise, wait for Home to signal PWA modal is handled
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
    logger.log('🔵 [App] handleLogin called with user:', user);
    logger.log('🔵 [App] User details:', {
      id: user.id,
      householdId: user.householdId,
      notificationsEnabled: user.notificationsEnabled,
      hasNotificationsEnabled: 'notificationsEnabled' in user
    });
    logger.log('🔵 [App] loginProcessedRef.current:', loginProcessedRef.current);
    logger.log('🔵 [App] currentUser before update:', currentUser);
    
    if (loginProcessedRef.current) {
      logger.log('⚠️ [App] handleLogin blocked by loginProcessedRef');
      return;
    }
    loginProcessedRef.current = true;
    const newUrl = window.location.pathname + window.location.hash.split('?')[0];
    window.history.replaceState({}, document.title, newUrl);
    setInviteParams(null);
    
    logger.log('🔵 [App] User details before setCurrentUser:', {
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
    logger.log('✅ [App] handleLogin completed, currentUser should be set');
    
    // Note: Notification capability check is handled by the useEffect that watches currentUser
    // No need to duplicate the check here - the useEffect will run when currentUser is set
    setTimeout(() => {
      loginProcessedRef.current = false;
      logger.log('✅ [App] loginProcessedRef reset');
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
      localStorage.removeItem('helpy_cached_helper_contracts');
      localStorage.removeItem('helpy_cached_salary_slips');
      localStorage.removeItem('helpy_cached_places');
      localStorage.removeItem('helpy_cached_practices');
      localStorage.removeItem('helpy_cached_usage_status');
    };

    const resetState = () => {
      loginProcessedRef.current = false;
      setCurrentUser(null);
      clearAllCaches();
      setActiveView('dashboard');
      setUsers([]);
      // Reset usage status
      setUsageStatus({
        aiScanCount: 0,
        aiScanRemaining: 5,
        canUseAiScan: true,
        salarySignCount: 0,
        salarySignRemaining: 1,
        canUseSalarySign: true,
        trialStartedAt: null,
        spendingSummaryDaysRemaining: 14,
        canUseSpendingSummary: true,
        hasPaidSubscription: false,
      });
      trialWarningShownRef.current = null;
      setTodoItems([]);
      setMeals([]);
      setExpenses([]);
      setFamilyNotes('');
      setFamilyNotesLang(null);
      setFamilyNotesTranslations({});
      setHelperContracts([]);
      setSalarySlips([]);
      setPlaces([]);
      setPractices([]);
    };

    try {
      await signOut();
      resetState();
    } catch (error) {
      logger.error('Logout error:', error);
      resetState();
    }
  }, [signOut]);

  // Navigation data (e.g., initialSection for ToDo, openAddSheet to auto-open add sheet, openCreateSalarySlip for Family helper section)
  const [navData, setNavData] = useState<{ section?: string; openAddSheet?: boolean; openCreateSalarySlip?: boolean } | null>(null);

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

  // Listen for service worker messages (NAVIGATE for notification clicks, DATA_CHANGED for push updates)
  // NAVIGATE: Allows in-app navigation without full page reload, preventing Clerk auth flash
  // DATA_CHANGED: Safety net when realtime websocket misses updates - triggers data refetch
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      // Handle DATA_CHANGED: Push notification received, trigger data refetch
      if (event.data?.type === 'DATA_CHANGED') {
        logger.log('[App] 📢 Received DATA_CHANGED from service worker:', event.data.dataType);
        // Increment trigger to cause subscription re-run
        setPushDataRefreshTrigger(prev => prev + 1);
        return;
      }
      
      // Handle NAVIGATE: Notification clicked, navigate in-app
      if (event.data?.type === 'NAVIGATE' && event.data?.url) {
        const url = event.data.url as string;
        logger.log('[App] Received NAVIGATE message from service worker:', url);
        // Parse the hash URL and navigate in-app
        if (url.includes('#todo') || url.includes('todo')) {
          // Extract section if present (e.g., ?section=shopping or ?section=task)
          const sectionMatch = url.match(/section=(\w+)/);
          const section = sectionMatch ? sectionMatch[1] : undefined;
          setActiveView('todo');
          setNavData(section ? { section } : null);
          logger.log('[App] Navigating to ToDo', section ? `(section: ${section})` : '');
        } else if (url.includes('#meals') || url.includes('meals')) {
          setActiveView('meals');
          setNavData(null);
          logger.log('[App] Navigating to Meals');
        } else if (url.includes('#expenses') || url.includes('expenses')) {
          setActiveView('expenses');
          setNavData(null);
          logger.log('[App] Navigating to Expenses');
        } else if (url.includes('#profile') || url.includes('profile')) {
          setActiveView('profile');
          setNavData(null);
          logger.log('[App] Navigating to Profile');
        } else {
          // Default to dashboard
          setActiveView('dashboard');
          setNavData(null);
          logger.log('[App] Navigating to Home (default)');
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
  const [places, setPlaces] = useState<Place[]>(() => {
    const cached = localStorage.getItem('helpy_cached_places');
    return cached ? JSON.parse(cached) : [];
  });
  const [practices, setPractices] = useState<Practice[]>(() => {
    const cached = localStorage.getItem('helpy_cached_practices');
    return cached ? JSON.parse(cached) : [];
  });
  const [helperContracts, setHelperContracts] = useState<HelperContract[]>(() => {
    const cached = localStorage.getItem('helpy_cached_helper_contracts');
    return cached ? JSON.parse(cached) : [];
  });
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>(() => {
    const cached = localStorage.getItem('helpy_cached_salary_slips');
    return cached ? JSON.parse(cached) : [];
  });
  
  // Household limits for family member quota (used by Home)
  const [householdLimits, setHouseholdLimits] = useState<{ maxFamily: number; maxHelpers: number }>({ maxFamily: 3, maxHelpers: 1 });
  
  // Usage status for usage-based and time-based trial limits
  const [usageStatus, setUsageStatus] = useState<UsageStatus>(() => {
    const cached = localStorage.getItem('helpy_cached_usage_status');
    return cached ? JSON.parse(cached) : {
      aiScanCount: 0,
      aiScanRemaining: 5,
      canUseAiScan: true,
      salarySignCount: 0,
      salarySignRemaining: 1,
      canUseSalarySign: true,
      trialStartedAt: null,
      spendingSummaryDaysRemaining: 14,
      canUseSpendingSummary: true,
      hasPaidSubscription: false,
    };
  });
  
  // Legacy trialStatus for backwards compatibility with TrialWarningModal
  const trialStatus: TrialStatus = {
    isInTrial: usageStatus.canUseSpendingSummary && !usageStatus.hasPaidSubscription,
    daysRemaining: usageStatus.spendingSummaryDaysRemaining,
    trialStartedAt: usageStatus.trialStartedAt,
    trialEndsAt: null,
    shouldShowWarning: usageStatus.spendingSummaryDaysRemaining === 2,
    shouldShowExpired: usageStatus.spendingSummaryDaysRemaining === 1,
    isExpired: usageStatus.spendingSummaryDaysRemaining === 0 && !usageStatus.hasPaidSubscription,
  };
  
  // Usage limit modal state (for AI scan and salary sign limits)
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);
  const [usageLimitFeature, setUsageLimitFeature] = useState<'aiScan' | 'salarySign' | 'spendingSummary'>('aiScan');
  
  // Trial warning modal state (for spending summary time-based warnings)
  const [showTrialWarningModal, setShowTrialWarningModal] = useState(false);
  const [trialWarningVariant, setTrialWarningVariant] = useState<'warning' | 'expired' | 'full_expired'>('warning');
  const trialWarningShownRef = useRef<string | null>(null); // Track which warning was shown this session
  
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
      } else {
        // Clear cache when notes are empty to prevent stale cached notes from flashing on next app open
        localStorage.removeItem('helpy_cached_family_notes');
      }
      if (familyNotesLang) {
        localStorage.setItem('helpy_cached_family_notes_lang', familyNotesLang);
      } else {
        localStorage.removeItem('helpy_cached_family_notes_lang');
      }
      if (Object.keys(familyNotesTranslations).length > 0) {
        localStorage.setItem('helpy_cached_family_notes_translations', JSON.stringify(familyNotesTranslations));
      } else {
        localStorage.removeItem('helpy_cached_family_notes_translations');
      }
    }
  }, [familyNotes, familyNotesLang, familyNotesTranslations, currentUser?.householdId]);

  useEffect(() => {
    if (currentUser?.householdId) {
      if (helperContracts.length > 0) {
        localStorage.setItem('helpy_cached_helper_contracts', JSON.stringify(helperContracts));
      } else {
        // Clear cache when contracts are empty to prevent stale cached data from flashing on next app open
        localStorage.removeItem('helpy_cached_helper_contracts');
      }
    }
  }, [helperContracts, currentUser?.householdId]);

  useEffect(() => {
    if (currentUser?.householdId) {
      if (salarySlips.length > 0) {
        localStorage.setItem('helpy_cached_salary_slips', JSON.stringify(salarySlips));
      } else {
        // Clear cache when slips are empty to prevent stale cached data from flashing on next app open
        localStorage.removeItem('helpy_cached_salary_slips');
      }
    }
  }, [salarySlips, currentUser?.householdId]);

  useEffect(() => {
    if (currentUser?.householdId) {
      if (places.length > 0) {
        localStorage.setItem('helpy_cached_places', JSON.stringify(places));
      } else {
        // Clear cache when places are empty to prevent stale cached data from flashing on next app open
        localStorage.removeItem('helpy_cached_places');
      }
    }
  }, [places, currentUser?.householdId]);

  useEffect(() => {
    if (currentUser?.householdId) {
      if (practices.length > 0) {
        localStorage.setItem('helpy_cached_practices', JSON.stringify(practices));
      } else {
        // Clear cache when practices are empty to prevent stale cached data from flashing on next app open
        localStorage.removeItem('helpy_cached_practices');
      }
    }
  }, [practices, currentUser?.householdId]);

  // Cache usage status for instant load on next app open
  useEffect(() => {
    if (currentUser?.householdId) {
      localStorage.setItem('helpy_cached_usage_status', JSON.stringify(usageStatus));
    }
  }, [usageStatus, currentUser?.householdId]);

  // Sync function for periodic backup fetching
  const syncAllData = useCallback(async () => {
    if (!currentUser?.householdId) return;
    const hid = currentUser.householdId;
    
    logger.log('[App] Running periodic sync...');
    
    // Use authenticated client for RLS-protected queries (fixes 406 errors)
    const authClient = getAuthenticatedSupabaseClient() || supabase;
    
    try {
      // Fetch all collections in parallel (including household limits AND family notes AND usage info)
      const [usersData, todoData, mealsData, expensesData, householdData, contractsData, slipsData] = await Promise.all([
        fetchCollection(hid, 'users'),
        fetchCollection(hid, 'todo_items'),
        fetchCollection(hid, 'meals'),
        fetchCollection(hid, 'expenses'),
        authClient.from('households').select('max_family_members, max_helpers, family_notes, family_notes_lang, family_notes_translations, trial_started_at, ai_scan_count, salary_slip_sign_count, subscription_plan, subscription_status').eq('id', hid).maybeSingle(),
        getHelperContracts(hid),
        getAllSalarySlips(hid),
      ]);
      
      // Update state with fresh data - only if data exists (don't wipe cache with empty results)
      if (usersData.length > 0) {
        const uniqueUsers = Array.from(new Map(usersData.map(u => [u.id, u])).values());
        setUsers(uniqueUsers as User[]);
      }
      if (todoData && todoData.length > 0) setTodoItems(todoData as ToDoItem[]);
      if (mealsData && mealsData.length > 0) setMeals(mealsData as Meal[]);
      if (expensesData && expensesData.length > 0) setExpenses(expensesData as Expense[]);
      
      // Update helper contracts and salary slips - always update (even if empty) to clear stale cache
      if (contractsData) {
        setHelperContracts(contractsData);
        // Clear cache if empty to prevent stale data from flashing on next app open
        if (contractsData.length === 0) {
          localStorage.removeItem('helpy_cached_helper_contracts');
        }
      }
      if (slipsData) {
        setSalarySlips(slipsData);
        // Clear cache if empty to prevent stale data from flashing on next app open
        if (slipsData.length === 0) {
          localStorage.removeItem('helpy_cached_salary_slips');
        }
      }
      
      // Update household limits AND family notes (Family Board) AND trial status
      if (householdData.data) {
        setHouseholdLimits({
          maxFamily: householdData.data.max_family_members ?? 3,
          maxHelpers: householdData.data.max_helpers ?? 1,
        });
        // Sync family notes - fixes Android PWA delay issue where real-time updates were missed
        const syncedNotes = householdData.data.family_notes || '';
        const syncedNotesLang = householdData.data.family_notes_lang || null;
        const syncedNotesTranslations = householdData.data.family_notes_translations || {};
        
        setFamilyNotes(syncedNotes);
        setFamilyNotesLang(syncedNotesLang);
        setFamilyNotesTranslations(syncedNotesTranslations);
        
        // Clear cache when notes are empty to prevent stale cached notes from flashing on next app open
        if (!syncedNotes) {
          localStorage.removeItem('helpy_cached_family_notes');
          localStorage.removeItem('helpy_cached_family_notes_lang');
          localStorage.removeItem('helpy_cached_family_notes_translations');
        }
        
        // Update usage status - check subscription and calculate limits
        const hasPaidSubscription = 
          householdData.data.subscription_status === 'active' && 
          householdData.data.subscription_plan && 
          householdData.data.subscription_plan !== 'free';
        
        const newUsageStatus = calculateUsageStatus(
          householdData.data.ai_scan_count ?? 0,
          householdData.data.salary_slip_sign_count ?? 0,
          householdData.data.trial_started_at,
          hasPaidSubscription
        );
        setUsageStatus(newUsageStatus);
      }
      
      logger.log('[App] Periodic sync completed');
    } catch (error) {
      logger.error('[App] Periodic sync failed:', error);
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
        logger.log('[App] 📱 App became visible, checking connection status...');
        
        // If disconnected or connecting, immediately sync data
        if (realtimeStatus === 'disconnected' || realtimeStatus === 'connecting') {
          logger.log(`[App] ⚠️ Connection status: ${realtimeStatus} - triggering immediate sync`);
          syncNow();
        } else {
          // Even if connected, do a quick sync to ensure we have latest data
          // This handles cases where subscriptions missed updates while backgrounded
          logger.log('[App] ✅ Connection appears active, doing background refresh to catch any missed updates');
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
    initializePushNotifications()
      .then(() => {
        // Check for updates AFTER service worker is registered and listeners are set up
        // This prevents the race condition where we check before we're listening
        logger.log('[App] SW initialized - checking for updates...');
        checkForUpdates();
      })
      .catch(err => {
        logger.warn('[App] Failed to initialize push notifications:', err);
        // Still check for updates even if push init fails (SW might still be registered)
        checkForUpdates();
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
    
    logger.log('[App] Auto-subscribe useEffect triggered', {
      hasCurrentUser: !!currentUser,
      userId,
      householdId,
      notificationsEnabled
    });
    
    if (!userId || !householdId) {
      logger.log('[App] Auto-subscribe skipped: missing currentUser or householdId');
      return;
    }
    
    // Create a unique key for this check to prevent duplicate runs
    const checkKey = `${userId}-${householdId}-${notificationsEnabled}`;
    
    // Skip if we already checked with the same parameters
    if (lastNotificationCheckKeyRef.current === checkKey) {
      logger.log('[App] Skipping duplicate notification check (same parameters)');
      return;
    }
    
    // Skip if a check is already in progress
    if (notificationCheckInProgressRef.current) {
      logger.log('[App] Notification check already in progress, skipping');
      return;
    }
    
    logger.log('[App] Checking notification capability...');
    
    // EARLY SYNC CHECK: If browser permission doesn't allow notifications but database
    // says hasPushSubscription=true, this is stale data. Fix it immediately to prevent
    // showing blue bell before the async check completes.
    if (typeof Notification !== 'undefined' && currentHasPushSubscription) {
      const browserPermission = Notification.permission;
      if (browserPermission === 'default' || browserPermission === 'denied') {
        logger.log(`[App] 🔧 Early fix: Permission is '${browserPermission}' but hasPushSubscription=true. Correcting stale data.`);
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
          logger.log('[App] Notifications disabled by user preference');
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
          logger.log('[App] 🔄 Ensuring current browser subscription is synced to database...');
          logger.log('[App] 🔍 Debug: userId =', userId, 'householdId =', householdId, 'email =', userEmail ? userEmail.substring(0, 3) + '***' : 'undefined');
          const synced = await ensureCurrentSubscriptionSaved(userId, householdId, 0, userEmail);
          if (synced) {
            logger.log('[App] ✅ Subscription synced successfully');
            setCurrentUser(prev => prev ? { ...prev, hasPushSubscription: true } : prev);
            return; // No need for further checks, we just synced
          } else {
            logger.log('[App] ⚠️ Subscription sync failed on initial attempt');
            // Schedule a delayed retry as a fallback (gives more time for service worker)
            logger.log('[App] 📅 Scheduling delayed retry in 5 seconds...');
            setTimeout(async () => {
              logger.log('[App] ⏰ Delayed retry: Attempting subscription sync again...');
              const delayedSync = await ensureCurrentSubscriptionSaved(userId, householdId, 0, userEmail);
              if (delayedSync) {
                logger.log('[App] ✅ Delayed sync succeeded!');
                setCurrentUser(prev => prev ? { ...prev, hasPushSubscription: true } : prev);
              } else {
                logger.log('[App] ❌ Delayed sync also failed');
              }
            }, 5000);
          }
        } else {
          logger.log('[App] ⏭️ Skipping sync: Notification not defined or permission not granted');
          if (typeof Notification !== 'undefined') {
            logger.log('[App] Current permission:', Notification.permission);
          }
        }
        
        // Check actual capability
        const capability = await checkNotificationCapability(userId, householdId);
        
        logger.log('[App] Notification capability:', capability);
        
        // Update UI state to reflect REALITY
        const isActuallyCapable = capability.capable;
        
        // Only update if the value actually changed
        if (isActuallyCapable !== currentHasPushSubscription) {
          logger.log(`[App] Updating hasPushSubscription: ${currentHasPushSubscription} → ${isActuallyCapable}`);
          setCurrentUser(prev => prev ? { ...prev, hasPushSubscription: isActuallyCapable } : prev);
        }
        
        // If not capable but should be, try to auto-fix
        if (!isActuallyCapable) {
          // Only auto-fix if the reason is something we can fix silently
          if (capability.reason === 'no_browser_subscription' || 
              capability.reason === 'no_database_subscription' ||
              capability.reason === 'subscription_mismatch' ||
              capability.reason === 'no_service_worker') {
            logger.log('[App] Attempting auto-fix...');
            const fixed = await autoFixNotificationIssues(userId, householdId);
            if (fixed) {
              logger.log('[App] ✅ Auto-fix successful');
              setCurrentUser(prev => prev ? { ...prev, hasPushSubscription: true } : prev);
            } else {
              logger.log('[App] ⚠️ Auto-fix failed - user may need to re-toggle');
            }
          } else {
            logger.log('[App] ❌ Cannot auto-fix:', capability.reason);
          }
        } else {
          logger.log('[App] ✅ Notifications working correctly');
        }
      } catch (err) {
        logger.warn('[App] Error checking notification capability:', err);
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
      logger.log('[App] ⏳ Waiting for authenticated Supabase client...');
      return;
    }
    if (pushDataRefreshTrigger > 0) {
      logger.log(`[App] 📢 Push notification received (trigger: ${pushDataRefreshTrigger}) - re-subscribing for fresh data`);
    } else if (tokenRefreshCount > 0) {
      logger.log(`[App] 🔄 Token refreshed (count: ${tokenRefreshCount}) - re-subscribing for fresh data`);
    } else {
      logger.log('[App] ✅ Supabase ready, setting up subscriptions');
    }
    const hid = currentUser.householdId;
    
    const unsubUsers = subscribeToCollection(hid, 'users', (data) => {
      if (!data) return;
      
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
      
      // Protect cached data: don't replace existing users with empty results
      setUsers(prev => {
        if (finalUsers.length === 0 && prev.length > 0) {
          logger.log('[App] 🛡️ Protecting cached users from empty result');
          return prev;
        }
        return finalUsers as User[];
      });
    });
    const unsubTodoItems = subscribeToCollection(hid, 'todo_items', (data) => {
      if (!data) return;
      
      // Filter out items that are pending deletion to prevent "ghost returns"
      const filteredData = (data as ToDoItem[]).filter(item => !pendingTodoDeletions.current.has(item.id));
      
      // Merge with temp items and protect cached data
      setTodoItems(prev => {
        // Protect cached data: don't replace existing todos with empty results
        const realPrevItems = prev.filter(item => !item.id.startsWith('temp-') && !item.id.startsWith('todo-'));
        if (filteredData.length === 0 && realPrevItems.length > 0) {
          logger.log('[App] 🛡️ Protecting cached todos from empty result');
          return prev;
        }
        
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
    const unsubMeals = subscribeToCollection(hid, 'meals', (data) => {
      if (!data) return;
      // Protect cached data: don't replace existing data with empty results
      // This prevents brief network hiccups from wiping the UI
      setMeals(prev => {
        if (data.length === 0 && prev.length > 0) {
          logger.log('[App] 🛡️ Protecting cached meals from empty result');
          return prev;
        }
        return data as Meal[];
      });
    });
    const unsubExpenses = subscribeToCollection(hid, 'expenses', (data) => {
      if (!data) return;
      // Protect cached data: don't replace existing data with empty results
      setExpenses(prev => {
        if (data.length === 0 && prev.length > 0) {
          logger.log('[App] 🛡️ Protecting cached expenses from empty result');
          return prev;
        }
        return data as Expense[];
      });
    });
    const unsubNotes = subscribeToNotes(hid, (notesData) => {
      const notes = notesData.notes || '';
      const notesLang = notesData.notesLang || null;
      const notesTranslations = notesData.notesTranslations || {};
      
      setFamilyNotes(notes);
      setFamilyNotesLang(notesLang);
      setFamilyNotesTranslations(notesTranslations);
      
      // Clear cache when notes are empty to prevent stale cached notes from flashing on next app open
      if (!notes) {
        localStorage.removeItem('helpy_cached_family_notes');
        localStorage.removeItem('helpy_cached_family_notes_lang');
        localStorage.removeItem('helpy_cached_family_notes_translations');
      }
    });
    const unsubPlaces = subscribeToPlaces(hid, (data) => {
      // Protect cached data: don't replace existing places with empty results
      // This prevents brief JWT hiccups from wiping the UI
      setPlaces(prev => {
        if (data.length === 0 && prev.length > 0) {
          logger.log('[App] 🛡️ Protecting cached places from empty result');
          return prev;
        }
        return data;
      });
    });
    const unsubPractices = subscribeToPractices(hid, (data) => {
      // Protect cached data: don't replace existing practices with empty results
      setPractices(prev => {
        if (data.length === 0 && prev.length > 0) {
          logger.log('[App] 🛡️ Protecting cached practices from empty result');
          return prev;
        }
        return data;
      });
    });
    
    // Subscribe to helper data via realtime (fixes sync issues between household members)
    // Previously these were only fetched on mount/periodic sync, causing stale data
    const unsubHelperContracts = subscribeToHelperContracts(hid, (data) => {
      // Protect cached data: don't replace existing contracts with empty results
      setHelperContracts(prev => {
        if (data.length === 0 && prev.length > 0) {
          logger.log('[App] 🛡️ Protecting cached helper contracts from empty result');
          return prev;
        }
        return data;
      });
    });
    
    const unsubSalarySlips = subscribeToSalarySlips(hid, (data) => {
      // Protect cached data: don't replace existing slips with empty results
      setSalarySlips(prev => {
        if (data.length === 0 && prev.length > 0) {
          logger.log('[App] 🛡️ Protecting cached salary slips from empty result');
          return prev;
        }
        return data;
      });
    });
    
    return () => {
      unsubUsers();
      unsubTodoItems();
      unsubMeals();
      unsubExpenses();
      unsubNotes();
      unsubPlaces();
      unsubPractices();
      unsubHelperContracts();
      unsubSalarySlips();
    };
    // tokenRefreshCount: When token is proactively refreshed (e.g., on app visibility change),
    // re-run subscriptions to ensure data is fetched with the fresh token.
    // This fixes the "helper can't see data" issue where stale tokens cause empty reads.
    // pushDataRefreshTrigger: When a push notification is received, re-run subscriptions.
    // This is a safety net in case realtime websocket missed the update.
  }, [currentUser?.householdId, isSupabaseReady, tokenRefreshCount, pushDataRefreshTrigger]);

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

  // "At the door" session verification - runs BEFORE showing any app content
  // Makes an actual database query to verify the JWT/session works
  // This catches stale sessions (like Ryan's bug) at app startup, not during operations
  const sessionVerificationRef = useRef(false);
  const masterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // MASTER TIMEOUT - starts IMMEDIATELY, independent of Supabase readiness
  // This is the safety net that prevents users from being stuck on loading forever
  // Even if Clerk/Supabase is slow, users get through after 5 seconds
  useEffect(() => {
    // Only run for logged-in, non-demo users who haven't been verified yet
    if (!currentUser || sessionVerified || isDemoMode) {
      // Clear any existing timeout
      if (masterTimeoutRef.current) {
        clearTimeout(masterTimeoutRef.current);
        masterTimeoutRef.current = null;
      }
      return;
    }
    
    // Start master timeout IMMEDIATELY
    if (!masterTimeoutRef.current) {
      logger.log('[Session Verification] ⏱️ Starting 5s master timeout...');
      masterTimeoutRef.current = setTimeout(() => {
        if (!sessionVerified) {
          logger.warn('[Session Verification] ⏰ MASTER TIMEOUT - letting user through after 5s wait');
          setSessionVerified(true);
        }
        masterTimeoutRef.current = null;
      }, 5000);
    }
    
    return () => {
      if (masterTimeoutRef.current) {
        clearTimeout(masterTimeoutRef.current);
        masterTimeoutRef.current = null;
      }
    };
  }, [currentUser, sessionVerified, isDemoMode]);
  
  // Session verification logic - runs when Supabase is ready
  useEffect(() => {
    // Reset verification state when user logs out
    if (!currentUser) {
      setSessionVerified(false);
      sessionVerificationRef.current = false;
      return;
    }
    
    // Skip if already verified this session
    if (sessionVerified || sessionVerificationRef.current) return;
    
    // Demo mode: skip verification
    if (isDemoMode) {
      logger.log('[Session Verification] Demo mode - skipping verification');
      setSessionVerified(true);
      sessionVerificationRef.current = true;
      return;
    }
    
    // Wait for authenticated Supabase client (master timeout will save us if this takes too long)
    if (!isSupabaseReady) {
      logger.log('[Session Verification] ⏳ Waiting for authenticated client...');
      return;
    }
    
    // Mark as in-progress to prevent duplicate runs
    sessionVerificationRef.current = true;
    
    const verifySession = async (): Promise<'verified' | 'stale'> => {
      logger.log('[Session Verification] 🔍 Verifying session at the door...');
      logger.log('[Session Verification] currentUser.id:', currentUser.id);
      logger.log('[Session Verification] householdId:', currentUser.householdId);
      
      const client = getAuthenticatedSupabaseClient();
      if (!client) {
        throw new Error('No authenticated Supabase client available');
      }
      
      // FIXED: Instead of querying by localStorage user ID (which might not match JWT),
      // verify we can access the HOUSEHOLD. This is what matters for the session.
      // RLS will check if our JWT has access to this household.
      const { data: householdData, error: householdError } = await client
        .from('households')
        .select('id, name')
        .eq('id', currentUser.householdId)
        .maybeSingle();
      
      if (householdError) {
        logger.error('[Session Verification] ❌ Household query error:', householdError.message, householdError.code);
        // 406 means RLS blocked - the JWT doesn't have access to this household
        if (householdError.code === 'PGRST116' || householdError.message?.includes('406')) {
          logger.error('[Session Verification] ❌ RLS blocked access - session is stale');
          return 'stale';
        }
        return 'stale';
      }
      
      if (!householdData) {
        logger.error('[Session Verification] ❌ Household not found or no access');
        return 'stale';
      }
      
      logger.log('[Session Verification] ✅ Household access verified:', householdData.name);
      
      // Optional: Also verify we can see at least one user in the household
      // This catches edge cases where household is visible but user data isn't
      const { data: usersInHousehold, error: usersError } = await client
        .from('users')
        .select('id, clerk_id')
        .eq('household_id', currentUser.householdId)
        .limit(1);
      
      if (usersError) {
        logger.warn('[Session Verification] ⚠️ Users query failed:', usersError.message);
        // Household worked, so session is probably OK
        return 'verified';
      }
      
      if (!usersInHousehold || usersInHousehold.length === 0) {
        logger.warn('[Session Verification] ⚠️ No users visible in household (might be OK if RLS is strict)');
        // Household access worked, so session is valid
        return 'verified';
      }
      
      logger.log('[Session Verification] ✅ Session verified successfully');
      return 'verified';
    };
    
    // Run verification (master timeout is already running as safety net)
    verifySession()
      .then((result) => {
        // Clear master timeout since we got a result
        if (masterTimeoutRef.current) {
          clearTimeout(masterTimeoutRef.current);
          masterTimeoutRef.current = null;
        }
        
        if (result === 'verified') {
          setSessionVerified(true);
        } else {
          // Stale session detected
          logger.warn('[Session Verification] ⚠️ Session invalid');
          
          // On localhost, skip session invalidation (JWT template may be missing)
          const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (isLocalDev) {
            logger.log('[Session Verification] ⚠️ Skipping invalidation on localhost - marking as verified');
            setSessionVerified(true);
            return;
          }
          
          logger.log('[Session Verification] 🔄 Triggering silent refresh via Auth');
          localStorage.removeItem('helpy_current_session_user');
          setCurrentUser(null);
          setSessionVerified(false);
          sessionVerificationRef.current = false;
        }
      })
      .catch((err) => {
        logger.error('[Session Verification] ❌ Unexpected error:', err);
        // On error, let master timeout handle it (or it already did)
      });
  }, [currentUser, isSupabaseReady, sessionVerified, isDemoMode]);

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
      logger.log('📷 Demo mode: skipping todo add to database');
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
      
      try {
        const savedSeries = await addItem(hid, 'recurring_series', seriesData);
        logger.log('🔄 Created recurring series:', savedSeries?.id);
        
        // The database trigger automatically creates current + next instances
        // Fetch the created instances to update UI
        if (savedSeries?.id) {
          const authClient = getAuthenticatedSupabaseClient() || supabase;
          const createdInstances = await authClient
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
      } catch (error) {
        logger.error('❌ Failed to create recurring task:', error);
        // Remove the optimistic temp item since save failed
        setTodoItems(prev => prev.filter(i => i.id !== tempId));
        showAlert(
          t['error.title'] || 'Error',
          t['error.taskSaveFailed'] || 'Failed to save recurring task. Please try again.',
          'error'
        );
        return item; // Return original item (without temp ID)
      }
    }
    
    // Non-recurring: create the todo item directly
    const itemData = {
      ...item,
      createdBy: currentUser?.id,
    };
    
    try {
      const savedItem = await addItem(hid, 'todo_items', itemData);
      
      // Immediately replace temp ID with real ID from database
      // This ensures any subsequent edits use the real ID and get saved properly
      if (savedItem?.id && savedItem.id !== tempId) {
        setTodoItems(prev => prev.map(i => 
          i.id === tempId ? { ...i, id: savedItem.id } : i
        ));
      }
      
      return savedItem || newItem;
    } catch (error) {
      logger.error('❌ Failed to create task:', error);
      // Remove the optimistic temp item since save failed
      setTodoItems(prev => prev.filter(i => i.id !== tempId));
      showAlert(
        t['error.title'] || 'Error',
        t['error.taskSaveFailed'] || 'Failed to save task. Please try again.',
        'error'
      );
      return item; // Return original item
    }
  };

  const handleUpdateTodoItem = async (id: string, data: Partial<ToDoItem>) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping todo update to database');
      return;
    }
    
    // Auto-set completedAt when marking item complete/incomplete
    const enhancedData = { ...data };
    if (data.completed === true) {
      enhancedData.completedAt = new Date().toISOString();
    } else if (data.completed === false) {
      enhancedData.completedAt = null; // Clear when uncompleting (null explicitly clears in DB)
    }
    
    // Set lastModifiedBy to current user for correct notification attribution
    // This ensures "bought by" / "done by" shows who performed the action
    enhancedData.lastModifiedBy = currentUser?.id;
    
    // Optimistically update UI
    setTodoItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...enhancedData } : item
    ));
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping update for temp item - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'todo_items', id, enhancedData);
    
    // NOTE: Recurring task next instance creation is handled by database trigger
    // (create_next_recurring_instance in migration 074_recurring_task_series.sql)
    // This ensures a single source of truth and prevents duplicate instances
  };

  // Update recurring series template AND all future non-completed instances
  const handleUpdateTodoSeries = async (seriesId: string, data: Partial<ToDoItem>) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping series update to database');
      return;
    }
    
    logger.log('🔄 Updating recurring series:', seriesId, data);
    
    // Optimistically update UI - update all items with this seriesId that are not completed
    setTodoItems(prev => prev.map(item => {
      if (item.seriesId === seriesId && !item.completed && !item.isException) {
        return { ...item, ...data };
      }
      return item;
    }));
    
    try {
      // Update the series template
      const seriesUpdates: Record<string, any> = {};
      if (data.name !== undefined) seriesUpdates.name = data.name;
      if (data.category !== undefined) seriesUpdates.category = data.category;
      if (data.assigneeId !== undefined) seriesUpdates.assigneeId = data.assigneeId;
      if (data.dueTime !== undefined) seriesUpdates.dueTime = data.dueTime;
      if (data.recurrence?.frequency !== undefined) seriesUpdates.frequency = data.recurrence.frequency;
      if (data.recurrence?.dayOfWeek !== undefined) seriesUpdates.dayOfWeek = data.recurrence.dayOfWeek;
      if (data.recurrence?.dayOfMonth !== undefined) seriesUpdates.dayOfMonth = data.recurrence.dayOfMonth;
      
      // Update series template
      await updateItem(hid, 'recurring_series', seriesId, seriesUpdates);
      
      // Update all future non-completed, non-exception instances
      // Build the recurrence JSONB for instances
      const recurrenceJson = data.recurrence ? {
        frequency: data.recurrence.frequency,
        dayOfWeek: data.recurrence.dayOfWeek,
        dayOfMonth: data.recurrence.dayOfMonth,
      } : undefined;
      
      // Fetch all future instances and update them
      const authClient = getAuthenticatedSupabaseClient() || supabase;
      const today = getLocalDateString();
      
      const { data: futureInstances } = await authClient
        .from('todo_items')
        .select('id')
        .eq('series_id', seriesId)
        .eq('completed', false)
        .or('is_exception.is.null,is_exception.eq.false')
        .gte('due_date', today)
        .is('deleted_at', null);
      
      if (futureInstances && futureInstances.length > 0) {
        logger.log(`🔄 Updating ${futureInstances.length} future instances`);
        
        // Build update data for instances
        const instanceUpdates: Record<string, any> = {};
        if (data.name !== undefined) instanceUpdates.name = data.name;
        if (data.category !== undefined) instanceUpdates.category = data.category;
        if (data.assigneeId !== undefined) instanceUpdates.assignee_id = data.assigneeId;
        if (data.dueTime !== undefined) instanceUpdates.due_time = data.dueTime;
        if (recurrenceJson) instanceUpdates.recurrence = recurrenceJson;
        
        // Update each instance
        for (const instance of futureInstances) {
          await updateItem(hid, 'todo_items', instance.id, instanceUpdates);
        }
      }
      
      logger.log('✅ Successfully updated series and future instances');
    } catch (error) {
      logger.error('❌ Failed to update recurring series:', error);
      // The optimistic update will be corrected by real-time sync
    }
  };

  const handleDeleteTodoItem = async (id: string) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping todo delete from database');
      return;
    }
    
    // Get the item before deleting to check if it has a series
    const itemToDelete = todoItems.find(i => i.id === id);
    const seriesId = itemToDelete?.seriesId;
    
    // Track this item for ghost prevention immediately
    pendingTodoDeletions.current.add(id);
    
    // Optimistically remove from UI (also remove other items from same series)
    if (seriesId) {
      setTodoItems(prev => prev.filter(item => item.id !== id && item.seriesId !== seriesId));
    } else {
      setTodoItems(prev => prev.filter(item => item.id !== id));
    }
    
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping delete for temp item - not yet saved:', id);
      setTimeout(() => {
        pendingTodoDeletions.current.delete(id);
      }, 500);
      return;
    }
    
    // Track all series item IDs for ghost prevention and cleanup
    let allSeriesItemIds: string[] = [id];
    
    try {
      // For recurring tasks: FIRST soft-delete the series to prevent the trigger
      // from creating new instances while we're deleting
      if (seriesId) {
        logger.log('🗑️ Soft-deleting recurring series FIRST:', seriesId);
        await updateItem(hid, 'recurring_series', seriesId, { 
          deletedAt: new Date().toISOString() 
        });
        
        // NOW query database for all items - safe because series is already soft-deleted
        // No new instances can be created by the trigger at this point
        try {
          const authClient = getAuthenticatedSupabaseClient() || supabase;
          const { data: dbSeriesItems } = await authClient
            .from('todo_items')
            .select('id')
            .eq('series_id', seriesId)
            .is('deleted_at', null);
          
          if (dbSeriesItems && dbSeriesItems.length > 0) {
            allSeriesItemIds = dbSeriesItems.map(item => item.id);
            // Add all to pending deletions for ghost prevention
            allSeriesItemIds.forEach(itemId => pendingTodoDeletions.current.add(itemId));
          }
        } catch (err) {
          logger.warn('Failed to fetch series items from DB, falling back to local state');
          allSeriesItemIds = todoItems.filter(t => t.seriesId === seriesId).map(t => t.id);
          allSeriesItemIds.forEach(itemId => pendingTodoDeletions.current.add(itemId));
        }
        
        // Delete ALL items in the series (including the one user clicked)
        // Pass currentUser.id for notification attribution
        for (const itemId of allSeriesItemIds) {
          await deleteItem(hid, 'todo_items', itemId, currentUser?.id);
        }
      } else {
        // Non-recurring: just delete the single item
        // Pass currentUser.id for notification attribution
        await deleteItem(hid, 'todo_items', id, currentUser?.id);
      }
      
      // Clear from pending deletions after success + buffer for real-time sync
      setTimeout(() => {
        allSeriesItemIds.forEach(itemId => pendingTodoDeletions.current.delete(itemId));
      }, 2000);
    } catch (error) {
      logger.error('Failed to delete todo item:', error);
      // On error, clear from pending - real-time sync will restore items
      allSeriesItemIds.forEach(itemId => pendingTodoDeletions.current.delete(itemId));
    }
  };

  // Meal CRUD Handlers (with optimistic updates for instant UI)
  const handleAddMeal = async (meal: Meal) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping meal add to database');
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
      logger.log('📷 Demo mode: skipping meal update to database');
      return;
    }
    
    // Set lastModifiedBy to current user for correct notification attribution
    const enhancedData = { ...data, lastModifiedBy: currentUser?.id };
    
    setMeals(prev => prev.map(m => m.id === id ? { ...m, ...enhancedData } : m));  // Optimistic
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping update for temp meal - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'meals', id, enhancedData);
  };

  const handleDeleteMeal = async (id: string) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping meal delete from database');
      return;
    }
    
    setMeals(prev => prev.filter(m => m.id !== id));  // Optimistic
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping delete for temp meal - not yet saved:', id);
      return;
    }
    // Pass currentUser.id for notification attribution
    await deleteItem(hid, 'meals', id, currentUser?.id);
  };

  // Expense CRUD Handlers (with optimistic updates for instant UI)
  const handleAddExpense = async (expense: Expense): Promise<Expense> => {
    if (!hid) return expense;
    
    // Demo mode: skip database, just return the expense for UI display
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping expense add to database');
      return expense;
    }
    
    const tempId = `temp-${Date.now()}`;
    const newExpense = { ...expense, id: tempId };
    setExpenses(prev => [...prev, newExpense]);  // Optimistic
    
    // Create expense without ID so Supabase generates UUID
    const expenseWithoutId = { ...expense };
    delete expenseWithoutId.id; // Remove ID so Supabase generates UUID
    // Keep createdBy for notifications - expenses table has created_by column (migration 018)
    logger.log('[App] Adding expense without ID, will get UUID from DB');
    const savedExpense = await addItem(hid, 'expenses', expenseWithoutId);
    logger.log('[App] Expense saved with UUID:', savedExpense.id);
    
    // Return the expense with the actual UUID from database
    return savedExpense as Expense;
  };

  const handleUpdateExpense = async (expense: Expense) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping expense update to database');
      return;
    }
    
    // Exclude createdBy from update - it's a Clerk ID in the app but needs to be UUID in DB
    // The created_by field shouldn't change after creation anyway
    // But include lastModifiedBy for notification attribution
    const { id, createdBy, lastModifiedBy, ...data } = expense;
    const enhancedData = { ...data, lastModifiedBy: currentUser?.id };
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...enhancedData } : e));  // Optimistic
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping update for temp expense - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'expenses', id, enhancedData);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping expense delete from database');
      return;
    }
    
    setExpenses(prev => prev.filter(e => e.id !== id));  // Optimistic
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping delete for temp expense - not yet saved:', id);
      return;
    }
    // Pass currentUser.id for notification attribution
    await deleteItem(hid, 'expenses', id, currentUser?.id);
  };

  // User CRUD Handlers (with optimistic updates for instant UI)
  const handleAddUser = async (user: Omit<User, 'id'>): Promise<User | undefined> => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping user add to database');
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
      logger.log('📷 Demo mode: skipping user update to database');
      return;
    }
    
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));  // Optimistic
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping update for temp user - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'users', id, data);
  };

  const handleDeleteUser = async (id: string) => {
    if (!hid || !currentUser) return;

    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping user delete from database');
      return;
    }

    // Skip for temp IDs - user not in database yet
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping delete for temp user - not yet saved:', id);
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

      logger.log(`✅ Successfully ${result.operation} user: ${result.removedUser?.name}`);

    } catch (error: any) {
      logger.error('Failed to delete user:', error);
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
      logger.log('📷 Demo mode: skipping family notes save to database');
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
      logger.error('Failed to save notes:', error);
      // Rollback on error
      setFamilyNotes(previousNotes);
      setFamilyNotesLang(previousLang);
      throw error; // Re-throw so Home knows save failed
    }
  };

  // Update notes translations handler
  const handleUpdateNotesTranslations = async (translations: Record<string, string>): Promise<void> => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping notes translations save to database');
      return;
    }
    
    setFamilyNotesTranslations(translations);
    try {
      const authClient = getAuthenticatedSupabaseClient() || supabase;
      const { error } = await authClient
        .from('households')
        .update({ family_notes_translations: translations })
        .eq('id', hid);
      if (error) throw error;
    } catch (error) {
      logger.error('Failed to update notes translations:', error);
      throw error;
    }
  };

  // Places CRUD Handlers (with optimistic updates for instant UI)
  const handleAddPlace = async (info: CreatePlace) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping place add to database');
      return;
    }
    
    const tempId = `temp-${Date.now()}`;
    const tempItem: Place = {
      ...info,
      id: tempId,
      householdId: hid,
      createdAt: new Date().toISOString(),
    };
    setPlaces(prev => [tempItem, ...prev]);  // Optimistic
    try {
      await createPlace(hid, info);
    } catch (error) {
      logger.error('Failed to add place:', error);
      setPlaces(prev => prev.filter(item => item.id !== tempId));  // Rollback
    }
  };

  const handleUpdatePlace = async (id: string, data: Partial<CreatePlace>) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping place update to database');
      return;
    }
    
    const previousItems = places;
    setPlaces(prev => prev.map(item => 
      item.id === id ? { ...item, ...data } : item
    ));  // Optimistic
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping update for temp place - waiting for real ID:', id);
      return;
    }
    try {
      await updatePlace(hid, id, data);
    } catch (error) {
      logger.error('Failed to update place:', error);
      setPlaces(previousItems);  // Rollback
    }
  };

  const handleDeletePlace = async (id: string) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping place delete from database');
      return;
    }
    
    const previousItems = places;
    setPlaces(prev => prev.filter(item => item.id !== id));  // Optimistic
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping delete for temp place - not yet saved:', id);
      return;
    }
    try {
      await deletePlace(hid, id);
    } catch (error) {
      logger.error('Failed to delete place:', error);
      setPlaces(previousItems);  // Rollback
    }
  };

  // Practice CRUD Handlers (with optimistic updates for instant UI)
  const handleAddPractice = async (item: CreatePractice) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping practice add to database');
      return;
    }
    
    const tempId = `temp-${Date.now()}`;
    const tempItem: Practice = {
      ...item,
      id: tempId,
      householdId: hid,
      createdAt: new Date().toISOString(),
    };
    setPractices(prev => [tempItem, ...prev]);  // Optimistic
    try {
      const saved = await createPractice(hid, item);
      // Replace the temp item with the saved record
      setPractices(prev => prev.map(i => i.id === tempId ? saved : i));
    } catch (error) {
      logger.error('Failed to add practice:', error);
      setPractices(prev => prev.filter(i => i.id !== tempId));  // Rollback
    }
  };

  const handleUpdatePractice = async (id: string, data: Partial<CreatePractice>) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping practice update to database');
      return;
    }
    
    const previousItems = practices;
    setPractices(prev => prev.map(i => 
      i.id === id ? { ...i, ...data } : i
    ));  // Optimistic
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping update for temp practice - waiting for real ID:', id);
      return;
    }
    try {
      // Fire and forget - rely on optimistic update + real-time sync merge
      // DO NOT update state with DB result here! It can overwrite optimistic
      // translations if DB hasn't committed yet. This matches handleUpdatePlace.
      await updatePractice(hid, id, data);
    } catch (error) {
      logger.error('Failed to update practice:', error);
      setPractices(previousItems);  // Rollback
    }
  };

  const handleDeletePractice = async (id: string) => {
    if (!hid) return;
    
    // Demo mode: skip database operation
    if (isDemoMode) {
      logger.log('📷 Demo mode: skipping practice delete from database');
      return;
    }
    
    const previousItems = practices;
    setPractices(prev => prev.filter(i => i.id !== id));  // Optimistic
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      logger.warn('⚠️ Skipping delete for temp practice - not yet saved:', id);
      return;
    }
    try {
      await deletePractice(hid, id);
    } catch (error) {
      logger.error('Failed to delete practice:', error);
      setPractices(previousItems);  // Rollback
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Home
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
            onOpenFeedback={() => {
              localStorage.setItem('helpy_profile_target_section', 'feedback');
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
            onUpdateSeries={handleUpdateTodoSeries}
            t={translations}
            currentLang={lang}
            initialSection={navData?.section as 'shopping' | 'task' | undefined}
            autoOpenSheet={navData?.openAddSheet}
          />
        );

      case 'meals':
        // Meals is rendered separately outside Layout to preserve scroll position
        return null;


      case 'expenses':
        return (
          <Expenses
            expenses={isDemoMode ? demoExpenses : expenses}
            householdId={hid}
            currentUser={isDemoMode ? demoUsers[0] : currentUser}
            onNavigateToPlan={() => {
              localStorage.setItem('helpy_profile_target_section', 'plan');
              handleNavigate('profile');
            }}
            onAdd={handleAddExpense}
            onUpdate={handleUpdateExpense}
            onDelete={handleDeleteExpense}
            t={translations}
            currentLang={lang}
            autoOpenSheet={navData?.openAddSheet}
            usageStatus={usageStatus}
            onShowUsageLimitModal={(feature) => {
              setUsageLimitFeature(feature);
              setShowUsageLimitModal(true);
            }}
            onIncrementAiScan={async () => {
              const newCount = await incrementAiScanCount(hid);
              if (newCount >= 0) {
                // Update local state with new count
                setUsageStatus(prev => calculateUsageStatus(
                  newCount,
                  prev.salarySignCount,
                  prev.trialStartedAt,
                  prev.hasPaidSubscription
                ));
              }
            }}
          />
        );

      case 'info':
        return (
          <Family
            householdId={hid}
            currentUser={isDemoMode ? demoUsers[0] : currentUser!}
            users={isDemoMode ? demoUsers : users}
            places={isDemoMode ? demoPlaces : places}
            practices={isDemoMode ? demoPractices : practices}
            onAddPlace={handleAddPlace}
            onUpdatePlace={handleUpdatePlace}
            onDeletePlace={handleDeletePlace}
            onAddPractice={handleAddPractice}
            onUpdatePractice={handleUpdatePractice}
            onDeletePractice={handleDeletePractice}
            helperContracts={helperContracts}
            salarySlips={salarySlips}
            onHelperContractsChange={setHelperContracts}
            onSalarySlipsChange={setSalarySlips}
            t={translations}
            currentLang={lang}
            initialSection={navData?.section as 'places' | 'practice' | 'helper' | undefined}
            autoOpenCreateSalarySlip={navData?.openCreateSalarySlip}
            onNavigateToProfile={() => {
              localStorage.setItem('helpy_profile_target_section', 'plan');
              handleNavigate('profile');
            }}
            onEditHelper={handleEditHelper}
            usageStatus={usageStatus}
            onShowUsageLimitModal={(feature) => {
              setUsageLimitFeature(feature);
              setShowUsageLimitModal(true);
            }}
            onUsageStatusChange={setUsageStatus}
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

      case 'analytics':
        return (
          <Analytics
            onBack={() => setActiveView('dashboard')}
            t={translations}
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
    logger.log('🟣 [App] Clerk not loaded yet, showing loading state');
    logger.log('🟣 [App] Clerk state details:', { 
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
    logger.log('🟠 [App] Rendering Auth component - no currentUser');
    logger.log('🟠 [App] Clerk state:', { clerkLoaded, isSignedIn, clerkUser: !!clerkUser });
    return (
      <div 
        className={`transition-opacity duration-300 ${appReady ? 'opacity-100' : 'opacity-0'}`}
      >
        <Auth onLogin={handleLogin} t={translations} />
      </div>
    );
  }

  // "At the door" check: Don't show app content until session is verified
  // This ensures we catch stale sessions BEFORE the user tries to do anything
  // User sees the loading bar briefly (~200-500ms for valid sessions)
  // Skip on localhost to allow development without JWT template
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!sessionVerified && !isDemoMode && !isLocalhost) {
    logger.log('🔐 [App] Session not yet verified, showing loading...');
    return <AppLoading />;
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
      
      {/* Meals rendered separately to preserve scroll position (always mounted, hidden when not active) */}
      {currentUser && (
        <div style={{ display: activeView === 'meals' ? 'block' : 'none' }}>
          <Meals
            meals={isDemoMode ? demoMeals : meals}
            users={isDemoMode ? demoUsers : users}
            currentUser={isDemoMode ? demoUsers[0] : currentUser!}
            onAdd={handleAddMeal}
            onUpdate={handleUpdateMeal}
            onDelete={handleDeleteMeal}
            t={translations}
            currentLang={lang}
            isActive={activeView === 'meals'}
          />
        </div>
      )}

      {/* NotificationPrompt - shows for first-time PWA users after onboarding */}
      {/* Hidden during onboarding */}
      {currentUser && !(onboardingStep > 0 && pwaModalHandled) && (
        <NotificationPrompt
          currentUser={currentUser}
          t={translations}
          isOnboardingActive={onboardingStep > 0 && pwaModalHandled}
          onVisibilityChange={setNotifPromptVisible}
          onNotificationEnabled={async () => {
            logger.log('[App] Notifications enabled via prompt');
            if (currentUser) {
              await handleUpdateUser(currentUser.id, {
                notificationsEnabled: true,
                hasPushSubscription: true
              });
            }
          }}
        />
      )}

      {/* Salary Slip Reminder Prompt - shows for admin/spouse users without January 2026 salary slip */}
      {/* Hidden during onboarding AND when NotificationPrompt is visible */}
      {currentUser && !(onboardingStep > 0 && pwaModalHandled) && !isNotifPromptVisible && (
        <SalarySlipReminderPrompt
          currentUser={currentUser}
          users={users}
          salarySlips={salarySlips}
          t={translations}
          isOnboardingActive={onboardingStep > 0 && pwaModalHandled}
          onVisibilityChange={setSalaryReminderVisible}
          onShowMeHow={() => {
            // Navigate to Family > Helper section and open Create Salary Slip sheet
            handleNavigate('info', { section: 'helper', openCreateSalarySlip: true });
          }}
        />
      )}

      {/* PWA Update Toast - shows when new version is available */}
      {/* Hidden during onboarding AND when NotificationPrompt or SalarySlipReminder is visible */}
      <UpdateToast
        isVisible={showUpdateToast && !(onboardingStep > 0 && pwaModalHandled) && !isNotifPromptVisible && !isSalaryReminderVisible}
        onUpdate={handleUpdateApp}
        onDismiss={handleDismissUpdate}
        t={translations}
      />

      {/* Trial Warning Modal - shows on day 13 and 14 of spending summary trial */}
      <TrialWarningModal
        isOpen={showTrialWarningModal}
        onClose={() => setShowTrialWarningModal(false)}
        onUpgrade={() => {
          localStorage.setItem('helpy_profile_target_section', 'plan');
          handleNavigate('profile');
        }}
        trialStatus={trialStatus}
        t={translations}
        variant={trialWarningVariant}
      />

      {/* Usage Limit Modal - shows when usage-based limits are reached */}
      <UsageLimitModal
        isOpen={showUsageLimitModal}
        onClose={() => setShowUsageLimitModal(false)}
        onUpgrade={() => {
          localStorage.setItem('helpy_profile_target_section', 'plan');
          handleNavigate('profile');
        }}
        usageStatus={usageStatus}
        feature={usageLimitFeature}
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
              <p className="text-body font-medium text-muted-foreground">
                {alertModal.message}
              </p>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border shrink-0">
              <button
                onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                className={`w-full py-3.5 rounded-xl text-body font-medium ${
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
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </DemoModeProvider>
    </TranslationProvider>
  );
};

export default App;
