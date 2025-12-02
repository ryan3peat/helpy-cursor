import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useClerk } from '@clerk/clerk-react';
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
import { ToDoItem, Meal, Expense, User, TranslationDictionary } from './types';
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
  const { signOut } = useClerk();
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
  const [navData, setNavData] = useState<{ section?: string } | null>(null);

  // Navigation
  const handleNavigate = (view: string, data?: { section?: string }) => {
    setActiveView(view);
    setNavData(data ?? null);
    // Scroll to top when navigating to a new view
    window.scrollTo(0, 0);
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
  const [todoItems, setTodoItems] = useState<ToDoItem[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [familyNotes, setFamilyNotes] = useState('');

  // Ensure currentUser is always in the users array (for assignee selection)
  useEffect(() => {
    if (currentUser && !users.find(u => u.id === currentUser.id)) {
      setUsers(prev => prev.length > 0 ? prev : [currentUser]);
    }
  }, [currentUser, users]);

  // Supabase Subscriptions
  useEffect(() => {
    if (!currentUser || !currentUser.householdId) return;
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
    const unsubNotes = subscribeToNotes(hid, (note) => setFamilyNotes(note));
    
    return () => {
      unsubUsers();
      unsubTodoItems();
      unsubMeals();
      unsubExpenses();
      unsubNotes();
    };
  }, [currentUser]);

  const hid = currentUser?.householdId ?? '';

  // ToDo CRUD Handlers
  const handleAddTodoItem = async (item: ToDoItem) => {
    if (!hid) return item;
    const newItem = { ...item, id: `todo-${Date.now()}` };
    setTodoItems(prev => [newItem, ...prev]);
    await addItem(hid, 'todo_items', item);
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
    await addItem(hid, 'meals', meal);      // Sync to server in background
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
  const handleAddExpense = async (expense: Expense) => {
    if (!hid) return;
    const tempId = `temp-${Date.now()}`;
    const newExpense = { ...expense, id: tempId };
    setExpenses(prev => [...prev, newExpense]);  // Optimistic
    await addItem(hid, 'expenses', expense);
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
    if (!hid) return;
    setUsers(prev => prev.filter(u => u.id !== id));  // Optimistic
    await deleteItem(hid, 'users', id);
  };

  // Notes Handler
  const handleSaveFamilyNotes = async (notes: string) => {
    if (!hid) return;
    await saveFamilyNotes(hid, notes);
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
            onUpdateNotes={handleSaveFamilyNotes}
            currentUser={currentUser!}
            t={translations}
            currentLang={lang}
            onLanguageChange={setLang}
            isTranslating={isTranslating}
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
            householdId={hid}
            currentUser={currentUser!}
            users={users}
            t={translations}
            currentLang={lang}
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#3EAFD2' }}>
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
