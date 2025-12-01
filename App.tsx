import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useClerk } from '@clerk/clerk-react'; // ADD THIS IMPORT
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
  const { signOut } = useClerk(); // ADD THIS HOOK
  const [showIntro, setShowIntro] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');

  // Localization State
  const [lang, setLang] = useState<string>(() => localStorage.getItem('helpy_lang') ?? 'en');
  const [translations, setTranslations] = useState<TranslationDictionary>(BASE_TRANSLATIONS);
  const [isTranslating, setIsTranslating] = useState(false);

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

  // Check for invite params on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const inviteFlag = urlParams.get('invite') || hashParams.get('invite');
    const hid = urlParams.get('hid') || hashParams.get('hid');
    const uid = urlParams.get('uid') || hashParams.get('uid');
    if (inviteFlag === 'true' && hid && uid) {
      setInviteParams({ hid, uid });
    }
  }, []);

  const handleLogin = useCallback((user: User) => {
    if (loginProcessedRef.current) {
      return;
    }
    loginProcessedRef.current = true;
    const newUrl = window.location.pathname + window.location.hash.split('?')[0];
    window.history.replaceState({}, document.title, newUrl);
    setInviteParams(null);
    setCurrentUser(user);
    localStorage.setItem('helpy_current_session_user', JSON.stringify(user));
    setShowIntro(false);
    setActiveView('dashboard');
    setTimeout(() => {
      loginProcessedRef.current = false;
    }, 1000);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      // 1. Sign out from Clerk first
      await signOut();
      
      // 2. Reset the login processed ref
      loginProcessedRef.current = false;
      
      // 3. Clear local state
      setCurrentUser(null);
      localStorage.removeItem('helpy_current_session_user');
      setActiveView('dashboard');
      setUsers([]);
      setShowIntro(true);
    } catch (error) {
      console.error('Logout error:', error);
      // Even if Clerk logout fails, clear local state
      loginProcessedRef.current = false;
      setCurrentUser(null);
      localStorage.removeItem('helpy_current_session_user');
      setActiveView('dashboard');
      setUsers([]);
      setShowIntro(true);
    }
  }, [signOut]);

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

  const handleAddShoppingItem = async (item: Omit<ShoppingItem, 'id'>) => {
    if (!hid) return;
    await addItem(hid, 'shopping', item);
  };

  const handleUpdateShoppingItem = async (id: string, data: Partial<ShoppingItem>) => {
    if (!hid) return;
    await updateItem(hid, 'shopping', id, data);
  };

  const handleDeleteShoppingItem = async (id: string) => {
    if (!hid) return;
    await deleteItem(hid, 'shopping', id);
  };

  const handleAddTask = async (task: Omit<Task, 'id'>) => {
    if (!hid) return;
    await addItem(hid, 'tasks', task);
  };

  const handleUpdateTask = async (id: string, data: Partial<Task>) => {
    if (!hid) return;
    await updateItem(hid, 'tasks', id, data);
  };

  const handleDeleteTask = async (id: string) => {
    if (!hid) return;
    await deleteItem(hid, 'tasks', id);
  };

  const handleAddMeal = async (meal: Omit<Meal, 'id'>) => {
    if (!hid) return;
    await addItem(hid, 'meals', meal);
  };

  const handleUpdateMeal = async (id: string, data: Partial<Meal>) => {
    if (!hid) return;
    await updateItem(hid, 'meals', id, data);
  };

  const handleDeleteMeal = async (id: string) => {
    if (!hid) return;
    await deleteItem(hid, 'meals', id);
  };

  const handleAddExpense = async (expense: Omit<Expense, 'id'>) => {
    if (!hid) return;
    await addItem(hid, 'expenses', expense);
  };

  const handleUpdateExpense = async (id: string, data: Partial<Expense>) => {
    if (!hid) return;
    await updateItem(hid, 'expenses', id, data);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!hid) return;
    await deleteItem(hid, 'expenses', id);
  };

  const handleAddSection = async (section: Omit<Section, 'id'>) => {
    if (!hid) return;
    await addItem(hid, 'sections', section);
  };

  const handleUpdateSection = async (id: string, data: Partial<Section>) => {
    if (!hid) return;
    await updateItem(hid, 'sections', id, data);
  };

  const handleDeleteSection = async (id: string) => {
    if (!hid) return;
    await deleteItem(hid, 'sections', id);
  };

  const handleAddUser = async (user: Omit<User, 'id'>): Promise<User | undefined> => {
    if (!hid) return;
    const result = await addItem(hid, 'users', user);
    return result ? (result as User) : undefined;
  };

  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    if (!hid) return;
    await updateItem(hid, 'users', id, data);
  };

  const handleDeleteUser = async (id: string) => {
    if (!hid) return;
    await deleteItem(hid, 'users', id);
  };

  const handleSaveFamilyNotes = async (notes: string) => {
    if (!hid) return;
    await saveFamilyNotes(hid, notes);
  };

  const renderView = () => {
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
            onUpdateNotes={handleSaveFamilyNotes}
            currentUser={currentUser!}
            t={translations}
            currentLang={lang}
            onLanguageChange={setLang}
            isTranslating={isTranslating}
          />
        );
      case 'shopping':
        return (
          <ShoppingList
            items={shoppingItems}
            users={users}
            onAdd={handleAddShoppingItem}
            onUpdate={handleUpdateShoppingItem}
            onDelete={handleDeleteShoppingItem}
            currentUser={currentUser!}
            t={translations}
          />
        );
      case 'tasks':
        return (
          <Tasks
            tasks={tasks}
            users={users}
            onAdd={handleAddTask}
            onUpdate={handleUpdateTask}
            onDelete={handleDeleteTask}
            currentUser={currentUser!}
            t={translations}
          />
        );
      case 'meals':
        return (
          <Meals
            meals={meals}
            users={users}
            onAdd={handleAddMeal}
            onUpdate={handleUpdateMeal}
            onDelete={handleDeleteMeal}
            currentUser={currentUser!}
            t={translations}
          />
        );
      case 'expenses':
        return (
          <Expenses
            expenses={expenses}
            users={users}
            onAdd={handleAddExpense}
            onUpdate={handleUpdateExpense}
            onDelete={handleDeleteExpense}
            currentUser={currentUser!}
            t={translations}
            currentLang={lang}
          />
        );
      case 'info':
        return (
          <HouseholdInfo
            sections={householdSections}
            familyNotes={familyNotes}
            onAddSection={handleAddSection}
            onUpdateSection={handleUpdateSection}
            onDeleteSection={handleDeleteSection}
            onSaveFamilyNotes={handleSaveFamilyNotes}
            currentUser={currentUser!}
            t={translations}
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
            t={translations}
            currentLang={lang}
          />
        );
      default:
        return null;
    }
  };

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

  if (inviteParams && !currentUser) {
    return <InviteSetup householdId={inviteParams.hid} userId={inviteParams.uid} onComplete={handleLogin} />;
  }

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

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