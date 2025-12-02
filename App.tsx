import React, { useState, useEffect } from 'react';
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
  const [showIntro, setShowIntro] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');

  // Localization
  const [lang, setLang] = useState<string>(() => localStorage.getItem('helpy_lang') || 'en');
  const [translations, setTranslations] = useState<TranslationDictionary>(BASE_TRANSLATIONS);
  const [isTranslating, setIsTranslating] = useState(false);

  // Authentication
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('helpy_current_session_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Onboarding
  const [onboardingStep, setOnboardingStep] = useState<number>(() => {
    const saved = localStorage.getItem('helpy_onboarding_step');
    return saved ? parseInt(saved) : 0;
  });

  useEffect(() => {
    localStorage.setItem('helpy_onboarding_step', onboardingStep.toString());
  }, [onboardingStep]);

  const advanceOnboarding = () => setOnboardingStep(step => step + 1);
  const skipOnboarding = () => setOnboardingStep(0);

  // Household data
  const hid = currentUser?.householdId || '';

  const [users, setUsers] = useState<User[]>([]);
  const [todoItems, setTodoItems] = useState<ToDoItem[]>([]);
  
  // Ensure currentUser is always in the users array (for assignee selection)
  useEffect(() => {
    if (currentUser && !users.find(u => u.id === currentUser.id)) {
      setUsers(prev => prev.length > 0 ? prev : [currentUser]);
    }
  }, [currentUser, users]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [familyNotes, setFamilyNotes] = useState('');

  // Supabase subscriptions
  useEffect(() => {
    if (!hid) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(subscribeToCollection(hid, 'users', (data) => setUsers(data as User[])));
    unsubs.push(subscribeToCollection(hid, 'todo_items', (data) => setTodoItems(data as ToDoItem[])));
    unsubs.push(subscribeToCollection(hid, 'meals', (data) => {
      // Keep mock data if Supabase returns empty
      if (data && data.length > 0) {
        setMeals(data as Meal[]);
      }
    }));
    unsubs.push(subscribeToCollection(hid, 'expenses', (data) => setExpenses(data as Expense[])));
    unsubs.push(subscribeToNotes(hid, setFamilyNotes));

    return () => unsubs.forEach((u) => u());
  }, [hid]);

  // Navigation
  const handleNavigate = (view: string) => setActiveView(view);

  // CRUD Handlers for ToDo items (local state)
  const handleAddTodoItem = async (item: ToDoItem) => {
    const newItem = { ...item, id: `todo-${Date.now()}` };
    setTodoItems(prev => [newItem, ...prev]);
    return newItem;
  };
  
  const handleUpdateTodoItem = async (id: string, data: Partial<ToDoItem>) => {
    setTodoItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...data } : item
    ));
  };
  
  const handleDeleteTodoItem = async (id: string) => {
    setTodoItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddMeal = async (meal: Meal) => addItem(hid, 'meals', meal);
  const handleUpdateMeal = (id: string, data: Partial<Meal>) => updateItem(hid, 'meals', id, data);
  const handleDeleteMeal = (id: string) => deleteItem(hid, 'meals', id);

  const handleAddExpense = async (expense: Expense) => addItem(hid, 'expenses', expense);

  const handleUpdateNotes = (notes: string) => saveFamilyNotes(hid, notes);

  // Authentication
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('helpy_current_session_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('helpy_current_session_user');
  };

  // View Selection
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
            onUpdateNotes={handleUpdateNotes}
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
            onAdd={handleAddExpense}
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
            onAdd={() => {}}
            onUpdate={() => {}}
            onDelete={() => {}}
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

  // Login first
  if (!currentUser) return <Auth onLogin={handleLogin} />;

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
