import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { initializePushNotifications, autoSubscribeIfNeeded } from './services/pushNotificationService';
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

// Inner App component that uses the translation context
const AppContent: React.FC = () => {
  const { signOut } = useClerk();
  const { user: clerkUser, isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { setStaticTranslating, isAnyTranslating } = useTranslationContext();
  const isSupabaseReady = useSupabaseReady(); // Wait for authenticated Supabase client
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
    
    // Trigger auto-subscribe immediately after login
    console.log('[App] Triggering auto-subscribe after login...');
    autoSubscribeIfNeeded(
      user.id,
      user.householdId,
      user.notificationsEnabled === true  // Only if EXPLICITLY true, not undefined/null
    ).then(success => {
      if (success) {
        console.log('[App] Push notifications auto-subscribed successfully (from handleLogin)');
      } else {
        console.log('[App] Auto-subscribe returned false (check push service logs)');
      }
    }).catch(err => {
      console.warn('[App] Failed to auto-subscribe to push notifications (from handleLogin):', err);
    });
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
    } catch (error) {
      console.error('Logout error:', error);
      loginProcessedRef.current = false;
      setCurrentUser(null);
      localStorage.removeItem('helpy_current_session_user');
      setActiveView('dashboard');
      setUsers([]);
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
      
      // Update state with fresh data
      if (usersData.length > 0) {
        const uniqueUsers = Array.from(new Map(usersData.map(u => [u.id, u])).values());
        setUsers(uniqueUsers as User[]);
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

  // Initialize push notifications service worker
  useEffect(() => {
    initializePushNotifications().catch(err => {
      console.warn('[App] Failed to initialize push notifications:', err);
    });
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
  useEffect(() => {
    console.log('[App] Auto-subscribe useEffect triggered', {
      hasCurrentUser: !!currentUser,
      userId: currentUser?.id,
      householdId: currentUser?.householdId,
      notificationsEnabled: currentUser?.notificationsEnabled,
      fullCurrentUser: currentUser
    });
    
    if (!currentUser || !currentUser.householdId) {
      console.log('[App] Auto-subscribe skipped: missing currentUser or householdId');
      return;
    }
    
    console.log('[App] Calling autoSubscribeIfNeeded...');
    
    // Check if user has notifications enabled and auto-subscribe
    autoSubscribeIfNeeded(
      currentUser.id,
      currentUser.householdId,
      currentUser.notificationsEnabled === true  // Only if EXPLICITLY true, not undefined/null
    ).then(success => {
      if (success) {
        console.log('[App] Push notifications auto-subscribed successfully');
      } else {
        console.log('[App] Auto-subscribe returned false (check push service logs)');
      }
    }).catch(err => {
      console.warn('[App] Failed to auto-subscribe to push notifications:', err);
    });
  }, [currentUser]); // Changed to depend on entire currentUser object instead of individual properties

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
    const newItem = { ...item, id: `todo-${Date.now()}` };
    setTodoItems(prev => [newItem, ...prev]);
    // Include createdBy for notifications - use currentUser's id
    await addItem(hid, 'todo_items', { ...item, createdBy: currentUser?.id });
    return newItem;
  };

  const handleUpdateTodoItem = async (id: string, data: Partial<ToDoItem>) => {
    if (!hid) return;
    // Optimistically update UI
    setTodoItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...data } : item
    ));
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      console.warn('⚠️ Skipping update for temp item - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'todo_items', id, data);
  };

  const handleDeleteTodoItem = async (id: string) => {
    if (!hid) return;
    // Optimistically remove from UI
    setTodoItems(prev => prev.filter(item => item.id !== id));
    // Skip database call for temp IDs - item not in database yet
    if (isTempId(id)) {
      console.warn('⚠️ Skipping delete for temp item - not yet saved:', id);
      return;
    }
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
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      console.warn('⚠️ Skipping update for temp meal - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'meals', id, data);
  };

  const handleDeleteMeal = async (id: string) => {
    if (!hid) return;
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
    // Skip database call for temp IDs - real-time sync will handle it
    if (isTempId(id)) {
      console.warn('⚠️ Skipping update for temp user - waiting for real ID:', id);
      return;
    }
    await updateItem(hid, 'users', id, data);
  };

  const handleDeleteUser = async (id: string) => {
    if (!hid || !currentUser) return;

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
      alert(`Failed to remove user: ${error.message}`);
    }
  };

  // Notes Handler
  const handleSaveFamilyNotes = async (notes: string): Promise<void> => {
    if (!hid) return;
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
            autoOpenSheet={navData?.openAddSheet}
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
        <div className="min-h-screen flex flex-col justify-center items-center p-4" style={{ backgroundColor: '#3EAFD2' }}>
          <div className="text-white text-center max-w-md">
            <p className="text-lg font-bold mb-2">Clerk Loading Timeout</p>
            {clerkError && (
              <p className="text-sm mb-4 text-red-200">{clerkError}</p>
            )}
            <p className="text-sm mb-4">Clerk is taking longer than expected to initialize.</p>
            <p className="text-xs text-white/80 mb-4">Please check:</p>
            <ul className="text-xs text-white/80 text-left list-disc list-inside mb-4 space-y-1">
              <li>Browser console for errors (F12 → Console tab)</li>
              <li>Network tab (F12 → Network) - look for failed requests to clerk.accounts.dev</li>
              <li>That your Clerk publishable key is correct in .env.local</li>
              <li>That you're using test keys (pk_test_...) for local development</li>
              <li>Firewall/antivirus blocking Clerk API requests</li>
            </ul>
            <div className="flex gap-2 justify-center">
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-white text-[#3EAFD2] rounded font-semibold"
              >
                Reload Page
              </button>
              <button 
                onClick={() => {
                  console.log('🔍 [Debug] Clerk Key:', import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? 'Present' : 'MISSING');
                  console.log('🔍 [Debug] Key preview:', import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 20));
                  console.log('🔍 [Debug] Hostname:', window.location.hostname);
                  console.log('🔍 [Debug] Full URL:', window.location.href);
                }} 
                className="px-4 py-2 bg-white/20 text-white rounded font-semibold"
              >
                Debug Info
              </button>
            </div>
          </div>
        </div>
      );
    }
    
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
          <p className="text-xs text-white/60 mt-2">Please wait a moment</p>
        </div>
      </div>
    );
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
      {onboardingStep > 0 && (
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
    </div>
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
