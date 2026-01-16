import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  Users,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Baby,
  Check,
  Youtube,
  ArrowLeft
} from 'lucide-react';
import Avatar from './ui/Avatar';
import ErrorBanner from './ui/ErrorBanner';
import { useTranslatedContent } from '@/hooks/useTranslatedContent';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useSheetTheme } from '@/hooks/useSheetTheme';
import { Meal, MealType, MealAudience, User, UserRole, BaseViewProps } from '../types';
import { detectInputLanguage } from '../services/languageDetectionService';
import { useDemoMode } from '../contexts/DemoModeContext';

interface MealTableV4Props extends BaseViewProps {
  meals: Meal[];
  users: User[];
  currentUser: User;
  onAdd: (meal: Meal) => void;
  onUpdate: (id: string, data: Partial<Meal>) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

// Component for displaying translated meal description
const TranslatedMealDescription: React.FC<{
  meal: Meal;
  currentLang: string;
  onUpdate?: (id: string, data: Partial<Meal>) => void;
}> = ({ meal, currentLang, onUpdate }) => {
  const translatedDescription = useTranslatedContent({
    content: meal.description,
    contentLang: meal.descriptionLang,
    currentLang,
    translations: meal.descriptionTranslations || {},
    onTranslationUpdate: async (translation) => {
      if (onUpdate) {
        const updatedTranslations = {
          ...(meal.descriptionTranslations || {}),
          [currentLang]: translation,
        };
        await onUpdate(meal.id, { descriptionTranslations: updatedTranslations });
      }
    },
  });

  return <>{translatedDescription}</>;
};

const MealTableV4: React.FC<MealTableV4Props> = ({
  meals,
  users,
  currentUser,
  onAdd,
  onUpdate,
  onDelete,
  onBack,
  t,
  currentLang
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Role-based permissions
  // ─────────────────────────────────────────────────────────────────
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  const { isViewingAsHelper } = useDemoMode();
  const isHelper = currentUser.role === UserRole.HELPER || (isSuperAdmin && isViewingAsHelper);

  const [error, setError] = useState<string | null>(null);
  
  // Track horizontal scroll for shadow effect on frozen column
  const [isScrolledHorizontally, setIsScrolledHorizontally] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Date Navigation State
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  useScrollLock(isModalOpen);
  useSheetTheme(isModalOpen);
  
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [modalDate, setModalDate] = useState<Date>(new Date());
  const [modalType, setModalType] = useState<MealType>(MealType.DINNER);
  const [modalAudience, setModalAudience] = useState<MealAudience>('ALL');
  const [description, setDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER, MealType.SNACKS];
  const langCode = currentLang === 'en' ? 'en-GB' : currentLang;

  // --- Helpers ---
  const getMealLabel = (type: MealType) => t[`meal.type.${type.toLowerCase()}`] ?? type;
  const getAudienceLabel = (audience: MealAudience) => {
    switch (audience) {
      case 'ALL': return t['meals.audience_all'] ?? 'Everyone';
      case 'ADULTS': return t['meals.audience_adults'] ?? 'Adults';
      case 'KIDS': return t['meals.audience_kids'] ?? 'Kids';
    }
  };

  const formatDateStr = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startOfWeek = useMemo(() => {
    const d = new Date(currentViewDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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
    currentStart.setHours(0, 0, 0, 0);
    return startOfWeek.getTime() === currentStart.getTime();
  }, [startOfWeek]);

  const nextWeek = () => { const d = new Date(currentViewDate); d.setDate(d.getDate() + 7); setCurrentViewDate(d); };
  const prevWeek = () => { const d = new Date(currentViewDate); d.setDate(d.getDate() - 7); setCurrentViewDate(d); };
  const goToToday = () => setCurrentViewDate(new Date());

  const handleTableScroll = () => {
    if (tableContainerRef.current) {
      setIsScrolledHorizontally(tableContainerRef.current.scrollLeft > 0);
    }
  };

  const getMealIcon = (type: MealType, isSelected = false) => {
    const colorClass = isSelected ? '' : {
      [MealType.BREAKFAST]: 'text-[#FF9800]',
      [MealType.LUNCH]: 'text-[#4CAF50]',
      [MealType.DINNER]: 'text-[#7E57C2]',
      [MealType.SNACKS]: 'text-[#F06292]',
    }[type];
    switch (type) {
      case MealType.BREAKFAST: return <Coffee size={14} className={colorClass} />;
      case MealType.LUNCH: return <Sun size={14} className={colorClass} />;
      case MealType.DINNER: return <Moon size={14} className={colorClass} />;
      case MealType.SNACKS: return <Cookie size={14} className={colorClass} />;
    }
  };

  const getMealsForSlot = (date: Date, type: MealType) => {
    const d = formatDateStr(date);
    return meals.filter(m => m.date === d && m.type === type);
  };

  const getUsersForAudience = (audience: MealAudience): User[] => {
    const activeUsers = users.filter(u => u.status === 'active');
    let filtered: User[];
    switch (audience) {
      case 'ALL': filtered = activeUsers; break;
      case 'ADULTS': filtered = activeUsers.filter(u => u.role !== UserRole.CHILD); break;
      case 'KIDS': filtered = activeUsers.filter(u => u.role === UserRole.CHILD); break;
    }
    const getRolePriority = (user: User): number => {
      switch (user.role) {
        case UserRole.SUPERADMIN: return 0;
        case UserRole.MASTER: return 1;
        case UserRole.SPOUSE: return 2;
        case UserRole.CHILD: return 3;
        case UserRole.OTHER: return 4;
        case UserRole.HELPER: return 5;
        default: return 6;
      }
    };
    return [...filtered].sort((a, b) => {
      const priorityDiff = getRolePriority(a) - getRolePriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return a.name.localeCompare(b.name);
    });
  };

  // --- Modal Actions ---
  const openAddModal = (date: Date, type: MealType) => {
    setEditingMealId(null);
    setModalDate(date);
    setModalType(type);
    setModalAudience('ALL');
    setDescription('');
    setSelectedUserIds(users.filter(u => u.status === 'active').map(u => u.id));
    setIsModalOpen(true);
  };

  const openEditModal = (meal: Meal) => {
    setEditingMealId(meal.id);
    setModalDate(new Date(meal.date));
    setModalType(meal.type);
    setModalAudience(meal.audience || 'ALL');
    setDescription(meal.description);
    setSelectedUserIds(meal.forUserIds);
    setIsModalOpen(true);
  };

  const handleAudienceChange = (newAudience: MealAudience) => {
    setModalAudience(newAudience);
    setSelectedUserIds(getUsersForAudience(newAudience).map(u => u.id));
  };

  const handleSave = () => {
    const hasDish = description.trim().length > 0;
    const hasPeople = selectedUserIds.length > 0;
    if (!hasDish && !hasPeople) return;

    const dateStr = formatDateStr(modalDate);
    try {
      if (editingMealId) {
        const existingMeal = meals.find(m => m.id === editingMealId);
        const descriptionChanged = existingMeal && existingMeal.description !== description;
        const detectedLang = descriptionChanged ? detectInputLanguage(currentLang) : undefined;
        onUpdate(editingMealId, {
          description,
          forUserIds: selectedUserIds,
          type: modalType,
          audience: modalAudience,
          ...(descriptionChanged && detectedLang !== undefined ? { descriptionLang: detectedLang || null, descriptionTranslations: {} } : {}),
        });
      } else {
        const detectedLang = detectInputLanguage(currentLang);
        const newMeal: Meal = {
          id: Date.now().toString(),
          date: dateStr,
          type: modalType,
          description,
          forUserIds: selectedUserIds,
          audience: modalAudience,
          createdBy: currentUser.id,
          descriptionLang: detectedLang || null,
          descriptionTranslations: {}
        };
        onAdd(newMeal);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save meal:', err);
      setError(t['error.save_meal'] || 'Failed to save meal. Please try again.');
    }
  };

  const handleDelete = () => {
    if (editingMealId) {
      try {
        onDelete(editingMealId);
        setIsModalOpen(false);
      } catch (err) {
        console.error('Failed to delete meal:', err);
        setError(t['error.delete_meal'] || 'Failed to delete meal. Please try again.');
      }
    }
  };

  const toggleUser = (uid: string) => {
    setSelectedUserIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const dateRangeStr = `${weekDays[0].toLocaleDateString(langCode, { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString(langCode, { day: 'numeric', month: 'short' })}`;

  // ─────────────────────────────────────────────────────────────────
  // RENDER - Same structure as Meals.tsx but with fixed-height table
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY HEADER - Same as Meals.tsx */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header 
          className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
          style={{ height: '120px' }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 -ml-2 rounded-full text-muted-foreground">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-display text-foreground">{t['meals.title']} V4</h1>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        <ErrorBanner error={error} onDismiss={() => setError(null)} title={t['common.error'] || 'Error'} />

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* WEEK NAVIGATION - Same as Meals.tsx */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div 
          className="sticky z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-5"
          style={{ top: '120px' }}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-1 flex items-center justify-between px-2 rounded-xl h-12 overflow-hidden bg-muted">
              <button onClick={prevWeek} className="p-2 rounded-lg text-muted-foreground z-10">
                <ChevronLeft size={20} />
              </button>
              <span className={`text-body font-semibold tabular-nums z-10 ${isCurrentWeek ? 'text-primary' : 'text-foreground'}`}>{dateRangeStr}</span>
              <button onClick={nextWeek} className="p-2 rounded-lg text-muted-foreground z-10">
                <ChevronRight size={20} />
              </button>
              <div className="absolute inset-0 rounded-xl pointer-events-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]" />
            </div>
            <button
              onClick={goToToday}
              disabled={isCurrentWeek}
              className={`px-4 rounded-xl font-semibold text-body h-12 ${isCurrentWeek ? 'bg-muted text-muted-foreground cursor-default' : 'bg-primary text-primary-foreground shadow-sm'}`}
            >
              {t['meals.today'] ?? 'Today'}
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* 4-PANE TABLE - Fixed height, scrollable container */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div className="pt-1">
          <div className="rounded-xl bg-card shadow-sm overflow-hidden">
            {/* 
              Fixed height container - only this scrolls
              Height: viewport - header(120) - nav(~72) - padding(~100) - bottom nav(~80)
            */}
            <div
              ref={tableContainerRef}
              onScroll={handleTableScroll}
              className="overflow-auto scrollbar-hide"
              style={{
                height: 'calc(100vh - 380px)',
                minHeight: '300px',
                overscrollBehavior: 'contain'
              }}
            >
              <table 
                style={{ 
                  borderCollapse: 'separate', 
                  borderSpacing: 0,
                  minWidth: '490px',
                  width: '100%'
                }}
              >
                <colgroup>
                  <col style={{ minWidth: '90px', width: '90px' }} />
                  {mealTypes.map((type) => (
                    <col key={type} style={{ minWidth: '100px', width: '100px' }} />
                  ))}
                </colgroup>

                {/* HEADER ROW - Sticky within scroll container */}
                <thead>
                  <tr>
                    {/* CORNER - Sticky top + left */}
                    <th 
                      className="p-2 bg-muted border-b border-r border-border"
                      style={{ 
                        position: 'sticky',
                        top: 0,
                        left: 0,
                        zIndex: 3,
                        minWidth: '90px',
                        boxShadow: isScrolledHorizontally ? '4px 0 8px -4px rgba(0,0,0,0.15)' : undefined
                      }}
                    />
                    {/* MEAL TYPE HEADERS - Sticky top */}
                    {mealTypes.map((type, i) => (
                      <th 
                        key={type}
                        className={`p-2 text-center border-b border-border ${i < mealTypes.length - 1 ? 'border-r' : ''} bg-muted`}
                        style={{ position: 'sticky', top: 0, zIndex: 2 }}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {getMealIcon(type)}
                          <span className="text-caption font-semibold text-muted-foreground leading-tight text-center">
                            {getMealLabel(type)}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                
                {/* TABLE BODY */}
                <tbody>
                  {weekDays.map((day, dayIndex) => {
                    const dateStr = formatDateStr(day);
                    const isToday = day.toDateString() === new Date().toDateString();
                    const isLastRow = dayIndex === weekDays.length - 1;

                    return (
                      <tr key={dateStr}>
                        {/* DATE COLUMN - Sticky left */}
                        <td 
                          onClick={() => openAddModal(day, MealType.DINNER)}
                          className={`p-2 text-center align-middle cursor-pointer border-r border-border ${!isLastRow ? 'border-b' : ''} ${isToday ? 'bg-primary' : 'bg-card'}`}
                          style={{ 
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            minWidth: '90px',
                            boxShadow: isScrolledHorizontally ? '4px 0 8px -4px rgba(0,0,0,0.1)' : undefined
                          }}
                        >
                          <span className={`text-caption font-semibold block ${isToday ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            {day.toLocaleDateString(langCode, { weekday: 'short' })}
                          </span>
                          <span className={`text-body font-bold block ${isToday ? 'text-primary-foreground' : 'text-foreground'}`}>
                            {day.getDate()} {day.toLocaleDateString(langCode, { month: 'short' })}
                          </span>
                        </td>
                        
                        {/* MEAL CELLS */}
                        {mealTypes.map((type, typeIndex) => {
                          const slotMeals = getMealsForSlot(day, type);
                          const isLastCol = typeIndex === mealTypes.length - 1;
                          
                          return (
                            <td
                              key={`${dateStr}-${type}`}
                              onClick={() => slotMeals.length > 0 ? openEditModal(slotMeals[0]) : openAddModal(day, type)}
                              className={`p-1.5 cursor-pointer align-top ${!isLastRow ? 'border-b border-border' : ''} ${!isLastCol ? 'border-r border-border' : ''}`}
                              style={{ minWidth: '100px' }}
                            >
                              {slotMeals.length > 0 ? (
                                <div className="space-y-1">
                                  {slotMeals.map(meal => {
                                    const hasDish = meal.description.trim().length > 0;
                                    const mealUsers = meal.forUserIds.map(uid => users.find(u => u.id === uid)).filter((u): u is User => !!u);
                                    const adultCount = mealUsers.filter(u => u.role !== UserRole.CHILD).length;
                                    const kidCount = mealUsers.filter(u => u.role === UserRole.CHILD).length;
                                    
                                    return (
                                      <div key={meal.id} className="px-1.5 py-1 rounded-md bg-muted/50">
                                        {hasDish ? (
                                          <span className="text-caption font-semibold text-foreground leading-tight block break-words">
                                            <TranslatedMealDescription meal={meal} currentLang={currentLang} onUpdate={onUpdate} />
                                          </span>
                                        ) : (
                                          <span className="text-caption font-semibold text-muted-foreground block">RSVP</span>
                                        )}
                                        <div className="flex items-center gap-1 text-caption text-muted-foreground mt-0.5">
                                          {adultCount > 0 && <span className="flex items-center gap-0.5"><UserIcon size={12} />{adultCount}</span>}
                                          {kidCount > 0 && <span className="flex items-center gap-0.5"><Baby size={12} />{kidCount}</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center py-2">
                                  <span className="text-muted-foreground/30 text-lg">·</span>
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
          </div>
        </div>

        {/* Footer */}
        <div className="helpy-footer">
          <span className="helpy-logo">helpy</span>
          <p className="text-caption text-muted-foreground mt-2">Meal Table V4 - 4-Pane Test</p>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* MEAL MODAL */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {isModalOpen && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="absolute bottom-0 left-0 right-0 bg-card" style={{ height: 'env(safe-area-inset-bottom, 34px)' }} />
          <div 
            className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col"
            style={{ maxHeight: '88vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground">
                <X size={20} />
              </button>
              <h2 className="text-title font-semibold text-foreground text-center flex-1">
                {`${modalDate.toLocaleDateString(langCode, { weekday: 'short' })}, ${modalDate.getDate()} ${modalDate.toLocaleDateString(langCode, { month: 'short' })}`}
              </h2>
              <button
                onClick={handleSave}
                disabled={!description.trim()}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${description.trim() ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'}`}
              >
                <Check size={20} strokeWidth={3} />
              </button>
            </div>
            
            <div className="px-5"><div className="h-px bg-border w-full"></div></div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2">{t['meals.whats_cooking'] ?? 'Dish Name'}</label>
                <textarea
                  rows={2}
                  autoComplete="one-time-code"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`${t['meals.whats_for'] ?? "What's for"} ${getMealLabel(modalType).toLowerCase()}?`}
                  className="w-full bg-muted border border-transparent rounded-xl px-4 py-3 text-xl font-semibold focus:border-primary outline-none text-foreground resize-none placeholder-light transition-colors"
                />
              </div>

              <button
                onClick={() => {
                  if (!description.trim()) return;
                  const searchQuery = encodeURIComponent(`Recipe: ${description.trim()}`);
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  const isAndroid = /Android/.test(navigator.userAgent);
                  if (isIOS) {
                    window.location.href = `youtube://www.youtube.com/results?search_query=${searchQuery}`;
                    setTimeout(() => { if (document.visibilityState === 'visible') window.location.href = `https://www.youtube.com/results?search_query=${searchQuery}`; }, 500);
                  } else if (isAndroid) {
                    window.location.href = `intent://www.youtube.com/results?search_query=${searchQuery}#Intent;scheme=https;package=com.google.android.youtube;end`;
                  } else {
                    window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
                  }
                }}
                disabled={!description.trim()}
                className={`w-full py-3 rounded-xl text-body font-semibold flex items-center justify-center gap-2 ${description.trim() ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
              >
                <Youtube size={18} />
                {t['meals.search_youtube'] ?? 'Search Recipe in YouTube'}
              </button>

              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2">{t['meals.meal_type'] ?? 'Meal Type'}</label>
                <div className="grid grid-cols-2 gap-2">
                  {mealTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setModalType(type)}
                      className={`py-2.5 rounded-xl transition-colors flex items-center justify-start gap-2 px-3 ${modalType === type ? 'bg-primary text-primary-foreground' : 'bg-card ring-1 ring-border text-foreground'}`}
                    >
                      {getMealIcon(type, modalType === type)}
                      <span className="text-body font-medium">{getMealLabel(type)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2">{t['meals.audience_label'] ?? 'This meal is for'}</label>
                <div className="flex gap-2">
                  {(['ALL', 'ADULTS', 'KIDS'] as const).map(aud => (
                    <button
                      key={aud}
                      onClick={() => handleAudienceChange(aud)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-body transition-colors ${modalAudience === aud ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground ring-1 ring-border'}`}
                    >
                      {getAudienceLabel(aud)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2 flex items-center gap-2">
                  <Users size={14} /> {t['meals.who_eating'] ?? "Who's eating?"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {getUsersForAudience(modalAudience).map(user => (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={`flex items-center justify-start gap-2 px-3 py-2 rounded-xl text-body transition-colors ${selectedUserIds.includes(user.id) ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground ring-1 ring-border'}`}
                    >
                      <Avatar user={user} size="xs" />
                      <span>{user.id === currentUser.id ? (t['common.you'] ?? 'You') : user.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {editingMealId && !isHelper ? (
              <>
                <div className="px-5"><div className="h-px bg-border w-full"></div></div>
                <div className="shrink-0 p-5 pb-8">
                  <button onClick={handleDelete} className="w-full py-3.5 rounded-xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2">
                    <Trash2 size={20} />
                    {t['meals.delete_meal'] ?? 'Delete Meal'}
                  </button>
                </div>
              </>
            ) : (
              <div className="shrink-0 p-5 pb-8"><div className="h-[52px]"></div></div>
            )}
          </div>
        </div>
      , document.body)}

    </div>
  );
};

export default MealTableV4;
