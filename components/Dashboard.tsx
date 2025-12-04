
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
  onUpdateNotes: (notes: string) => void;
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
  const [timeOfDay, setTimeOfDay] = useState('');
  const [showLangModal, setShowLangModal] = useState(false);
  
  // Scroll header animation
  const { isScrolled } = useScrollHeader();
  
  // Lock body scroll when language modal is open
  useScrollLock(showLangModal);

  useEffect(() => {
    setTempNotes(familyNotes);
  }, [familyNotes]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setTimeOfDay(t['dashboard.greeting.morning']);
    else if (hour < 18) setTimeOfDay(t['dashboard.greeting.afternoon']);
    else setTimeOfDay(t['dashboard.greeting.evening']);
  }, [t]);

  const handleSaveNotes = () => {
    onUpdateNotes(tempNotes);
    setIsEditingNotes(false);
  };

  const handleCancelNotes = () => {
    setTempNotes(familyNotes);
    setIsEditingNotes(false);
  };

  const handleDeleteNotes = () => {
    onUpdateNotes('');
    setTempNotes('');
    setIsEditingNotes(false);
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
            <span className="text-xs font-semibold">{adultCount}</span>
          </span>
        )}
        {kidCount > 0 && (
          <span className="flex items-center gap-0.5">
            <Baby size={14} />
            <span className="text-xs font-semibold">{kidCount}</span>
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
        <span className="text-3xl font-bold tracking-tight text-foreground block mb-1">
          {count}
        </span>
        <div>
          <span className="font-semibold text-foreground text-lg block leading-tight">{title}</span>
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
      </div>
    </button>
  );

  return (
    <div className="pb-16 animate-fade-in page-content bg-background">
      {/* Sticky Header */}
      <header 
        className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-5 transition-[padding,box-shadow] duration-300 overflow-hidden"
        style={{ 
          paddingTop: isScrolled ? '12px' : '64px',
          paddingBottom: isScrolled ? '12px' : '16px',
          boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
        }}
      >
        <div className="flex justify-between items-center">
          <div 
            className="transition-transform duration-300 origin-left will-change-transform"
            style={{ transform: isScrolled ? 'scale(0.65)' : 'scale(1)' }}
          >
            <h1 className="text-3xl font-bold text-foreground tracking-tight leading-tight">
              {timeOfDay},<br />
              <span className="text-primary">{currentUser.name.split(' ')[0]}</span>
            </h1>
          </div>
          <div 
            className="flex gap-2 transition-transform duration-300"
            style={{ 
              transform: isScrolled ? 'scale(0.85)' : 'scale(1)'
            }}
          >
            <button
              onClick={() => setShowLangModal(true)}
              className="w-14 h-14 rounded-full bg-card border border-border shadow-sm flex flex-col items-center justify-center text-muted-foreground active:scale-95 transition-transform"
            >
              {isTranslating ? (
                <Loader2 size={18} className="animate-spin text-primary" />
              ) : (
                <Languages size={18} />
              )}
              <span className="text-[14px] font-medium text-primary mt-0.5">
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
              className="relative group"
            >
              <div className="absolute inset-0 bg-primary blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
              <img
                src={currentUser.avatar}
                alt="Profile"
                className="w-14 h-14 rounded-full border-4 border-card shadow-sm bg-muted object-cover relative z-10 active:scale-95 transition-transform"
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
              <span className="font-bold text-lg text-white">{t['dashboard.family_board']}</span>
            </div>
            {isEditingNotes ? (
              <div className="flex gap-2 animate-fade-in">
                <button onClick={handleCancelNotes} className="p-1.5 bg-white/20 rounded-full text-white shadow-sm hover:bg-white/30 transition-colors">
                  <X size={14} />
                </button>
                <button onClick={handleSaveNotes} className="p-1.5 bg-white rounded-full text-primary shadow-sm hover:bg-white/90 transition-colors">
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingNotes(true)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
          {isEditingNotes ? (
            <div className="space-y-2">
              <textarea
                value={tempNotes}
                onChange={(e) => setTempNotes(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm font-medium text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/50 focus:border-transparent outline-none resize-none leading-relaxed"
                rows={3}
                placeholder={t['dashboard.type_note']}
              />
              <div className="flex justify-end">
                <button 
                  onClick={handleDeleteNotes} 
                  className="p-1.5 bg-white rounded-full text-[#F06292] shadow-sm hover:bg-white/90 transition-colors animate-fade-in"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div onClick={() => setIsEditingNotes(true)} className="min-h-[40px] cursor-pointer">
              {familyNotes ? (
                <p className="text-white text-sm font-medium leading-relaxed whitespace-pre-line">
                  {familyNotes}
                </p>
              ) : (
                <div className="flex items-center gap-2 py-1 text-white/70">
                  <span className="text-sm font-medium">{t['dashboard.tap_to_pin']}</span>
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
          <h2 className="text-lg font-bold text-white">Today's Menu</h2>
          <span className="text-sm font-bold text-white">
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
                          <span className="text-sm text-muted-foreground mb-0.5 block">
                            {t[`meal.type.${meal.type.toLowerCase()}`] ?? meal.type}
                          </span>
                          {renderAudienceIcons(meal.forUserIds)}
                        </div>
                        {meal.description ? (
                          <p className="text-base font-bold text-foreground leading-tight line-clamp-2">
                            {meal.description}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground leading-tight">
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
              <p className="text-sm text-muted-foreground">No meals remaining for today</p>
              <button className="text-sm font-bold text-primary flex items-center gap-1 hover:underline">
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
            <span className="text-sm font-bold text-muted-foreground align-top">$</span>
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
          <p className="text-[#D1D5DB] dark:text-[#4B5563] text-xs font-medium mt-2 leading-relaxed">
            "I just want you to know<br />I'm real grateful you're here"
          </p>
          <p className="text-[#D1D5DB] dark:text-[#4B5563] text-[10px] mt-1 font-medium">
            Aibileen Clark, The Help
          </p>
        </div>
      </div>

      {/* Language Sheet */}
      {showLangModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Click outside to close */}
          <div 
            className="absolute inset-0"
            onClick={() => setShowLangModal(false)}
          />
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div 
            className="relative w-full max-w-lg bg-card rounded-t-3xl bottom-sheet-content flex flex-col" 
            style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-border">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">{t['dashboard.language']}</h3>
                <button
                  onClick={() => setShowLangModal(false)}
                  className="p-2 bg-muted rounded-full text-muted-foreground hover:bg-muted/80"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Translation provided by AI. For accuracy, please refer to the original language version if in doubt.
              </p>
            </div>
            
            {/* Language List */}
            <div className="px-5 pt-5 pb-8 space-y-2 overflow-y-auto no-scrollbar">
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
                    className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${
                      currentLang === lang.code
                        ? 'bg-primary text-primary-foreground font-bold shadow-md'
                        : 'bg-muted text-foreground font-medium hover:bg-muted/80'
                    }`}
                  >
                    <span className="text-sm">{getDisplayName(lang.code)}</span>
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

