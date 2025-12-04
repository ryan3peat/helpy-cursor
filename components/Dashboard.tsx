
import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  ClipboardList,
  DollarSign,
  Pencil,
  Check,
  X,
  Pin,
  Loader2,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Baby,
  User as UserIcon,
  Plus,
  Languages,
  Trash2
} from 'lucide-react';
import { ToDoItem, Meal, User, MealType, TranslationDictionary, UserRole, Expense } from '../types';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { useScrollLock } from '../hooks/useScrollLock';
import { SUPPORTED_LANGUAGES } from '../constants';

interface DashboardProps {
  todoItems: ToDoItem[];
  meals: Meal[];
  users: User[];
  expenses: Expense[];
  onNavigate: (view: string, data?: { section?: string }) => void;
  familyNotes: string;
  onUpdateNotes: (notes: string) => Promise<void>;
  currentUser: User;
  t: TranslationDictionary;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
  isTranslating: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
  todoItems,
  meals,
  users,
  expenses,
  onNavigate,
  familyNotes,
  onUpdateNotes,
  currentUser,
  t,
  currentLang,
  onLanguageChange,
  isTranslating
}) => {
  const shoppingCount = todoItems.filter(i => i.type === 'shopping' && !i.completed).length;
  const activeTaskCount = todoItems.filter(i => i.type === 'task' && !i.completed).length;
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(familyNotes);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState('');
  const [showLangModal, setShowLangModal] = useState(false);
  
  // Scroll header animation
  const { isScrolled } = useScrollHeader();
  
  // Lock body scroll when language modal is open
  useScrollLock(showLangModal);

  // Only sync tempNotes with familyNotes when NOT editing (prevents overwriting user input)
  useEffect(() => {
    if (!isEditingNotes) {
      setTempNotes(familyNotes);
    }
  }, [familyNotes, isEditingNotes]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setTimeOfDay(t['dashboard.greeting.morning']);
    else if (hour < 18) setTimeOfDay(t['dashboard.greeting.afternoon']);
    else setTimeOfDay(t['dashboard.greeting.evening']);
  }, [t]);

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await onUpdateNotes(tempNotes);
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCancelNotes = () => {
    setTempNotes(familyNotes);
    setIsEditingNotes(false);
  };

  const handleDeleteNotes = async () => {
    setIsSavingNotes(true);
    try {
      await onUpdateNotes('');
      setTempNotes('');
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Failed to delete notes:', error);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // --- Meal Logic ---
  const getTodayDateKey = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = getTodayDateKey();

  const getTodaysRemainingMeals = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const todays = meals.filter(m => m.date === todayStr);
    const remaining = todays.filter(m => {
      if (m.type === MealType.BREAKFAST && currentHour >= 11) return false;
      if (m.type === MealType.LUNCH && currentHour >= 15) return false;
      return true;
    });
    const order = { [MealType.BREAKFAST]: 1, [MealType.LUNCH]: 2, [MealType.DINNER]: 3, [MealType.SNACKS]: 4 };
    return remaining.sort((a, b) => (order[a.type] ?? 0) - (order[b.type] ?? 0));
  };
  const todaysMenu = getTodaysRemainingMeals();

  // Render audience icons with counts
  const renderAudienceIcons = (forUserIds: string[]) => {
    const eaters = users.filter(u => forUserIds.includes(u.id));
    const adultCount = eaters.filter(u => u.role !== UserRole.CHILD).length;
    const kidCount = eaters.filter(u => u.role === UserRole.CHILD).length;

    return (
      <span className="flex items-center gap-2 text-muted-foreground">
        {adultCount > 0 && (
          <span className="flex items-center gap-0.5">
            <UserIcon size={14} />
            <span className="text-caption">{adultCount}</span>
          </span>
        )}
        {kidCount > 0 && (
          <span className="flex items-center gap-0.5">
            <Baby size={14} />
            <span className="text-caption">{kidCount}</span>
          </span>
        )}
      </span>
    );
  };

  const getMealTypeIcon = (type: MealType) => {
    switch (type) {
      case MealType.BREAKFAST: return <Coffee size={16} />;
      case MealType.LUNCH: return <Sun size={16} />;
      case MealType.DINNER: return <Moon size={16} />;
      case MealType.SNACKS: return <Cookie size={16} />;
    }
  };

  const getMealTypeColor = (type: MealType) => {
    switch (type) {
      case MealType.BREAKFAST: return 'text-[#FF9800]';
      case MealType.LUNCH: return 'text-[#4CAF50]';
      case MealType.DINNER: return 'text-[#7E57C2]';
      case MealType.SNACKS: return 'text-[#F06292]';
    }
  };

  // ✅ Calculate current month's expenses
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const totalExpenses = expenses
    .filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const StatCard = ({ title, count, icon: Icon, colorClass, onClick, label }: any) => (
    <button
      onClick={onClick}
      className="relative w-full p-4 rounded-2xl transition-all duration-200 active:scale-95 flex flex-col h-32 text-left bg-card shadow-sm border border-border hover:border-foreground/20 hover:shadow-md group"
    >
      <div className="absolute top-4 right-4 opacity-80 group-hover:opacity-100 transition-opacity">
        <Icon size={18} className={colorClass} />
      </div>
      <div className="mt-auto">
        <span className="text-display text-foreground block mb-1">
          {count}
        </span>
        <div>
          <span className="text-title text-foreground block leading-tight">{title}</span>
          <span className="text-caption text-muted-foreground">{label}</span>
        </div>
      </div>
    </button>
  );

  return (
    <div className="pb-16 animate-fade-in page-content bg-background">
      {/* Sticky Header - Push Up (No Shrink) */}
      <header 
        className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 pt-12 pb-3 transition-shadow duration-200"
        style={{ 
          boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
        }}
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-display text-foreground">
              {timeOfDay},<br />
              <span className="text-primary">{currentUser.name.split(' ')[0]}</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLangModal(true)}
              className="w-14 h-14 rounded-full bg-card border border-border shadow-sm flex flex-col items-center justify-center text-muted-foreground"
            >
              {isTranslating ? (
                <Loader2 size={18} className="animate-spin text-primary" />
              ) : (
                <Languages size={18} />
              )}
              <span className="text-caption text-primary mt-0.5">
                {(() => {
                  switch(currentLang) {
                    case 'en': return 'en';
                    case 'zh-CN': return '简中';
                    case 'zh-TW': return '繁中';
                    case 'tl': return 'tl';
                    case 'id': return 'id';
                    case 'ko': return '한국';
                    case 'ja': return '日本';
                    default: return currentLang.split('-')[0];
                  }
                })()}
              </span>
            </button>
            <button
              id="onboarding-profile-btn"
              onClick={() => onNavigate('profile')}
              className="relative"
            >
              <img
                src={currentUser.avatar}
                alt="Profile"
                className="w-14 h-14 rounded-full border-4 border-card shadow-sm bg-muted object-cover"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-5 space-y-5">

      {/* Family Notes */}
      <div className="relative group">
        <div className="relative bg-primary p-5 rounded-2xl shadow-sm border border-border transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="text-white">
                <Pin size={18} />
              </div>
              <span className="text-title text-white">{t['dashboard.family_board']}</span>
            </div>
            {!isEditingNotes && (
              <button
                onClick={() => setIsEditingNotes(true)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
          {isEditingNotes ? (
            <div className="space-y-3">
              <textarea
                value={tempNotes}
                onChange={(e) => setTempNotes(e.target.value)}
                disabled={isSavingNotes}
                className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-body text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/50 focus:border-transparent outline-none resize-none leading-relaxed disabled:opacity-50"
                rows={3}
                placeholder={t['dashboard.type_note']}
              />
              <div className="flex justify-between items-center">
                <button 
                  onClick={handleDeleteNotes}
                  disabled={isSavingNotes}
                  className="p-2.5 bg-[#F06292] rounded-full text-white shadow-sm hover:bg-[#EC407A] transition-colors disabled:opacity-50"
                >
                  {isSavingNotes ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                </button>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleCancelNotes}
                    disabled={isSavingNotes}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-white text-body font-medium shadow-sm hover:bg-white/30 transition-colors disabled:opacity-50"
                  >
                    <X size={16} />
                    <span>Cancel</span>
                  </button>
                  <button 
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-full text-primary text-body font-medium shadow-sm hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    <span>Save</span>
                    {isSavingNotes ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div onClick={() => setIsEditingNotes(true)} className="min-h-[40px] cursor-pointer">
              {familyNotes ? (
                <p className="text-white text-body leading-relaxed whitespace-pre-line">
                  {familyNotes}
                </p>
              ) : (
                <div className="flex items-center gap-2 py-1 text-white/70">
                  <span className="text-body">{t['dashboard.tap_to_pin']}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Today's Menu */}
      <div
        onClick={() => onNavigate('meals')}
        className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden cursor-pointer active:scale-[0.99] transition-transform hover:shadow-md"
      >
        <div className="bg-primary px-4 py-2.5 flex justify-between items-center">
          <h2 className="text-title text-white">Today's Menu</h2>
          <span className="text-body text-white">
            {(() => {
              const d = new Date();
              const locale = currentLang === 'en' ? 'en-GB' : currentLang;
              const weekday = d.toLocaleDateString(locale, { weekday: 'short' });
              const day = d.getDate();
              const month = d.toLocaleDateString(locale, { month: 'short' });
              return `${weekday}, ${day} ${month}`;
            })()}
          </span>
        </div>
        <div className="p-4">
          {todaysMenu.length > 0 ? (
            <div className="space-y-4">
              {todaysMenu.map((meal, idx) => {
                return (
                  <div key={meal.id} className="relative">
                    {idx > 0 && <div className="absolute -top-2 left-8 right-0 border-t border-border"></div>}
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${getMealTypeColor(meal.type)}`}>
                        {getMealTypeIcon(meal.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <span className="text-body text-muted-foreground mb-0.5 block">
                            {t[`meal.type.${meal.type.toLowerCase()}`] ?? meal.type}
                          </span>
                          {renderAudienceIcons(meal.forUserIds)}
                        </div>
                        {meal.description ? (
                          <p className="text-title text-foreground leading-tight line-clamp-2">
                            {meal.description}
                          </p>
                        ) : (
                          <p className="text-body text-muted-foreground leading-tight">
                            {t['meals.hungry_no_menu'] ?? "Someone's hungry, menu unknown..."}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-2 flex flex-col items-center gap-2">
              <p className="text-body text-muted-foreground">No meals remaining for today</p>
              <button className="text-body text-primary flex items-center gap-1 hover:underline">
                <Plus size={12} /> Plan Meal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-5">
        <StatCard
          title={t['dashboard.shopping']}
          count={shoppingCount}
          icon={ShoppingCart}
          label={t['dashboard.todo']}
          colorClass="text-primary"
          onClick={() => onNavigate('todo', { section: 'shopping' })}
        />
        <StatCard
          title={t['dashboard.tasks']}
          count={activeTaskCount}
          icon={ClipboardList}
          label={t['dashboard.todo']}
          colorClass="text-primary"
          onClick={() => onNavigate('todo', { section: 'task' })}
        />
      </div>

      {/* Expenses */}
      <StatCard
        title={t['dashboard.expenses']}
        count={
          <div className="flex items-baseline gap-0.5">
            <span className="text-body text-muted-foreground align-top">$</span>
            <span>{totalExpenses.toFixed(2)}</span>
          </div>
        }
        icon={DollarSign}
        label={(() => {
          const d = new Date();
          const locale = currentLang === 'en' ? 'en-GB' : currentLang;
          const month = d.toLocaleDateString(locale, { month: 'short' });
          const year = d.getFullYear();
          return `${month} ${year}`;
        })()}
        colorClass="text-primary"
        onClick={() => onNavigate('expenses')}
      />

      {/* Footer */}
        <div className="helpy-footer">
          <span className="helpy-logo">helpy</span>
          <p className="text-[#D1D5DB] dark:text-[#4B5563] text-caption mt-2 leading-relaxed">
            "I just want you to know<br />I'm real grateful you're here"
          </p>
          <p className="text-[#D1D5DB] dark:text-[#4B5563] text-micro mt-1">
            Aibileen Clark, The Help
          </p>
          
          {/* Dark Mode Test Toggle */}
          <button
            onClick={() => {
              const html = document.documentElement;
              const isDark = html.classList.contains('dark');
              if (isDark) {
                html.classList.remove('dark');
                html.classList.add('light');
                localStorage.setItem('helpy_theme', 'light');
              } else {
                html.classList.remove('light');
                html.classList.add('dark');
                localStorage.setItem('helpy_theme', 'dark');
              }
            }}
            className="mt-4 px-4 py-2 rounded-full bg-muted text-muted-foreground text-caption flex items-center gap-2 mx-auto hover:bg-muted/80 transition-colors"
          >
            <Sun size={14} className="dark:hidden" />
            <Moon size={14} className="hidden dark:block" />
            <span className="dark:hidden">Dark Mode (BETA)</span>
            <span className="hidden dark:block">Light Mode</span>
          </button>
        </div>
      </div>

      {/* Language Sheet */}
      {showLangModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div 
            className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" 
            style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowLangModal(false)}
              className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors right-4 top-4 text-muted-foreground"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
              <h2 className="text-title text-foreground text-center">{t['dashboard.language']}</h2>
              <p className="text-caption text-muted-foreground text-center mt-2">
                Translation provided by AI. For accuracy, please refer to the original language version if in doubt.
              </p>
            </div>
            
            {/* Language List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {SUPPORTED_LANGUAGES.map(lang => {
                // Display names in native language with code - UI only, doesn't affect backend
                const getDisplayName = (code: string) => {
                  switch(code) {
                    case 'en': return 'English (en)';
                    case 'zh-CN': return '简体中文 (zh-CN)';
                    case 'zh-TW': return '繁體中文 (zh-TW)';
                    case 'tl': return 'Tagalog (tl)';
                    case 'id': return 'Bahasa Indonesia (id)';
                    case 'ko': return '한국어 (ko)';
                    case 'ja': return '日本語 (ja)';
                    default: return lang.name;
                  }
                };
                
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      onLanguageChange(lang.code);
                      setShowLangModal(false);
                    }}
                    className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${
                      currentLang === lang.code
                        ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                        : 'bg-secondary text-foreground font-medium hover:bg-secondary/80'
                    }`}
                  >
                    <span className="text-body">{getDisplayName(lang.code)}</span>
                    {currentLang === lang.code && <Check size={18} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
  </div>
  );
  };

  export default Dashboard;

