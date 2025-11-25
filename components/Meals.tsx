
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  X,
  Users,
  Coffee,
  Sun,
  Moon,
  Calendar,
  Edit2,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { Meal, MealType, User, UserRole, BaseViewProps } from '../types';
import { suggestMeal } from '../services/geminiService';

interface MealsProps extends BaseViewProps {
  meals: Meal[];
  users: User[];
  onAdd: (meal: Meal) => void;
  onUpdate: (id: string, data: Partial<Meal>) => void;
  onDelete: (id: string) => void;
}

const Meals: React.FC<MealsProps> = ({
  meals,
  users,
  onAdd,
  onUpdate,
  onDelete,
  t,
  currentLang
}) => {
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

  // >>> NEW: Availability-only toggle in modal
  const [availabilityOnly, setAvailabilityOnly] = useState<boolean>(false);

  // Ref: Day view container for auto-scroll to current day
  const dayViewRef = useRef<HTMLDivElement | null>(null);

  const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
  const langCode = currentLang === 'en' ? 'en-GB' : currentLang;

  // --- Translation Helper ---
  const getMealLabel = (type: MealType) => {
    const key = `meal.type.${type.toLowerCase()}`;
    return t[key] ?? type;
  };

  // --- Date Logic Helpers ---
  // Always compute Monday as start of week
  const startOfWeek = useMemo(() => {
    const d = new Date(currentViewDate);
    const day = d.getDay(); // 0 is Sunday
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [currentViewDate]);

  // Week days in Monday -> Sunday order
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

  // --- Icons: imaginative emoji by default; set to false to use Lucide icons ---
  const useEmojiMealIcons = true;
  const getMealIcon = (type: MealType) => {
    if (useEmojiMealIcons) {
      const emoji =
        type === MealType.BREAKFAST ? '🥐' :
        type === MealType.LUNCH ? '🥗' :
        '🍛';
      return <span className="text-base">{emoji}</span>;
    }
    switch (type) {
      case MealType.BREAKFAST: return <Coffee size={14} />;
      case MealType.LUNCH:     return <Sun size={14} />;
      case MealType.DINNER:    return <Moon size={14} />;
    }
  };

  const getMealColor = (type: MealType) => {
    switch (type) {
      case MealType.BREAKFAST: return 'text-orange-600 bg-orange-50 border-orange-200';
      case MealType.LUNCH:     return 'text-amber-600 bg-amber-50 border-amber-200';
      case MealType.DINNER:    return 'text-indigo-600 bg-indigo-50 border-indigo-200';
    }
  };

  const getMealsForSlot = (date: Date, type: MealType) => {
    const d = date.toISOString().split('T')[0];
    return meals.filter(m => m.date === d && m.type === type);
  };

  // --- Avatars for eaters ---
  const renderEaterAvatars = (userIds: string[]) => {
    const eaters = userIds
      .map(uid => users.find(u => u.id === uid))
      .filter((u): u is User => !!u);

    const visible = eaters.slice(0, 5);
    const remaining = eaters.length - visible.length;

    return (
      <div className="flex items-center -space-x-1.5">
        {visible.map(u => (
          <img
            key={u.id}
            src={u.avatar}
            alt={u.name}
            title={u.name}
            className="w-5 h-5 rounded-full border border-white bg-gray-200 object-cover"
          />
        ))}
        {remaining > 0 && (
          <span className="text-[10px] font-bold text-gray-600 bg-gray-100 rounded-full px-1.5 py-0.5 border border-white">
            +{remaining}
          </span>
        )}
      </div>
    );
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
    setSelectedUserIds(users.filter(u => u.role !== UserRole.HELPER).map(u => u.id));
    setAvailabilityOnly(false); // default off for new adds
    setIsModalOpen(true);
  };
  const openEditModal = (meal: Meal) => {
    setEditingMealId(meal.id);
    setModalDate(new Date(meal.date));
    setModalType(meal.type);
    setDescription(meal.description);
    setSelectedUserIds(meal.forUserIds);
    setAvailabilityOnly(!meal.description.trim()); // availability-only if empty description
    setIsModalOpen(true);
  };

  // >>> UPDATED: Save allows "availability-only" (no dish) as long as at least one person is selected
  const handleSave = () => {
    const hasDish = description.trim().length > 0;
    const hasPeople = selectedUserIds.length > 0;
    if (!hasDish && !hasPeople) return; // must have either a dish or at least one person

    const dateStr = modalDate.toISOString().split('T')[0];
    if (editingMealId) {
      onUpdate(editingMealId, {
        description,               // may be ''
        forUserIds: selectedUserIds,
        type: modalType
      });
    } else {
      const newMeal: Meal = {
        id: Date.now().toString(),
        date: dateStr,
        type: modalType,
        description,               // may be ''
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
    setAvailabilityOnly(false); // if AI suggests, it's a dish entry
    setLoadingAi(false);
  };

  const toggleUser = (uid: string) => {
    setSelectedUserIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  // Week cell click -> set date AND go to Day view (auto-scroll will kick in)
  const handleWeekCellClick = (date: Date, type: MealType) => {
    setCurrentViewDate(new Date(date));
    setView('day');
  };

  // Auto-scroll Day view so the current day row is at the top
  useEffect(() => {
    if (view !== 'day') return;
    const container = dayViewRef.current;
    if (!container) return;

    const targetDateStr = new Date(currentViewDate).toISOString().split('T')[0];
    const targetEl = document.getElementById(`day-${targetDateStr}`);
    if (!targetEl) return;

    const top = targetEl.offsetTop - (container.offsetTop || 0);
    container.scrollTo({ top, behavior: 'auto' });
    targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [view, currentViewDate, startOfWeek]);

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

          {/* Back to Today */}
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
      {view === 'day' ? (
        <div ref={dayViewRef} className="flex-1 overflow-y-auto p-4 pb-32">
          {/* Single column list, each day is a full-width row, Monday -> Sunday */}
          <div className="space-y-4">
            {weekDays.map((dayDate) => {
              const dateStr = dayDate.toISOString().split('T')[0];
              const isToday = dayDate.toDateString() === new Date().toDateString();
              const dayMeals = meals.filter(m => m.date === dateStr);
              const hasMeals = dayMeals.length > 0;

              return (
                <div key={dateStr} id={`day-${dateStr}`} className="bg-white rounded-xl shadow-sm border border-gray-100">
                  {/* Date Header (compact) */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                    <Calendar size={14} className={isToday ? "text-brand-primary" : "text-gray-400"} />
                    <h3 className={`text-xs font-bold ${isToday ? "text-brand-primary" : "text-gray-600"}`}>
                      {dayDate.toLocaleDateString(langCode, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </h3>
                    {isToday && (
                      <span className="ml-2 bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {t['meals.today']}
                      </span>
                    )}
                  </div>

                  {/* Day Card Body (compact) */}
                  {(!hasMeals) ? (
                    // Only keep the faint dashed "Plan meal" button
                    <div className="p-2">
                      <button
                        onClick={() => openAddModal(dayDate, MealType.DINNER)}
                        className="w-full py-2 border border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 text-gray-400 hover:text-brand-primary hover:border-brand-primary hover:bg-gray-50 transition-all group"
                      >
                        <Plus size={14} />
                        <span className="font-medium text-xs">{t['meals.plan_meal']}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {mealTypes.map((type) => {
                        const slotMeals = dayMeals.filter(m => m.type === type);
                        if (slotMeals.length === 0) return null;

                        return (
                          <div key={type} className="rounded-lg border border-gray-100 p-2 bg-gray-50/40">
                            {/* Slimline Slot Header */}
                            <div className="flex items-center gap-1 mb-1">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600">
                                {getMealIcon(type)}
                                {getMealLabel(type)}
                              </span>
                              <button
                                onClick={() => openAddModal(dayDate, type)}
                                className="ml-auto text-brand-primary p-1 hover:bg-brand-primary/10 rounded-md transition-colors"
                                aria-label="Add meal in slot"
                              >
                                <Plus size={12} />
                              </button>
                            </div>

                            {/* Meal Rows (dish or availability-only) */}
                            <div className="flex flex-col gap-1">
                              {slotMeals.map(meal => {
                                const isAvailability = !meal.description.trim();

                                return (
                                  <button
                                    key={meal.id}
                                    onClick={() => openEditModal(meal)}
                                    className={`group w-full text-left border rounded-md px-2 py-1 transition-colors ${
                                      isAvailability
                                        ? 'bg-white border-dashed border-gray-300 hover:bg-gray-50'
                                        : 'bg-white border border-gray-200 hover:bg-gray-50 hover:border-brand-primary/50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`flex-1 truncate text-xs font-semibold leading-tight ${
                                        isAvailability ? 'text-gray-500 italic' : 'text-gray-800'
                                      }`}>
                                        {isAvailability
                                          ? (t['meals.availability_only'] ?? 'Availability only')
                                          : meal.description}
                                      </span>

                                      {/* Avatars of eaters */}
                                      {renderEaterAvatars(meal.forUserIds)}

                                      {/* edit glyph appears on hover */}
                                      <Edit2 size={12} className="text-gray-300 opacity-0 group-hover:opacity-100" />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* NOTE: no second bottom "Plan meal" button */}
                </div>
              );
            })}
          </div>
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
                              {slotMeals.map(meal => {
                                const isAvailability = !meal.description.trim();
                                return (
                                  <div
                                    key={meal.id}
                                    className={`rounded-lg p-2 shadow-sm transition-shadow ${
                                      isAvailability
                                        ? 'bg-white border border-dashed border-gray-300'
                                        : 'bg-white border border-gray-200 hover:shadow-md'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className={`text-sm leading-tight mb-0 flex-1 truncate ${
                                        isAvailability ? 'text-gray-600 italic' : 'text-gray-800 font-medium'
                                      }`}>
                                        {isAvailability
                                          ? (t['meals.availability_only'] ?? 'Availability only')
                                          : meal.description}
                                      </p>
                                      {renderEaterAvatars(meal.forUserIds)}
                                    </div>
                                  </div>
                                );
                              })}
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
            <div className="grid grid-cols-3 gap-2 mb-4">
              {mealTypes.map(type => {
                const isSelected = modalType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setModalType(type)}
                    className={`py-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? getMealColor(type)
                        : 'bg-white border-gray-100 text-gray-300 hover:border-gray-200 hover:text-gray-400'
                    }`}
                  >
                    {getMealIcon(type)}
                    <span className="text-[10px] font-bold">{getMealLabel(type)}</span>
                  </button>
                );
              })}
            </div>

            {/* >>> NEW: Availability-only toggle */}
            <div className="flex items-center justify-between mb-2 px-1">
              <label className="text-sm font-bold text-gray-500">{t['meals.the_dish']}</label>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={availabilityOnly}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setAvailabilityOnly(on);
                    if (on) setDescription(''); // clear dish when availability-only
                  }}
                />
                {t['meals.availability_toggle'] ?? 'Only set who’s eating (no dish yet)'}
              </label>
            </div>

            <div className="space-y-6 overflow-y-auto flex-1 px-1 min-h-0 py-2">
              {/* Input Section */}
              <div className="space-y-2">
                <div className="relative group">
                  <div className={`absolute inset-0 bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl blur opacity-20 transition-opacity ${loadingAi ? 'opacity-100' : 'opacity-0'}`}></div>
                  <textarea
                    autoFocus={!availabilityOnly}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      availabilityOnly
                        ? (t['meals.availability_placeholder'] ?? 'No dish yet — set who’s eating below')
                        : `${t['meals.whats_for']} ${getMealLabel(modalType).toLowerCase()}?`
                    }
                    disabled={availabilityOnly}
                    className={`relative w-full bg-gray-50 border-none rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-medium text-gray-800 resize-none placeholder:text-gray-400 pr-12 leading-relaxed ${
                      availabilityOnly ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  />
                  {!availabilityOnly && (
                    <button
                      onClick={handleAiSuggest}
                      disabled={loadingAi}
                      className="absolute bottom-3 right-3 p-2 bg-white shadow-sm border border-gray-100 rounded-full text-purple-500 hover:text-purple-600 hover:scale-105 transition-all disabled:opacity-50 z-10"
                      title={t['meals.suggest_ai']}
                    >
                      {loadingAi ? <span className="animate-spin block w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></span> : <Sparkles size={16} />}
                    </button>
                  )}
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
                          active ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
                    );
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
              {/* >>> UPDATED: Save enabled if dish OR at least one person */}
              <button
                onClick={handleSave}
                disabled={!(description.trim().length > 0 || selectedUserIds.length > 0)}
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
