import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  X,
  Users,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Edit2,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  UserCheck,
  UserPlus,
  User as UserIcon,
  Baby,
  LayoutList,
  LayoutGrid
} from 'lucide-react';
import { useScrollHeader } from '@/hooks/useScrollHeader';
import { Meal, MealType, MealAudience, User, UserRole, BaseViewProps } from '../types';
import { suggestMeal } from '../services/geminiService';

interface MealsProps extends BaseViewProps {
  meals: Meal[];
  users: User[];
  currentUser: User;
  onAdd: (meal: Meal) => void;
  onUpdate: (id: string, data: Partial<Meal>) => void;
  onDelete: (id: string) => void;
}

const Meals: React.FC<MealsProps> = ({
  meals,
  users,
  currentUser,
  onAdd,
  onUpdate,
  onDelete,
  t,
  currentLang
}) => {
  const [view, setView] = useState<'day' | 'week'>('day');
  const [loadingAi, setLoadingAi] = useState(false);
  
  // Scroll header hook for animation
  // - cooldown: 300ms to handle elastic bounce
  // - expandThreshold: 40px so header expands sooner when scrolling back up
  const { isScrolled } = useScrollHeader({ cooldown: 300, expandThreshold: 40 });

  // Date Navigation State
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  // Context for the modal (When adding new)
  const [modalDate, setModalDate] = useState<Date>(new Date());
  const [modalType, setModalType] = useState<MealType>(MealType.DINNER);
  const [modalAudience, setModalAudience] = useState<MealAudience>('ALL');

  // Form Data
  const [description, setDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Ref: Day view container for auto-scroll to current day
  const dayViewRef = useRef<HTMLDivElement | null>(null);

  // Ref: Track if we should auto-scroll (only on view change or Today click)
  const shouldAutoScroll = useRef(false);

  const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER, MealType.SNACKS];
  const langCode = currentLang === 'en' ? 'en-GB' : currentLang;

  // --- Translation Helper ---
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

  // --- Date Logic Helpers ---
  // Format date to YYYY-MM-DD in local timezone (avoids UTC conversion issues)
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
  // Colors based on brand palette: #3EAFD2, #FF9800, #7E57C2, #4CAF50, #F06292, #AB47BC
  const getMealIcon = (type: MealType) => {
    switch (type) {
      case MealType.BREAKFAST: return <Coffee size={14} className="text-[#FF9800]" />;
      case MealType.LUNCH: return <Sun size={14} className="text-[#4CAF50]" />;
      case MealType.DINNER: return <Moon size={14} className="text-[#7E57C2]" />;
      case MealType.SNACKS: return <Cookie size={14} className="text-[#F06292]" />;
    }
  };

  const getMealColor = (type: MealType) => {
    switch (type) {
      case MealType.BREAKFAST: return 'text-[#FF9800] bg-[#FFF3E0] border-[#FF9800]/30';
      case MealType.LUNCH: return 'text-[#4CAF50] bg-[#E8F5E9] border-[#4CAF50]/30';
      case MealType.DINNER: return 'text-[#7E57C2] bg-[#EDE7F6] border-[#7E57C2]/30';
      case MealType.SNACKS: return 'text-[#F06292] bg-[#FCE4EC] border-[#F06292]/30';
    }
  };

  const getAudienceColor = (audience: MealAudience) => {
    switch (audience) {
      case 'ALL': return 'bg-muted text-muted-foreground';
      case 'ADULTS': return 'bg-primary/10 text-primary';
      case 'KIDS': return 'bg-accent text-accent-foreground';
    }
  };

  // Render audience icons next to meal type
  const renderAudienceIcons = (audience: MealAudience) => {
    switch (audience) {
      case 'ADULTS':
        return <UserIcon size={10} className="text-gray-400" />;
      case 'KIDS':
        return <Baby size={10} className="text-gray-400" />;
      case 'ALL':
      default:
        return (
          <span className="flex items-center gap-0.5">
            <UserIcon size={10} className="text-gray-400" />
            <Baby size={10} className="text-gray-400" />
          </span>
        );
    }
  };

  const getMealsForSlot = (date: Date, type: MealType) => {
    const d = formatDateStr(date);
    return meals.filter(m => m.date === d && m.type === type);
  };

  // --- User/Audience Logic ---
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
    switch (audience) {
      case 'ALL': return users;
      case 'ADULTS': return users.filter(u => u.role !== UserRole.CHILD);
      case 'KIDS': return users.filter(u => u.role === UserRole.CHILD);
    }
  };

  // --- Quick RSVP ---
  const handleQuickRsvp = (meal: Meal, e: React.MouseEvent) => {
    e.stopPropagation();
    const isIn = isUserInMeal(meal);
    const newUserIds = isIn
      ? meal.forUserIds.filter(id => id !== currentUser.id)
      : [...meal.forUserIds, currentUser.id];
    onUpdate(meal.id, { forUserIds: newUserIds });
  };

  // Quick RSVP for empty slot - create availability entry
  const handleQuickRsvpEmpty = (date: Date, type: MealType) => {
    const dateStr = formatDateStr(date);
    const newMeal: Meal = {
      id: Date.now().toString(),
      date: dateStr,
      type,
      description: '',
      forUserIds: [currentUser.id],
      audience: currentUser.role === UserRole.CHILD ? 'KIDS' : 'ALL'
    };
    onAdd(newMeal);
  };

  // --- Avatars for eaters ---
  const renderEaterAvatars = (userIds: string[], maxShow: number = 4) => {
    const eaters = userIds
      .map(uid => users.find(u => u.id === uid))
      .filter((u): u is User => !!u);

    const visible = eaters.slice(0, maxShow);
    const remaining = eaters.length - visible.length;

    return (
      <div className="flex items-center -space-x-2">
        {visible.map(u => (
          <img
            key={u.id}
            src={u.avatar}
            alt={u.name}
            title={u.name}
            className={`w-6 h-6 rounded-full border-2 border-white bg-gray-200 object-cover ${
              u.id === currentUser.id ? 'ring-2 ring-brand-primary ring-offset-1' : ''
            }`}
          />
        ))}
        {remaining > 0 && (
          <span className="text-[10px] font-bold text-gray-600 bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
            +{remaining}
          </span>
        )}
      </div>
    );
  };

  // --- Modal Actions ---
  const openAddModal = (date: Date, type: MealType) => {
    setEditingMealId(null);
    setModalDate(date);
    setModalType(type);
    setModalAudience('ALL');
    setDescription('');
    // Auto-select all non-helper users
    setSelectedUserIds(users.filter(u => u.role !== UserRole.HELPER).map(u => u.id));
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

  // When audience changes, auto-select appropriate users
  const handleAudienceChange = (newAudience: MealAudience) => {
    setModalAudience(newAudience);
    const eligibleUsers = getUsersForAudience(newAudience);
    // Auto-select all eligible users (except helper by default for ALL)
    if (newAudience === 'ALL') {
      setSelectedUserIds(eligibleUsers.filter(u => u.role !== UserRole.HELPER).map(u => u.id));
    } else {
      setSelectedUserIds(eligibleUsers.map(u => u.id));
    }
  };

  const handleSave = () => {
    const hasDish = description.trim().length > 0;
    const hasPeople = selectedUserIds.length > 0;
    if (!hasDish && !hasPeople) return;

    const dateStr = formatDateStr(modalDate);
    if (editingMealId) {
      onUpdate(editingMealId, {
        description,
        forUserIds: selectedUserIds,
        type: modalType,
        audience: modalAudience
      });
    } else {
      const newMeal: Meal = {
        id: Date.now().toString(),
        date: dateStr,
        type: modalType,
        description,
        forUserIds: selectedUserIds,
        audience: modalAudience
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

  // Week cell click -> go to Day view
  const handleWeekCellClick = (date: Date) => {
    shouldAutoScroll.current = true;
    setCurrentViewDate(new Date(date));
    setView('day');
  };

  // Go to today (with auto-scroll)
  const goToTodayWithScroll = () => {
    shouldAutoScroll.current = true;
    goToToday();
  };

  // Auto-scroll Day view (only when explicitly requested)
  useEffect(() => {
    if (view !== 'day') return;
    if (!shouldAutoScroll.current) return;

    // Small delay to ensure DOM is updated after week change
    const timeoutId = setTimeout(() => {
      const targetDateStr = formatDateStr(new Date(currentViewDate));
    const targetEl = document.getElementById(`day-${targetDateStr}`);
      
      if (targetEl) {
        // Calculate scroll position with offset for sticky header + breathing room
        const headerOffset = 200;
        const elementPosition = targetEl.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: elementPosition - headerOffset, behavior: 'auto' });
      }
      shouldAutoScroll.current = false;
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [view, currentViewDate]);

  // Date Range String
  const dateRangeStr = `${weekDays[0].toLocaleDateString(langCode, { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString(langCode, { day: 'numeric', month: 'short' })}`;

  // --- Render Split Meal Card (for existing meals) ---
  const renderMealCard = (meal: Meal, compact: boolean = false) => {
    const hasDish = meal.description.trim().length > 0;
    const isIn = isUserInMeal(meal);
    const canJoin = canUserJoinMeal(meal);
    const eaterCount = meal.forUserIds.length;
    const eaters = meal.forUserIds
      .map(uid => users.find(u => u.id === uid))
      .filter((u): u is User => !!u);

  return (
      <div
        key={meal.id}
        className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm"
      >
        {/* Split Content: LEFT (Dish) | RIGHT (Who's Eating) */}
        <div className="flex divide-x divide-border min-h-[100px]">
          {/* LEFT: Dish Section */}
          <div 
            onClick={() => openEditModal(meal)}
            className="flex-1 p-3 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col"
          >
            {/* Audience Badge */}
            <span className={`text-caption font-semibold px-2 py-0.5 rounded-full self-start mb-2 ${getAudienceColor(meal.audience || 'ALL')}`}>
              {getAudienceLabel(meal.audience || 'ALL')}
            </span>
            
            {hasDish ? (
              <div className="flex-1 flex flex-col">
                <p className={`font-semibold text-foreground leading-tight flex-1 ${compact ? 'text-caption' : 'text-body'}`}>
                  {meal.description}
                </p>
                <button className="flex items-center gap-1 text-caption font-medium text-muted-foreground hover:text-primary transition-colors mt-2">
                  <Edit2 size={10} />
                  {t['meals.edit_dish'] ?? 'Edit dish'}
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <button className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-caption font-semibold text-muted-foreground transition-colors">
                  <Plus size={14} />
                  {t['meals.plan_dish'] ?? 'Plan Dish'}
                </button>
                <span className="text-caption text-muted-foreground mt-1.5">
                  {t['meals.no_dish_yet'] ?? 'No dish yet'}
                </span>
              </div>
            )}
        </div>

          {/* RIGHT: Who's Eating Section */}
          <div className="flex-1 p-3 flex flex-col">
            <div className="flex items-center gap-1 mb-2">
              <Users size={12} className="text-muted-foreground" />
              <span className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                {t['meals.eating'] ?? 'Eating'} ({eaterCount})
              </span>
            </div>

            {/* Avatars Grid */}
            {eaterCount > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2 flex-1">
                {eaters.slice(0, 6).map(u => (
                  <div key={u.id} className="flex flex-col items-center">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      title={u.name}
                      className={`w-7 h-7 rounded-full bg-muted object-cover border-2 ${
                        u.id === currentUser.id ? 'border-primary' : 'border-card'
                      }`}
                    />
                    {!compact && (
                      <span className={`text-[8px] font-medium mt-0.5 ${
                        u.id === currentUser.id ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {u.id === currentUser.id ? 'You' : u.name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                ))}
                {eaterCount > 6 && (
                  <div className="flex flex-col items-center">
                    <span className="w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-caption font-semibold text-muted-foreground">
                      +{eaterCount - 6}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-caption text-muted-foreground italic mb-2 flex-1">
                {t['meals.no_one_yet'] ?? 'No one yet'}
              </p>
            )}

            {/* Join/Leave Button - Pill shaped with opacity bg */}
            {canJoin ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickRsvp(meal, e);
                }}
                className={`text-caption font-semibold px-4 py-1.5 rounded-full transition-all flex items-center justify-center gap-1.5 ${
                  isIn
                    ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                    : 'bg-primary/15 text-primary hover:bg-primary/25'
                }`}
              >
                {isIn ? (
                  <>
                    {t['meals.leave'] ?? 'Leave'} <X size={12} />
                  </>
                ) : (
                  <>
                    Join <Plus size={12} />
                  </>
                )}
              </button>
            ) : (
              <div className="text-center py-1.5 text-caption text-muted-foreground italic">
                {t['meals.not_for_you'] ?? 'Not for you'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Render Empty Slot Card (same split design) ---
  const renderEmptySlotCard = (date: Date, type: MealType) => {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card overflow-hidden hover:border-foreground/20 transition-all">
        {/* Split Content: LEFT (Dish) | RIGHT (Who's Eating) */}
        <div className="flex divide-x divide-border min-h-[100px]">
          {/* LEFT: Plan Dish Section */}
          <div 
            onClick={() => openAddModal(date, type)}
            className="flex-1 p-3 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center justify-center"
          >
            <button className="flex items-center gap-1.5 px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-xl text-caption font-semibold text-muted-foreground transition-colors">
              <Plus size={16} />
              {t['meals.plan_dish'] ?? 'Plan Dish'}
            </button>
            <span className="text-caption text-muted-foreground mt-2">
              {t['meals.whats_for'] ?? "What's for"} {getMealLabel(type).toLowerCase()}?
            </span>
          </div>

          {/* RIGHT: RSVP Section */}
          <div className="flex-1 p-3 flex flex-col">
            <div className="flex items-center gap-1 mb-2">
              <Users size={12} className="text-muted-foreground" />
              <span className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                {t['meals.eating'] ?? 'Eating'} (0)
              </span>
            </div>

            <p className="text-caption text-muted-foreground italic mb-2 flex-1">
              {t['meals.no_one_yet'] ?? 'No one yet'}
            </p>

            {/* Quick RSVP Button */}
            <button
              onClick={() => handleQuickRsvpEmpty(date, type)}
              className="w-full py-2 rounded-lg text-caption font-semibold transition-all flex items-center justify-center gap-1.5 bg-muted text-muted-foreground hover:bg-muted/80 border border-dashed border-border"
            >
              <UserPlus size={14} />
              {t['meals.ill_be_eating'] ?? "I'll be eating"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY HEADER with Scroll Animation */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header 
          className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 transition-[padding] duration-300 overflow-hidden"
          style={{ 
            paddingTop: isScrolled ? '12px' : '48px',
            paddingBottom: '12px'
          }}
        >
          <div className="flex items-center justify-between">
            {/* Title - shrinks to 50% on scroll */}
            <h1 
              className="text-display text-foreground transition-transform duration-300 origin-left will-change-transform"
              style={{ transform: isScrolled ? 'scale(0.5)' : 'scale(1)' }}
            >
              {t['meals.title']}
            </h1>
            
            {/* Day/Week Toggle - Compact pill in header */}
            <div 
              className="relative rounded-full overflow-hidden shrink-0"
              style={{ backgroundColor: 'hsl(var(--muted))' }}
            >
              <div className="flex p-0.5">
                {['day', 'week'].map(v => {
                  const isActive = view === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setView(v as 'day' | 'week')}
                      className={`py-1.5 px-3 rounded-full text-caption font-medium transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-card text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {v === 'day' ? (
                        <><LayoutList size={14} /> {t['meals.view_day'] ?? 'Day'}</>
                      ) : (
                        <><LayoutGrid size={14} /> {t['meals.view_week'] ?? 'Week'}</>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Inset shadow overlay */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.06)' }}
              />
            </div>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* WEEK NAVIGATION - Always sticky */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div 
          className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-all duration-300"
          style={{ 
            top: isScrolled ? '52px' : '80px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          <div className="flex items-center gap-3">
            {/* Week Selector */}
            <div 
              className="relative flex-1 flex items-center justify-between px-2 rounded-xl h-12 overflow-hidden"
              style={{ backgroundColor: 'hsl(var(--card))' }}
            >
              <button
                onClick={prevWeek}
                className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors z-10"
              >
                <ChevronLeft size={20} />
              </button>
              <span className={`text-body font-semibold tabular-nums z-10 ${isCurrentWeek ? 'text-primary' : 'text-foreground'}`}>{dateRangeStr}</span>
              <button
                onClick={nextWeek}
                className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors z-10"
              >
                <ChevronRight size={20} />
              </button>
              {/* Inset shadow overlay */}
              <div 
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
              />
            </div>

            {/* Today Button - Always visible */}
              <button
              onClick={goToTodayWithScroll}
              disabled={isCurrentWeek}
              className={`px-4 rounded-xl font-semibold text-body transition-all h-12 ${
                isCurrentWeek
                  ? 'bg-muted text-primary cursor-default'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              }`}
            >
              {t['meals.today'] ?? 'Today'}
              </button>
        </div>
      </div>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* MAIN CONTENT */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div className="pt-4">

      {/* Day View */}
      {view === 'day' ? (
        <div ref={dayViewRef} className="space-y-4">
            {weekDays.map((dayDate) => {
              const dateStr = formatDateStr(dayDate);
              const isToday = dayDate.toDateString() === new Date().toDateString();
              const dayMeals = meals.filter(m => m.date === dateStr);
            
            // Build rows: each meal + one "Add Meal Plan" row
            const mealRows = dayMeals.map(meal => ({ type: 'meal' as const, meal }));
            // Always add one "Add" row at the end
            const rows = [...mealRows, { type: 'add' as const, meal: null }];

              return (
              <div 
                key={dateStr} 
                id={`day-${dateStr}`} 
                className="bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* 3-Column Table Layout */}
                <div className="flex">
                  {/* Column 1: Date (spans all rows) */}
                  <div className={`w-20 shrink-0 p-3 flex flex-col items-center justify-center ${isToday ? 'bg-primary' : 'bg-card'}`}>
                    <span className={`text-caption font-bold ${isToday ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      {dayDate.getDate()} {dayDate.toLocaleDateString(langCode, { month: 'short' })}
                      </span>
                    <span className={`text-title font-bold ${isToday ? 'text-primary-foreground' : 'text-foreground'}`}>
                      {dayDate.toLocaleDateString(langCode, { weekday: 'short' })}
                    </span>
                  </div>

                  {/* Inset Vertical Separator with Gradient */}
                  <div className="flex items-center py-4">
                    <div 
                      className="w-px h-full opacity-50"
                      style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 40%, hsl(var(--border)) 60%, transparent)' }}
                    />
                    </div>

                  {/* Columns 2 & 3: Meal rows */}
                  <div className="flex-1 divide-y divide-border">
                      {rows.map((row, idx) => {
                        if (row.type === 'meal' && row.meal) {
                          const meal = row.meal;
                          const hasDish = meal.description.trim().length > 0;
                          const isIn = isUserInMeal(meal);
                          const canJoin = canUserJoinMeal(meal);
                          const eaters = meal.forUserIds
                            .map(uid => users.find(u => u.id === uid))
                            .filter((u): u is User => !!u);

                        return (
                            <div key={meal.id} className="flex min-h-[70px]">
                              {/* Column 2: Meal Info */}
                              <div 
                                onClick={() => openEditModal(meal)}
                                className="flex-1 p-3 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col justify-center"
                              >
                                {hasDish ? (
                                  <>
                                    <span className="text-caption font-medium text-muted-foreground uppercase flex items-center gap-1">
                                      {getMealIcon(meal.type)}
                                      {getMealLabel(meal.type)}
                                      {renderAudienceIcons(meal.audience || 'ALL')}
                                    </span>
                                    <span className="text-body font-semibold text-foreground leading-tight">
                                      {meal.description}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-caption font-medium text-muted-foreground uppercase flex items-center gap-1">
                                      {getMealIcon(meal.type)}
                                      {getMealLabel(meal.type)}
                                      {renderAudienceIcons(meal.audience || 'ALL')}
                                    </span>
                                    <button className="text-body font-semibold text-primary flex items-center gap-1">
                        <Plus size={14} />
                                      {t['meals.add_dish'] ?? 'Add Dish'}
                              </button>
                                  </>
                                )}
                            </div>

                              {/* Inset Vertical Separator with Gradient */}
                              <div className="flex items-center py-4">
                                <div 
                                  className="w-px h-full opacity-50"
                                  style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 40%, hsl(var(--border)) 60%, transparent)' }}
                                />
                              </div>

                              {/* Column 3: Who's Eating + Action */}
                              <div className="w-28 shrink-0 p-2 flex flex-col items-center justify-center gap-1.5">
                                {/* Avatars */}
                                <div className="flex -space-x-1.5">
                                  {eaters.slice(0, 4).map(u => (
                                    <img
                                      key={u.id}
                                      src={u.avatar}
                                      alt={u.name}
                                      className={`w-6 h-6 rounded-full bg-muted object-cover border-2 ${
                                        u.id === currentUser.id ? 'border-primary' : 'border-card'
                                      }`}
                                    />
                                  ))}
                                  {eaters.length > 4 && (
                                    <span className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                                      +{eaters.length - 4}
                              </span>
                                  )}
                                  {eaters.length === 0 && (
                                    <span className="text-caption text-muted-foreground/50">--</span>
                                  )}
                            </div>

                                {/* Join/Leave Button - Pill shaped with opacity bg */}
                                {canJoin ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuickRsvp(meal, e);
                                    }}
                                    className={`text-caption font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                                      isIn
                                        ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                                        : 'bg-primary/15 text-primary hover:bg-primary/25'
                                    }`}
                                  >
                                    {isIn ? (
                                      <>{t['meals.leave'] ?? 'Leave'} <X size={10} /></>
                                    ) : (
                                      <>Join <Plus size={10} /></>
                                    )}
                                  </button>
                                ) : (
                                  <div className="text-center">
                                    <span className="text-[9px] text-muted-foreground block">
                                      {meal.audience === 'ADULTS' 
                                        ? (t['meals.adults_only'] ?? 'Adults Only')
                                        : (t['meals.kids_only'] ?? 'Kids Only')}
                                      </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        } else {
                          // "Add Meal Plan" row
                          return (
                            <div key={`add-${idx}`} className="flex min-h-[60px]">
                              {/* Column 2: Add Meal Plan */}
                              <div 
                                onClick={() => openAddModal(dayDate, MealType.DINNER)}
                                className="flex-1 p-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-center"
                              >
                                <button className="text-body font-semibold text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors">
                                  {t['meals.add_meal_plan'] ?? 'Add Meal Plan'}
                                  <Plus size={16} />
                                </button>
                              </div>

                              {/* Inset Vertical Separator with Gradient */}
                              <div className="flex items-center py-4">
                                <div 
                                  className="w-px h-full opacity-50"
                                  style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 40%, hsl(var(--border)) 60%, transparent)' }}
                                />
                              </div>

                              {/* Column 3: Quick Join */}
                              <div className="w-28 shrink-0 p-2 flex flex-col items-center justify-center gap-1.5">
                                {/* Show all user avatars as potential eaters */}
                                <div className="flex -space-x-1.5">
                                  {users.filter(u => u.role !== UserRole.HELPER).slice(0, 4).map(u => (
                                    <img
                                      key={u.id}
                                      src={u.avatar}
                                      alt={u.name}
                                      className="w-6 h-6 rounded-full bg-muted object-cover border-2 border-card opacity-40"
                                    />
                                  ))}
                                    </div>
                                <button
                                  onClick={() => handleQuickRsvpEmpty(dayDate, MealType.DINNER)}
                                  className="text-caption font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 bg-primary/15 text-primary hover:bg-primary/25"
                                >
                                  Join <Plus size={10} />
                                  </button>
                            </div>
                          </div>
                        );
                        }
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
          /* Week View - Compact Chips */
          <div className="overflow-auto rounded-xl bg-card shadow-sm hover:shadow-md transition-shadow">
            <table className="min-w-[700px] w-full border-collapse">
            <thead>
              <tr>
                  <th className="sticky top-0 left-0 z-40 bg-muted w-16 p-2 border-b border-r border-border text-body font-semibold text-muted-foreground text-center">
                    
                </th>
                {mealTypes.map(type => (
                    <th key={type} className="sticky top-0 z-30 bg-muted p-2 border-b border-border text-center min-w-[140px]">
                      <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                        {getMealIcon(type)}
                        <span className="text-body font-semibold">{getMealLabel(type)}</span>
                      </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekDays.map(day => {
                const dateStr = formatDateStr(day);
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                    <tr key={dateStr} className="group">
                      {/* Day Column */}
                      <td 
                        className={`sticky left-0 z-20 p-2 border-b border-r border-border text-center ${
                          isToday ? 'bg-primary text-primary-foreground' : 'bg-card'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span className={`text-body font-semibold ${isToday ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {day.toLocaleDateString(langCode, { weekday: 'short' })}
                        </span>
                          <span className={`text-body font-semibold ${isToday ? 'text-primary-foreground' : 'text-foreground'}`}>
                          {day.getDate()}
                        </span>
                      </div>
                    </td>
                      {/* Meal Columns */}
                    {mealTypes.map(type => {
                      const slotMeals = getMealsForSlot(day, type);
                      return (
                        <td
                          key={type}
                            onClick={() => handleWeekCellClick(day)}
                            className="p-1.5 border-b border-r border-border align-top cursor-pointer hover:bg-primary/5 transition-colors"
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
                                      className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                                    >
                                      {/* Audience Icon */}
                                      <span className="text-muted-foreground shrink-0 mt-0.5">
                                        {meal.audience === 'ADULTS' && <UserIcon size={12} />}
                                        {meal.audience === 'KIDS' && <Baby size={12} />}
                                        {meal.audience === 'ALL' && (
                                          <span className="flex items-center gap-0.5">
                                            <UserIcon size={11} />
                                            <Baby size={11} />
                                          </span>
                                        )}
                                      </span>
                                      {/* Meal Name or RSVP count */}
                                      {hasDish ? (
                                        <span className="text-body font-semibold text-foreground line-clamp-2 leading-tight">
                                          {meal.description}
                                        </span>
                                      ) : (
                                        <div className="flex flex-col text-body leading-tight gap-0.5">
                                          <span className="font-semibold text-muted-foreground">RSVP</span>
                                          {mealUsers.length > 0 ? (
                                            <>
                                              {adultCount > 0 && (
                                                <span className="text-foreground flex items-center gap-1">
                                                  <UserIcon size={11} /> Adult x {adultCount}
                                                </span>
                                              )}
                                              {kidCount > 0 && (
                                                <span className="text-foreground flex items-center gap-1">
                                                  <Baby size={11} /> Kid x {kidCount}
                                                </span>
                                              )}
                                            </>
                                          ) : (
                                            <span className="text-foreground">{meal.forUserIds.length} people</span>
                                          )}
                                    </div>
                                      )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                              <div className="h-8 flex items-center justify-center">
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
      )}

        </div>
        {/* End of MAIN CONTENT */}

        {/* Footer */}
        <div className="helpy-footer">
          <span className="helpy-logo">helpy</span>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* MEAL MODAL - Bottom Sheet Style */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-popover w-full max-w-lg rounded-t-2xl p-6 flex flex-col max-h-[85vh] bottom-sheet-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-title font-bold text-foreground">
                {modalDate.toLocaleDateString(langCode, { weekday: 'short', day: 'numeric', month: 'short' })}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                className="p-2 bg-muted rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  <X size={20} />
                </button>
            </div>

            {/* Meal Type Selector */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {mealTypes.map(type => {
                const isSelected = modalType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setModalType(type)}
                    className={`py-2.5 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-card border-border text-muted-foreground hover:border-foreground/20'
                    }`}
                  >
                    {getMealIcon(type)}
                    <span className="text-caption font-semibold">{getMealLabel(type)}</span>
                  </button>
                );
              })}
            </div>

            {/* Audience Selector */}
            <div className="mb-5">
              <label className="text-caption font-semibold text-muted-foreground mb-2 block">
                {t['meals.audience_label'] ?? 'This meal is for'}
              </label>
              <div 
                className="relative rounded-full overflow-hidden"
                style={{ backgroundColor: 'hsl(var(--muted))' }}
              >
                <div className="flex p-1">
                  {(['ALL', 'ADULTS', 'KIDS'] as const).map(aud => {
                    const active = modalAudience === aud;
                    return (
                      <button
                        key={aud}
                        onClick={() => handleAudienceChange(aud)}
                        className={`flex-1 py-2 text-body font-medium rounded-full transition-all ${
                          active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {getAudienceLabel(aud)}
                      </button>
                    );
                  })}
                </div>
                <div 
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
                />
              </div>
            </div>

            <div className="space-y-5 overflow-y-auto flex-1 min-h-0 py-2">
              {/* Dish Input */}
              <div className="space-y-2">
                <label className="text-caption font-semibold text-muted-foreground">{t['meals.the_dish'] ?? 'The Dish'}</label>
                <div className="relative">
                  <textarea
                    autoFocus
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={`${t['meals.whats_for'] ?? "What's for"} ${getMealLabel(modalType).toLowerCase()}?`}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-body focus:border-foreground outline-none font-medium text-foreground resize-none placeholder:text-muted-foreground pr-12"
                  />
                    <button
                      onClick={handleAiSuggest}
                      disabled={loadingAi}
                    className="absolute bottom-2 right-2 p-2 bg-card shadow-sm border border-border rounded-full text-primary hover:text-primary/80 hover:scale-105 transition-all disabled:opacity-50"
                      title={t['meals.suggest_ai']}
                    >
                    {loadingAi ? (
                      <span className="animate-spin block w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></span>
                    ) : (
                      <Sparkles size={14} />
                    )}
                  </button>
                </div>
              </div>

              {/* People Section */}
              <div className="space-y-3">
                <label className="text-caption font-semibold text-muted-foreground flex items-center gap-2">
                  <Users size={14} /> {t['meals.who_eating'] ?? "Who's eating?"}
                </label>
                <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                  {getUsersForAudience(modalAudience).map(user => {
                    const isSelected = selectedUserIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleUser(user.id)}
                        className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'bg-card border-primary shadow-sm'
                            : 'bg-muted border-transparent opacity-50 hover:opacity-80'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                            <Check size={8} strokeWidth={4} />
                          </div>
                        )}
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover bg-muted"
                        />
                        <span className={`text-caption font-semibold truncate w-full text-center ${
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {user.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 flex gap-3 pt-4 border-t border-border shrink-0">
              {editingMealId && (
                <button
                  onClick={handleDelete}
                  className="p-4 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!(description.trim().length > 0 || selectedUserIds.length > 0)}
                className="flex-1 bg-primary text-primary-foreground py-4 rounded-xl font-semibold text-body transition-all disabled:opacity-50 hover:bg-primary/90"
                style={{ boxShadow: 'var(--shadow-md)' }}
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
