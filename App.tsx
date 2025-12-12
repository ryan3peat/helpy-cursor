import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useClerk, useUser, useAuth } from '@clerk/clerk-react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ToDo from './components/ToDo';
import Meals from './components/Meals';
import Expenses from './components/Expenses';
import Profile from './components/Profile';
import HouseholdInfo from './components/HouseholdInfo';
import IntroAnimation from './components/IntroAnimation';
import Auth from './components/Auth';
import OnboardingOverlay from './components/OnboardingOverlay';
import InviteSetup from './components/InviteSetup';
// InviteWelcome removed - using Option 2 flow (direct to SignUp via Auth.tsx)
import { ToDoItem, Meal, Expense, User, TranslationDictionary, HouseholdPlan } from './types';
import { BASE_TRANSLATIONS } from './constants';
import { detectDeviceLanguage } from './services/languageDetectionService';
import { getStaticTranslations } from './services/translationService';
import { TranslationProvider, useTranslationContext } from './contexts/TranslationContext';
import {
  subscribeToCollection,
  addItem,
  updateItem,
  deleteItem,
  saveFamilyNotes,
  subscribeToNotes,
  fetchCollection,
  getCachedSupabaseUuid,
} from './services/supabaseService';
import { useSupabase, useSupabaseReady } from './contexts/SupabaseContext';
import { supabase as defaultSupabase } from './services/supabase';
import { initializePushNotifications, autoSubscribeIfNeeded, debugPushNotifications } from './services/pushNotificationService';
import { debugJwt } from './services/jwtDebugService';

// Make debug function available globally in browser console
if (typeof window !== 'undefined') {
  (window as any).helpyDebugPush = debugPushNotifications;
}
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

// Broom icon component for loading animation (matching flaticon clean_9755169)
const BroomIcon = ({ className }: { className?: string }) => (
  <img 
    src="https://cdn-icons-png.flaticon.com/512/9755/9755169.png" 
    alt="" 
    className={className}
    style={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }}
  />
);

// Loading screen shown while Clerk initializes
// Shows a helpful hint after 8 seconds if loading takes too long
const ClerkLoadingScreen = () => {
  const [showHint, setShowHint] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col justify-end pb-24" style={{ backgroundColor: '#3EAFD2' }}>
      <div className="text-white text-center">
        <div className="broom-loader-wrapper">
          <div className="broom-loader mb-4">
            <BroomIcon className="broom-icon-svg" />
            <div className="broom-track"></div>
            <div className="broom-trail"></div>
          </div>
          <p className="text-sm font-bold whitespace-nowrap">Tidying things up...</p>
        </div>
        <p className="text-xs text-white/60 mt-2">
          {showHint ? (<>Sorry, too much dust here!<br />Close the app and open it again.</>) : "Please wait a moment"}
        </p>
      </div>
    </div>
  );
};

// Helper function to parse notification deep links from URL hash
// Used when user taps on a push notification to go directly to the relevant page
const parseNotificationDeepLink = (): { view: string; navData: { section?: string } | null; isDeepLink: boolean } => {
  const hash = window.location.hash;
  const fullUrl = window.location.href;
  
  console.log('[DeepLink] Parsing deep link:', { hash, fullUrl });
  
  // Check for deep link patterns: #todo, #meals, #expenses, #profile, #info
  if (hash.startsWith('#todo')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const section = params.get('section');
    console.log('[DeepLink] Matched #todo, section:', section);
    return { 
      view: 'todo', 
      navData: section ? { section } : null,
      isDeepLink: true 
    };
  }
  if (hash.startsWith('#meals')) {
    console.log('[DeepLink] Matched #meals');
    return { view: 'meals', navData: null, isDeepLink: true };
  }
  if (hash.startsWith('#expenses')) {
    console.log('[DeepLink] Matched #expenses');
    return { view: 'expenses', navData: null, isDeepLink: true };
  }
  if (hash.startsWith('#profile')) {
    console.log('[DeepLink] Matched #profile');
    return { view: 'profile', navData: null, isDeepLink: true };
  }
  if (hash.startsWith('#info')) {
    console.log('[DeepLink] Matched #info');
    return { view: 'info', navData: null, isDeepLink: true };
  }
  
  console.log('[DeepLink] No deep link detected, defaulting to dashboard');
  return { view: 'dashboard', navData: null, isDeepLink: false };
};

// Inner App component that uses the translation context
const AppContent: React.FC = () => {
  const { signOut } = useClerk();
  const { user: clerkUser, isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { getToken } = useAuth(); // For JWT debugging
  const { setStaticTranslating, isAnyTranslating } = useTranslationContext();
  const supabase = useSupabase(); // Use authenticated client with JWT for RLS
  const isSupabaseReady = useSupabaseReady(); // Check if JWT has been loaded
  
  // Set up JWT debug function with access to getToken
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).helpyDebugJwt = () => debugJwt(getToken);
      console.log('[App] 🔧 JWT debug available: run window.helpyDebugJwt() in console');
    }
  }, [getToken]);
  
  // Also set up RLS test function immediately (doesn't depend on getToken)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).helpyTestRLS = async () => {
        console.log('🧪 Testing RLS with authenticated client...');
        try {
          const { getAuthenticatedSupabaseClient } = await import('./contexts/SupabaseContext');
          const client = getAuthenticatedSupabaseClient();
          
          if (!client) {
            console.error('❌ No authenticated client available');
            console.log('💡 Make sure you are signed in and SupabaseContext has initialized');
            return;
          }
          
          console.log('✅ Authenticated client found');
          
          // Test 1: Try to read households
          console.log('\n📋 Test 1: Reading households...');
          const { data: households, error: hError } = await client
            .from('households')
            .select('id, name, subscription_plan')
            .limit(1);
          
          if (hError) {
            console.error('❌ Household query failed:', hError);
            console.error('Error code:', hError.code);
            console.error('Error message:', hError.message);
          } else {
            console.log('✅ Household query succeeded:', households);
          }
          
          // Test 2: Try to read users
          console.log('\n👥 Test 2: Reading users...');
          const { data: users, error: uError } = await client
            .from('users')
            .select('id, clerk_id, email, household_id')
            .limit(5);
          
          if (uError) {
            console.error('❌ Users query failed:', uError);
            console.error('Error code:', uError.code);
            console.error('Error message:', uError.message);
          } else {
            console.log('✅ Users query succeeded:', users);
            console.log('Users found:', users?.length || 0);
          }
          
          // Test 3: Check specific household
          console.log('\n🏠 Test 3: Reading specific household...');
          const { data: household, error: shError } = await client
            .from('households')
            .select('id, name, subscription_plan')
            .eq('id', 'ecb34564-470c-41ea-a7ef-ed7446dd853d')
            .single();
          
          if (shError) {
            console.error('❌ Specific household query failed:', shError);
            console.error('Error code:', shError.code);
            console.error('Error message:', shError.message);
            if (shError.code === 'PGRST116') {
              console.log('💡 PGRST116 means RLS returned 0 rows - user may not have access');
            }
          } else {
            console.log('✅ Specific household query succeeded:', household);
          }
          
          console.log('\n✅ RLS test complete!');
        } catch (error: any) {
          console.error('❌ Error running RLS test:', error);
        }
      };
      
      console.log('[App] 🔧 RLS test function set up: window.helpyTestRLS()');
    }
  }, []); // Empty deps - set up once on mount
  
  // Parse deep link on mount to determine initial view and whether to skip intro
  // This enables direct navigation when user taps on a push notification
  const initialDeepLinkRef = useRef(() => {
    const result = parseNotificationDeepLink();
    console.log('[App] Initial deep link parsed:', result);
    return result;
  });
  
  // Lazy initialize to ensure parseNotificationDeepLink runs only once
  const getInitialDeepLink = () => {
    if (typeof initialDeepLinkRef.current === 'function') {
      initialDeepLinkRef.current = initialDeepLinkRef.current();
    }
    return initialDeepLinkRef.current;
  };
  
  const initialDeepLink = getInitialDeepLink();
  
  // Skip intro animation if coming from a notification deep link OR returning user with cached session
  const [showIntro, setShowIntro] = useState(() => {
    const shouldSkipDeepLink = initialDeepLink.isDeepLink;
    const hasCachedSession = !!localStorage.getItem('helpy_current_session_user');
    const shouldSkip = shouldSkipDeepLink || hasCachedSession;
    console.log('[App] showIntro initial:', !shouldSkip, '(isDeepLink:', shouldSkipDeepLink, ', hasCachedSession:', hasCachedSession, ')');
    return !shouldSkip;
  });
  
  // Initialize activeView from URL hash (for notification deep links)
  const [activeView, setActiveView] = useState(() => {
    console.log('[App] activeView initial:', initialDeepLink.view);
    return initialDeepLink.view;
  });
  
  // Removed clerkLoadTimeout - was causing bad UX with frozen buttons on mobile
  
  // Debug: Log when component mounts/renders
  useEffect(() => {
    console.log('[App] Component mounted. Current state:', {
      showIntro,
      activeView,
      hash: window.location.hash,
      href: window.location.href,
      clerkLoaded,
      isSignedIn,
      hasCurrentUser: !!localStorage.getItem('helpy_current_session_user')
    });
    
    // Check for deep link again after mount (for PWA cold start scenarios)
    // The hash might not be available at initial parse but becomes available shortly after
    const checkDeepLinkAfterMount = () => {
      const hash = window.location.hash;
      console.log('[App] Post-mount deep link check. Hash:', hash);
      
      if (hash && (hash.startsWith('#todo') || hash.startsWith('#meals') || hash.startsWith('#expenses'))) {
        const deepLink = parseNotificationDeepLink();
        console.log('[App] Post-mount deep link detected:', deepLink);
        
        if (deepLink.isDeepLink) {
          setShowIntro(false);
          setActiveView(deepLink.view);
          setNavData(deepLink.navData);
          // Clear the hash after processing
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    };
    
    // Check immediately and after a short delay (for PWA timing issues)
    checkDeepLinkAfterMount();
    const timer = setTimeout(checkDeepLinkAfterMount, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Removed Clerk timeout - was causing bad UX (frozen buttons, confusing developer messages)
  // If Clerk is slow, we just keep showing the loading animation - users can naturally close/reopen

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

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('helpy_current_session_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that the user object has required fields
        if (parsed && typeof parsed === 'object' && parsed.id && parsed.householdId && parsed.name) {
          return parsed;
        } else {
          console.warn('🔄 [App] Invalid user data in localStorage, clearing...');
          localStorage.removeItem('helpy_current_session_user');
          return null;
        }
      } catch (e) {
        console.warn('🔄 [App] Failed to parse user data from localStorage, clearing...');
        localStorage.removeItem('helpy_current_session_user');
        return null;
      }
    }
    return null;
  });

  // Onboarding State (index-based: 0, 1, 2... or -1 for complete)
  const [onboardingStepIndex, setOnboardingStepIndex] = useState<number>(() => {
    const saved = localStorage.getItem('helpy_onboarding_step_index');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  // State to trigger add member sheet from onboarding
  const [openAddMemberFromOnboarding, setOpenAddMemberFromOnboarding] = useState(false);

  useEffect(() => {
    localStorage.setItem('helpy_onboarding_step_index', String(onboardingStepIndex));
  }, [onboardingStepIndex]);

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
    
    // Check for pending deep link BEFORE clearing URL
    // This preserves the notification destination through the auth flow
    const pendingDeepLink = parseNotificationDeepLink();
    
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
    setShowIntro(false);
    
    // Navigate to deep link destination or default to dashboard
    if (pendingDeepLink.isDeepLink) {
      console.log('🔵 [App] Navigating to deep link:', pendingDeepLink.view, pendingDeepLink.navData);
      setActiveView(pendingDeepLink.view);
      setNavData(pendingDeepLink.navData);
    } else {
      setActiveView('dashboard');
    }
    console.log('✅ [App] handleLogin completed, currentUser should be set');
    
    // NOTE: Auto-subscribe is now handled by the useEffect that watches users.length
    // This ensures the clerk_id -> UUID cache is populated before subscribing.
    // The useEffect will trigger when users are loaded after login.
    console.log('[App] Push subscription will be triggered once users are loaded');
    
    setTimeout(() => {
      loginProcessedRef.current = false;
      console.log('✅ [App] loginProcessedRef reset');
    }, 1000);
  }, [currentUser]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      loginProcessedRef.current = false;
      setCurrentUser(null);
      localStorage.removeItem('helpy_current_session_user');
      setActiveView('dashboard');
      setUsers([]);
      setShowIntro(true);
    } catch (error) {
      console.error('Logout error:', error);
      loginProcessedRef.current = false;
      setCurrentUser(null);
      localStorage.removeItem('helpy_current_session_user');
      setActiveView('dashboard');
      setUsers([]);
      setShowIntro(true);
    }
  }, [signOut]);

  // Navigation data (e.g., initialSection for ToDo)
  // Initialize from deep link if present (for notification deep links)
  const [navData, setNavData] = useState<{ section?: string } | null>(() => {
    console.log('[App] navData initial:', initialDeepLink.navData);
    return initialDeepLink.navData;
  });

  // Navigation
  const handleNavigate = (view: string, data?: { section?: string }) => {
    setActiveView(view);
    setNavData(data ?? null);
    // Scroll to top when navigating to a new view
    window.scrollTo(0, 0);
  };

  // Track current section for onboarding (info: essentialInfo/houseRoutine, todo: shopping/task)
  const [onboardingSection, setOnboardingSection] = useState<string | undefined>(undefined);

  // Handle onboarding action and advance to next step
  const handleOnboardingAction = (action: { type: string; target?: string; section?: string; sheet?: string }) => {
    if (action.type === 'navigate' && action.target) {
      setActiveView(action.target);
      // Set section for the target page if specified
      if (action.section) {
        setOnboardingSection(action.section);
        setNavData({ section: action.section });
      } else {
        setOnboardingSection(undefined);
        setNavData(null);
      }
      window.scrollTo(0, 0);
    } else if (action.type === 'openSheet' && action.sheet === 'addMember') {
      setOpenAddMemberFromOnboarding(true);
    } else if (action.type === 'complete') {
      // Onboarding complete - set to -1 to hide overlay
      setOnboardingStepIndex(-1);
      setOnboardingSection(undefined);
      return; // Don't advance step index
    }
    // Advance to next step
    setOnboardingStepIndex(prev => prev + 1);
  };

  const skipOnboarding = () => {
    setOnboardingStepIndex(-1);
    setOnboardingSection(undefined);
  };
  
  const restartOnboarding = () => {
    setOnboardingStepIndex(0);
    setOnboardingSection(undefined);
    setActiveView('dashboard');
  };

  // Global Data State
  const [users, setUsers] = useState<User[]>([]);
  const [todoItems, setTodoItems] = useState<ToDoItem[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [familyNotes, setFamilyNotes] = useState('');
  const [familyNotesLang, setFamilyNotesLang] = useState<string | null>(null);
  const [familyNotesTranslations, setFamilyNotesTranslations] = useState<Record<string, string>>({});
  const [essentialItems, setEssentialItems] = useState<EssentialInfo[]>([]);
  const [houseRoutineItems, setHouseRoutineItems] = useState<HouseRoutine[]>([]);
  const [householdPlan, setHouseholdPlan] = useState<HouseholdPlan | null>(null);

  const fetchHouseholdPlan = useCallback(async (householdId: string) => {
    try {
      console.log('[App] Fetching household plan for:', householdId);
      console.log('[App] Supabase ready:', isSupabaseReady);
      console.log('[App] Using authenticated supabase client:', !!supabase);
      console.log('[App] Current user household ID:', currentUser?.householdId);
      console.log('[App] Requested household ID matches user:', householdId === currentUser?.householdId);

      // Early return if supabase client is not ready or null
      if (!isSupabaseReady || !supabase) {
        console.warn('[App] Supabase client not ready yet, skipping household plan fetch');
        return;
      }

      console.log('[App] Client type check:', supabase === defaultSupabase ? 'DEFAULT CLIENT (no JWT)' : 'AUTHENTICATED CLIENT (has JWT)');

      // First try a simple query to test authentication
      console.log('[App] Testing basic authentication...');
      const { data: testData, error: testError } = await supabase
        .from('households')
        .select('count')
        .limit(1);

      if (testError) {
        console.error('[App] Basic auth test failed:', testError);
      } else {
        console.log('[App] Basic auth test passed');
      }

      const { data, error } = await supabase
        .from('households')
        .select('subscription_plan, subscription_status, max_family_members, max_helpers')
        .eq('id', householdId)
        .single();

      if (error) {
        console.error('[App] Household fetch error:', error);
        console.error('[App] Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });

        // If it's a permission error, let's check if the household exists at all
        if (error.code === 'PGRST116') {
          console.log('[App] Checking if household exists without RLS...');
          // Temporarily disable RLS to check if data exists
          const { data: existsCheck, error: existsError } = await supabase
            .from('households')
            .select('id, subscription_plan')
            .eq('id', householdId)
            .limit(1);

          if (existsCheck && existsCheck.length > 0) {
            console.log('[App] Household exists but RLS blocks access:', existsCheck[0]);
          } else {
            console.log('[App] Household does not exist or still blocked');
          }
        }

        throw error;
      }

      setHouseholdPlan({
        plan: (data?.subscription_plan || 'free') as HouseholdPlan['plan'],
        status: data?.subscription_status || 'inactive',
        maxFamilyMembers: data?.max_family_members ?? null,
        maxHelpers: data?.max_helpers ?? null,
      });
    } catch (error) {
      console.error('[App] Failed to load household plan info:', error);
      setHouseholdPlan(prev => prev || null);
    }
  }, [supabase, isSupabaseReady, currentUser?.householdId]);

  // Sync function for periodic backup fetching
  const syncAllData = useCallback(async () => {
    if (!currentUser?.householdId) return;
    const hid = currentUser.householdId;
    
    console.log('[App] Running periodic sync...');
    
    try {
      // Fetch all collections in parallel
      const [usersData, todoData, mealsData, expensesData] = await Promise.all([
        fetchCollection(hid, 'users'),
        fetchCollection(hid, 'todo_items'),
        fetchCollection(hid, 'meals'),
        fetchCollection(hid, 'expenses'),
      ]);
      
      // Update state with fresh data, preserving hasPushSubscription from current state
      if (usersData.length > 0) {
        const uniqueUsers = Array.from(new Map(usersData.map(u => [u.id, u])).values());
        setUsers(prev => {
          // Merge new data with existing hasPushSubscription values
          return uniqueUsers.map(newUser => {
            const existingUser = prev.find(u => u.id === newUser.id);
            return {
              ...newUser,
              hasPushSubscription: existingUser?.hasPushSubscription ?? (newUser as any).hasPushSubscription
            };
          }) as User[];
        });
      }
      if (todoData) setTodoItems(todoData as ToDoItem[]);
      if (mealsData) setMeals(mealsData as Meal[]);
      if (expensesData) setExpenses(expensesData as Expense[]);
      
      console.log('[App] Periodic sync completed');
    } catch (error) {
      console.error('[App] Periodic sync failed:', error);
    }
  }, [currentUser?.householdId]);

  // Real-time connection status with auto-reconnect and periodic sync
  const { status: realtimeStatus } = useRealtimeStatus({
    enablePeriodicSync: true,
    syncInterval: 1 * 60 * 1000, // 1 minute - backup sync if real-time fails
    onSyncRequest: syncAllData,
  });

  // Keep household subscription + limits in sync
  useEffect(() => {
    if (!currentUser?.householdId || !isSupabaseReady) {
      console.log('[App] Skipping household plan fetch - user:', !!currentUser?.householdId, 'supabase ready:', isSupabaseReady);
      setHouseholdPlan(null);
      return;
    }

    const hid = currentUser.householdId;
    console.log('[App] Starting household plan fetch for user:', currentUser.id);
    fetchHouseholdPlan(hid);

    const channel = supabase
      .channel(`household-plan-${hid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${hid}` },
        () => fetchHouseholdPlan(hid)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.householdId, fetchHouseholdPlan, isSupabaseReady]);

  // Ensure currentUser is always in the users array (for assignee selection)
  useEffect(() => {
    if (currentUser && !users.find(u => u.id === currentUser.id)) {
      setUsers(prev => prev.length > 0 ? prev : [currentUser]);
    }
  }, [currentUser, users]);

  // Initialize push notifications service worker
  useEffect(() => {
    initializePushNotifications().catch(err => {
      console.warn('[App] Failed to initialize push notifications:', err);
    });
  }, []);

  // Background session validation: If Clerk is loaded and says user is NOT signed in,
  // but we have a cached session, clear it and redirect to auth.
  // This handles expired sessions after optimistic rendering for notification deep links.
  useEffect(() => {
    if (clerkLoaded && !isSignedIn && currentUser) {
      console.log('⚠️ [App] Clerk loaded but user not signed in. Cached session expired, clearing...');
      setCurrentUser(null);
      localStorage.removeItem('helpy_current_session_user');
      setShowIntro(true);
    }
  }, [clerkLoaded, isSignedIn, currentUser]);

  // Auto-subscribe to push notifications if user has them enabled
  // This ensures users with notificationsEnabled=true get subscribed automatically
  // 
  // IMPORTANT: We wait for `users` to be loaded (length > 0) before subscribing.
  // This ensures the clerk_id -> UUID cache is populated in supabaseService.ts,
  // which is needed for proper ID resolution when saving the push subscription.
  useEffect(() => {
    console.log('[App] Auto-subscribe useEffect triggered', {
      hasCurrentUser: !!currentUser,
      userId: currentUser?.id,
      householdId: currentUser?.householdId,
      notificationsEnabled: currentUser?.notificationsEnabled,
      usersLoaded: users.length,
    });
    
    if (!currentUser || !currentUser.householdId) {
      console.log('[App] Auto-subscribe skipped: missing currentUser or householdId');
      return;
    }
    
    // CRITICAL: Wait for users to be loaded before subscribing
    // This ensures the clerk_id -> UUID cache is populated
    if (users.length === 0) {
      console.log('[App] Auto-subscribe skipped: waiting for users to load (ID cache not ready)');
      return;
    }
    
    // Only auto-subscribe when notifications are explicitly enabled
    // Don't trigger when notificationsEnabled is false or undefined
    const notificationsEnabled = currentUser.notificationsEnabled ?? false;
    if (!notificationsEnabled) {
      console.log('[App] Auto-subscribe skipped: notifications not enabled');
      return;
    }
    
    console.log('[App] Calling autoSubscribeIfNeeded (users loaded, cache should be ready)...');
    
    // Auto-subscribe only when notifications are enabled AND users are loaded
    autoSubscribeIfNeeded(
      currentUser.id,
      currentUser.householdId,
      true  // We already checked it's enabled above
    ).then(success => {
      if (success) {
        console.log('[App] Push notifications auto-subscribed successfully');
      } else {
        console.log('[App] Auto-subscribe returned false (check push service logs)');
      }
    }).catch(err => {
      console.warn('[App] Failed to auto-subscribe to push notifications:', err);
    });
  }, [currentUser?.id, currentUser?.householdId, users.length]); // Added users.length dependency

  // Supabase Subscriptions
  useEffect(() => {
    if (!currentUser || !currentUser.householdId) return;
    const hid = currentUser.householdId;
    
    const unsubUsers = subscribeToCollection(hid, 'users', async (data) => {
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
      
      // Fetch push subscription status for each user to determine "Incomplete" vs "Ready" state
      const usersWithStatus = await Promise.all(finalUsers.map(async (user) => {
        // Skip check for children or temp users
        if (user.role === 'Child' || user.id.startsWith('temp-')) {
          return { ...user, hasPushSubscription: false };
        }
        
        try {
          // Resolve to Supabase UUID (user.id may be a Clerk ID)
          const supabaseUserId = getCachedSupabaseUuid(user.id);
          const { count } = await supabase
            .from('push_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', supabaseUserId);
            
          return {
            ...user,
            hasPushSubscription: (count || 0) > 0
          };
        } catch (e) {
          console.warn('Failed to check push subscription for user', user.id, e);
          return { ...user, hasPushSubscription: false };
        }
      }));
      
      setUsers(usersWithStatus as User[]);
    });
    const unsubTodoItems = subscribeToCollection(hid, 'todo_items', (data) => setTodoItems(data as ToDoItem[]));
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
  }, [currentUser]);

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

  // Handle URL hash changes (for when app is already open and notification is tapped)
  // This navigates to the correct page when service worker calls client.navigate()
  useEffect(() => {
    const handleDeepLink = () => {
      const deepLink = parseNotificationDeepLink();
      if (deepLink.isDeepLink) {
        console.log('[App] Deep link detected, navigating to:', deepLink.view, deepLink.navData);
        setShowIntro(false); // Always skip intro for deep links
        setActiveView(deepLink.view);
        setNavData(deepLink.navData);
        // Clear the hash parameters after navigation to keep URL clean
        window.history.replaceState({}, '', window.location.pathname);
      }
    };
    
    // Handle hash changes (for when app is open and SW navigates)
    const handleHashChange = () => {
      console.log('[App] Hash change event detected. Hash:', window.location.hash);
      handleDeepLink();
    };
    
    // Handle visibility changes (for when PWA becomes visible after notification tap)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] App became visible. Hash:', window.location.hash);
        handleDeepLink();
      }
    };
    
    // Handle focus (another way to detect app becoming active)
    const handleFocus = () => {
      console.log('[App] Window focused. Hash:', window.location.hash);
      handleDeepLink();
    };
    
    window.addEventListener('hashchange', handleHashChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const hid = currentUser?.householdId ?? '';

  // ToDo CRUD Handlers
  const handleAddTodoItem = async (item: ToDoItem) => {
    if (!hid) return item;
    const newItem = { ...item, id: `todo-${Date.now()}` };
    setTodoItems(prev => [newItem, ...prev]);
    // Include createdBy for notifications - use currentUser's id
    await addItem(hid, 'todo_items', { ...item, createdBy: currentUser?.id });
    return newItem;
  };

  const handleUpdateTodoItem = async (id: string, data: Partial<ToDoItem>) => {
    if (!hid) return;
    setTodoItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...data } : item
    ));
    await updateItem(hid, 'todo_items', id, data);
  };

  const handleDeleteTodoItem = async (id: string) => {
    if (!hid) return;
    setTodoItems(prev => prev.filter(item => item.id !== id));
    await deleteItem(hid, 'todo_items', id);
  };

  // Meal CRUD Handlers (with optimistic updates for instant UI)
  const handleAddMeal = async (meal: Meal) => {
    if (!hid) return;
    const tempId = `temp-${Date.now()}`;
    const newMeal = { ...meal, id: tempId };
    setMeals(prev => [...prev, newMeal]);  // Optimistic: update UI immediately
    // Include createdBy for notifications
    await addItem(hid, 'meals', { ...meal, createdBy: currentUser?.id });
  };

  const handleUpdateMeal = async (id: string, data: Partial<Meal>) => {
    if (!hid) return;
    setMeals(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));  // Optimistic
    await updateItem(hid, 'meals', id, data);
  };

  const handleDeleteMeal = async (id: string) => {
    if (!hid) return;
    setMeals(prev => prev.filter(m => m.id !== id));  // Optimistic
    await deleteItem(hid, 'meals', id);
  };

  // Expense CRUD Handlers (with optimistic updates for instant UI)
  const handleAddExpense = async (expense: Expense): Promise<Expense> => {
    if (!hid) return expense;
    const tempId = `temp-${Date.now()}`;
    const newExpense = { ...expense, id: tempId };
    setExpenses(prev => [...prev, newExpense]);  // Optimistic
    
    // Create expense without ID so Supabase generates UUID
    const expenseWithoutId = { ...expense };
    delete expenseWithoutId.id; // Remove ID so Supabase generates UUID
    // Add createdBy so notifications show who added the expense
    expenseWithoutId.createdBy = currentUser?.id;
    
    console.log('[App] Adding expense without ID, will get UUID from DB');
    const savedExpense = await addItem(hid, 'expenses', expenseWithoutId);
    console.log('[App] Expense saved with UUID:', savedExpense.id);
    
    // Return the expense with the actual UUID from database
    return savedExpense as Expense;
  };

  const handleUpdateExpense = async (expense: Expense) => {
    if (!hid) return;
    const { id, ...data } = expense;
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));  // Optimistic
    await updateItem(hid, 'expenses', id, data);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!hid) return;
    setExpenses(prev => prev.filter(e => e.id !== id));  // Optimistic
    await deleteItem(hid, 'expenses', id);
  };

  // User CRUD Handlers (with optimistic updates for instant UI)
  const handleAddUser = async (user: Omit<User, 'id'>): Promise<User | undefined> => {
    if (!hid) return;
    
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
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));  // Optimistic
    await updateItem(hid, 'users', id, data);
  };

  const handleDeleteUser = async (id: string) => {
    if (!hid || !currentUser) return;
    const previousUsers = users;  // Store for rollback
    setUsers(prev => prev.filter(u => u.id !== id));  // Optimistic
    try {
      await deleteItem(hid, 'users', id, currentUser.id);
    } catch (error) {
      console.error('❌ Failed to delete user:', error);
      setUsers(previousUsers);  // Rollback on error
      throw error;  // Re-throw so Profile can show error
    }
  };

  // Notes Handler
  const handleSaveFamilyNotes = async (notes: string): Promise<void> => {
    if (!hid) return;
    const previousNotes = familyNotes; // Store previous value
    setFamilyNotes(notes); // Optimistic update
    // Reset translation fields when notes change (will be detected and saved)
    setFamilyNotesLang(null);
    setFamilyNotesTranslations({});
    
    try {
      await saveFamilyNotes(hid, notes, lang);
    } catch (error) {
      console.error('Failed to save notes:', error);
      setFamilyNotes(previousNotes); // Rollback on error
      throw error; // Re-throw so Dashboard knows save failed
    }
  };

  // Update notes translations handler
  const handleUpdateNotesTranslations = async (translations: Record<string, string>): Promise<void> => {
    if (!hid) return;
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
    const previousItems = essentialItems;
    setEssentialItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...data } : item
    ));  // Optimistic
    try {
      await updateEssentialInfo(hid, id, data);
    } catch (error) {
      console.error('Failed to update essential info:', error);
      setEssentialItems(previousItems);  // Rollback
    }
  };

  const handleDeleteEssentialInfo = async (id: string) => {
    if (!hid) return;
    const previousItems = essentialItems;
    setEssentialItems(prev => prev.filter(item => item.id !== id));  // Optimistic
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
    const previousItems = houseRoutineItems;
    setHouseRoutineItems(prev => prev.map(i => 
      i.id === id ? { ...i, ...data } : i
    ));  // Optimistic
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
    const previousItems = houseRoutineItems;
    setHouseRoutineItems(prev => prev.filter(i => i.id !== id));  // Optimistic
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
            todoItems={todoItems}
            meals={meals}
            users={users}
            expenses={expenses}
            onNavigate={handleNavigate}
            familyNotes={familyNotes}
            familyNotesLang={familyNotesLang}
            familyNotesTranslations={familyNotesTranslations}
            onUpdateNotes={handleSaveFamilyNotes}
            onUpdateNotesTranslations={handleUpdateNotesTranslations}
            currentUser={currentUser!}
            t={translations}
            currentLang={lang}
            onLanguageChange={handleLanguageChange}
            isTranslating={isAnyTranslating}
            onUpdateMeal={handleUpdateMeal}
            realtimeStatus={realtimeStatus}
            onRestartOnboarding={restartOnboarding}
          />
        );

      case 'todo':
        return (
          <ToDo
            items={todoItems}
            users={users}
            currentUser={currentUser!}
            onAdd={handleAddTodoItem}
            onUpdate={handleUpdateTodoItem}
            onDelete={handleDeleteTodoItem}
            t={translations}
            currentLang={lang}
            initialSection={navData?.section as 'shopping' | 'task' | undefined}
            onSectionChange={setOnboardingSection}
          />
        );

      case 'meals':
        return (
          <Meals
            meals={meals}
            users={users}
            currentUser={currentUser!}
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
            expenses={expenses}
            householdId={hid}
            currentUser={currentUser}
            householdPlan={householdPlan}
            onNavigateToPlan={() => {
              localStorage.setItem('helpy_profile_target_section', 'plan');
              handleNavigate('profile');
            }}
            onAdd={handleAddExpense}
            onUpdate={handleUpdateExpense}
            onDelete={handleDeleteExpense}
            t={translations}
            currentLang={lang}
          />
        );

      case 'info':
        return (
          <HouseholdInfo
            householdId={hid}
            currentUser={currentUser!}
            users={users}
            essentialItems={essentialItems}
            houseRoutineItems={houseRoutineItems}
            onAddEssentialInfo={handleAddEssentialInfo}
            onUpdateEssentialInfo={handleUpdateEssentialInfo}
            onDeleteEssentialInfo={handleDeleteEssentialInfo}
            onAddHouseRoutine={handleAddHouseRoutine}
            onUpdateHouseRoutine={handleUpdateHouseRoutine}
            onDeleteHouseRoutine={handleDeleteHouseRoutine}
            t={translations}
            currentLang={lang}
            initialSection={navData?.section as 'essentialInfo' | 'houseRoutine' | undefined}
            onSectionChange={setOnboardingSection}
          />
        );

      case 'profile':
        return (
          <Profile
            users={users}
            onAdd={handleAddUser}
            onUpdate={handleUpdateUser}
            onDelete={handleDeleteUser}
            onBack={() => setActiveView('dashboard')}
            currentUser={currentUser!}
            onLogout={handleLogout}
            householdPlan={householdPlan}
            t={translations}
            currentLang={lang}
            openAddMemberFromOnboarding={openAddMemberFromOnboarding}
            onAddMemberSheetOpened={() => setOpenAddMemberFromOnboarding(false)}
          />
        );

      default:
        return null;
    }
  };

  if (loginProcessedRef.current && !currentUser) {
    return (
      <div className="min-h-screen flex flex-col justify-end pb-24" style={{ backgroundColor: '#3EAFD2' }}>
        <div className="text-white text-center">
          <div className="broom-loader-wrapper">
            <div className="broom-loader mb-4">
              <BroomIcon className="broom-icon-svg" />
              <div className="broom-track"></div>
              <div className="broom-trail"></div>
            </div>
            <p className="text-sm font-bold whitespace-nowrap">Tidying things up...</p>
          </div>
          <p className="text-xs text-white/60 mt-2">Almost ready</p>
        </div>
      </div>
    );
  }

  // Show loading while Clerk is initializing (after OAuth redirect)
  // OPTIMIZATION: For notification deep links with cached session, skip the loading screen
  // and render the content immediately. This provides instant navigation when tapping notifications.
  // We'll validate the session in the background and only redirect to auth if it's invalid.
  const shouldSkipClerkLoading = !clerkLoaded && !!currentUser && !!currentUser.householdId && initialDeepLink.isDeepLink;
  
  if (!clerkLoaded && !shouldSkipClerkLoading) {
    // For regular app launches (not from notifications), wait for Clerk
    console.log('🟣 [App] Clerk not loaded yet, showing loading state');
    return <ClerkLoadingScreen />;
  }
  
  if (shouldSkipClerkLoading) {
    console.log('🟢 [App] Clerk not loaded, but cached session exists + deep link detected. Rendering content optimistically.');
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
      <>
        {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}
        <Auth onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}
      {onboardingStepIndex >= 0 && (
        <OnboardingOverlay
          stepIndex={onboardingStepIndex}
          userRole={currentUser.role}
          currentPage={activeView}
          currentSection={onboardingSection}
          onNext={handleOnboardingAction}
          onSkip={skipOnboarding}
          t={translations}
        />
      )}
      <Layout activeView={activeView} onNavigate={handleNavigate} t={translations}>
        {renderView()}
      </Layout>
    </>
  );
};

// Main App component that wraps everything with TranslationProvider
const App: React.FC = () => {
  return (
    <TranslationProvider>
      <AppContent />
    </TranslationProvider>
  );
};

export default App;
