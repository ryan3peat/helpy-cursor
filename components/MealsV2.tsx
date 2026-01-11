// components/MealsV2.tsx
// EXPERIMENTAL: Rebuilt Meals component with proper architecture to eliminate iOS flicker
// Key changes:
// 1. Both views always mounted, toggle with CSS (no unmount/remount)
// 2. useLayoutEffect + rAF for instant scroll positioning BEFORE first paint
// 3. Week view: Fixed-height container with sticky date row, no page scroll interference

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Plus,
  X,
  Users,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  UserCheck,
  UserPlus,
  User as UserIcon,
  Baby,
  Rows3,
  Sheet,
  Check,
  Youtube
} from 'lucide-react';
import Avatar from './ui/Avatar';
import ErrorBanner from './ui/ErrorBanner';
import { useScrollHeader } from '@/hooks/useScrollHeader';
import { useTranslatedContent } from '@/hooks/useTranslatedContent';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useSheetTheme } from '@/hooks/useSheetTheme';
import { Meal, MealType, MealAudience, User, UserRole, BaseViewProps } from '../types';
import { suggestMeal } from '../services/geminiService';
import { detectInputLanguage } from '../services/languageDetectionService';
import { haptics } from '../utils/haptics';
import { useDemoMode } from '../contexts/DemoModeContext';

interface MealsV2Props extends BaseViewProps {
  meals: Meal[];
  users: User[];
  currentUser: User;
  onAdd: (meal: Meal) => void;
  onUpdate: (id: string, data: Partial<Meal>) => void;
  onDelete: (id: string) => void;
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

const MealsV2: React.FC<MealsV2Props> = ({
  meals,
  users,
  currentUser,
  onAdd,
  onUpdate,
  onDelete,
  t,
  currentLang
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Role-based permissions
  // ─────────────────────────────────────────────────────────────────
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  const { isViewingAsHelper } = useDemoMode();
  const isHelper = currentUser.role === UserRole.HELPER || (isSuperAdmin && isViewingAsHelper);

  const [view, setView] = useState<'list' | 'table'>('list');
  const [loadingAi, setLoadingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Scroll header hook for animation
  const { isScrolled } = useScrollHeader({ collapseThreshold: 20 });

  // Date Navigation State
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Lock body scroll when modal is open
  useScrollLock(isModalOpen);
  
  // Dim status bar when sheet is open (iOS)
  useSheetTheme(isModalOpen);
  
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  // Context for the modal (When adding new)
  const [modalDate, setModalDate] = useState<Date>(new Date());
  const [modalType, setModalType] = useState<MealType>(MealType.DINNER);
  const [modalAudience, setModalAudience] = useState<MealAudience>('ALL');

  // Form Data
  const [description, setDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Quick Join Popover State
  const [quickJoinPopoverDate, setQuickJoinPopoverDate] = useState<string | null>(null);
  const quickJoinPopoverRef = useRef<HTMLDivElement | null>(null);

  // Refs for scroll containers
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  // ─────────────────────────────────────────────────────────────────
  // Constants
  // ─────────────────────────────────────────────────────────────────
  const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER, MealType.SNACKS];
  const langCode = currentLang === 'en' ? 'en-GB' : currentLang;

  // ─────────────────────────────────────────────────────────────────
  // Date Logic Helpers
  // ─────────────────────────────────────────────────────────────────
  const formatDateStr = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get all days in the current month
  const monthDays = useMemo(() => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // Last day of month
    const daysInMonth = lastDay.getDate();
    
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [currentViewDate]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return (
      currentViewDate.getFullYear() === now.getFullYear() &&
      currentViewDate.getMonth() === now.getMonth()
    );
  }, [currentViewDate]);

  const todayIndex = useMemo(() => {
    const today = new Date();
    return monthDays.findIndex(d => d.toDateString() === today.toDateString());
  }, [monthDays]);

  // Navigation Handlers
  const nextMonth = () => {
    const d = new Date(currentViewDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentViewDate(d);
  };
  const prevMonth = () => {
    const d = new Date(currentViewDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentViewDate(d);
  };
  const goToToday = () => {
    setCurrentViewDate(new Date());
  };

  // ─────────────────────────────────────────────────────────────────
  // AUTO-SCROLL TO TODAY - useLayoutEffect (runs BEFORE paint)
  // This is the KEY to eliminating iOS flicker:
  // - useLayoutEffect runs synchronously after DOM mutations but BEFORE browser paint
  // - We scroll the page instantly so user never sees the wrong position
  // ─────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    // Only scroll list view when it becomes visible
    if (view !== 'list') return;
    if (todayIndex < 0) return;
    
    // Find today's card and scroll page to it
    const targetEl = document.querySelector(`[data-day-index="${todayIndex}"]`) as HTMLElement;
    if (!targetEl) return;
    
    // Use same offset as Meals V1: 230px
    // This accounts for: header (120px) + nav (~68px) + padding/breathing room (~42px)
    const headerOffset = 230;
    const rect = targetEl.getBoundingClientRect();
    const absoluteTop = rect.top + window.scrollY;
    
    // Scroll instantly - no animation, no visible movement
    window.scrollTo({
      top: Math.max(0, absoluteTop - headerOffset),
      behavior: 'instant' as ScrollBehavior
    });
  }, [view, todayIndex, currentViewDate]);

  // Auto-scroll table view to today's row (vertical scroll within container)
  useLayoutEffect(() => {
    if (view !== 'table') return;
    
    // Scroll page to top first so page header is visible
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });

    const container = tableScrollRef.current;
    if (!container) return;

    // If today is not in this month, start at top
    if (todayIndex < 0) {
      container.scrollTop = 0;
      return;
    }

    // If today is the 1st (index 0), don't scroll - show from top
    // Otherwise, scroll so today's row is visible with the header
    if (todayIndex === 0) {
      container.scrollTop = 0;
    } else {
      // Each day row is 80px, scroll to show today with header visible
      // Subtract a bit so we see the row above too for context
      const dayRowHeight = 80;
      const targetScroll = Math.max(0, (todayIndex - 1) * dayRowHeight);
      container.scrollTop = targetScroll;
    }
  }, [view, todayIndex, currentViewDate]);

  // ─────────────────────────────────────────────────────────────────
  // Translation Helpers
  // ─────────────────────────────────────────────────────────────────
  const getMealLabel = (type: MealType) => {
    const key = `meal.type.${type.toLowerCase()}`;
    return t[key] ?? type;
  };

  const getAudienceLabel = (audience: MealAudience) => {
    switch (audience) {
      case 'ALL': return t['meals.audience_all'] ?? 'Everyone';
      case 'ADULTS': return t['meals.audience_adults'] ?? 'Adults';
      case 'KIDS': return t['meals.audience_kids'] ?? 'Kids';
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Icons & Colors
  // ─────────────────────────────────────────────────────────────────
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

  const getAudienceColor = (audience: MealAudience) => {
    switch (audience) {
      case 'ALL': return 'bg-muted text-muted-foreground';
      case 'ADULTS': return 'bg-primary/10 text-primary';
      case 'KIDS': return 'bg-accent text-accent-foreground';
    }
  };

  const getMealsForSlot = (date: Date, type: MealType) => {
    const d = formatDateStr(date);
    return meals.filter(m => m.date === d && m.type === type);
  };

  // ─────────────────────────────────────────────────────────────────
  // User/Audience Logic
  // ─────────────────────────────────────────────────────────────────
  const canUserJoinMeal = (meal: Meal): boolean => {
    if (meal.audience === 'ALL') return true;
    if (meal.audience === 'ADULTS') return currentUser.role !== UserRole.CHILD;
    if (meal.audience === 'KIDS') return currentUser.role === UserRole.CHILD;
    return false;
  };

  const isUserInMeal = (meal: Meal): boolean => {
    return meal.forUserIds.includes(currentUser.id);
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

  // ─────────────────────────────────────────────────────────────────
  // Quick RSVP
  // ─────────────────────────────────────────────────────────────────
  const handleQuickRsvp = (meal: Meal, e: React.MouseEvent) => {
    e.stopPropagation();
    const isIn = isUserInMeal(meal);
    
    if (isIn) {
      haptics.light();
    } else {
      haptics.success();
    }
    
    const newUserIds = isIn
      ? meal.forUserIds.filter(id => id !== currentUser.id)
      : [...meal.forUserIds, currentUser.id];
    
    try {
      if (isIn && newUserIds.length === 0 && !meal.description.trim()) {
        onDelete(meal.id);
      } else {
        onUpdate(meal.id, { forUserIds: newUserIds });
      }
    } catch (err) {
      console.error('Failed to update meal:', err);
      setError(t['error.update_meal'] || 'Failed to update meal. Please try again.');
    }
  };

  const handleQuickRsvpEmpty = (date: Date, type: MealType) => {
    const dateStr = formatDateStr(date);
    const newMeal: Meal = {
      id: Date.now().toString(),
      date: dateStr,
      type,
      description: '',
      forUserIds: [currentUser.id],
      audience: currentUser.role === UserRole.CHILD ? 'KIDS' : 'ALL',
      createdBy: currentUser.id,
      descriptionLang: null,
      descriptionTranslations: {}
    };
    try {
      onAdd(newMeal);
    } catch (err) {
      console.error('Failed to add meal:', err);
      setError(t['error.add_meal'] || 'Failed to add meal. Please try again.');
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Modal Actions
  // ─────────────────────────────────────────────────────────────────
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
    const eligibleUsers = getUsersForAudience(newAudience);
    setSelectedUserIds(eligibleUsers.map(u => u.id));
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
          ...(descriptionChanged && detectedLang !== undefined ? {
            descriptionLang: detectedLang || null,
            descriptionTranslations: {}
          } : {}),
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

  // Table cell click -> go to List view for that day
  const handleTableCellClick = (date: Date) => {
    setCurrentViewDate(new Date(date));
    setView('list');
  };

  // Close quick join popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickJoinPopoverRef.current && !quickJoinPopoverRef.current.contains(event.target as Node)) {
        setQuickJoinPopoverDate(null);
      }
    };

    if (quickJoinPopoverDate) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [quickJoinPopoverDate]);

  // Date Range String
  // Month display string: "Jan 2026"
  const monthDisplayStr = currentViewDate.toLocaleDateString(langCode, { month: 'short', year: 'numeric' });

  // ─────────────────────────────────────────────────────────────────
  // Helper: Get participant counts
  // ─────────────────────────────────────────────────────────────────
  const getParticipantCounts = (userIds: string[]) => {
    const participants = userIds
      .map(uid => users.find(u => u.id === uid))
      .filter((u): u is User => !!u);
    const adultCount = participants.filter(u => u.role !== UserRole.CHILD).length;
    const kidCount = participants.filter(u => u.role === UserRole.CHILD).length;
    return { adultCount, kidCount };
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY HEADER - matches HouseholdInfo */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header 
          className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
          style={{ height: '120px' }}
        >
          <div className="flex items-center justify-between w-full">
            <div>
              <span className="text-primary font-bold" style={{ fontSize: '20px' }}>V2 Prototype</span>
              <h1 className="text-display text-foreground">
                {t['meals.title']}
              </h1>
            </div>
            
            {/* List/Table Toggle */}
            <button
              onClick={() => setView(view === 'list' ? 'table' : 'list')}
              className="p-2 rounded-full text-muted-foreground transition-colors"
            >
              {view === 'list' ? <Sheet size={20} /> : <Rows3 size={20} />}
            </button>
          </div>
        </header>

        {/* Error Banner */}
        <ErrorBanner 
          error={error} 
          onDismiss={() => setError(null)} 
          title={t['common.error'] || 'Error'}
        />

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* MONTH NAVIGATION */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div 
          className="sticky z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-5 transition-shadow duration-200"
          style={{ 
            top: '120px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          <div className="flex items-center gap-3">
            {/* Month Selector */}
            <div className="relative flex-1 flex items-center justify-between px-2 rounded-xl h-12 overflow-hidden bg-muted">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg text-muted-foreground z-10"
              >
                <ChevronLeft size={20} />
              </button>
              <span className={`text-body font-semibold tabular-nums z-10 ${isCurrentMonth ? 'text-primary' : 'text-foreground'}`}>
                {monthDisplayStr}
              </span>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg text-muted-foreground z-10"
              >
                <ChevronRight size={20} />
              </button>
              {/* Inset shadow overlay */}
              <div className="absolute inset-0 rounded-xl pointer-events-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]" />
            </div>

            {/* Today Button */}
            <button
              onClick={goToToday}
              disabled={isCurrentMonth}
              className={`px-4 rounded-xl font-semibold text-body h-12 ${
                isCurrentMonth
                  ? 'bg-muted text-muted-foreground cursor-default'
                  : 'bg-primary text-primary-foreground shadow-sm'
              }`}
            >
              {t['meals.today'] ?? 'Today'}
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* CONTENT AREA - Both views ALWAYS exist, toggle with display */}
        {/* This is the key architectural change to eliminate flicker */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div className="pt-3 relative">

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* LIST VIEW - Always mounted, hidden when not active */}
          {/* Shows all days of the month as cards */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div 
            className="space-y-4"
            style={{ display: view === 'list' ? 'block' : 'none' }}
          >
            {monthDays.map((dayDate, dayIndex) => {
              const dateStr = formatDateStr(dayDate);
              const isToday = dayDate.toDateString() === new Date().toDateString();
              const mealTypeOrder: Record<string, number> = { Breakfast: 1, Lunch: 2, Dinner: 3, Snacks: 4 };
              const dayMeals = meals
                .filter(m => m.date === dateStr)
                .sort((a, b) => (mealTypeOrder[a.type] || 99) - (mealTypeOrder[b.type] || 99));
            
              const mealRows = dayMeals.map(meal => ({ type: 'meal' as const, meal }));
              const rows = [...mealRows, { type: 'add' as const, meal: null }];

              return (
                <div 
                  key={dateStr} 
                  data-day-index={dayIndex}
                  className="bg-card rounded-xl overflow-hidden shadow-sm"
                >
                  {/* Prominent Date Header Bar */}
                  <div className={`px-4 py-3 ${isToday ? 'bg-primary' : 'bg-card'}`}>
                    <span className={`text-body font-bold ${isToday ? 'text-primary-foreground' : 'text-foreground'}`}>
                      {dayDate.toLocaleDateString(langCode, { weekday: 'short' })}, {dayDate.getDate()} {dayDate.toLocaleDateString(langCode, { month: 'short' })}
                    </span>
                  </div>

                  {/* Meal Rows */}
                  <div className="[&>*]:mx-3 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-border">
                    {rows.map((row, idx) => {
                      if (row.type === 'meal' && row.meal) {
                        const meal = row.meal;
                        const hasDish = meal.description.trim().length > 0;
                        const isIn = isUserInMeal(meal);
                        const canJoin = canUserJoinMeal(meal);
                        const { adultCount, kidCount } = getParticipantCounts(meal.forUserIds);

                        return (
                          <div key={meal.id} className="grid grid-cols-[1fr_1px_4rem_1px_7rem] h-[80px] items-center">
                            {/* Left Column: Meal Info */}
                            <div 
                              onClick={() => openEditModal(meal)}
                              className="h-full p-3 cursor-pointer flex flex-col justify-center min-w-0"
                            >
                              <span className="text-caption font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
                                {getMealIcon(meal.type)}
                                {getMealLabel(meal.type)}
                              </span>
                              {hasDish ? (
                                <span className="text-body font-semibold text-foreground leading-tight line-clamp-2 block">
                                  <TranslatedMealDescription meal={meal} currentLang={currentLang} onUpdate={onUpdate} />
                                </span>
                              ) : (
                                <button className="text-body font-semibold text-primary flex items-center gap-1">
                                  <Plus size={14} />
                                  {t['meals.add_dish'] ?? 'Add Dish'}
                                </button>
                              )}
                            </div>

                            {/* Vertical Separator */}
                            <div 
                              className="h-1/2 opacity-50"
                              style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 20%, hsl(var(--border)) 80%, transparent)' }}
                            />

                            {/* Middle Column: Participant Counts */}
                            <div 
                              onClick={() => openEditModal(meal)}
                              className="h-full p-2 cursor-pointer flex flex-col items-center justify-center gap-0.5"
                            >
                              {(adultCount > 0 || kidCount > 0) ? (
                                <>
                                  {adultCount > 0 && (
                                    <div className="flex items-center gap-1">
                                      <UserIcon size={14} className="text-muted-foreground" />
                                      <span className="text-body font-bold text-foreground">{adultCount}</span>
                                    </div>
                                  )}
                                  {kidCount > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Baby size={14} className="text-muted-foreground" />
                                      <span className="text-body font-bold text-foreground">{kidCount}</span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <UserIcon size={14} className="text-muted-foreground/40" />
                                  <span className="text-body font-medium text-muted-foreground/40">0</span>
                                </div>
                              )}
                            </div>

                            {/* Vertical Separator */}
                            <div 
                              className="h-1/2 opacity-50"
                              style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 20%, hsl(var(--border)) 80%, transparent)' }}
                            />

                            {/* Right Column: Join Button */}
                            <div className="h-full p-2 flex items-center justify-center">
                              {canJoin ? (
                                <button
                                  onClick={(e) => handleQuickRsvp(meal, e)}
                                  className={`w-[100px] px-3 text-caption font-semibold py-2 rounded-full transition-colors text-center whitespace-nowrap ${
                                    isIn
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {isIn ? (t['meals.joined'] ?? 'Joined') : (t['meals.tap_to_join'] ?? 'Tap to Join')}
                                </button>
                              ) : (
                                <span className="text-caption text-muted-foreground text-center leading-tight">
                                  {meal.audience === 'ADULTS' 
                                    ? (t['meals.adults_only'] ?? 'Adults Only')
                                    : (t['meals.kids_only'] ?? 'Kids Only')}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      } else {
                        // "Add Meal Plan" row
                        const isExpanded = quickJoinPopoverDate === dateStr;
                        const existingMealTypes = dayMeals
                          .filter(m => m.description.trim() || m.forUserIds.length > 0)
                          .map(m => m.type);
                        
                        return (
                          <div key={`add-${idx}`} className="relative">
                            {/* Expanded: Meal type picker */}
                            {isExpanded && (
                              <div 
                                ref={quickJoinPopoverRef}
                                className="absolute inset-0 bg-card z-10 flex items-center h-[80px] px-4"
                              >
                                <div className="flex-1 flex items-center justify-evenly min-w-0">
                                  {[
                                    { type: MealType.BREAKFAST, label: t['meal.type.breakfast'] || 'Breakfast', icon: <Coffee size={18} />, color: 'text-[#FF9800] border-[#FF9800]/30' },
                                    { type: MealType.LUNCH, label: t['meal.type.lunch'] || 'Lunch', icon: <Sun size={18} />, color: 'text-[#4CAF50] border-[#4CAF50]/30' },
                                    { type: MealType.DINNER, label: t['meal.type.dinner'] || 'Dinner', icon: <Moon size={18} />, color: 'text-[#7E57C2] border-[#7E57C2]/30' },
                                    { type: MealType.SNACKS, label: t['meal.type.snacks'] || 'Snack', icon: <Cookie size={18} />, color: 'text-[#F06292] border-[#F06292]/30' },
                                  ].map(({ type, label, icon, color }) => {
                                    const alreadyExists = existingMealTypes.includes(type);
                                    return (
                                      <button
                                        key={type}
                                        onClick={() => {
                                          if (alreadyExists) return;
                                          handleQuickRsvpEmpty(dayDate, type);
                                          setQuickJoinPopoverDate(null);
                                        }}
                                        disabled={alreadyExists}
                                        className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                                          alreadyExists 
                                            ? 'opacity-30 cursor-not-allowed text-muted-foreground' 
                                            : color.split(' ')[0]
                                        }`}
                                        title={alreadyExists ? `${getMealLabel(type)} already exists` : getMealLabel(type)}
                                      >
                                        <div className={`w-9 h-9 flex items-center justify-center rounded-xl border-2 bg-card transition-colors ${
                                          alreadyExists 
                                            ? 'border-muted' 
                                            : color
                                        }`}>
                                          {icon}
                                        </div>
                                        <span className="text-micro">{label}</span>
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="flex-shrink-0 pl-3">
                                  <button
                                    onClick={() => setQuickJoinPopoverDate(null)}
                                    className="w-9 h-9 flex items-center justify-center rounded-full bg-destructive/15 text-destructive"
                                  >
                                    <X size={18} />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Grid row */}
                            <div className="grid grid-cols-[1fr_1px_4rem_1px_7rem] h-[80px] items-center">
                              <div 
                                onClick={() => openAddModal(dayDate, MealType.DINNER)}
                                className="h-full p-3 cursor-pointer flex flex-col justify-center min-w-0"
                              >
                                <button className="text-body font-semibold text-muted-foreground flex items-center gap-1.5">
                                  <Plus size={16} />
                                  {t['meals.add_meal_plan'] ?? 'Add Meal Plan'}
                                </button>
                              </div>

                              <div 
                                className="h-1/2 opacity-50"
                                style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 20%, hsl(var(--border)) 80%, transparent)' }}
                              />

                              <div 
                                onClick={() => openAddModal(dayDate, MealType.DINNER)}
                                className="h-full p-2 cursor-pointer flex flex-col items-center justify-center gap-0.5"
                              >
                                <div className="flex items-center gap-1">
                                  <UserIcon size={14} className="text-muted-foreground/40" />
                                  <span className="text-body font-medium text-muted-foreground/40">0</span>
                                </div>
                              </div>

                              <div 
                                className="h-1/2 opacity-50"
                                style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 20%, hsl(var(--border)) 80%, transparent)' }}
                              />

                              <div className="h-full p-2 flex items-center justify-center">
                                <button
                                  onClick={() => setQuickJoinPopoverDate(dateStr)}
                                  className="w-[100px] px-3 text-caption font-semibold py-2 rounded-full transition-colors text-center whitespace-nowrap bg-muted text-muted-foreground"
                                >
                                  {t['meals.tap_to_join'] ?? 'Tap to Join'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* TABLE VIEW - Shows all days of the month in a grid */}
          {/* First column (dates) frozen at left */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div style={{ display: view === 'table' ? 'block' : 'none' }}>
            <div className="rounded-xl bg-card shadow-sm overflow-hidden">
              <div 
                ref={tableScrollRef}
                className="overflow-x-scroll overflow-y-auto"
                style={{ 
                  maxHeight: 'calc(100vh - 220px)',
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'none'
                }}
              >
                {/* Single grid with header as first row */}
                <div 
                  className="grid"
                  style={{ 
                    // Fixed widths to ensure horizontal scroll is needed
                    gridTemplateColumns: '80px 120px 120px 120px 120px',
                    width: 'max-content'
                  }}
                >
                  {/* ═══════════════════════════════════════════════════════════ */}
                  {/* HEADER ROW - NOT sticky (per user request) */}
                  {/* ═══════════════════════════════════════════════════════════ */}
                  
                  {/* Corner cell - sticky left only (matches date column) */}
                  <div 
                    className="sticky left-0 z-20 p-2 bg-muted border-b border-border flex items-center justify-center"
                    style={{ 
                      boxShadow: '1px 0 0 0 hsl(var(--border)), 4px 0 8px -2px rgba(0,0,0,0.1)',
                      minHeight: '52px'
                    }}
                  />

                  {/* Meal type header cells - NOT sticky */}
                  {mealTypes.map((type, typeIndex) => {
                    const isLastCol = typeIndex === mealTypes.length - 1;
                    return (
                      <div 
                        key={`header-${type}`}
                        className={`p-2 bg-muted text-center flex flex-col items-center justify-center gap-0.5 border-b border-border ${!isLastCol ? 'border-r border-border' : ''}`}
                        style={{ minHeight: '52px' }}
                      >
                        {getMealIcon(type)}
                        <span className="text-micro font-semibold text-muted-foreground leading-tight">
                          {getMealLabel(type)}
                        </span>
                      </div>
                    );
                  })}

                  {/* ═══════════════════════════════════════════════════════════ */}
                  {/* DAY ROWS - First column (dates) frozen at left */}
                  {/* ═══════════════════════════════════════════════════════════ */}
                  {monthDays.map((day, dayIndex) => {
                    const dateStr = formatDateStr(day);
                    const isToday = day.toDateString() === new Date().toDateString();
                    const isLastRow = dayIndex === monthDays.length - 1;
                    
                    return (
                      <React.Fragment key={dateStr}>
                        {/* Date cell - frozen at left (sticky left-0) */}
                        <div 
                          data-day-row={dayIndex}
                          onClick={() => handleTableCellClick(day)}
                          className={`sticky left-0 z-10 p-1.5 text-center cursor-pointer flex flex-col items-center justify-center ${!isLastRow ? 'border-b border-border' : ''} ${isToday ? 'bg-primary' : 'bg-card'}`}
                          style={{ 
                            boxShadow: '1px 0 0 0 hsl(var(--border)), 4px 0 8px -2px rgba(0,0,0,0.1)',
                            minHeight: '80px'
                          }}
                        >
                          <span className={`text-micro font-semibold block ${isToday ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            {day.toLocaleDateString(langCode, { weekday: 'short' })}
                          </span>
                          <span className={`text-caption font-bold block ${isToday ? 'text-primary-foreground' : 'text-foreground'}`}>
                            {day.getDate()} {day.toLocaleDateString(langCode, { month: 'short' })}
                          </span>
                        </div>

                        {/* Meal cells for this day */}
                        {mealTypes.map((type, typeIndex) => {
                          const slotMeals = getMealsForSlot(day, type);
                          const isLastCol = typeIndex === mealTypes.length - 1;
                          
                          return (
                            <div
                              key={`${dateStr}-${type}`}
                              onClick={() => handleTableCellClick(day)}
                              className={`p-1.5 cursor-pointer bg-card border-border ${!isLastRow ? 'border-b' : ''} ${!isLastCol ? 'border-r' : ''}`}
                              style={{ minHeight: '80px' }}
                            >
                              {slotMeals.length > 0 ? (
                                <div className="space-y-1">
                                  {slotMeals.map(meal => {
                                    const hasDish = meal.description.trim().length > 0;
                                    const mealUsers = meal.forUserIds
                                      .map(uid => users.find(u => u.id === uid))
                                      .filter((u): u is User => !!u);
                                    const adultCount = mealUsers.filter(u => u.role !== UserRole.CHILD).length;
                                    const kidCount = mealUsers.filter(u => u.role === UserRole.CHILD).length;
                                    
                                    return (
                                      <div
                                        key={meal.id}
                                        className="px-1.5 py-1 rounded-md bg-muted/50"
                                      >
                                        {hasDish ? (
                                          <span className="text-micro font-semibold text-foreground leading-tight block break-words">
                                            <TranslatedMealDescription meal={meal} currentLang={currentLang} onUpdate={onUpdate} />
                                          </span>
                                        ) : (
                                          <span className="text-micro font-medium text-muted-foreground block">
                                            RSVP
                                          </span>
                                        )}
                                        <div className="flex items-center gap-1 text-micro text-muted-foreground mt-0.5">
                                          {adultCount > 0 && (
                                            <span className="flex items-center gap-0.5">
                                              <UserIcon size={10} />
                                              {adultCount}
                                            </span>
                                          )}
                                          {kidCount > 0 && (
                                            <span className="flex items-center gap-0.5">
                                              <Baby size={10} />
                                              {kidCount}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <span className="text-muted-foreground/30 text-lg">·</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>
        {/* End of CONTENT AREA */}

        {/* Footer */}
        <div className="helpy-footer">
          <span className="helpy-logo">helpy</span>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* MEAL MODAL - Bottom Sheet Style */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {isModalOpen && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div 
            className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col"
            style={{ maxHeight: '88vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}
          >
            {/* Header with X left, Title center, ✓ right */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
                aria-label={t['common.close'] || 'Close'}
              >
                <X size={20} />
              </button>
              
              <h2 className="text-title font-semibold text-foreground text-center flex-1">
                {`${modalDate.toLocaleDateString(langCode, { weekday: 'short' })}, ${modalDate.getDate()} ${modalDate.toLocaleDateString(langCode, { month: 'short' })}`}
              </h2>
              
              <button
                onClick={handleSave}
                disabled={!description.trim()}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  description.trim()
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground'
                }`}
                aria-label={t['common.save'] || 'Save'}
              >
                <Check size={20} strokeWidth={3} />
              </button>
            </div>
            
            {/* Header separator */}
            <div className="px-5"><div className="h-px bg-border w-full"></div></div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Main Input: Dish Name */}
              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                  {t['meals.whats_cooking'] ?? 'Dish Name'}
                </label>
                <textarea
                  rows={2}
                  autoComplete="one-time-code"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`${t['meals.whats_for'] ?? "What's for"} ${getMealLabel(modalType).toLowerCase()}?`}
                  className="w-full bg-muted border border-transparent rounded-xl px-4 py-3 text-xl font-semibold focus:border-primary outline-none text-foreground resize-none placeholder-light transition-colors"
                />
              </div>

              {/* Search Recipe in YouTube */}
              <button
                onClick={() => {
                  if (!description.trim()) return;
                  
                  const searchQuery = encodeURIComponent(`Recipe: ${description.trim()}`);
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  const isAndroid = /Android/.test(navigator.userAgent);
                  
                  if (isIOS) {
                    window.location.href = `youtube://www.youtube.com/results?search_query=${searchQuery}`;
                    setTimeout(() => {
                      if (document.visibilityState === 'visible') {
                        window.location.href = `https://www.youtube.com/results?search_query=${searchQuery}`;
                      }
                    }, 500);
                  } else if (isAndroid) {
                    window.location.href = `intent://www.youtube.com/results?search_query=${searchQuery}#Intent;scheme=https;package=com.google.android.youtube;end`;
                  } else {
                    window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
                  }
                }}
                disabled={!description.trim()}
                className={`w-full py-3 rounded-xl text-body font-semibold flex items-center justify-center gap-2 ${
                  description.trim()
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Youtube size={18} />
                {t['meals.search_youtube'] ?? 'Search Recipe in YouTube'}
              </button>

              {/* Meal Type Selector */}
              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                  {t['meals.meal_type'] ?? 'Meal Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {mealTypes.map(type => {
                    const isSelected = modalType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setModalType(type)}
                        className={`py-2.5 rounded-xl transition-colors flex items-center justify-start gap-2 px-3 ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card ring-1 ring-border text-foreground'
                        }`}
                      >
                        {getMealIcon(type, isSelected)}
                        <span className="text-body font-medium">{getMealLabel(type)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Audience Selector */}
              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                  {t['meals.audience_label'] ?? 'This meal is for'}
                </label>
                <div className="flex gap-2">
                  {(['ALL', 'ADULTS', 'KIDS'] as const).map(aud => {
                    const active = modalAudience === aud;
                    return (
                      <button
                        key={aud}
                        onClick={() => handleAudienceChange(aud)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-body transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-foreground ring-1 ring-border'
                        }`}
                      >
                        {getAudienceLabel(aud)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* People Section */}
              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2 flex items-center gap-2">
                  <Users size={14} /> {t['meals.who_eating'] ?? "Who's eating?"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {getUsersForAudience(modalAudience).map(user => {
                    const isSelected = selectedUserIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleUser(user.id)}
                        className={`flex items-center justify-start gap-2 px-3 py-2 rounded-xl text-body transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-foreground ring-1 ring-border'
                        }`}
                      >
                        <Avatar
                          user={user}
                          size="xs"
                        />
                        <span>{user.id === currentUser.id ? (t['common.you'] ?? 'You') : user.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer - Delete button only (when editing), or invisible spacer */}
            {editingMealId && !isHelper ? (
              <>
                <div className="px-5"><div className="h-px bg-border w-full"></div></div>
                <div className="shrink-0 p-5 pb-8">
                  <button
                    onClick={handleDelete}
                    className="w-full py-3.5 rounded-xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"
                  >
                    <Trash2 size={20} />
                    {t['meals.delete_meal'] ?? 'Delete Meal'}
                  </button>
                </div>
              </>
            ) : (
              <div className="shrink-0 p-5 pb-8">
                <div className="h-[52px]"></div>
              </div>
            )}
          </div>
        </div>
      , document.body)}

    </div>
  );
};

export default MealsV2;

