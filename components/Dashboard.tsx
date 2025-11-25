
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Calendar, DollarSign, Utensils, FileText, ChevronRight, Pencil, Check, X, Pin, ArrowRight, TrendingUp, Globe, Loader2, Coffee, Sun, Moon, Users, Baby, User as UserIcon, Plus } from 'lucide-react';
import { ShoppingItem, Task, Meal, User, MealType, TranslationDictionary, UserRole } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';

interface DashboardProps {
  shoppingItems: ShoppingItem[];
  tasks: Task[];
  meals: Meal[];
  users: User[];
  onNavigate: (view: string) => void;
  familyNotes: string;
  onUpdateNotes: (notes: string) => void;
  currentUser: User;
  t: TranslationDictionary;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
  isTranslating: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  shoppingItems, tasks, meals, users, onNavigate, 
  familyNotes, onUpdateNotes, currentUser, 
  t, currentLang, onLanguageChange, isTranslating 
}) => {
  const shoppingCount = shoppingItems.filter(i => !i.completed).length;
  const activeTaskCount = tasks.filter(t => !t.completed).length;

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(familyNotes);
  const [timeOfDay, setTimeOfDay] = useState('');
  const [showLangModal, setShowLangModal] = useState(false);

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

  // --- Meal Logic for Widgets ---

  const getTodayDateKey = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  };
  const todayStr = getTodayDateKey();

  const getUpcomingMeal = () => {
    const upcoming = meals.filter(m => m.date >= todayStr);
    
    upcoming.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const order = { [MealType.BREAKFAST]: 1, [MealType.LUNCH]: 2, [MealType.DINNER]: 3 };
        return (order[a.type] || 0) - (order[b.type] || 0);
    });
    
    return upcoming[0];
  };
  const nextMeal = getUpcomingMeal();
  const nextMealLabel = nextMeal ? (t[`meal.type.${nextMeal.type.toLowerCase()}`] || nextMeal.type) : '';

  // --- New "Today's Menu" Widget Logic ---
  
  const getTodaysRemainingMeals = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // 1. Filter for Today using the fixed key
    const todays = meals.filter(m => m.date === todayStr);

    // 2. Filter by Time logic
    const remaining = todays.filter(m => {
        if (m.type === MealType.BREAKFAST && currentHour >= 11) return false;
        if (m.type === MealType.LUNCH && currentHour >= 15) return false;
        return true;
    });

    // 3. Sort
    const order = { [MealType.BREAKFAST]: 1, [MealType.LUNCH]: 2, [MealType.DINNER]: 3 };
    return remaining.sort((a, b) => (order[a.type] || 0) - (order[b.type] || 0));
  };

  const todaysMenu = getTodaysRemainingMeals();

  // Helper to determine who is eating
  const getAudienceInfo = (userIds: string[]) => {
      const eaters = users.filter(u => userIds.includes(u.id));
      const totalUsers = users.length;
      
      if (eaters.length === totalUsers) return { label: t['dashboard.everyone'] || 'Everyone', icon: Users, color: 'bg-blue-100 text-blue-600' };
      
      const hasAdults = eaters.some(u => u.role !== UserRole.CHILD);
      const hasKids = eaters.some(u => u.role === UserRole.CHILD);

      if (hasAdults && !hasKids) return { label: t['meals.group_adults'] || 'Adults', icon: UserIcon, color: 'bg-purple-100 text-purple-600' };
      if (!hasAdults && hasKids) return { label: t['meals.group_kids'] || 'Kids', icon: Baby, color: 'bg-green-100 text-green-600' };
      
      return { label: 'Mixed', icon: Users, color: 'bg-gray-100 text-gray-600' };
  };

  const getMealTypeIcon = (type: MealType) => {
     switch(type) {
        case MealType.BREAKFAST: return <Coffee size={16} />;
        case MealType.LUNCH: return <Sun size={16} />;
        case MealType.DINNER: return <Moon size={16} />;
     }
  };

  const getMealTypeColor = (type: MealType) => {
     switch(type) {
        case MealType.BREAKFAST: return 'text-orange-500';
        case MealType.LUNCH: return 'text-amber-500';
        case MealType.DINNER: return 'text-indigo-500';
     }
  };

  // --- Components ---

  const StatCard = ({ title, count, icon: Icon, colorClass, onClick, label }: any) => (
    <button 
      onClick={onClick}
      className="relative p-4 rounded-2xl transition-all duration-200 active:scale-95 flex flex-col h-32 text-left bg-white shadow-sm border border-gray-100 hover:border-gray-200 hover:shadow-md group"
    >
      <div className="absolute top-4 right-4 opacity-80 group-hover:opacity-100 transition-opacity">
         <Icon size={18} className={colorClass} /> 
      </div>

      <div className="mt-auto">
        <span className="text-3xl font-bold tracking-tight text-gray-900 block mb-1">
          {count}
        </span>
        <div>
            <span className="font-semibold text-gray-700 text-sm block leading-tight">{title}</span>
            <span className="text-[10px] font-medium text-gray-400">{label}</span>
        </div>
      </div>
    </button>
  );

  return (
    <div className="px-5 pt-16 pb-32 space-y-6 animate-fade-in h-full overflow-y-auto no-scrollbar">
      
      {/* 1. Header Section */}
      <div className="flex justify-between items-end mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className="text-[10px] font-bold text-gray-400">
                {new Date().toLocaleDateString(currentLang === 'en' ? 'en-GB' : currentLang, { weekday: 'short', day: 'numeric', month: 'short' })}
             </span>
          </div>
          <h1 className="text-3xl font-bold text-brand-text tracking-tight leading-tight">
            {timeOfDay},<br/>
            <span className="text-brand-primary">{currentUser.name.split(' ')[0]}</span>
          </h1>
        </div>
        
        <div className="flex gap-2">
          {/* Language Switcher */}
          <button 
            onClick={() => setShowLangModal(true)}
            className="w-14 h-14 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform relative"
          >
             {isTranslating ? (
               <Loader2 size={24} className="animate-spin text-brand-primary" />
             ) : (
               <Globe size={24} />
             )}
             <span className="absolute -bottom-1 text-[8px] font-bold bg-gray-100 px-1.5 rounded-full text-gray-500">
                {currentLang.split('-')[0]}
             </span>
          </button>

          <button 
            id="onboarding-profile-btn"
            onClick={() => onNavigate('profile')} 
            className="relative group"
          >
            <div className="absolute inset-0 bg-brand-primary blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
            <img 
              src={currentUser.avatar} 
              alt="Profile" 
              className="w-14 h-14 rounded-full border-4 border-white shadow-sm bg-gray-200 object-cover relative z-10 active:scale-95 transition-transform"
            />
          </button>
        </div>
      </div>

      {/* 2. Family Notes (Clean White Style) */}
      <div className="relative group">
        <div className="relative bg-white border border-gray-100 p-5 rounded-2xl shadow-sm transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="text-amber-500">
                 <FileText size={18} />
              </div>
              <span className="font-bold text-xs text-gray-400">{t['dashboard.family_board']}</span>
            </div>
            
            {isEditingNotes ? (
              <div className="flex gap-2 animate-fade-in">
                <button onClick={handleCancelNotes} className="p-1.5 bg-gray-50 rounded-full text-gray-400 shadow-sm hover:text-red-500 transition-colors">
                  <X size={14} />
                </button>
                <button onClick={handleSaveNotes} className="p-1.5 bg-brand-primary rounded-full text-white shadow-sm hover:bg-brand-secondary transition-colors">
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditingNotes(true)} 
                className="p-1.5 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-full transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
          
          {isEditingNotes ? (
            <textarea 
              value={tempNotes}
              onChange={(e) => setTempNotes(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none resize-none shadow-inner leading-relaxed"
              rows={3}
              autoFocus
              placeholder={t['dashboard.type_note']}
            />
          ) : (
            <div 
                onClick={() => setIsEditingNotes(true)}
                className="min-h-[40px] cursor-pointer"
            >
                {familyNotes ? (
                   <p className="text-gray-700 text-sm font-medium leading-relaxed whitespace-pre-line">
                      {familyNotes}
                   </p>
                ) : (
                   <div className="flex items-center gap-2 py-1 text-gray-300">
                      <Pin size={16} />
                      <span className="text-xs font-medium">{t['dashboard.tap_to_pin']}</span>
                   </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* 2.5 Today's Menu Widget (Full Width) */}
      <div 
        onClick={() => onNavigate('meals')}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-[0.99] transition-transform hover:shadow-md"
      >
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xs font-bold text-gray-500">Today's Menu</h2>
              <span className="text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">
                 {new Date().toLocaleDateString(currentLang === 'en' ? 'en-GB' : currentLang, {weekday:'short', day:'numeric', month: 'short'})}
              </span>
          </div>
          <div className="p-4">
              {todaysMenu.length > 0 ? (
                <div className="space-y-4">
                  {todaysMenu.map((meal, idx) => {
                      const audience = getAudienceInfo(meal.forUserIds);
                      const AudienceIcon = audience.icon;

                      return (
                          <div key={meal.id} className="relative">
                              {/* Separator if not first item */}
                              {idx > 0 && <div className="absolute -top-2 left-8 right-0 border-t border-dashed border-gray-100"></div>}
                              
                              <div className="flex items-start gap-3">
                                  <div className={`mt-0.5 ${getMealTypeColor(meal.type)}`}>
                                      {getMealTypeIcon(meal.type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start">
                                          <span className="text-xs font-bold text-gray-400 mb-0.5 block">
                                              {t[`meal.type.${meal.type.toLowerCase()}`] || meal.type}
                                          </span>
                                          {/* Audience Badge */}
                                          <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${audience.color}`}>
                                              <AudienceIcon size={10} />
                                              <span>{audience.label}</span>
                                          </div>
                                      </div>
                                      <p className="text-sm font-bold text-gray-800 leading-tight line-clamp-2">
                                          {meal.description}
                                      </p>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
                </div>
              ) : (
                <div className="text-center py-2 flex flex-col items-center gap-2">
                   <p className="text-xs text-gray-400 italic">No meals remaining for today</p>
                   <button className="text-xs font-bold text-brand-primary flex items-center gap-1 hover:underline">
                      <Plus size={12} /> Plan Meal
                   </button>
                </div>
              )}
          </div>
      </div>

      {/* 3. Bento Grid Status Cards (Clean White Style) */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard 
          title={t['dashboard.shopping']} 
          count={shoppingCount} 
          icon={ShoppingCart} 
          label={t['dashboard.items_needed']}
          colorClass="text-blue-600"
          onClick={() => onNavigate('shopping')}
        />
        <StatCard 
          title={t['dashboard.tasks']} 
          count={activeTaskCount} 
          icon={Calendar} 
          label={t['dashboard.todo']}
          colorClass="text-purple-600"
          onClick={() => onNavigate('tasks')}
        />
        <StatCard 
          title={t['dashboard.meals']} 
          count={meals.length} 
          icon={Utensils} 
          label={t['dashboard.planned']}
          colorClass="text-green-600"
          onClick={() => onNavigate('meals')}
        />
        <StatCard 
          title={t['dashboard.expenses']} 
          count={
             <div className="flex items-baseline gap-0.5">
                <span className="text-sm font-bold text-gray-400 align-top">$</span>
                <span>1.2k</span>
             </div>
          } 
          icon={TrendingUp} 
          label={t['dashboard.this_month']}
          colorClass="text-orange-600"
          onClick={() => onNavigate('expenses')}
        />
      </div>

      {/* 4. Upcoming Event / Meal (Hero Widget) */}
      {/* Only show if it's tomorrow or later */}
      {nextMeal && nextMeal.date > todayStr && (
        <div>
            <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="font-bold text-base text-gray-800">{t['dashboard.up_next']}</h2>
                <button onClick={() => onNavigate('meals')} className="text-brand-primary text-xs font-bold hover:underline">
                    {t['dashboard.view_schedule']}
                </button>
            </div>
            
            <div 
                onClick={() => onNavigate('meals')}
                className="group bg-white p-1 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all hover:shadow-md hover:border-gray-200"
            >
                <div className="flex gap-4 p-3">
                    {/* Date Box */}
                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-indigo-50 rounded-xl text-indigo-600 shrink-0 border border-indigo-100/50">
                        <span className="text-[10px] font-bold">{new Date(nextMeal.date).toLocaleDateString(currentLang === 'en' ? 'en-GB' : currentLang, {weekday: 'short'})}</span>
                        <span className="text-lg font-bold leading-none">{new Date(nextMeal.date).getDate()}</span>
                    </div>

                    <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-indigo-500">
                                {nextMealLabel}
                            </span>
                        </div>
                        <h3 className="font-bold text-gray-800 text-base truncate">{nextMeal.description}</h3>
                        
                        {/* Avatar Stack */}
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex -space-x-2">
                                {nextMeal.forUserIds.map((uid, idx) => {
                                    const u = users.find(user => user.id === uid);
                                    if (!u || idx > 4) return null;
                                    return (
                                        <div key={uid} className="w-5 h-5 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                                            <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                                        </div>
                                    );
                                })}
                            </div>
                            <span className="text-[10px] font-medium text-gray-400">
                                {nextMeal.forUserIds.length === users.length ? t['dashboard.everyone'] : `${nextMeal.forUserIds.length} ${t['dashboard.eating']}`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center px-2 text-gray-300 group-hover:text-brand-primary transition-colors">
                        <ChevronRight size={20} />
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Language Modal */}
      {showLangModal && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800">{t['dashboard.language']}</h3>
                    <button 
                        onClick={() => setShowLangModal(false)}
                        className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar">
                    {SUPPORTED_LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => {
                                onLanguageChange(lang.code);
                                setShowLangModal(false);
                            }}
                            className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${
                                currentLang === lang.code 
                                ? 'bg-brand-primary text-white font-bold shadow-md' 
                                : 'bg-gray-50 text-gray-700 font-medium hover:bg-gray-100'
                            }`}
                        >
                            <span className="text-sm">{lang.name}</span>
                            {currentLang === lang.code && <Check size={18} />}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
