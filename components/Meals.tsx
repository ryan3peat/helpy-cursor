
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, Plus, X, Users, Coffee, Sun, Moon, Calendar, Edit2, Trash2, Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Meal, MealType, User, UserRole, BaseViewProps } from '../types';
import { suggestMeal } from '../services/geminiService';

interface MealsProps extends BaseViewProps {
  meals: Meal[];
  users: User[];
  onAdd: (meal: Meal) => void;
  onUpdate: (id: string, data: Partial<Meal>) => void;
  onDelete: (id: string) => void;
}

const Meals: React.FC<MealsProps> = ({ meals, users, onAdd, onUpdate, onDelete, t, currentLang }) => {
  const [view, setView] = useState<'day' | 'week'>('day');
  const [loadingAi, setLoadingAi] = useState(false);
  
  // Date Navigation State
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  
  // Context for the modal (When adding new)
  const [modalDate, setModalDate] = useState<Date>(new Date());
  const [modalType, setModalType] = useState<MealType>(MealType.DINNER);

  // Form Data
  const [description, setDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
  const langCode = currentLang === 'en' ? 'en-GB' : currentLang;

  // --- Translation Helper ---
  const getMealLabel = (type: MealType) => {
      const key = `meal.type.${type.toLowerCase()}`;
      return t[key] || type;
  };

  // --- Date Logic Helpers ---

  // Ensure we always look at Monday - Sunday
  const startOfWeek = useMemo(() => {
    const d = new Date(currentViewDate);
    const day = d.getDay(); // 0 is Sunday
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [currentViewDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }, [startOfWeek]);

  const isCurrentWeek = useMemo(() => {
    const now = new Date();
    const currentStart = new Date(now);
    const day = currentStart.getDay();
    const diff = currentStart.getDate() - day + (day === 0 ? -6 : 1);
    currentStart.setDate(diff);
    currentStart.setHours(0,0,0,0);
    
    return startOfWeek.getTime() === currentStart.getTime();
  }, [startOfWeek]);

  // Navigation Handlers
  const nextWeek = () => {
    const d = new Date(currentViewDate);
    d.setDate(d.getDate() + 7);
    setCurrentViewDate(d);
  };

  const prevWeek = () => {
    const d = new Date(currentViewDate);
    d.setDate(d.getDate() - 7);
    setCurrentViewDate(d);
  };

  const goToToday = () => {
    setCurrentViewDate(new Date());
  };

  // --- UI Helpers ---

  const getMealIcon = (type: MealType) => {
    switch (type) {
        case MealType.BREAKFAST: return <Coffee size={18} />;
        case MealType.LUNCH: return <Sun size={18} />;
        case MealType.DINNER: return <Moon size={18} />;
    }
  };

  const getMealColor = (type: MealType) => {
    switch (type) {
        case MealType.BREAKFAST: return 'text-orange-600 bg-orange-50 border-orange-200';
        case MealType.LUNCH: return 'text-amber-600 bg-amber-50 border-amber-200';
        case MealType.DINNER: return 'text-indigo-600 bg-indigo-50 border-indigo-200';
    }
  };

  const getMealsForSlot = (date: Date, type: MealType) => {
    const d = date.toISOString().split('T')[0];
    return meals.filter(m => m.date === d && m.type === type);
  };

  const getPortionDisplay = (meal: Meal) => {
    const eaters = users.filter(u => meal.forUserIds.includes(u.id));
    if (eaters.length === 0) return "";
    
    // If everyone is eating
    if (eaters.length === users.length) return "All";

    const adults = eaters.filter(u => u.role !== UserRole.CHILD).length;
    const kids = eaters.filter(u => u.role === UserRole.CHILD).length;
    
    const parts = [];
    if (adults > 0) parts.push(`${adults}A`);
    if (kids > 0) parts.push(`${kids}K`);
    
    return parts.join(' ');
  };

  // --- Group Selection Logic ---

  const selectGroup = (group: 'ALL' | 'ADULTS' | 'KIDS') => {
      if (group === 'ALL') {
          setSelectedUserIds(users.map(u => u.id));
      } else if (group === 'ADULTS') {
          setSelectedUserIds(users.filter(u => u.role !== UserRole.CHILD).map(u => u.id));
      } else if (group === 'KIDS') {
          setSelectedUserIds(users.filter(u => u.role === UserRole.CHILD).map(u => u.id));
      }
  };

  const isGroupActive = (group: 'ALL' | 'ADULTS' | 'KIDS') => {
      let targetIds: string[] = [];
      if (group === 'ALL') targetIds = users.map(u => u.id);
      else if (group === 'ADULTS') targetIds = users.filter(u => u.role !== UserRole.CHILD).map(u => u.id);
      else if (group === 'KIDS') targetIds = users.filter(u => u.role === UserRole.CHILD).map(u => u.id);
      
      if (targetIds.length === 0) return false;
      if (selectedUserIds.length !== targetIds.length) return false;
      return targetIds.every(id => selectedUserIds.includes(id));
  };

  // --- Modal Actions ---

  const openAddModal = (date: Date, type: MealType) => {
    setEditingMealId(null);
    setModalDate(date);
    setModalType(type);
    setDescription('');
    // Default to all except Helper if possible, or just all
    setSelectedUserIds(users.filter(u => u.role !== UserRole.HELPER).map(u => u.id));
    setIsModalOpen(true);
  };

  const openEditModal = (meal: Meal) => {
    setEditingMealId(meal.id);
    setModalDate(new Date(meal.date));
    setModalType(meal.type);
    setDescription(meal.description);
    setSelectedUserIds(meal.forUserIds);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!description.trim()) return;
    
    const dateStr = modalDate.toISOString().split('T')[0];

    if (editingMealId) {
        onUpdate(editingMealId, {
            description,
            forUserIds: selectedUserIds,
            type: modalType // Allow changing type on edit
        });
    } else {
        const newMeal: Meal = {
            id: Date.now().toString(),
            date: dateStr,
            type: modalType,
            description,
            forUserIds: selectedUserIds
        };
        onAdd(newMeal);
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (editingMealId) {
        onDelete(editingMealId);
        setIsModalOpen(false);
    }
  };

  const handleAiSuggest = async () => {
    setLoadingAi(true);
    const suggestion = await suggestMeal(modalType, "family style");
    setDescription(suggestion);
    setLoadingAi(false);
  };

  const toggleUser = (uid: string) => {
      setSelectedUserIds(prev => 
          prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
      );
  };

  const handleWeekCellClick = (date: Date, type: MealType) => {
     // Switch to day view and set date to that week (already set)
     setView('day');
     // Note: In a real app we might scroll to the element ID here
  };

  // Date Range String
  const dateRangeStr = `${weekDays[0].toLocaleDateString(langCode, { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString(langCode, { day: 'numeric', month: 'short' })}`;

  return (
    <div className="flex flex-col h-full bg-gray-50 animate-slide-up relative">
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-gray-50/95 backdrop-blur-sm pt-16 pb-2 px-4 border-b border-gray-200/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-brand-text">{t['meals.title']}</h1>
        </div>
        
        {/* Controls Container */}
        <div className="space-y-3">
            {/* View Switcher - Pill Buttons */}
            <div className="flex gap-3">
                {['Day', 'Week'].map(v => {
                    const isActive = view === v.toLowerCase();
                    return (
                        <button
                            key={v}
                            onClick={() => setView(v.toLowerCase() as 'day' | 'week')}
                            className={`flex-1 py-2 px-4 rounded-full text-sm transition-all border ${
                                isActive
                                ? 'bg-brand-primary text-white border-brand-primary shadow-md font-medium' 
                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 font-normal'
                            }`}
                        >
                            {v === 'Day' ? t['meals.view_day'] : t['meals.view_week']}
                        </button>
                    );
                })}
            </div>

            {/* Week Navigation */}
            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-gray-200">
                <button 
                    onClick={prevWeek}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                
                <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-gray-800 tabular-nums">{dateRangeStr}</span>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={nextWeek}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
            
            {/* Back to Today (Floating or Conditional) */}
            {!isCurrentWeek && (
                <div className="flex justify-center">
                    <button 
                        onClick={goToToday}
                        className="flex items-center gap-2 text-sm font-bold text-brand-primary bg-brand-primary/10 px-4 py-1.5 rounded-full hover:bg-brand-primary/20 transition-colors"
                    >
                        <RotateCcw size={14} />
                        {t['meals.back_to_week']}
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 ${view === 'day' ? 'overflow-y-auto p-4 pb-32' : 'overflow-hidden flex flex-col'}`}>
        
        {view === 'day' ? (
            <div className="space-y-6">
                {weekDays.map((dayDate) => {
                    const dateStr = dayDate.toISOString().split('T')[0];
                    const isToday = dayDate.toDateString() === new Date().toDateString();
                    const dayMeals = meals.filter(m => m.date === dateStr);
                    const hasMeals = dayMeals.length > 0;

                    return (
                        <div key={dateStr} id={`day-${dateStr}`}>
                            {/* Date Header */}
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <Calendar size={16} className={isToday ? "text-brand-primary" : "text-gray-400"} />
                                <h3 className={`text-sm font-bold ${isToday ? "text-brand-primary" : "text-gray-500"}`}>
                                    {dayDate.toLocaleDateString(langCode, { weekday: 'short', day: 'numeric', month: 'short' })}
                                </h3>
                                {isToday && (
                                    <span className="bg-brand-primary text-white text-sm font-bold px-2 py-0.5 rounded-full ml-2">{t['meals.today']}</span>
                                )}
                            </div>

                            {/* Day Card */}
                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                                {!hasMeals ? (
                                    // Empty State: Optimized compact button
                                    <div className="p-3">
                                        <button 
                                            onClick={() => openAddModal(dayDate, MealType.DINNER)}
                                            className="w-full py-4 border border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-400 hover:text-brand-primary hover:border-brand-primary hover:bg-gray-50 transition-all group"
                                        >
                                            <Plus size={18} />
                                            <span className="font-medium text-sm">{t['meals.plan_meal']}</span>
                                        </button>
                                    </div>
                                ) : (
                                    // Filled State: Only show slots that have meals
                                    <div className="p-2 space-y-1">
                                        {mealTypes.map((type) => {
                                            const slotMeals = dayMeals.filter(m => m.type === type);
                                            if (slotMeals.length === 0) return null;

                                            return (
                                                <div 
                                                    key={type}
                                                    className="bg-gray-50/50 rounded-xl p-3 border border-gray-100"
                                                >
                                                    {/* Slot Header */}
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className={`p-1.5 rounded-lg ${type === MealType.DINNER ? 'bg-indigo-50 text-indigo-500' : type === MealType.LUNCH ? 'bg-amber-50 text-amber-500' : 'bg-orange-50 text-orange-500'}`}>
                                                            {getMealIcon(type)}
                                                        </div>
                                                        <span className="text-sm font-bold text-gray-500">{getMealLabel(type)}</span>
                                                        
                                                        {/* Inline Add for this specific type */}
                                                        <button 
                                                            onClick={() => openAddModal(dayDate, type)}
                                                            className="ml-auto text-brand-primary p-1 hover:bg-brand-primary/10 rounded-md transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>

                                                    {/* Meals List */}
                                                    <div className="space-y-2 pl-9">
                                                        {slotMeals.map(meal => (
                                                            <div 
                                                                key={meal.id}
                                                                onClick={() => openEditModal(meal)}
                                                                className="bg-white hover:bg-gray-50 transition-colors rounded-xl p-3 flex items-start justify-between cursor-pointer group border border-gray-200 hover:border-brand-primary/50 shadow-sm"
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm font-semibold text-gray-800 truncate leading-relaxed">{meal.description}</p>
                                                                    <div className="flex items-center gap-2 mt-2">
                                                                        {meal.forUserIds.length === users.length ? (
                                                                            <span className="text-xs text-gray-400 font-medium">{t['dashboard.everyone']}</span>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                                                <span>{getPortionDisplay(meal)}</span>
                                                                                <div className="flex -space-x-1.5 ml-1">
                                                                                    {meal.forUserIds.slice(0, 3).map(uid => {
                                                                                        const u = users.find(usr => usr.id === uid);
                                                                                        if (!u) return null;
                                                                                        return (
                                                                                            <img 
                                                                                                key={uid} 
                                                                                                src={u.avatar} 
                                                                                                className="w-4 h-4 rounded-full border border-white bg-gray-200 object-cover" 
                                                                                                alt={u.name} 
                                                                                            />
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <Edit2 size={14} className="text-gray-300 group-hover:text-brand-primary mt-1" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Generic Add Button at bottom for adding distinct meal types */}
                                        <button 
                                            onClick={() => {
                                                // Determine sensible default
                                                const presentTypes = dayMeals.map(m => m.type);
                                                let nextType = MealType.DINNER;
                                                if (!presentTypes.includes(MealType.BREAKFAST)) nextType = MealType.BREAKFAST;
                                                else if (!presentTypes.includes(MealType.LUNCH)) nextType = MealType.LUNCH;
                                                
                                                openAddModal(dayDate, nextType);
                                            }}
                                            className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:text-brand-primary hover:bg-gray-50 rounded-xl transition-colors border-t border-transparent hover:border-gray-100"
                                        >
                                            <Plus size={16} />
                                            {t['meals.plan_meal']}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        ) : (
            /* Week View - Cross Table */
            <div className="flex-1 w-full overflow-auto bg-white border-t border-gray-200 pb-32">
               <table className="min-w-[800px] w-full border-collapse">
                 <thead>
                    <tr>
                       <th className="sticky top-0 left-0 z-40 bg-gray-50 w-28 p-3 border-b border-r border-gray-200 text-sm font-bold text-gray-500 text-left shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                          Day
                       </th>
                       {mealTypes.map(type => (
                           <th key={type} className="sticky top-0 z-30 bg-gray-50 p-3 border-b border-gray-200 text-sm font-bold text-gray-500 text-left min-w-[200px]">
                              {getMealLabel(type)}
                           </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody>
                    {weekDays.map(day => {
                       const dateStr = day.toISOString().split('T')[0];
                       const isToday = day.toDateString() === new Date().toDateString();

                       return (
                          <tr key={dateStr} className="hover:bg-gray-50/50 transition-colors group">
                             <td className={`sticky left-0 z-20 p-3 border-b border-r border-gray-100 bg-white align-top shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${isToday ? 'bg-blue-50/30' : ''}`}>
                                <div className="flex flex-col gap-1">
                                   <span className={`text-sm font-bold uppercase ${isToday ? 'text-brand-primary' : 'text-gray-500'}`}>
                                       {day.toLocaleDateString(langCode, { weekday: 'short' })}
                                   </span>
                                   <span className={`text-sm font-bold leading-none mt-1 ${isToday ? 'text-brand-primary' : 'text-gray-800'}`}>
                                       {day.getDate()}
                                   </span>
                                   {isToday && <span className="text-sm font-bold mt-1 text-brand-primary opacity-80">{t['meals.today']}</span>}
                                </div>
                             </td>
                             {mealTypes.map(type => {
                                const slotMeals = getMealsForSlot(day, type);
                                return (
                                   <td 
                                      key={type} 
                                      onClick={() => handleWeekCellClick(day, type)}
                                      className="p-2 border-b border-r border-gray-100 align-top cursor-pointer hover:bg-blue-50/50 transition-colors"
                                   >
                                      {slotMeals.length > 0 ? (
                                         <div className="space-y-2">
                                            {slotMeals.map(meal => (
                                               <div key={meal.id} className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow">
                                                  <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight mb-1.5">{meal.description}</p>
                                                  <div className="flex items-center gap-1 text-sm text-gray-500 font-bold bg-gray-50 px-1.5 py-0.5 rounded-md w-fit">
                                                     <Users size={14} />
                                                     <span>{getPortionDisplay(meal)}</span>
                                                  </div>
                                               </div>
                                            ))}
                                         </div>
                                      ) : (
                                         <div className="h-full min-h-[80px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                             <div className="w-8 h-8 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center">
                                                 <Plus size={16} />
                                             </div>
                                         </div>
                                      )}
                                   </td>
                                );
                             })}
                          </tr>
                       );
                    })}
                 </tbody>
               </table>
            </div>
        )}

      </div>

      {/* Meal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up flex flex-col max-h-[90vh]">
                
                {/* Header: Date */}
                <div className="relative mb-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-800">
                            {modalDate.toLocaleDateString(langCode, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </h3>
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Meal Type Selector */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                    {mealTypes.map(type => {
                        const isSelected = modalType === type;
                        return (
                            <button
                                key={type}
                                onClick={() => setModalType(type)}
                                className={`py-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                                    isSelected 
                                    ? getMealColor(type) // e.g. 'text-orange-600 bg-orange-50 border-orange-200'
                                    : 'bg-white border-gray-100 text-gray-300 hover:border-gray-200 hover:text-gray-400'
                                }`}
                            >
                                {getMealIcon(type)}
                                <span className="text-[10px] font-bold">{getMealLabel(type)}</span>
                            </button>
                        )
                    })}
                </div>

                <div className="space-y-6 overflow-y-auto flex-1 px-1 min-h-0 py-2">
                    
                    {/* Input Section */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                           <label className="text-sm font-bold text-gray-500">{t['meals.the_dish']}</label>
                        </div>
                        <div className="relative group">
                            <div className={`absolute inset-0 bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl blur opacity-20 transition-opacity ${loadingAi ? 'opacity-100' : 'opacity-0'}`}></div>
                            <textarea
                                autoFocus
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={`${t['meals.whats_for']} ${getMealLabel(modalType).toLowerCase()}?`}
                                className="relative w-full bg-gray-50 border-none rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-medium text-gray-800 resize-none placeholder:text-gray-400 pr-12 leading-relaxed"
                            />
                            <button 
                                onClick={handleAiSuggest}
                                disabled={loadingAi}
                                className="absolute bottom-3 right-3 p-2 bg-white shadow-sm border border-gray-100 rounded-full text-purple-500 hover:text-purple-600 hover:scale-105 transition-all disabled:opacity-50 z-10"
                                title={t['meals.suggest_ai']}
                            >
                                {loadingAi ? <span className="animate-spin block w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></span> : <Sparkles size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* People Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-500 flex items-center gap-2">
                            <Users size={16} /> {t['meals.who_eating']}
                        </label>
                        
                        {/* Quick Select Segmented Control */}
                        <div className="flex p-1 bg-gray-100 rounded-xl">
                            {(['ALL', 'ADULTS', 'KIDS'] as const).map(g => {
                                const active = isGroupActive(g);
                                let label: string = g;
                                if (g === 'ALL') label = t['meals.group_all'];
                                if (g === 'ADULTS') label = t['meals.group_adults'];
                                if (g === 'KIDS') label = t['meals.group_kids'];

                                return (
                                    <button 
                                        key={g}
                                        onClick={() => selectGroup(g)}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                            active 
                                            ? 'bg-white text-gray-800 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-4 gap-3 pt-1 max-h-40 overflow-y-auto no-scrollbar">
                            {users.map(user => {
                                const isSelected = selectedUserIds.includes(user.id);
                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => toggleUser(user.id)}
                                        className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 ${
                                            isSelected 
                                            ? 'bg-white border-brand-primary shadow-sm scale-100 opacity-100' 
                                            : 'bg-gray-50 border-transparent scale-95 opacity-60 grayscale hover:opacity-100 hover:grayscale-0'
                                        }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-1 right-1 bg-brand-primary text-white rounded-full p-0.5">
                                                <Check size={10} strokeWidth={4} />
                                            </div>
                                        )}
                                        <img 
                                            src={user.avatar} 
                                            alt={user.name}
                                            className="w-10 h-10 rounded-full object-cover bg-gray-200" 
                                        />
                                        <span className={`text-sm font-bold truncate w-full text-center leading-tight ${isSelected ? 'text-brand-primary' : 'text-gray-500'}`}>
                                            {user.name.split(' ')[0]}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-6 flex gap-3 pt-4 border-t border-gray-100 shrink-0">
                    {editingMealId && (
                        <button 
                            onClick={handleDelete}
                            className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                    <button 
                        onClick={handleSave}
                        disabled={!description.trim()}
                        className="flex-1 bg-brand-primary text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary hover:shadow-xl transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {editingMealId ? t['meals.save_changes'] : t['meals.add_meal']}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default Meals;
