
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  GraduationCap,
  BookOpen,
  UserPlus,
  ArrowDownToLine,
  Share,
  LayoutGrid,
  SquarePlus,
  AlertCircle,
  MoreVertical,
  Heart,
  Crown,
  Eye,
  EyeOff,
  Lock,
  Smartphone,
  UserCog
} from 'lucide-react';
import Avatar from './ui/Avatar';
import ErrorBanner from './ui/ErrorBanner';
import { ToDoItem, Meal, User, MealType, TranslationDictionary, UserRole, Expense } from '../types';
import { formatCurrency } from '../currencyConfig';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { useScrollLock } from '../hooks/useScrollLock';
import { useSheetTheme } from '../hooks/useSheetTheme';
import { SUPPORTED_LANGUAGES } from '../constants';
import { useTranslatedContent } from '../hooks/useTranslatedContent';
import { haptics } from '../utils/haptics';
import { useDemoMode } from '../contexts/DemoModeContext';
import { isRunningAsPwa, isIosDevice, isAndroidDevice } from '../utils/pwaUtils';
import { isDevicePwaInstalled, recordPwaInstallation } from '../services/pwaService';
import { getCachedSupabaseUuid, isUserCachePopulated } from '../services/supabaseService';

import type { ConnectionStatus } from '../hooks/useRealtimeStatus';

interface HomeProps {
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
  /** Navigate to Profile and select a specific family member */
  onSelectFamilyMember?: (userId: string) => void;
  /** Household limits for family member quota display */
  householdLimits?: { maxFamily: number; maxHelpers: number };
  /** Update user data (e.g., after enabling notifications) */
  onUpdateUser?: (id: string, data: Partial<User>) => Promise<void>;
  /** Whether onboarding is currently active (to prevent PWA modal during onboarding) */
  isOnboardingActive?: boolean;
  /** Callback when PWA modal is dismissed (to start onboarding after) */
  onPwaModalDismissed?: () => void;
  /** Test trigger for UpdateToast (SuperAdmin only) */
  onTriggerUpdateToast?: () => void;
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

// Family Card component with Apple Wallet-style photo glow effect (Home only)
const FamilyCardWithGlow: React.FC<{
  user: User;
  isCurrent: boolean;
  isScrolled: boolean;
  getAvatarUrl: (user: User) => string;
  getRoleBadgeColor: (role: UserRole) => string;
  renderTruncatedTags: (items: string[] | undefined, type: 'allergy' | 'preference') => React.ReactNode;
  onSelect?: () => void;
  t: TranslationDictionary;
}> = ({ user, isCurrent, isScrolled, getAvatarUrl, getRoleBadgeColor, renderTruncatedTags, onSelect, t }) => {
  const [glowLoaded, setGlowLoaded] = useState(false);
  
  return (
    <div
      onClick={onSelect}
      className="h-full relative snap-start"
    >
      {/* Photo Glow - Blurred copy positioned behind the card */}
      <div 
        className="absolute top-0 left-1/2 w-[92%] h-[200px] rounded-t-2xl overflow-hidden pointer-events-none transition-opacity duration-300"
        style={{ 
          transform: 'translateX(-50%) translateY(12px)',
          filter: 'blur(20px)',
          opacity: glowLoaded ? 0.45 : 0,
          zIndex: 0,
          willChange: 'transform',
          contain: 'strict',
        }}
        aria-hidden="true"
      >
        <img 
          src={getAvatarUrl(user)} 
          alt="" 
          className="w-full h-full object-cover"
          onLoad={() => setGlowLoaded(true)}
          onError={() => setGlowLoaded(false)}
        />
      </div>
      
      {/* Actual Card - shadow-sm as fallback/base */}
      <div 
        className="relative h-full bg-card rounded-2xl shadow-sm overflow-hidden cursor-pointer flex flex-col"
        style={{ zIndex: 1 }}
      >
        {/* Avatar - Edge to Edge at Top */}
        <div className="relative w-full h-[200px]">
          {/* Avatar Image - Rounded only at top (inherited from card overflow-hidden) */}
          <div className="w-full h-full bg-secondary">
            <img 
              src={getAvatarUrl(user)} 
              alt={user.name} 
              className="w-full h-full object-cover" 
            />
          </div>
          
          {/* Role Badge - Bottom Left (inside avatar) */}
          <div className="absolute bottom-3 left-3">
            <span className={`inline-block px-3 py-1 rounded-full text-caption font-semibold ${getRoleBadgeColor(user.role)}`}>
              {user.role}
            </span>
          </div>
        </div>

        {/* Content Area - With padding, grows to fill remaining space */}
        <div className="p-4 flex-1 flex flex-col">
          {/* Name + Pending Status - Same row */}
          <div className="flex items-center justify-between mt-1">
            <h3 className="text-title font-bold text-foreground truncate">
              {user.name.split(' ')[0]} {isCurrent ? `(${t['common.you'] || 'You'})` : ''}
            </h3>
            {user.status === 'pending' && (
              <span className="text-body text-muted-foreground flex-shrink-0 ml-2">
                {t['common.pending'] || 'Pending'}
              </span>
            )}
          </div>

          {/* Collapsible Section - Allergies & Preferences */}
          <div 
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{
              gridTemplateRows: isScrolled ? '0fr' : '1fr',
              willChange: 'grid-template-rows',
              contain: 'layout style',
            }}
          >
            <div 
              className={`overflow-hidden transition-opacity duration-300 ease-out ${isScrolled ? 'opacity-0' : 'opacity-100'}`}
              style={{
                willChange: 'opacity',
                transform: 'translateZ(0)',
              }}
            >
              {/* Divider */}
              <div className="h-px bg-border my-3" />

              {/* Allergies */}
              <div className="mb-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertCircle size={14} className="text-destructive flex-shrink-0" />
                  <span className="text-body font-bold text-foreground">
                    {t['profile.allergies'] || 'Allergies'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {renderTruncatedTags(user.allergies, 'allergy')}
                </div>
              </div>

              {/* Preferences */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Heart size={14} className="text-foreground flex-shrink-0" />
                  <span className="text-body font-bold text-foreground">
                    {t['profile.preferences'] || 'Preferences'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {renderTruncatedTags(user.preferences, 'preference')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

// isRunningAsPwa, isIosDevice, isAndroidDevice are imported from utils/pwaUtils

function isMobileDevice(): boolean {
  const uaDataMobile = (navigator as any).userAgentData?.mobile;
  if (typeof uaDataMobile === 'boolean') return uaDataMobile;

  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|android/.test(ua);
}

/**
 * Hook to manage PWA installation nudge
 * 
 * Features:
 * - Checks database to see if PWA was already installed on this device
 * - Progressive dismissal: 72h → 7d → 14d → never
 * - Returns whether to show modal and device type for correct instructions
 * 
 * @param userId - Supabase UUID of the current user (optional)
 * @param householdId - Household ID (optional)
 */
function usePwaInstallNudge(userId?: string, householdId?: string) {
  // Progressive dismissal delays: 72h, 7d, 14d, then never
  const DISMISS_DELAYS = [
    72 * 60 * 60 * 1000,      // 1st dismissal: 72 hours
    7 * 24 * 60 * 60 * 1000,  // 2nd dismissal: 7 days
    14 * 24 * 60 * 60 * 1000, // 3rd dismissal: 14 days
    Infinity                   // 4th+ dismissal: never again
  ];
  const DISMISS_COUNT_KEY = 'helpy_pwa_dismiss_count';
  const DISMISS_UNTIL_KEY = 'helpy_pwa_dismissed_until';

  const [isInstalled, setIsInstalled] = useState<boolean>(() => isRunningAsPwa());
  const [isInstalledOnDevice, setIsInstalledOnDevice] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number | 'never'>(() => {
    const raw = localStorage.getItem(DISMISS_UNTIL_KEY);
    if (raw === 'never') return 'never';
    return raw ? Number(raw) : 0;
  });

  // Check database for existing installation on this device
  useEffect(() => {
    if (!userId) return;
    
    const checkInstallation = async () => {
      const installed = await isDevicePwaInstalled(userId);
      if (installed) {
        console.log('[PWA Nudge] Device already has PWA installed');
        setIsInstalledOnDevice(true);
      }
    };
    
    checkInstallation();
  }, [userId]);

  // Record installation to database when running as PWA
  const doRecordInstallation = async () => {
    if (!userId || !householdId) return;
    
    const success = await recordPwaInstallation(userId, householdId);
    if (success) {
      setIsInstalledOnDevice(true);
    }
  };

  useEffect(() => {
    // If we're currently running as PWA, ensure we never show the modal
    // and record the installation to the database
    if (isRunningAsPwa()) {
      setIsInstalled(true);
      doRecordInstallation();
    }

    // Check for globally captured prompt (captured in index.tsx before React mounted)
    const globalPrompt = (window as any).deferredInstallPrompt;
    if (globalPrompt && !deferredPrompt) {
      setDeferredPrompt(globalPrompt);
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // required to trigger prompt from our custom button
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Also update global reference
      (window as any).deferredInstallPrompt = e;
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).deferredInstallPrompt = null;
      setShowModal(false);
      // Record installation to database
      doRecordInstallation();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Keep state in sync if display-mode changes
    const mm = window.matchMedia?.('(display-mode: standalone)');
    const onChange = () => {
      const isPwa = isRunningAsPwa();
      setIsInstalled(isPwa);
      if (isPwa) {
        setShowModal(false);
        doRecordInstallation();
      }
    };
    mm?.addEventListener?.('change', onChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mm?.removeEventListener?.('change', onChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, householdId]);

  const isDismissed = dismissedUntil === 'never' || (typeof dismissedUntil === 'number' && dismissedUntil > Date.now());
  const isMobile = isMobileDevice();

  // Progressive dismiss: 72h → 7d → 14d → never
  const dismiss = () => {
    const count = Number(localStorage.getItem(DISMISS_COUNT_KEY) || 0);
    const delay = DISMISS_DELAYS[Math.min(count, DISMISS_DELAYS.length - 1)];
    
    localStorage.setItem(DISMISS_COUNT_KEY, String(count + 1));
    
    if (delay === Infinity) {
      localStorage.setItem(DISMISS_UNTIL_KEY, 'never');
      setDismissedUntil('never');
    } else {
      const until = Date.now() + delay;
      localStorage.setItem(DISMISS_UNTIL_KEY, String(until));
      setDismissedUntil(until);
    }
    setShowModal(false);
  };

  // Determine if we should auto-show the modal (on page load)
  const shouldAutoShow = isMobile && !isInstalled && !isInstalledOnDevice && !isDismissed;
  
  // Can we use Chrome's native install prompt?
  const canUseNativePrompt = !!deferredPrompt;

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null); // one-shot
    if (choice.outcome === 'accepted') {
      setShowModal(false);
    } else {
      dismiss();
    }
  };

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  return { 
    shouldAutoShow,
    showModal,
    openModal,
    closeModal,
    dismiss, 
    promptInstall,
    canUseNativePrompt,
    isMobile,
    isInstalled: isInstalled || isInstalledOnDevice
  };
}

const Home: React.FC<HomeProps> = ({
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
  onSelectFamilyMember,
  householdLimits = { maxFamily: 3, maxHelpers: 1 },
  onUpdateUser,
  isOnboardingActive = false,
  onPwaModalDismissed,
  onTriggerUpdateToast,
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Safety check for currentUser
  // ─────────────────────────────────────────────────────────────────
  if (!currentUser || !currentUser.name) {
    console.error('❌ Home: currentUser is missing or malformed:', currentUser);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">{t['error.account_setup_incomplete'] || 'Account Setup Incomplete'}</h2>
          <p className="text-muted-foreground">{t['error.please_logout_signin'] || 'Please try logging out and signing in again.'}</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Role-based permissions
  // ─────────────────────────────────────────────────────────────────
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  
  // Demo mode for marketing screenshots (SuperAdmin only)
  // Simulate free user mode to test paid feature locks (SuperAdmin only)
  // View as Helper to test Helper experience (SuperAdmin only)
  const { isDemoMode, toggleDemoMode, isSimulatingFreeUser, toggleSimulateFreeUser, isViewingAsHelper, toggleViewingAsHelper } = useDemoMode();
  
  // isHelper: true if actual Helper OR SuperAdmin viewing as Helper
  const isHelper = currentUser.role === UserRole.HELPER || (isSuperAdmin && isViewingAsHelper);

  // ─────────────────────────────────────────────────────────────────
  // Family Carousel Helpers
  // ─────────────────────────────────────────────────────────────────
  
  // Role priority for consistent sorting (same as Profile.tsx)
  const ROLE_PRIORITY: Record<string, number> = {
    'superadmin': 0,
    'admin': 1,
    'spouse': 2,
    'helper': 3,
    'child': 4,
    'other': 5,
  };
  
  const getRolePriority = (role: string): number => {
    return ROLE_PRIORITY[role.toLowerCase()] ?? 99;
  };

  // Filter and sort users by role priority, then alphabetically
  const validUsers = React.useMemo(() => {
    return users
      .filter(user => user && user.id && user.name)
      .sort((a, b) => {
        const priorityA = getRolePriority(a.role);
        const priorityB = getRolePriority(b.role);
        const roleDiff = priorityA - priorityB;
        if (roleDiff !== 0) return roleDiff;
        return a.name.localeCompare(b.name);
      });
  }, [users]);

  const getAvatarUrl = (user: User) => {
    const isDicebearAvatar = user.avatar?.includes('dicebear');
    if (isDicebearAvatar) {
      const seed = encodeURIComponent(user.name);
      const bgColor = user.status === 'pending' ? '9CA3AF' : '3EAFD2';
      return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=${bgColor}&fontSize=40`;
    }
    return user.avatar;
  };

  // Role badge colors: White background with colored text, except SuperAdmin (solid blue)
  // All badges have subtle shadow for depth
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPERADMIN: return 'bg-primary text-white shadow-sm'; // Solid blue with white text
      case UserRole.MASTER: return 'bg-white text-primary shadow-sm'; // White bg, cyan text
      case UserRole.SPOUSE: return 'bg-white text-[#7E57C2] shadow-sm'; // White bg, purple text
      case UserRole.HELPER: return 'bg-white text-[#FF9800] shadow-sm'; // White bg, orange text
      case UserRole.CHILD: return 'bg-white text-[#4CAF50] shadow-sm'; // White bg, green text
      case UserRole.OTHER: return 'bg-white text-[#F06292] shadow-sm'; // White bg, pink text
      default: return 'bg-white text-muted-foreground shadow-sm';
    }
  };

  // Render allergies/preferences with truncation (show 3, then +X)
  const renderTruncatedTags = (
    items: string[] | undefined,
    type: 'allergy' | 'preference'
  ) => {
    if (!items || items.length === 0) {
      return (
        <span className="text-body text-muted-foreground">
          {t['profile.none'] || 'None listed'}
        </span>
      );
    }

    const maxVisible = 3;
    const visibleItems = items.slice(0, maxVisible);
    const remainingCount = items.length - maxVisible;

    const tagStyle = type === 'allergy'
      ? 'px-2 py-1 bg-destructive/10 text-destructive rounded-full text-body font-medium'
      : 'px-2 py-1 bg-foreground/10 text-foreground rounded-full text-body font-medium';

    return (
      <>
        {visibleItems.map((item) => (
          <span key={item} className={tagStyle}>
            {item}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className={tagStyle}>
            +{remainingCount}
          </span>
        )}
      </>
    );
  };

  const shoppingCount = todoItems.filter(i => i.type === 'shopping' && !i.completed).length;
  
  // Task count - deduplicate recurring tasks (count only next upcoming instance per series)
  const activeTaskCount = useMemo(() => {
    const taskItems = todoItems.filter(i => i.type === 'task' && !i.completed);
    
    // Apply same deduplication logic as ToDo display
    const seriesMap = new Map<string, ToDoItem[]>();
    const nonSeriesItems: ToDoItem[] = [];
    
    taskItems.forEach(item => {
      const isActivelyRecurring = item.seriesId && 
        item.recurrence && 
        item.recurrence.frequency !== 'NONE';
      
      if (isActivelyRecurring) {
        if (!seriesMap.has(item.seriesId!)) {
          seriesMap.set(item.seriesId!, []);
        }
        seriesMap.get(item.seriesId!)!.push(item);
      } else {
        nonSeriesItems.push(item);
      }
    });
    
    // For each series, count only the next upcoming instance
    let pendingCount = nonSeriesItems.length;
    
    seriesMap.forEach((seriesItems) => {
      const sorted = seriesItems.sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate + 'T00:00:00').getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate + 'T00:00:00').getTime() : Infinity;
        return dateA - dateB;
      });
      
      const nextUpcoming = sorted.find(item => !item.completed);
      if (nextUpcoming) pendingCount++;
    });
    
    return pendingCount;
  }, [todoItems]);
  
  // Calculate total member count for quota display (family + helpers combined)
  // Count ALL users (active + pending) since pending invites also consume quota slots
  const totalMemberCount = useMemo(() => {
    return users.filter(u => u && u.id).length;
  }, [users]);
  
  // Total slots = family slots + helper slots
  const totalMaxSlots = householdLimits.maxFamily + householdLimits.maxHelpers;
  
  // Check if at total member limit
  const isAtMemberLimit = totalMemberCount >= totalMaxSlots;
  
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(familyNotes);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isDeletingNotes, setIsDeletingNotes] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLangModal, setShowLangModal] = useState(false);
  const { 
    shouldAutoShow: shouldAutoShowPwaModal,
    showModal: showPwaModal,
    openModal: openPwaModal,
    closeModal: closePwaModalInternal,
    dismiss: dismissPwaModalInternal,
    promptInstall,
    canUseNativePrompt,
    isMobile,
    isInstalled: isPwaInstalled
  } = usePwaInstallNudge(
    // Only pass userId when we have a valid Supabase UUID (not a Clerk ID)
    (() => {
      if (!currentUser?.id || !isUserCachePopulated()) return undefined;
      const uuid = getCachedSupabaseUuid(currentUser.id);
      // Don't pass Clerk IDs (they start with "user_") to PWA service
      return uuid && !uuid.startsWith('user_') ? uuid : undefined;
    })(),
    currentUser?.householdId
  );
  
  // Wrap close/dismiss to also notify parent (for onboarding flow)
  const closePwaModal = () => {
    closePwaModalInternal();
    onPwaModalDismissed?.();
  };
  
  const dismissPwaModal = () => {
    dismissPwaModalInternal();
    onPwaModalDismissed?.();
  };
  
  // Auto-show PWA install modal on page load for mobile users who haven't installed
  useEffect(() => {
    if (shouldAutoShowPwaModal && !showPwaModal) {
      // Small delay to let the page load first
      const timer = setTimeout(() => openPwaModal(), 500);
      return () => clearTimeout(timer);
    } else if (!shouldAutoShowPwaModal && !showPwaModal) {
      // If PWA modal not needed (desktop, already installed, dismissed), notify parent immediately
      // so onboarding can start
      onPwaModalDismissed?.();
    }
  }, [shouldAutoShowPwaModal]);
  
  // Carousel tracking
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Carousel scroll handler
  const handleCarouselScroll = () => {
    if (carouselRef.current) {
      const container = carouselRef.current;
      const cardWidth = 220 + 16; // w-[220px] + gap-4 (16px)
      const newIndex = Math.round(container.scrollLeft / cardWidth);
      setActiveCarouselIndex(Math.min(Math.max(newIndex, 0), validUsers.length - 1));
    }
  };

  const scrollToCarouselIndex = (index: number) => {
    if (carouselRef.current) {
      const cardWidth = 220 + 16;
      carouselRef.current.scrollTo({
        left: cardWidth * index,
        behavior: 'smooth'
      });
      setActiveCarouselIndex(index);
    }
  };
  
  // Scroll header animation - for sticky header shadow
  const { isScrolled } = useScrollHeader({ collapseThreshold: 50, expandThreshold: 110 });
  
  // Lock body scroll when any modal is open
  useScrollLock(showLangModal || showPwaModal);
  
  // Dim status bar when sheet is open (iOS)
  useSheetTheme(showLangModal || showPwaModal);

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
      haptics.success(); // Haptic feedback on successful save
    } catch (err) {
      console.error('Failed to save notes:', err);
      setError(t['error.save_notes'] || 'Failed to save notes. Please try again.');
      haptics.error();
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
    } catch (err) {
      console.error('Failed to delete notes:', err);
      setError(t['error.delete_notes'] || 'Failed to delete notes. Please try again.');
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

  const StatCard = ({ title, count, icon: Icon, colorClass, onClick, label, showAddButton, onAddClick }: any) => (
    <button
      onClick={onClick}
      className="relative w-full p-4 rounded-2xl flex flex-col h-32 text-left bg-card shadow-sm border border-border"
    >
      {/* Top icon - vertically centered with add button for alignment */}
      <div className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center opacity-80">
        <Icon size={20} className={colorClass} />
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
      {/* Add Button - bottom right corner, aligned with top icon */}
      {showAddButton && (
        <div className="absolute bottom-3 right-3 w-9 h-9 flex items-center justify-center">
          <div
            onClick={(e) => {
              e.stopPropagation();
              haptics.light(); // Haptic feedback on (+) button press
              onAddClick?.();
            }}
            className="p-1.5 rounded-full bg-primary flex items-center justify-center shadow-sm"
          >
            <Plus size={16} className="text-primary-foreground" />
          </div>
        </div>
      )}
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
                    case 'zh-HK': return '粵';
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
                  // Check if OS blocked notifications (pink = blocked, not orange = incomplete)
                  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return <BellOff size={12} className="text-destructive" />;
                  if (!currentUser.notificationsEnabled) return <BellOff size={12} className="text-destructive" />;
                  if (!currentUser.hasPushSubscription) return <BellOff size={12} className="text-orange-500" />;
                  return <Bell size={12} className="text-primary" />;
                })()}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-5 pt-4 space-y-4">

      {/* Error Banner */}
      <ErrorBanner 
        error={error} 
        onDismiss={() => setError(null)} 
        title={t['common.error'] || 'Error'}
      />

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

      {/* PWA Install Modal - Nearly full screen for mobile */}
      {showPwaModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-3"
          style={{ zIndex: 99999 }}
        >
          {/* Modal content - nearly full screen */}
          <div 
            className="relative overflow-hidden rounded-2xl bg-card w-full shadow-xl flex flex-col"
            style={{ 
              maxHeight: 'calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
              height: 'calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))'
            }}
          >
            {/* Close Button - inside, top right */}
            <button
              onClick={dismissPwaModal}
              className="absolute z-10 right-4 top-4 w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Header with Logo */}
            <div className="p-6 flex-shrink-0 relative">
              {/* Separator */}
              <div className="absolute left-6 right-6 bottom-0 border-b border-border"></div>
              <img src="/helpy-logo-blue.png" alt="Helpy" className="h-8 mb-6" />
              <h2 className="text-display text-foreground font-bold">{t['pwa.welcome'] || 'Welcome!'}</h2>
              <p className="text-primary mt-1 font-bold" style={{ fontSize: '20px' }}>
                {t['pwa.please_add_to_home_line1'] || 'Please add Helpy'}<br />
                {t['pwa.please_add_to_home_line2'] || 'to your home screen'}
              </p>
            </div>

            {/* Body - Device-specific instructions */}
            <div className="p-6 flex-1">
              {isIosDevice() ? (
                // iOS Instructions
                <ol className="list-decimal pl-5 space-y-3">
                  <li className="text-body text-foreground">
                    {t['pwa.step_tap_share'] || 'Tap Share'} <Share size={16} className="inline-block text-muted-foreground ml-1" />
                  </li>
                  <li className="text-body text-foreground">
                    {t['pwa.step_add_home'] || 'Add to Home Screen'} <SquarePlus size={16} className="inline-block text-muted-foreground ml-1" />
                    <p className="text-caption text-muted-foreground mt-1">{t['pwa.step_open_as_webapp'] || 'Switch on "Open as Web App" if available'}</p>
                  </li>
                  <li className="text-body text-foreground">{t['pwa.step_tap_add'] || 'Tap Add'}</li>
                  <li className="text-body text-foreground">{t['pwa.step_done'] || 'Done and open Helpy from your homescreen'}</li>
                </ol>
              ) : isAndroidDevice() ? (
                // Android Instructions
                <>
                  {/* One-click install button (if Chrome is ready) */}
                  {canUseNativePrompt && (
                    <button
                      onClick={() => promptInstall()}
                      className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm mb-4 flex items-center justify-center gap-2"
                    >
                      <Smartphone size={18} />
                      {t['pwa.add_to_homescreen_now'] || 'Add to Homescreen now'}
                    </button>
                  )}
                  
                  {/* Manual steps */}
                  <p className="text-body text-muted-foreground mb-3 font-semibold">
                    {canUseNativePrompt 
                      ? (t['pwa.or_follow_steps'] || 'Or follow the below steps:')
                      : (t['pwa.follow_steps'] || 'Follow these steps:')}
                  </p>
                  <ol className="list-decimal pl-5 space-y-3">
                    <li className="text-body text-foreground">
                      {t['pwa.step_tap_menu'] || 'Tap the menu'} <MoreVertical size={16} className="inline-block text-muted-foreground ml-1" />
                      <p className="text-caption text-muted-foreground mt-1">{t['pwa.step_menu_location'] || '(three dots in the top right corner)'}</p>
                    </li>
                    <li className="text-body text-foreground">
                      {t['pwa.step_add_home'] || 'Add to Home Screen'} <SquarePlus size={16} className="inline-block text-muted-foreground ml-1" />
                      <p className="text-caption text-muted-foreground mt-1">{t['pwa.step_or_install'] || 'Or look for "Install app" option'}</p>
                    </li>
                    <li className="text-body text-foreground">{t['pwa.step_confirm_add'] || 'Confirm by tapping Add or Install'}</li>
                    <li className="text-body text-foreground">{t['pwa.step_done'] || 'Done and open Helpy from your homescreen'}</li>
                  </ol>
                </>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
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
            <div className="space-y-3">
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
                          <p className="text-body text-foreground leading-tight line-clamp-2">
                            <TranslatedMealDescription 
                              meal={meal} 
                              currentLang={currentLang}
                              onUpdate={onUpdateMeal}
                            />
                          </p>
                        ) : (
                          <p className="text-body text-muted-foreground leading-tight">
                            {t['meals.hungry_no_menu'] ?? "Someone's joining. No menu yet"}
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
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          title={t['dashboard.tasks']}
          count={activeTaskCount}
          icon={ClipboardList}
          label={t['dashboard.todo']}
          colorClass="text-primary"
          showAddButton={true}
          onAddClick={() => onNavigate('todo', { section: 'task', openAddSheet: true })}
          onClick={() => onNavigate('todo', { section: 'task' })}
        />
        <StatCard
          title={t['dashboard.shopping']}
          count={shoppingCount}
          icon={ShoppingCart}
          label={t['dashboard.todo']}
          colorClass="text-primary"
          onClick={() => onNavigate('todo', { section: 'shopping' })}
          showAddButton={true}
          onAddClick={() => onNavigate('todo', { section: 'shopping', openAddSheet: true })}
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
        showAddButton={true}
        onAddClick={() => onNavigate('expenses', { openAddSheet: true })}
      />
      )}

      {/* Family Carousel */}
      <div 
        ref={carouselRef}
        onScroll={handleCarouselScroll}
        className="grid grid-flow-col auto-cols-[220px] gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5 snap-x snap-mandatory scroll-px-5"
      >
        {validUsers.map((user) => (
          <FamilyCardWithGlow
            key={user.id}
            user={user}
            isCurrent={user.id === currentUser.id}
            isScrolled={false}
            getAvatarUrl={getAvatarUrl}
            getRoleBadgeColor={getRoleBadgeColor}
            renderTruncatedTags={renderTruncatedTags}
            onSelect={() => onSelectFamilyMember?.(user.id)}
            t={t}
          />
        ))}

        {/* Add Button at END - Hidden for Helper */}
        {!isHelper && onOpenAddFamily && (
          <div
            onClick={() => {
              haptics.light();
              if (isAtMemberLimit) {
                // Navigate to plan section for upgrade
                localStorage.setItem('helpy_profile_target_section', 'plan');
                onNavigate('profile');
              } else {
                onOpenAddFamily();
              }
            }}
            className="h-full bg-secondary/30 rounded-2xl flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-border snap-start"
          >
            <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center shadow-sm">
              {isAtMemberLimit ? (
                <Crown size={28} className="text-primary" />
              ) : (
                <Plus size={28} className="text-primary" />
              )}
            </div>
            <span className="text-body font-semibold text-foreground mt-3">
              {isAtMemberLimit 
                ? (t['common.upgrade'] || 'Upgrade')
                : (t['common.add'] || 'Add')
              }
            </span>
            {isAtMemberLimit && (
              <span className="text-body text-muted-foreground">
                {t['common.to_add_more'] || 'to add more'}
              </span>
            )}
            <span className="text-body text-muted-foreground mt-2">
              {totalMemberCount} {t['common.of'] || 'of'} {totalMaxSlots}
            </span>
            <span className="text-body text-muted-foreground">
              {t['dashboard.member_slots_used'] || 'member slots used'}
            </span>
          </div>
        )}
      </div>

      {/* Carousel Dots */}
      {validUsers.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-1">
          {validUsers.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToCarouselIndex(index)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: index === activeCarouselIndex ? '20px' : '8px',
                height: '8px',
                backgroundColor: index === activeCarouselIndex 
                  ? 'hsl(var(--primary))' 
                  : 'hsl(var(--muted-foreground) / 0.25)',
              }}
              aria-label={`Go to item ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* How to use Helpy */}
      <div className="bg-card rounded-2xl p-6 shadow-sm">
        <p className="text-title font-bold text-foreground mb-6">{t['dashboard.need_help'] || 'Need Help Getting Started?'}</p>
        <div className="flex items-stretch justify-center">
          {onRestartTutorial && (
            <button onClick={onRestartTutorial} className="flex-1 flex flex-col items-center">
              <div className="h-8 flex items-center justify-center">
                <GraduationCap size={24} className="text-primary" />
              </div>
              <span className="text-body font-medium text-foreground mt-2">{t['common.tutorial'] || 'Tutorial'}</span>
            </button>
          )}
          {/* Vertical Divider */}
          <div className="w-px bg-border mx-4 self-stretch"></div>
          {onOpenUserGuide && (
            <button onClick={onOpenUserGuide} className="flex-1 flex flex-col items-center">
              <div className="h-8 flex items-center justify-center">
                <BookOpen size={24} className="text-primary" />
              </div>
              <span className="text-body font-medium text-foreground mt-2">{t['guide.title'] || 'User Guide'}</span>
            </button>
          )}
          {/* Add to Homescreen - Only show on mobile when not installed */}
          {isMobile && !isPwaInstalled && (
            <>
              <div className="w-px bg-border mx-4 self-stretch"></div>
              <button onClick={openPwaModal} className="flex-1 flex flex-col items-center">
                <div className="h-8 flex items-center justify-center">
                  <Smartphone size={24} className="text-primary" />
                </div>
                <span className="text-body font-medium text-foreground mt-2 text-center">{t['pwa.add_to_homescreen'] || 'Add to Homescreen'}</span>
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
          
          {/* Demo Mode Toggle - SuperAdmin Only */}
          {isSuperAdmin && (
            <div className="mt-6 pt-4 border-t border-border/30">
              <button
                onClick={() => {
                  haptics.light();
                  toggleDemoMode();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                  isDemoMode 
                    ? 'bg-primary/10 border border-primary/30' 
                    : 'bg-secondary/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isDemoMode ? (
                    <Eye size={18} className="text-primary" />
                  ) : (
                    <EyeOff size={18} className="text-muted-foreground" />
                  )}
                  <div className="text-left">
                    <span className="text-body font-medium text-foreground block">
                      {t['demo.title'] || 'Demo Mode'}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {t['demo.description'] || 'Show sample data for marketing screenshots'}
                    </span>
                  </div>
                </div>
                <div className={`w-12 h-7 rounded-full transition-colors flex items-center ${
                  isDemoMode ? 'bg-primary justify-end' : 'bg-muted-foreground/30 justify-start'
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-1 transition-transform`} />
                </div>
              </button>
              {isDemoMode && (
                <p className="text-caption text-primary mt-2 text-center">
                  {t['demo.enabled'] || 'Demo Mode Enabled'} - {t['demo.superadmin_only'] || 'SuperAdmin Only'}
                </p>
              )}
              
              {/* Simulate Free User Toggle - SuperAdmin Only */}
              <button
                onClick={() => {
                  haptics.light();
                  toggleSimulateFreeUser();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors mt-3 ${
                  isSimulatingFreeUser 
                    ? 'bg-destructive/10 border border-destructive/30' 
                    : 'bg-secondary/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Lock size={18} className={isSimulatingFreeUser ? 'text-destructive' : 'text-muted-foreground'} />
                  <div className="text-left">
                    <span className="text-body font-medium text-foreground block">
                      {t['simulate_free.title'] || 'Lock Paid Features'}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {t['simulate_free.description'] || 'Test experience as a free user'}
                    </span>
                  </div>
                </div>
                <div className={`w-12 h-7 rounded-full transition-colors flex items-center ${
                  isSimulatingFreeUser ? 'bg-destructive justify-end' : 'bg-muted-foreground/30 justify-start'
                }`}>
                  <div className="w-5 h-5 rounded-full bg-white shadow-sm mx-1 transition-transform" />
                </div>
              </button>
              {isSimulatingFreeUser && (
                <p className="text-caption text-destructive mt-2 text-center">
                  {t['simulate_free.enabled'] || 'Paid Features Locked'}
                </p>
              )}
              
              {/* View as Helper Toggle - SuperAdmin Only */}
              <button
                onClick={() => {
                  haptics.light();
                  toggleViewingAsHelper();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors mt-3 ${
                  isViewingAsHelper 
                    ? 'bg-[#FF9800]/10 border border-[#FF9800]/30' 
                    : 'bg-secondary/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <UserCog size={18} className={isViewingAsHelper ? 'text-[#FF9800]' : 'text-muted-foreground'} />
                  <div className="text-left">
                    <span className="text-body font-medium text-foreground block">
                      {t['view_as_helper.title'] || 'View as Helper'}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {t['view_as_helper.description'] || 'Experience the app as a Helper user'}
                    </span>
                  </div>
                </div>
                <div className={`w-12 h-7 rounded-full transition-colors flex items-center ${
                  isViewingAsHelper ? 'bg-[#FF9800] justify-end' : 'bg-muted-foreground/30 justify-start'
                }`}>
                  <div className="w-5 h-5 rounded-full bg-white shadow-sm mx-1 transition-transform" />
                </div>
              </button>
              {isViewingAsHelper && (
                <p className="text-caption text-[#FF9800] mt-2 text-center">
                  {t['view_as_helper.enabled'] || 'Viewing as Helper'}
                </p>
              )}
              
              {/* Test UpdateToast Button - SuperAdmin Only */}
              {onTriggerUpdateToast && (
                <button
                  onClick={() => {
                    haptics.light();
                    onTriggerUpdateToast();
                  }}
                  className="w-full mt-3 px-4 py-3 rounded-xl bg-secondary/50 border border-transparent text-left"
                >
                  <span className="text-body font-medium text-foreground block">
                    Test Update Toast
                  </span>
                  <span className="text-caption text-muted-foreground">
                    Manually trigger the app update notification
                  </span>
                </button>
              )}
              
              {/* Meal Table V3 - SuperAdmin Only */}
              <button
                onClick={() => {
                  haptics.light();
                  onNavigate('mealtablev3');
                }}
                className="w-full mt-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 text-left"
              >
                <span className="text-body font-medium text-primary block">
                  Meal Table V3
                </span>
                <span className="text-caption text-muted-foreground">
                  Test split-pane table with frozen header + column
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Language Sheet */}
      {showLangModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLangModal(false); }}
        >
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
            <div className="flex-1 overflow-y-auto p-5 pb-10 space-y-2">
              {SUPPORTED_LANGUAGES.map(lang => {
                // Display names in native language with code - UI only, doesn't affect backend
                const getDisplayName = (code: string) => {
                  switch(code) {
                    case 'en': return 'English (en)';
                    case 'zh-HK': return '粵語 (zh-HK)';
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
      , document.body)}
  </div>
  );
  };

  export default Home;
