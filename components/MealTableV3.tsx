import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  // SINGLE SCROLL CONTAINER (True Google Calendar approach)
  // No JS sync needed - CSS sticky handles everything!
  // ─────────────────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Cell dimensions
  const DATE_COL_WIDTH = 70;
  const MEAL_COL_WIDTH = 100;
  const HEADER_HEIGHT = 50;
  const MIN_ROW_HEIGHT = 60;

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
        {/* GOOGLE CALENDAR STYLE - Single Scroll Container + CSS Sticky */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div className="pt-1">
          {/* Single scroll container - handles BOTH horizontal and vertical scroll */}
          <div 
            ref={scrollContainerRef}
            className="rounded-xl bg-card shadow-sm border border-border overflow-auto"
            style={{ 
              maxHeight: '70vh',
              scrollSnapType: 'x proximity' // Natural horizontal snap
            }}
          >
            {/* CSS Grid table - sticky positioning for frozen header + column */}
            <div 
              className="grid"
              style={{ 
                gridTemplateColumns: `${DATE_COL_WIDTH}px repeat(${mealTypes.length}, ${MEAL_COL_WIDTH}px)`,
                width: `${DATE_COL_WIDTH + MEAL_COL_WIDTH * mealTypes.length}px`
              }}
            >
              {/* ═══════════════════════════════════════════════════════════ */}
              {/* ROW 0: HEADER (Corner + Meal Types) */}
              {/* ═══════════════════════════════════════════════════════════ */}
              
              {/* Corner cell - sticky BOTH top and left */}
              <div 
                className="bg-muted border-b border-r border-border flex items-center justify-center sticky top-0 left-0 z-20"
                style={{ height: `${HEADER_HEIGHT}px` }}
              >
                <span className="text-caption font-semibold text-muted-foreground">
                  {t['meals.date'] ?? 'Date'}
                </span>
              </div>
              
              {/* Header cells - sticky top only + snap align */}
              {mealTypes.map((type, idx) => (
                <div 
                  key={type}
                  className={`bg-muted border-b border-border flex flex-col items-center justify-center gap-0.5 sticky top-0 z-10 ${
                    idx < mealTypes.length - 1 ? 'border-r' : ''
                  }`}
                  style={{ height: `${HEADER_HEIGHT}px`, scrollSnapAlign: 'start' }}
                >
                  {getMealIcon(type)}
                  <span className="text-caption font-semibold text-muted-foreground">
                    {getMealLabel(type)}
                  </span>
                </div>
              ))}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* ROWS 1-7: Data rows (Date + Meal Cells) */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {weekDays.map((day, dayIdx) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const isLastRow = dayIdx === weekDays.length - 1;
                
                return (
                  <React.Fragment key={formatDateStr(day)}>
                    {/* Date cell - sticky left only */}
                    <div
                      className={`flex flex-col items-center justify-center sticky left-0 z-10 ${
                        !isLastRow ? 'border-b border-border' : ''
                      } border-r border-border ${isToday ? 'bg-primary' : 'bg-card'}`}
                      style={{ minHeight: `${MIN_ROW_HEIGHT}px` }}
                    >
                      <span className={`text-caption font-semibold ${isToday ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {day.toLocaleDateString(langCode, { weekday: 'short' })}
                      </span>
                      <span className={`text-body font-bold ${isToday ? 'text-primary-foreground' : 'text-foreground'}`}>
                        {day.getDate()}
                      </span>
                    </div>
                    
                    {/* Meal cells - normal (not sticky) */}
                    {mealTypes.map((type, typeIdx) => {
                      const slotMeals = getMealsForSlot(day, type);
                      const isLastCol = typeIdx === mealTypes.length - 1;
                      
                      return (
                        <div
                          key={`${formatDateStr(day)}-${type}`}
                          className={`p-2 bg-card ${!isLastRow ? 'border-b border-border' : ''} ${!isLastCol ? 'border-r border-border' : ''}`}
                          style={{ minHeight: `${MIN_ROW_HEIGHT}px` }}
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

          {/* Info text */}
          <p className="text-caption text-muted-foreground text-center mt-4">
            Google Calendar style: single scroll container + CSS sticky
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
