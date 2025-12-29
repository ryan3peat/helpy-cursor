
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
  Trash2,
  Bell,
  BellOff,
  BellDot,
  GraduationCap,
  BookOpen,
  UserPlus,
  ArrowDownToLine,
  Share,
  LayoutGrid,
  SquarePlus
} from 'lucide-react';
import Avatar from './ui/Avatar';
import { ToDoItem, Meal, User, MealType, TranslationDictionary, UserRole, Expense } from '../types';
import { formatCurrency } from '../currencyConfig';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { useScrollLock } from '../hooks/useScrollLock';
import { useSheetTheme } from '../hooks/useSheetTheme';
import { SUPPORTED_LANGUAGES } from '../constants';
import { useTranslatedContent } from '../hooks/useTranslatedContent';

import type { ConnectionStatus } from '../hooks/useRealtimeStatus';

interface DashboardProps {
  todoItems: ToDoItem[];
  meals: Meal[];
  users: User[];
  expenses: Expense[];
  onNavigate: (view: string, data?: { section?: string }) => void;
  familyNotes: string;
  familyNotesLang?: string | null;
  familyNotesTranslations?: Record<string, string>;
  onUpdateNotes: (notes: string) => Promise<void>;
  onUpdateNotesTranslations?: (translations: Record<string, string>) => Promise<void>;
  currentUser: User;
  t: TranslationDictionary;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
  isTranslating: boolean;
  onUpdateMeal?: (id: string, data: Partial<Meal>) => void;
  /** Real-time connection status */
  realtimeStatus?: ConnectionStatus;
  /** Restart the onboarding tutorial */
  onRestartTutorial?: () => void;
  /** Open the user guide page */
  onOpenUserGuide?: () => void;
  /** Open the add family member sheet in Profile */
  onOpenAddFamily?: () => void;
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

// Component for displaying translated family notes
const TranslatedFamilyNotes: React.FC<{
  notes: string;
  notesLang?: string | null;
  notesTranslations?: Record<string, string>;
  currentLang: string;
  onUpdate?: (translations: Record<string, string>) => Promise<void>;
}> = ({ notes, notesLang, notesTranslations, currentLang, onUpdate }) => {
  const translatedNotes = useTranslatedContent({
    content: notes,
    contentLang: notesLang || null,
    currentLang,
    translations: notesTranslations || {},
    onTranslationUpdate: async (translation) => {
      if (onUpdate) {
        const updatedTranslations = {
          ...(notesTranslations || {}),
          [currentLang]: translation,
        };
        await onUpdate(updatedTranslations);
      }
    },
  });

  return <>{translatedNotes}</>;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isRunningAsPwa(): boolean {
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const isIosStandalone = (window.navigator as any).standalone === true;
  return Boolean(isStandalone || isIosStandalone);
}

function isIosDevice(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isMobileDevice(): boolean {
  const uaDataMobile = (navigator as any).userAgentData?.mobile;
  if (typeof uaDataMobile === 'boolean') return uaDataMobile;

  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|android/.test(ua);
}

function usePwaInstallNudge() {
  const DISMISS_HOURS = 72;
  const DISMISS_KEY = 'helpy_pwa_nudge_dismissed_until';

  const [isInstalled, setIsInstalled] = useState<boolean>(() => isRunningAsPwa());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedUntil, setDismissedUntil] = useState<number>(() => {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? Number(raw) : 0;
  });

  useEffect(() => {
    // If we're currently running as PWA, ensure we never show the banner.
    if (isRunningAsPwa()) setIsInstalled(true);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // required to trigger prompt from our custom button
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Keep state in sync if display-mode changes
    const mm = window.matchMedia?.('(display-mode: standalone)');
    const onChange = () => setIsInstalled(isRunningAsPwa());
    mm?.addEventListener?.('change', onChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mm?.removeEventListener?.('change', onChange);
    };
  }, []);

  const isDismissed = dismissedUntil > Date.now();
  const isMobile = isMobileDevice();

  const dismiss = () => {
    const until = Date.now() + DISMISS_HOURS * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setDismissedUntil(until);
  };

  const canPromptInstall = isMobile && !isInstalled && !!deferredPrompt && !isDismissed;
  const shouldShowIosSteps = isMobile && !isInstalled && isIosDevice() && !isDismissed;

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null); // one-shot
    if (choice.outcome !== 'accepted') dismiss();
  };

  return { canPromptInstall, shouldShowIosSteps, dismiss, promptInstall };
}

const Dashboard: React.FC<DashboardProps> = ({
  todoItems,
  meals,
  users,
  expenses,
  onNavigate,
  familyNotes,
  familyNotesLang,
  familyNotesTranslations,
  onUpdateNotes,
  onUpdateNotesTranslations,
  currentUser,
  t,
  currentLang,
  onLanguageChange,
  isTranslating,
  onUpdateMeal,
  realtimeStatus = 'connected',
  onRestartTutorial,
  onOpenUserGuide,
  onOpenAddFamily,
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Safety check for currentUser
  // ─────────────────────────────────────────────────────────────────
  if (!currentUser || !currentUser.name) {
    console.error('❌ Dashboard: currentUser is missing or malformed:', currentUser);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">Account Setup Incomplete</h2>
          <p className="text-muted-foreground">Please try logging out and signing in again.</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Role-based permissions
  // ─────────────────────────────────────────────────────────────────
  const isHelper = currentUser.role === UserRole.HELPER;

  const shoppingCount = todoItems.filter(i => i.type === 'shopping' && !i.completed).length;
  const activeTaskCount = todoItems.filter(i => i.type === 'task' && !i.completed).length;
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(familyNotes);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isDeletingNotes, setIsDeletingNotes] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState('');
  const [showLangModal, setShowLangModal] = useState(false);
  const [showIosInstallSteps, setShowIosInstallSteps] = useState(false);
  const { canPromptInstall, shouldShowIosSteps, dismiss, promptInstall } = usePwaInstallNudge();
  
  // Scroll header animation
  const { isScrolled } = useScrollHeader();
  
  // Lock body scroll when language modal is open
  useScrollLock(showLangModal);
  
  // Dim status bar when sheet is open (iOS)
  useSheetTheme(showLangModal || showIosInstallSteps);

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

  const handleUpdateNotesTranslations = async (translations: Record<string, string>) => {
    // Update translations in database via App.tsx
    // This will be called by useTranslatedContent when a translation is generated
    if (onUpdateNotesTranslations) {
      await onUpdateNotesTranslations(translations);
    }
  };

  const handleCancelNotes = () => {
    setTempNotes(familyNotes);
    setIsEditingNotes(false);
  };

  const handleDeleteNotes = async () => {
    setIsDeletingNotes(true);
    try {
      await onUpdateNotes('');
      setTempNotes('');
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Failed to delete notes:', error);
    } finally {
      setIsDeletingNotes(false);
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

  // Render audience icons with counts (only active users)
  const renderAudienceIcons = (forUserIds: string[]) => {
    const eaters = users.filter(u => forUserIds.includes(u.id) && u.status === 'active');
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
      className="relative w-full p-4 rounded-2xl flex flex-col h-32 text-left bg-card shadow-sm border border-border"
    >
      <div className="absolute top-4 right-4 opacity-80">
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
    <div className="min-h-screen bg-background pb-16 page-content">
      {/* Sticky Header - Push Up (No Shrink) */}
      <header 
        className="sticky top-0 z-20 bg-background px-5 pb-3 flex items-end transition-shadow duration-200"
        style={{ 
          height: '120px',
          boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
        }}
      >
        <div className="flex justify-between items-center w-full">
          <div>
            <h1>
              <span className="text-primary font-bold" style={{ fontSize: '20px' }}>{timeOfDay},</span><br />
              <span className="text-display text-foreground">{currentUser.name?.split(' ')[0] || 'User'}</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLangModal(true)}
              className="relative w-14 h-14 rounded-full bg-card border border-border shadow-sm flex flex-col items-center justify-center text-muted-foreground overflow-visible"
            >
              {/* Spinning ring overlay when translating - positioned outside button edge */}
              {isTranslating && (
                <svg 
                  className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] animate-spin"
                  viewBox="0 0 64 64"
                >
                  <circle
                    cx="32"
                    cy="32"
                    r="30"
                    fill="none"
                    stroke="#3EAFD2"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="45 140"
                  />
                </svg>
              )}
              <Languages size={18} />
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
              <Avatar
                user={currentUser}
                size="2xl"
                className="shadow-sm"
              />
              {/* Notification indicator - synced with Profile page */}
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow-sm flex items-center justify-center">
                {(() => {
                  if (currentUser.role === UserRole.CHILD) return <BellOff size={12} className="text-muted-foreground" />;
                  if (!currentUser.notificationsEnabled) return <BellOff size={12} className="text-destructive" />;
                  if (!currentUser.hasPushSubscription) return <BellDot size={12} className="text-orange-500" />;
                  return <Bell size={12} className="text-primary" />;
                })()}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-5 pt-12 space-y-5">

      {/* PWA Install Nudge (Mobile Only) */}
      {(canPromptInstall || shouldShowIosSteps) && (
        <div className="rounded-3xl p-5 shadow-sm border bg-[#EAF7FB] border-[#BFE7F3] dark:bg-primary/10 dark:border-primary/20">
          {/* Title row (icon + text inline) */}
          <div className="flex items-center gap-2">
            <LayoutGrid size={20} className="text-primary" />
            <p className="text-title font-bold text-primary">
              {shouldShowIosSteps ? 'Add Helpy to Home Screen' : 'Install Helpy'}
            </p>
          </div>

          {/* Body */}
          <p className="text-body text-primary/80 mt-2">
            {shouldShowIosSteps
              ? 'Helpy works best as an app. On iPhone, adding to Home Screen helps with notifications.'
              : 'Open faster, full screen, and get a smoother notification setup.'}
          </p>

          {/* Buttons - 50/50 width */}
          <div className="flex items-center gap-3 mt-4">
            {shouldShowIosSteps ? (
              <button
                onClick={() => setShowIosInstallSteps(true)}
                className="w-1/2 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm"
              >
                Show steps
              </button>
            ) : (
              <button
                onClick={promptInstall}
                className="w-1/2 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm"
              >
                Install app
              </button>
            )}

            <button
              onClick={dismiss}
              className="w-1/2 py-[13px] rounded-xl bg-transparent border border-primary text-primary text-body font-semibold"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Family Notes */}
      <div id="onboarding-family-board" className="relative group">
        <div className="relative bg-primary p-5 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="text-white">
                <Pin size={18} />
              </div>
              <span className="text-title text-white">{t['dashboard.family_board']}</span>
            </div>
            {/* Edit button - Hidden for Helper */}
            {!isEditingNotes && !isHelper && (
              <button
                onClick={() => setIsEditingNotes(true)}
                className="p-1.5 text-white/70 rounded-full"
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
                disabled={isSavingNotes || isDeletingNotes}
                className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-body text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/50 focus:border-transparent outline-none resize-none leading-relaxed disabled:opacity-50"
                rows={3}
                placeholder={t['dashboard.type_note']}
              />
              <div className="flex justify-between items-center">
                <button 
                  onClick={handleDeleteNotes}
                  disabled={isSavingNotes || isDeletingNotes}
                  className="p-2.5 bg-[#F06292] rounded-full text-white shadow-sm disabled:opacity-50"
                >
                  {isDeletingNotes ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                </button>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleCancelNotes}
                    disabled={isSavingNotes || isDeletingNotes}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-white text-body font-medium shadow-sm disabled:opacity-50"
                  >
                    <X size={16} />
                    <span>{t['common.cancel'] || 'Cancel'}</span>
                  </button>
                  <button 
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes || isDeletingNotes}
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-full text-primary text-body font-medium shadow-sm disabled:opacity-50"
                  >
                    <span>{t['common.save'] || 'Save'}</span>
                    {isSavingNotes ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div onClick={() => !isHelper && setIsEditingNotes(true)} className={`min-h-[40px] ${!isHelper ? 'cursor-pointer' : ''}`}>
              {familyNotes ? (
                <p className="text-white text-body leading-relaxed whitespace-pre-line">
                  <TranslatedFamilyNotes
                    notes={familyNotes}
                    notesLang={familyNotesLang}
                    notesTranslations={familyNotesTranslations}
                    currentLang={currentLang}
                    onUpdate={handleUpdateNotesTranslations}
                  />
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

      {/* iOS Add to Home Screen Steps */}
      {showIosInstallSteps && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />

          <div
            className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative"
            style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowIosInstallSteps(false)}
              className="absolute z-10 right-4 top-4 w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border">
              <h2 className="text-title text-foreground">Add Helpy to Home Screen</h2>
              <p className="text-body text-muted-foreground mt-1">
                It will look and feel like an app.
              </p>
            </div>

            {/* Body */}
            <div className="p-5">
              <ol className="list-decimal pl-5 space-y-2">
                <li className="text-body text-foreground">Tap <strong>Share</strong> <Share size={16} className="inline-block text-muted-foreground ml-1" /></li>
                <li className="text-body text-foreground">
                  Tap <strong>Add to Home Screen</strong> <SquarePlus size={16} className="inline-block text-muted-foreground ml-1" />
                  <p className="text-caption text-muted-foreground mt-1">Switch on "Open as Web App" if available</p>
                </li>
                <li className="text-body text-foreground">Tap <strong>Add</strong></li>
                <li className="text-body text-foreground">Done and open Helpy from your homescreen</li>
              </ol>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border flex gap-3">
              <button
                onClick={() => {
                  setShowIosInstallSteps(false);
                  dismiss();
                }}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today's Menu */}
      <div
        onClick={() => onNavigate('meals')}
        className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden cursor-pointer"
      >
        <div className="bg-primary px-4 py-2.5 flex justify-between items-center">
          <h2 className="text-title text-white">{t['dashboard.todays_menu']}</h2>
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
                            <TranslatedMealDescription 
                              meal={meal} 
                              currentLang={currentLang}
                              onUpdate={onUpdateMeal}
                            />
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
            <div className="py-2 flex flex-col items-start gap-2">
              <p className="text-body text-muted-foreground">{t['dashboard.no_meals_today'] || 'No meals remaining for today'}</p>
              <button className="text-body text-primary flex items-center gap-1">
                <Plus size={12} /> {t['meals.plan_dish'] || 'Plan Meal'}
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

      {/* Expenses - Hidden for Helper */}
      {!isHelper && (
      <StatCard
        title={t['dashboard.expenses']}
        count={formatCurrency(totalExpenses)}
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
      )}

      {/* How to use Helpy */}
      <div className="bg-card rounded-3xl p-6 shadow-sm">
        <p className="text-title font-bold text-foreground mb-6">{t['dashboard.need_help'] || 'Need Help Getting Started?'}</p>
        <div className="flex items-center justify-center">
          {onRestartTutorial && (
            <button onClick={onRestartTutorial} className="flex-1 flex flex-col items-center gap-1.5">
              <GraduationCap size={24} className="text-primary" />
              <span className="text-body font-medium text-foreground">{t['common.tutorial'] || 'Tutorial'}</span>
            </button>
          )}
          {/* Vertical Divider */}
          <div className="h-12 w-px bg-border mx-4"></div>
          {onOpenUserGuide && (
            <button onClick={onOpenUserGuide} className="flex-1 flex flex-col items-center gap-1.5">
              <BookOpen size={24} className="text-primary" />
              <span className="text-body font-medium text-foreground">{t['guide.title'] || 'User Guide'}</span>
            </button>
          )}
          {/* Add Family - Hidden for Helper */}
          {onOpenAddFamily && currentUser.role !== UserRole.HELPER && (
            <>
              {/* Vertical Divider */}
              <div className="h-12 w-px bg-border mx-4"></div>
              <button onClick={onOpenAddFamily} className="flex-1 flex flex-col items-center gap-1.5">
                <UserPlus size={24} className="text-primary" />
                <span className="text-body font-medium text-foreground">{t['profile.add_family'] || 'Add Family'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
        <div className="helpy-footer">
          <span className="helpy-logo">helpy</span>
          <p className="text-[#BABABA] dark:text-[#5F5F5F] text-caption mt-2 leading-relaxed">
            "I just want you to know<br />I'm real grateful you're here"
          </p>
          <p className="text-[#BABABA] dark:text-[#5F5F5F] text-caption mt-1">
            Aibileen Clark, The Help
          </p>
          
          
          {/* Connection Status Indicator */}
          <div 
            className={`mt-3 mx-auto w-[14px] h-[14px] rounded-full transition-colors ${
              realtimeStatus === 'connected' 
                ? 'bg-primary' 
                : realtimeStatus === 'connecting'
                  ? 'bg-primary animate-pulse'
                  : 'bg-destructive'
            }`}
            title={
              realtimeStatus === 'connected' 
                ? (t['dashboard.realtime_active'] || 'Real-time sync active')
                : realtimeStatus === 'connecting'
                  ? (t['dashboard.connecting'] || 'Connecting...')
                  : (t['dashboard.disconnected'] || 'Disconnected - tap to reconnect')
            }
          />
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
              className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center right-4 top-4 text-muted-foreground"
              aria-label={t['common.close'] || 'Close'}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <h2 className="text-title text-foreground">{t['dashboard.language']}</h2>
              <p className="text-caption text-muted-foreground mt-2">
                {t['language.ai_disclaimer'] || 'Translation provided by AI. For accuracy, please refer to the original language version if in doubt.'}
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
                    className={`w-full p-4 rounded-xl flex items-center justify-between ${
                      currentLang === lang.code
                        ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                        : 'bg-secondary text-foreground font-medium'
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
