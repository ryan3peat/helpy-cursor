import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ShoppingList from './components/ShoppingList';
import Tasks from './components/Tasks';
import Meals from './components/Meals';
import Expenses from './components/Expenses';
import Profile from './components/Profile';
import HouseholdInfo from './components/HouseholdInfo';
import IntroAnimation from './components/IntroAnimation';
import Auth from './components/Auth';
import OnboardingOverlay from './components/OnboardingOverlay';
import InviteSetup from './components/InviteSetup';
import { ShoppingItem, Task, Meal, Expense, Section, User, TranslationDictionary } from './types';
import { BASE_TRANSLATIONS } from './constants';
import {
  subscribeToCollection,
  addItem,
  updateItem,
  deleteItem,
  saveFamilyNotes,
  subscribeToNotes
} from './services/supabaseService';

const App: React.FC = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');

  // Localization State
  const [lang, setLang] = useState<string>(() => localStorage.getItem('helpy_lang') ?? 'en');
  const [translations, setTranslations] = useState<TranslationDictionary>(BASE_TRANSLATIONS);
  const [isTranslating, setIsTranslating] = useState(false);

  // Invite Logic
  const [inviteParams, setInviteParams] = useState<{ hid: string; uid: string } | null>(null);

  // ✅ FIX: Ref to track if login has been processed (prevents race conditions)
  const loginProcessedRef = useRef(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('helpy_current_session_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState<number>(() => {
    const saved = localStorage.getItem('helpy_onboarding_step');
    return saved ? parseInt(saved) : 0;
  });

  useEffect(() => {
    localStorage.setItem('helpy_onboarding_step', onboardingStep.toString());
  }, [onboardingStep]);

  // Translation Effect
  useEffect(() => {
    const loadTranslations = async () => {
      if (lang === 'en') {
        setTranslations(BASE_TRANSLATIONS);
        return;
      }
      setIsTranslating(true);
      try {
        // @ts-ignore - Translation function not implemented yet
        const t = await getAppTranslations(lang, BASE_TRANSLATIONS);
        setTranslations(t);
      } catch (e) {
        console.error('Failed to load translations', e);
        setTranslations(BASE_TRANSLATIONS);
      } finally {
        setIsTranslating(false);
      }
    };
    loadTranslations();
    localStorage.setItem('helpy_lang', lang);
  }, [lang]);

  // ✅ Invite detection effect
  useEffect(() => {
    const checkInvite = () => {
      // Skip if user is logged in OR if login is being processed
      if (currentUser || loginProcessedRef.current) return;
      
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      let hid = params.get('hid');
      let uid = params.get('uid');
      let isInvite = params.get('invite') === 'true';

      if (!isInvite && hash.includes('invite')) {
        const hashParts = hash.split('?');
        if (hashParts.length > 1) {
          const hashParams = new URLSearchParams(hashParts[1]);
          hid = hashParams.get('hid');
          uid = hashParams.get('uid');
          isInvite = true;
        }
      }

      if (isInvite && hid && uid) {
        setInviteParams({ hid, uid });
        setShowIntro(false);
      }
    };

    checkInvite();
    window.addEventListener('hashchange', checkInvite);
    return () => window.removeEventListener('hashchange', checkInvite);
  }, [currentUser]);

  // ✅ FIX: Memoized handleLogin with useCallback to prevent reference changes
  // This is critical because InviteSetup has onComplete in its useEffect dependencies
  const handleLogin = useCallback((user: User) => {
    // Guard against multiple calls (race condition protection)
    if (loginProcessedRef.current) {
      console.log('⚠️ handleLogin already processed, skipping duplicate call');
      return;
    }
    loginProcessedRef.current = true;

    console.log('✅ handleLogin called for user:', user.name);

    // Clear URL and invite params FIRST (synchronously)
    const newUrl = window.location.href.split('#')[0].split('?')[0];
    window.history.replaceState({}, document.title, newUrl);
    
    // Clear invite params immediately
    setInviteParams(null);

    // Then set user and update state
    setCurrentUser(user);
    localStorage.setItem('helpy_current_session_user', JSON.stringify(user));
    setShowIntro(false);
    setActiveView('dashboard');

    // Reset the ref after a short delay to allow for future logins (e.g., after logout)
    setTimeout(() => {
      loginProcessedRef.current = false;
    }, 1000);
  }, []); // Empty deps = stable reference

  const handleLogout = useCallback(() => {
    // Reset the login processed ref on logout
    loginProcessedRef.current = false;
    
    setCurrentUser(null);
    localStorage.removeItem('helpy_current_session_user');
    setActiveView('dashboard');
    setUsers([]);
    setShowIntro(true);
  }, []);

  // Navigation
  const handleNavigate = (view: string) => {
    setActiveView(view);
    if (onboardingStep === 1 && view === 'profile') {
      setOnboardingStep(2);
    }
  };

  const advanceOnboarding = () => {
    if (onboardingStep === 1) {
      setActiveView('profile');
      setOnboardingStep(2);
      return;
    }
    setOnboardingStep(0);
  };

  const skipOnboarding = () => setOnboardingStep(0);

  // Global Data State
  const [users, setUsers] = useState<User[]>([]);
  const [householdSections, setHouseholdSections] = useState<Section[]>([]);
  const [familyNotes, setFamilyNotes] = useState('');
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Supabase Subscriptions
  useEffect(() => {
    if (!currentUser || !currentUser.householdId) return;
    const hid = currentUser.householdId;
    const unsubUsers = subscribeToCollection(hid, 'users', (data) => setUsers(data as User[]));
    const unsubTasks = subscribeToCollection(hid, 'tasks', (data) => setTasks(data as Task[]));
    const unsubShopping = subscribeToCollection(hid, 'shopping', (data) => setShoppingItems(data as ShoppingItem[]));
    const unsubMeals = subscribeToCollection(hid, 'meals', (data) => setMeals(data as Meal[]));
    const unsubExpenses = subscribeToCollection(hid, 'expenses', (data) => setExpenses(data as Expense[]));
    const unsubSections = subscribeToCollection(hid, 'sections', (data) => setHouseholdSections(data as Section[]));
    const unsubNotes = subscribeToNotes(hid, (note) => setFamilyNotes(note));
    return () => {
      unsubUsers();
      unsubTasks();
      unsubShopping();
      unsubMeals();
      unsubExpenses();
      unsubSections();
      unsubNotes();
    };
  }, [currentUser]);

  const hid = currentUser?.householdId ?? '';

  // CRUD Handlers
  const handleAddUser = async (user: Omit<User, 'id'>) => {
    if (!hid) return undefined;
    const mappedUser = {
      household_id: user.householdId,
      name: user.name,
      email: user.email ?? null,
      role: user.role,
      avatar: user.avatar,
      allergies: user.allergies,
      preferences: user.preferences,
      status: user.status ?? 'active'
    };
    try {
      const newItem = await addItem(hid, 'users', mappedUser);
      return newItem as User;
    } catch (error) {
      console.error('❌ Failed to add user:', error);
      return undefined;
    }
  };

  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    if (!hid) return;
    try {
      await updateItem(hid, 'users', id, data);
    } catch (error) {
      console.error('❌ Failed to update user:', error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!hid) return;
    try {
      await deleteItem(hid, 'users', id);
    } catch (error) {
      console.error('❌ Failed to delete user:', error);
    }
  };

  // Other handlers remain unchanged...

  const renderView = () => {
    if (!currentUser) return null;
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard
            shoppingItems={shoppingItems}
            tasks={tasks}
            meals={meals}
            users={users}
            expenses={expenses}
            onNavigate={handleNavigate}
            familyNotes={familyNotes}
            onUpdateNotes={setFamilyNotes}
            currentUser={currentUser}
            t={translations}
            currentLang={lang}
            onLanguageChange={setLang}
            isTranslating={isTranslating}
          />
        );
      case 'shopping':
        return <ShoppingList items={shoppingItems} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} t={translations} currentLang={lang} />;
      case 'tasks':
        return <Tasks tasks={tasks} users={users} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} t={translations} currentLang={lang} />;
      case 'meals':
        return <Meals meals={meals} users={users} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} t={translations} currentLang={lang} />;
      case 'expenses':
        return <Expenses expenses={expenses} householdId={hid} onAdd={() => {}} t={translations} currentLang={lang} />;
      case 'info':
        return <HouseholdInfo sections={householdSections} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} t={translations} currentLang={lang} />;
      case 'profile':
        return (
          <Profile
            users={users}
            onAdd={handleAddUser}
            onUpdate={handleUpdateUser}
            onDelete={handleDeleteUser}
            onBack={() => handleNavigate('dashboard')}
            currentUser={currentUser}
            onLogout={handleLogout}
            t={translations}
            currentLang={lang}
          />
        );
      default:
        return null;
    }
  };

  // ✅ FIX: Additional guard - if login is being processed, show loading
  // This prevents InviteSetup from re-rendering during the transition
  if (loginProcessedRef.current && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary to-brand-secondary">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-bold">Completing setup...</p>
        </div>
      </div>
    );
  }

  // Invite Setup View
  if (inviteParams && !currentUser) {
    return <InviteSetup householdId={inviteParams.hid} userId={inviteParams.uid} onComplete={handleLogin} />;
  }

  // Auth View
  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  // Main App View
  return (
    <>
      {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}
      {onboardingStep > 0 && (
        <OnboardingOverlay
          step={onboardingStep}
          userName={currentUser.name?.split(' ')[0] ?? 'User'}
          onNext={advanceOnboarding}
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

export default App;