import React, { useState, useEffect } from 'react';
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
  
  // --- Localization State ---
  const [lang, setLang] = useState<string>(() => localStorage.getItem('helpy_lang') || 'en');
  const [translations, setTranslations] = useState<TranslationDictionary>(BASE_TRANSLATIONS);
  const [isTranslating, setIsTranslating] = useState(false);

  // --- Invite Logic ---
  const [inviteParams, setInviteParams] = useState<{hid: string, uid: string} | null>(null);

  // --- Authentication State ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('helpy_current_session_user');
    return saved ? JSON.parse(saved) : null;
  });

  // --- Onboarding State ---
  const [onboardingStep, setOnboardingStep] = useState<number>(() => {
    const saved = localStorage.getItem('helpy_onboarding_step');
    return saved ? parseInt(saved) : 0;
  });

  useEffect(() => {
    localStorage.setItem('helpy_onboarding_step', onboardingStep.toString());
  }, [onboardingStep]);

  // --- Translation Effect ---
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
            console.error("Failed to load translations", e);
            setTranslations(BASE_TRANSLATIONS);
        } finally {
            setIsTranslating(false);
        }
    };
    loadTranslations();
    localStorage.setItem('helpy_lang', lang);
  }, [lang]);

  // --- Check URL for Invite ---
  useEffect(() => {
    const checkInvite = () => {
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
  }, []);

  // --- Global Data State ---
  const [users, setUsers] = useState<User[]>([]);
  const [householdSections, setHouseholdSections] = useState<Section[]>([]);
  const [familyNotes, setFamilyNotes] = useState('');
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // --- Supabase Subscriptions (Scoped by Household) ---
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

  // --- CRUD Handlers ---
  const hid = currentUser?.householdId || '';

  const handleAddUser = async (user: Omit<User, 'id'>) => {
    if(hid) {
        const newItem = await addItem(hid, 'users', user);
        return newItem as User;
    }
    return undefined;
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

  const handleAddTask = async (task: Task) => {
    if (!hid) return;
    try {
      await addItem(hid, 'tasks', task);
    } catch (error) {
      console.error('❌ Failed to add task:', error);
    }
  };

  const handleUpdateTask = async (id: string, data: Partial<Task>) => {
    if (!hid) return;
    try {
      await updateItem(hid, 'tasks', id, data);
    } catch (error) {
      console.error('❌ Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!hid) return;
    try {
      await deleteItem(hid, 'tasks', id);
    } catch (error) {
      console.error('❌ Failed to delete task:', error);
    }
  };

  const handleAddItem = async (item: ShoppingItem): Promise<void> => {
    if (!hid) {
      throw new Error('No household ID');
    }
    
    try {
      console.log('🟢 Adding shopping item:', item);
      
      // Remove id - let Supabase generate UUID
      const { id, ...itemWithoutId } = item;
      
      await addItem(hid, 'shopping', itemWithoutId as any);
      console.log('✅ Shopping item saved');
    } catch (error) {
      console.error('❌ Failed to add shopping item:', error);
      throw error; // Re-throw so ShoppingList can handle rollback
    }
  };

  const handleUpdateItem = async (id: string, data: Partial<ShoppingItem>) => {
    if (!hid) return;
    try {
      await updateItem(hid, 'shopping', id, data);
    } catch (error) {
      console.error('❌ Failed to update shopping item:', error);
    }
  };

  const handleDeleteItem = async (id: string): Promise<void> => {
    if (!hid) throw new Error('No household ID');
    try {
      await deleteItem(hid, 'shopping', id);
    } catch (error) {
      console.error('❌ Failed to delete shopping item:', error);
      throw error;
    }
  };

  const handleAddMeal = async (meal: Meal) => {
    if (!hid) return;
    try {
      await addItem(hid, 'meals', meal);
    } catch (error) {
      console.error('❌ Failed to add meal:', error);
    }
  };

  const handleUpdateMeal = async (id: string, data: Partial<Meal>) => {
    if (!hid) return;
    try {
      await updateItem(hid, 'meals', id, data);
    } catch (error) {
      console.error('❌ Failed to update meal:', error);
    }
  };

  const handleDeleteMeal = async (id: string) => {
    if (!hid) return;
    try {
      await deleteItem(hid, 'meals', id);
    } catch (error) {
      console.error('❌ Failed to delete meal:', error);
    }
  };

  const handleAddExpense = async (expense: Expense) => {
    if (!hid) return;
    try {
      await addItem(hid, 'expenses', expense);
    } catch (error) {
      console.error('❌ Failed to add expense:', error);
    }
  };

  const handleAddSection = async (section: Section) => {
    if (!hid) return;
    try {
      await addItem(hid, 'sections', section);
    } catch (error) {
      console.error('❌ Failed to add section:', error);
    }
  };

  const handleUpdateSection = async (id: string, data: Partial<Section>) => {
    if (!hid) return;
    try {
      await updateItem(hid, 'sections', id, data);
    } catch (error) {
      console.error('❌ Failed to update section:', error);
    }
  };

  const handleDeleteSection = async (id: string) => {
    if (!hid) return;
    try {
      await deleteItem(hid, 'sections', id);
    } catch (error) {
      console.error('❌ Failed to delete section:', error);
    }
  };

  const handleUpdateNotes = async (notes: string) => {
    if (!hid) return;
    try {
      await saveFamilyNotes(hid, notes);
    } catch (error) {
      console.error('❌ Failed to save notes:', error);
    }
  };

  // --- Auth Handlers ---
  
  const handleLogin = (user: User) => {
      setCurrentUser(user);
      localStorage.setItem('helpy_current_session_user', JSON.stringify(user));
      setShowIntro(false);
      setActiveView('dashboard');
      
      if (inviteParams) {
         const newUrl = window.location.href.split('#')[0].split('?')[0];
         window.history.replaceState({}, document.title, newUrl);
         setInviteParams(null);
      }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('helpy_current_session_user');
    setActiveView('dashboard');
    setUsers([]);
    setShowIntro(true);
  };

  // --- Navigation ---

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
            onUpdateNotes={handleUpdateNotes}
            currentUser={currentUser}
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
                onAdd={handleAddItem}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
                t={translations}
                currentLang={lang}
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
                t={translations}
                currentLang={lang}
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
                t={translations}
                currentLang={lang}
            />
        );
      case 'expenses':
        return (
            <Expenses 
                expenses={expenses} 
                householdId={hid}
                onAdd={handleAddExpense}
                t={translations}
                currentLang={lang}
            />
        );
      case 'info':
        return (
            <HouseholdInfo 
                sections={householdSections} 
                onAdd={handleAddSection}
                onUpdate={handleUpdateSection}
                onDelete={handleDeleteSection}
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

  // 1. Special View: Invite Setup
  if (inviteParams && !currentUser) {
      return (
          <InviteSetup 
            householdId={inviteParams.hid} 
            userId={inviteParams.uid} 
            onComplete={handleLogin} 
          />
      );
  }

  // 2. Auth View - Only passes onLogin now
  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  // 3. Main App View
  return (
    <>
      {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}
      
      {onboardingStep > 0 && (
        <OnboardingOverlay 
            step={onboardingStep} 
            userName={currentUser.name?.split(' ')[0] || 'User'}
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