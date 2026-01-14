import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import {
  Coffee,
  Sun,
  Moon,
  Cookie,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Baby,
  User as UserIcon
} from 'lucide-react';
import { useScrollHeader } from '@/hooks/useScrollHeader';
import { useTranslatedContent } from '@/hooks/useTranslatedContent';
import { Meal, MealType, User, UserRole, TranslationDictionary } from '../types';

interface MealTableV3Props {
  meals: Meal[];
  users: User[];
  currentUser: User;
  onUpdate?: (id: string, data: Partial<Meal>) => void;
  onBack: () => void;
  t: TranslationDictionary;
  currentLang: string;
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

const MealTableV3: React.FC<MealTableV3Props> = ({
  meals,
  users,
  currentUser,
  onUpdate,
  onBack,
  t,
  currentLang
}) => {
  // Scroll header hook for animation
  const { isScrolled } = useScrollHeader({ collapseThreshold: 20 });

  // Date Navigation State
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  // Row heights state - will be measured after render
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  const [heightsReady, setHeightsReady] = useState(false);

  const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER, MealType.SNACKS];
  const langCode = currentLang === 'en' ? 'en-GB' : currentLang;

  // --- Translation Helper ---
  const getMealLabel = (type: MealType) => {
    const key = `meal.type.${type.toLowerCase()}`;
    return t[key] ?? type;
  };

  // --- Date Logic Helpers ---
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

  // --- Icons ---
  const getMealIcon = (type: MealType) => {
    const colorClass = {
      [MealType.BREAKFAST]: 'text-[#FF9800]',
      [MealType.LUNCH]: 'text-[#4CAF50]',
      [MealType.DINNER]: 'text-[#7E57C2]',
      [MealType.SNACKS]: 'text-[#F06292]',
    }[type];
    
    switch (type) {
      case MealType.BREAKFAST: return <Coffee size={16} className={colorClass} />;
      case MealType.LUNCH: return <Sun size={16} className={colorClass} />;
      case MealType.DINNER: return <Moon size={16} className={colorClass} />;
      case MealType.SNACKS: return <Cookie size={16} className={colorClass} />;
      default: return null;
    }
  };

  const getMealsForSlot = (date: Date, type: MealType) => {
    const d = formatDateStr(date);
    return meals.filter(m => m.date === d && m.type === type);
  };

  // Date Range String
  const dateRangeStr = `${weekDays[0].toLocaleDateString(langCode, { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString(langCode, { day: 'numeric', month: 'short' })}`;

  // ─────────────────────────────────────────────────────────────────
  // SPLIT-PANE TABLE REFS (Google Calendar approach)
  // ─────────────────────────────────────────────────────────────────
  const leftColRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bodyRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // No scroll sync needed - header and body are in the SAME scroll container!

  // Cell dimensions
  const DATE_COL_WIDTH = 90;
  const MEAL_COL_WIDTH = 110;
  const MIN_ROW_HEIGHT = 56; // Minimum row height (fits 7 days on mobile)

  // Measure row heights after render and sync left column
  // Use offsetHeight (actual rendered height) not scrollHeight
  const measureRowHeights = useCallback(() => {
    const heights: number[] = [];
    bodyRowRefs.current.forEach((rowEl, idx) => {
      if (rowEl) {
        // offsetHeight = actual rendered height (what browser calculated)
        const height = Math.max(rowEl.offsetHeight, MIN_ROW_HEIGHT);
        heights[idx] = height;
      } else {
        heights[idx] = MIN_ROW_HEIGHT;
      }
    });
    
    // Only update if heights changed
    const heightsChanged = heights.some((h, i) => h !== rowHeights[i]) || heights.length !== rowHeights.length;
    if (heightsChanged) {
      setRowHeights(heights);
    }
    // Mark heights as ready (removes invisible state)
    if (!heightsReady) {
      setHeightsReady(true);
    }
  }, [rowHeights, heightsReady]);

  // Measure after initial render and when meals change
  useLayoutEffect(() => {
    measureRowHeights();
  }, [meals, weekDays, currentViewDate]);

  // Re-measure after a short delay to catch any async content
  useEffect(() => {
    const timer = setTimeout(measureRowHeights, 100);
    return () => clearTimeout(timer);
  }, [meals, weekDays, measureRowHeights]);

  // Calculate total body height for container
  const totalBodyHeight = useMemo(() => {
    if (rowHeights.length === 0) return MIN_ROW_HEIGHT * 7;
    return rowHeights.reduce((sum, h) => sum + h, 0);
  }, [rowHeights]);

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY HEADER - Same as Meals */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header 
          className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
          style={{ height: '120px' }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 -ml-2 rounded-full text-muted-foreground"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-display text-foreground">
                {t['meals.title']} V3
              </h1>
            </div>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* WEEK NAVIGATION - Same as Meals */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div 
          className="sticky z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-5 transition-shadow duration-200"
          style={{ 
            top: '120px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          <div className="flex items-center gap-3">
            {/* Week Selector */}
            <div className="relative flex-1 flex items-center justify-between px-2 rounded-xl h-12 overflow-hidden bg-muted">
              <button
                onClick={prevWeek}
                className="p-2 rounded-lg text-muted-foreground z-10"
              >
                <ChevronLeft size={20} />
              </button>
              <span className={`text-body font-semibold tabular-nums z-10 ${isCurrentWeek ? 'text-primary' : 'text-foreground'}`}>{dateRangeStr}</span>
              <button
                onClick={nextWeek}
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
              disabled={isCurrentWeek}
              className={`px-4 rounded-xl font-semibold text-body h-12 ${
                isCurrentWeek
                  ? 'bg-muted text-muted-foreground cursor-default'
                  : 'bg-primary text-primary-foreground shadow-sm'
              }`}
            >
              {t['meals.today'] ?? 'Today'}
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* SPLIT-PANE TABLE - Single Scroll Container Approach */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div className="pt-1">
          <div 
            className="rounded-xl bg-card shadow-sm border border-border overflow-x-hidden"
          >
            {/* Grid Layout: 2 columns (left fixed, right scrolls) */}
            <div 
              className="grid"
              style={{ gridTemplateColumns: `${DATE_COL_WIDTH}px 1fr` }}
            >
              {/* ═══════════════════════════════════════════════════════════ */}
              {/* LEFT SIDE: Corner + Date Column (Fixed) */}
              {/* ═══════════════════════════════════════════════════════════ */}
              <div ref={leftColRef} className="border-r border-border">
                {/* Corner cell */}
                <div 
                  className="bg-muted border-b border-border flex items-center justify-center"
                  style={{ height: '50px' }}
                >
                  <span className="text-caption font-semibold text-muted-foreground">
                    {t['meals.date'] ?? 'Date'}
                  </span>
                </div>
                {/* Date cells */}
                <div className="flex flex-col">
                  {weekDays.map((day, dayIdx) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    const isLastRow = dayIdx === weekDays.length - 1;
                    const rowHeight = rowHeights[dayIdx] || MIN_ROW_HEIGHT;
                    
                    return (
                      <div
                        key={formatDateStr(day)}
                        className={`flex flex-col items-center justify-center shrink-0 ${
                          !isLastRow ? 'border-b border-border' : ''
                        } ${isToday ? 'bg-primary' : 'bg-card'}`}
                        style={{ height: `${rowHeight}px`, width: `${DATE_COL_WIDTH}px` }}
                      >
                        <span className={`text-caption font-semibold ${isToday ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {day.toLocaleDateString(langCode, { weekday: 'short' })}
                        </span>
                        <span className={`text-body font-bold ${isToday ? 'text-primary-foreground' : 'text-foreground'}`}>
                          {day.getDate()} {day.toLocaleDateString(langCode, { month: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* RIGHT SIDE: Header + Body in SAME scroll container */}
              {/* ═══════════════════════════════════════════════════════════ */}
              <div 
                ref={scrollContainerRef}
                className="overflow-x-auto overflow-y-visible scrollbar-hide"
                style={{ 
                  overscrollBehaviorX: 'none',
                  scrollSnapType: 'x mandatory'
                }}
              >
                <div style={{ width: `${MEAL_COL_WIDTH * mealTypes.length}px` }}>
                  {/* Header row (inside scroll container) */}
                  <div 
                    className="flex bg-muted border-b border-border"
                    style={{ height: '50px' }}
                  >
                    {mealTypes.map((type, idx) => (
                      <div 
                        key={type}
                        className={`flex flex-col items-center justify-center gap-1 shrink-0 ${
                          idx < mealTypes.length - 1 ? 'border-r border-border' : ''
                        }`}
                        style={{ 
                          width: `${MEAL_COL_WIDTH}px`,
                          scrollSnapAlign: 'start'
                        }}
                      >
                        {getMealIcon(type)}
                        <span className="text-caption font-semibold text-muted-foreground">
                          {getMealLabel(type)}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Body rows */}
                  <div className="flex flex-col">
                    {weekDays.map((day, dayIdx) => {
                      const isLastRow = dayIdx === weekDays.length - 1;
                      
                      return (
                        <div 
                          key={formatDateStr(day)}
                          ref={el => bodyRowRefs.current[dayIdx] = el}
                          className={`flex shrink-0 ${!isLastRow ? 'border-b border-border' : ''}`}
                          style={{ minHeight: `${MIN_ROW_HEIGHT}px` }}
                        >
                        {mealTypes.map((type, typeIdx) => {
                          const slotMeals = getMealsForSlot(day, type);
                          const isLastCol = typeIdx === mealTypes.length - 1;
                          
                          return (
                            <div
                              key={`${formatDateStr(day)}-${type}`}
                              className={`p-2 shrink-0 ${!isLastCol ? 'border-r border-border' : ''}`}
                              style={{ 
                                width: `${MEAL_COL_WIDTH}px`,
                                scrollSnapAlign: 'start' // Snap point at each column
                              }}
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
                                          <span className="text-caption font-semibold text-foreground leading-tight block break-words">
                                            <TranslatedMealDescription meal={meal} currentLang={currentLang} onUpdate={onUpdate} />
                                          </span>
                                        ) : (
                                          <span className="text-caption font-semibold text-muted-foreground block">
                                            RSVP
                                          </span>
                                        )}
                                        {/* RSVP counts */}
                                        <div className="flex items-center gap-1 text-caption text-muted-foreground mt-0.5">
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
                                <div className="flex items-center justify-center" style={{ minHeight: `${MIN_ROW_HEIGHT - 16}px` }}>
                                  <span className="text-muted-foreground/30 text-lg">·</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Info text */}
          <p className="text-caption text-muted-foreground text-center mt-4">
            Split-pane table with frozen header row and first column (Google Calendar approach)
          </p>
        </div>

        {/* Footer */}
        <div className="helpy-footer">
          <span className="helpy-logo">helpy</span>
        </div>
      </div>
    </div>
  );
};

export default MealTableV3;
