// components/HouseholdInfo.tsx
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useScrollHeader } from "@/hooks/useScrollHeader";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useSheetTheme } from "@/hooks/useSheetTheme";
import {
  Plus,
  X,
  MapPin,
  Phone,
  FileText,
  Trash2,
  Pencil,
  Home,
  GraduationCap,
  Stethoscope,
  Building2,
  ShoppingCart,
  Stone,
  Clock,
  ChevronRight,
  ClipboardList,
  UtensilsCrossed,
  Baby,
  Sparkles,
  Shirt,
  PawPrint,
  ShieldAlert,
  Zap,
  Heart,
  AlertTriangle,
  Utensils,
  Info,
  ListChecks,
  HeartHandshake,
  Lock,
  Check,
  Globe,
  Lightbulb,
  Loader2,
} from "lucide-react";
import Avatar from "./ui/Avatar";
import ErrorBanner from "./ui/ErrorBanner";
import { BaseViewProps, User, UserRole, TranslationDictionary } from "@/types";
import { useTranslatedContent } from "@/hooks/useTranslatedContent";
import { detectInputLanguage } from "@/services/languageDetectionService";
import { useSupabase } from "@/contexts/SupabaseContext";
import { useDemoMode } from "@/contexts/DemoModeContext";

// Essential Info Types & Services
import type {
  EssentialInfo,
  CreateEssentialInfo,
  EssentialInfoCategory,
} from "@src/types/essentialInfo";
import { COUNTRY_CODES, CATEGORY_CONFIG } from "@src/types/essentialInfo";
// Keep updateEssentialInfo for translation updates in card components
import { updateEssentialInfo } from "@/services/essentialInfoService";

// House Routine Types & Services
import type {
  HouseRoutine,
  CreateHouseRoutine,
  HouseRoutineCategory,
} from "@src/types/houseRoutine";
import {
  HOUSE_ROUTINE_CATEGORIES,
  HOUSE_ROUTINE_CATEGORY_CONFIG,
} from "@src/types/houseRoutine";
// Keep updateHouseRoutine for translation updates in card components
import { updateHouseRoutine } from "@/services/houseRoutineService";

// Practice Presets (Suggested Practice Ideas)
import { PRACTICE_PRESETS, getPresetCategories } from "@src/data/practicePresets";
import type { PracticePreset } from "@src/data/practicePresets";
import haptics from "@/utils/haptics";

// Helper Management
import HelperManagementContent from "./HelperManagementContent";

interface HouseholdInfoProps extends BaseViewProps {
  householdId: string;
  currentUser: User;
  users: User[];
  essentialItems: EssentialInfo[];
  houseRoutineItems: HouseRoutine[];
  // Essential Info handlers (with optimistic updates in App.tsx)
  onAddEssentialInfo: (info: CreateEssentialInfo) => Promise<void>;
  onUpdateEssentialInfo: (id: string, data: Partial<CreateEssentialInfo>) => Promise<void>;
  onDeleteEssentialInfo: (id: string) => Promise<void>;
  // House Routine handlers (with optimistic updates in App.tsx)
  onAddHouseRoutine: (item: CreateHouseRoutine) => Promise<void>;
  onUpdateHouseRoutine: (id: string, data: Partial<CreateHouseRoutine>) => Promise<void>;
  onDeleteHouseRoutine: (id: string) => Promise<void>;
  // Section control for onboarding
  initialSection?: 'essentialInfo' | 'houseRoutine';
  onSectionChange?: (section: string) => void;
  // Navigation callback
  onNavigateToProfile?: () => void;
  // Direct edit helper callback (opens edit modal directly)
  onEditHelper?: (helperId: string) => void;
}

type ActiveSection = "essentialInfo" | "houseRoutine" | "helper";

const ESSENTIAL_CATEGORIES: EssentialInfoCategory[] = [
  "Home",
  "School",
  "Doctor",
  "Hospital",
  "Shops",
  "Others",
];

// Map categories to Lucide icons
const ESSENTIAL_CATEGORY_ICONS: Record<EssentialInfoCategory, React.ReactNode> = {
  Home: <Home size={18} />,
  School: <GraduationCap size={18} />,
  Doctor: <Stethoscope size={18} />,
  Hospital: <Building2 size={18} />,
  Shops: <ShoppingCart size={18} />,
  Others: <Stone size={18} />,
};

// Map house routine categories to Lucide icons
const HOUSE_ROUTINE_CATEGORY_ICONS: Record<HouseRoutineCategory, React.ReactNode> = {
  'Home Rules': <ClipboardList size={18} />,
  'Routine': <Clock size={18} />,
  'Cooking': <UtensilsCrossed size={18} />,
  'Child Care': <Baby size={18} />,
  'Cleaning': <Sparkles size={18} />,
  'Grocery': <ShoppingCart size={18} />,
  'Laundry': <Shirt size={18} />,
  'Pet Care': <PawPrint size={18} />,
  'Safety': <ShieldAlert size={18} />,
  'Utilities': <Zap size={18} />,
  'Helper Care': <HeartHandshake size={18} />,
  'Others': <Stone size={18} />,
};

// ─────────────────────────────────────────────────────────────────
// ROLE STYLING CONFIG
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// ROLE STYLING CONFIG
// NOTE: Keep in sync with Profile.tsx getRoleBadgeColor() for consistency
// Badge style: White background with colored text, except SuperAdmin (solid blue)
// See docs/GLOBAL_RULES.md for consistency guidelines
// ─────────────────────────────────────────────────────────────────
const ROLE_STYLES: Record<UserRole, { bg: string; color: string }> = {
  [UserRole.MASTER]: { 
    bg: '#FFFFFF', // White background for badge
    color: '#3EAFD2', // Helpy blue text
  },
  [UserRole.SUPERADMIN]: { 
    bg: '#3EAFD2', // Solid helpy blue background
    color: '#FFFFFF', // White text
  },
  [UserRole.SPOUSE]: { 
    bg: '#FFFFFF', // White background for badge
    color: '#7E57C2', // Purple text (unified with Dinner purple)
  },
  [UserRole.HELPER]: { 
    bg: '#FFFFFF', // White background for badge
    color: '#FF9800', // Orange text
  },
  [UserRole.CHILD]: { 
    bg: '#FFFFFF', // White background for badge
    color: '#4CAF50', // Green text
  },
  [UserRole.OTHER]: { 
    bg: '#FFFFFF', // White background for badge
    color: '#F06292', // Pink text
  },
};

// ─────────────────────────────────────────────────────────────────
// Role priority for consistent sorting across all family members
// NOTE: Keep in sync with Profile.tsx for consistency
// See docs/GLOBAL_RULES.md for consistency guidelines
// ─────────────────────────────────────────────────────────────────
const ROLE_PRIORITY: Record<string, number> = {
  'superadmin': 0,
  'admin': 1,
  'spouse': 2,
  'helper': 3,
  'child': 4,
  'other': 5,
};

// Helper function to get role priority (case-insensitive)
const getRolePriority = (role: string): number => {
  return ROLE_PRIORITY[role.toLowerCase()] ?? 99;
};

// ─────────────────────────────────────────────────────────────────
// Family Profile Carousel Component
// NOTE: User card styling should match Profile.tsx for consistency
// See docs/GLOBAL_RULES.md for consistency guidelines
// ─────────────────────────────────────────────────────────────────
interface FamilyProfileCarouselProps {
  users: User[];
  currentUser: User;
  t: TranslationDictionary;
  onNavigateToProfile?: () => void;
}

const FamilyProfileCarousel: React.FC<FamilyProfileCarouselProps> = ({ users, currentUser, t, onNavigateToProfile }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter to active users only, then sort by role priority
  const sortedUsers = React.useMemo(() => {
    return [...users]
      .filter(u => u.status === 'active')
      .sort((a, b) => {
        const priorityA = getRolePriority(a.role);
        const priorityB = getRolePriority(b.role);
        const roleDiff = priorityA - priorityB;
        if (roleDiff !== 0) return roleDiff;
        return a.name.localeCompare(b.name);
      });
  }, [users]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const cardWidth = container.offsetWidth * 0.82;
      const newIndex = Math.round(container.scrollLeft / cardWidth);
      setActiveIndex(Math.min(Math.max(newIndex, 0), sortedUsers.length - 1));
    }
  };

  const scrollToIndex = (index: number) => {
    if (scrollContainerRef.current) {
      const cardWidth = scrollContainerRef.current.offsetWidth * 0.82;
      scrollContainerRef.current.scrollTo({
        left: cardWidth * index,
        behavior: 'smooth'
      });
      setActiveIndex(index);
    }
  };

  if (sortedUsers.length === 0) return null;

  return (
    <div className="mb-5">
      {/* Carousel Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-3 items-stretch"
      >
        {sortedUsers.map((user, index) => {
          const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES[UserRole.HELPER];
          const isActive = index === activeIndex;
          
          return (
            <div
              key={user.id}
              className={`flex-shrink-0 w-[82%] snap-start rounded-2xl overflow-hidden transition-all duration-300 flex flex-col ${
                isActive ? 'shadow-md' : 'shadow-sm opacity-85'
              }`}
              style={{
                background: 'hsl(var(--card))',
              }}
            >
              <div className="p-5 flex-1 relative">
                {/* Edit Icon - Top Right Corner */}
                {/* Eligible users: Admins/SuperAdmins can edit anyone, users can edit themselves */}
                {(currentUser.role === UserRole.MASTER || 
                  currentUser.role === UserRole.SUPERADMIN || 
                  currentUser.id === user.id) && onNavigateToProfile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Store the user ID to edit in localStorage for Profile to pick up
                      localStorage.setItem('helpy_profile_edit_user_id', user.id);
                      onNavigateToProfile();
                    }}
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-muted-foreground"
                    aria-label={t['common.edit'] || 'Edit'}
                  >
                    <Pencil size={14} />
                  </button>
                )}
                
                {/* Profile Header */}
                <div className="flex items-start gap-3 mb-4">
                  {/* Avatar */}
                  <Avatar
                    user={user}
                    size="sm"
                  />
                  
                  {/* Name & Role */}
                  <div className="flex-1 min-w-0 pr-8">
                    <h3 className="text-title text-foreground truncate">
                      {user.name}
                    </h3>
                    <span 
                      className="text-caption px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-1"
                      style={{ 
                        backgroundColor: roleStyle.bg, 
                        color: roleStyle.color,
                      }}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>

                {/* Info Sections */}
                <div className="space-y-4">
                  {/* Allergy & Medical */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Info size={16} className="text-destructive" />
                      <span className="text-body text-foreground">
                        {t['common.allergy_medical'] || 'Allergy & Medical'}
                      </span>
                    </div>
                    {user.allergies && user.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-2 ml-6">
                        {user.allergies.slice(0, 6).map((allergy, i) => (
                          <span 
                            key={i}
                            className="text-caption px-2.5 py-1 rounded-full"
                            style={{
                              backgroundColor: 'hsl(var(--destructive) / 0.1)',
                              color: 'hsl(var(--destructive))',
                            }}
                          >
                            {allergy}
                          </span>
                        ))}
                        {user.allergies.length > 6 && (
                          <span className="text-caption text-muted-foreground px-2.5 py-1">
                            +{user.allergies.length - 6} {t['common.more'] || 'more'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-caption text-muted-foreground/60 italic ml-6">
                        {t['common.none_listed']}
                      </span>
                    )}
                  </div>

                  {/* Preferences */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Heart size={16} className="text-foreground" />
                      <span className="text-body text-foreground">
                        {t['profile.preferences']}
                      </span>
                    </div>
                    {user.preferences && user.preferences.length > 0 ? (
                      <div className="flex flex-wrap gap-2 ml-6">
                        {user.preferences.slice(0, 6).map((pref, i) => (
                          <span 
                            key={i}
                            className="text-caption px-2.5 py-1 rounded-full bg-foreground/10 text-foreground"
                          >
                            {pref}
                          </span>
                        ))}
                        {user.preferences.length > 6 && (
                          <span className="text-caption text-muted-foreground px-2.5 py-1">
                            +{user.preferences.length - 6} {t['common.more'] || 'more'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-caption text-muted-foreground/60 italic ml-6">
                        {t['common.none_listed']}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Dots */}
      {sortedUsers.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-1">
          {sortedUsers.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: index === activeIndex ? '20px' : '8px',
                height: '8px',
                backgroundColor: index === activeIndex 
                  ? 'hsl(var(--primary))' 
                  : 'hsl(var(--muted-foreground) / 0.25)',
              }}
              aria-label={`Go to profile ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Component for displaying translated EssentialInfo name
const TranslatedEssentialName: React.FC<{
  info: EssentialInfo;
  currentLang: string;
  onUpdate?: (id: string, data: Partial<EssentialInfo>) => void;
}> = ({ info, currentLang, onUpdate }) => {
  if (!info.name) return <>{info.name || "Unnamed"}</>;
  
  const translatedName = useTranslatedContent({
    content: info.name,
    contentLang: info.nameLang,
    currentLang,
    translations: info.nameTranslations || {},
    onTranslationUpdate: async (translation) => {
      if (onUpdate) {
        const updatedTranslations = {
          ...(info.nameTranslations || {}),
          [currentLang]: translation,
        };
        await onUpdate(info.id, { nameTranslations: updatedTranslations });
      }
    },
  });

  return <>{translatedName}</>;
};

// Component for displaying translated EssentialInfo note
const TranslatedEssentialNote: React.FC<{
  info: EssentialInfo;
  currentLang: string;
  onUpdate?: (id: string, data: Partial<EssentialInfo>) => void;
}> = ({ info, currentLang, onUpdate }) => {
  if (!info.note) return null;
  
  const translatedNote = useTranslatedContent({
    content: info.note,
    contentLang: info.noteLang,
    currentLang,
    translations: info.noteTranslations || {},
    onTranslationUpdate: async (translation) => {
      if (onUpdate) {
        const updatedTranslations = {
          ...(info.noteTranslations || {}),
          [currentLang]: translation,
        };
        await onUpdate(info.id, { noteTranslations: updatedTranslations });
      }
    },
  });

  return <>{translatedNote}</>;
};

// Component for displaying translated HouseRoutine name
const TranslatedHouseRoutineName: React.FC<{
  item: HouseRoutine;
  currentLang: string;
  onUpdate?: (id: string, data: Partial<HouseRoutine>) => void;
}> = ({ item, currentLang, onUpdate }) => {
  const translatedName = useTranslatedContent({
    content: item.name,
    contentLang: item.nameLang,
    currentLang,
    translations: item.nameTranslations || {},
    onTranslationUpdate: async (translation) => {
      if (onUpdate) {
        const updatedTranslations = {
          ...(item.nameTranslations || {}),
          [currentLang]: translation,
        };
        await onUpdate(item.id, { nameTranslations: updatedTranslations });
      }
    },
  });

  return <>{translatedName}</>;
};

// Component for displaying translated HouseRoutine note
const TranslatedHouseRoutineNote: React.FC<{
  item: HouseRoutine;
  currentLang: string;
  onUpdate?: (id: string, data: Partial<HouseRoutine>) => void;
}> = ({ item, currentLang, onUpdate }) => {
  if (!item.note) return null;
  
  const translatedNote = useTranslatedContent({
    content: item.note,
    contentLang: item.noteLang,
    currentLang,
    translations: item.noteTranslations || {},
    onTranslationUpdate: async (translation) => {
      if (onUpdate) {
        const updatedTranslations = {
          ...(item.noteTranslations || {}),
          [currentLang]: translation,
        };
        await onUpdate(item.id, { noteTranslations: updatedTranslations });
      }
    },
  });

  return <>{translatedNote}</>;
};

const HouseholdInfo: React.FC<HouseholdInfoProps> = ({
  householdId,
  currentUser,
  users,
  essentialItems,
  houseRoutineItems,
  onAddEssentialInfo,
  onUpdateEssentialInfo,
  onDeleteEssentialInfo,
  onAddHouseRoutine,
  onUpdateHouseRoutine,
  onDeleteHouseRoutine,
  t,
  currentLang,
  initialSection,
  onSectionChange,
  onNavigateToProfile,
  onEditHelper,
}) => {
  // Get authenticated Supabase client (with JWT for RLS)
  const supabase = useSupabase();
  
  // ─────────────────────────────────────────────────────────────────
  // Section Toggle State
  // ─────────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<ActiveSection>(initialSection || "essentialInfo");
  const [selectedHelperId, setSelectedHelperId] = useState<string | null>(null);
  
  // Filter helpers from users
  const helpers = users.filter(u => u.role === UserRole.HELPER && u.status === 'active');
  
  // Auto-select first helper when switching to helper tab
  useEffect(() => {
    if (activeSection === 'helper' && helpers.length > 0 && !selectedHelperId) {
      setSelectedHelperId(helpers[0].id);
    }
  }, [activeSection, helpers, selectedHelperId]);
  
  // Notify parent of section changes (for onboarding)
  useEffect(() => {
    onSectionChange?.(activeSection);
  }, [activeSection, onSectionChange]);
  
  // Update active section when initialSection changes (from navigation)
  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);
  
  // Role-based permissions
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  const { isViewingAsHelper, isSimulatingFreeUser } = useDemoMode();
  // isHelper: true if actual Helper OR SuperAdmin viewing as Helper
  const isHelper = currentUser.role === UserRole.HELPER || (isSuperAdmin && isViewingAsHelper);

  // ─────────────────────────────────────────────────────────────────
  // Subscription Plan State (for Helper Management access control)
  // ─────────────────────────────────────────────────────────────────
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('free');
  const [error, setError] = useState<string | null>(null);
  
  // Fetch subscription plan on mount
  useEffect(() => {
    const fetchSubscriptionPlan = async () => {
      if (!householdId || !supabase) return;
      
      try {
        const { data, error } = await supabase
          .from('households')
          .select('subscription_plan, subscription_status')
          .eq('id', householdId)
          .single();
        
        if (!error && data) {
          // Only set as paid plan if subscription is active
          if (data.subscription_status === 'active' && data.subscription_plan) {
            setSubscriptionPlan(data.subscription_plan);
          } else {
            setSubscriptionPlan('free');
          }
        }
      } catch (err) {
        console.error('Error fetching subscription plan:', err);
      }
    };
    
    fetchSubscriptionPlan();
  }, [householdId, supabase]);
  
  // Helper Management is only available to Core and Pro users (not Free)
  // SuperAdmin bypasses plan restrictions UNLESS simulating free user
  const hasHelperManagementAccess = subscriptionPlan === 'core' || subscriptionPlan === 'pro' || (isSuperAdmin && !isSimulatingFreeUser);
  
  // Helper upgrade modal state
  const [showHelperUpgradeModal, setShowHelperUpgradeModal] = useState(false);
  
  // Maps choice modal state (when Google Maps not installed on iOS)
  const [showMapsChoiceModal, setShowMapsChoiceModal] = useState(false);
  const [pendingMapsAddress, setPendingMapsAddress] = useState<string>('');

  // ─────────────────────────────────────────────────────────────────
  // Essential Info State (data comes from props, only UI state here)
  // ─────────────────────────────────────────────────────────────────
  const [selectedEssentialCategory, setSelectedEssentialCategory] = useState<EssentialInfoCategory | "All">("All");
  const [isEssentialModalOpen, setIsEssentialModalOpen] = useState(false);
  const [editingEssentialItem, setEditingEssentialItem] = useState<EssentialInfo | null>(null);
  const [essentialForm, setEssentialForm] = useState<CreateEssentialInfo>({
    category: "Home",
    name: "",
    address: "",
    countryCode: "+852",
    phone: "",
    note: "",
  });

  // ─────────────────────────────────────────────────────────────────
  // House Routine State (data comes from props, only UI state here)
  // ─────────────────────────────────────────────────────────────────
  const [selectedHouseRoutineCategory, setSelectedHouseRoutineCategory] = useState<HouseRoutineCategory | "All">("All");
  const [isHouseRoutineModalOpen, setIsHouseRoutineModalOpen] = useState(false);
  const [editingHouseRoutineItem, setEditingHouseRoutineItem] = useState<HouseRoutine | null>(null);
  const [viewingHouseRoutineItem, setViewingHouseRoutineItem] = useState<HouseRoutine | null>(null);
  const [houseRoutineForm, setHouseRoutineForm] = useState<CreateHouseRoutine>({
    category: "Home Rules",
    customCategory: "",
    name: "",
    note: "",
  });

  // ─────────────────────────────────────────────────────────────────
  // Practice Ideas Modal State (SuperAdmin only for now)
  // ─────────────────────────────────────────────────────────────────
  const [isPracticeIdeasModalOpen, setIsPracticeIdeasModalOpen] = useState(false);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [isAddingPresets, setIsAddingPresets] = useState(false);
  const [showAddPresetsConfirm, setShowAddPresetsConfirm] = useState(false);
  
  // Filter out presets that have already been added to this household
  const availablePresets = PRACTICE_PRESETS.filter(
    preset => !houseRoutineItems.some(item => item.preset_id === preset.id)
  );
  
  // Get unique categories from available presets
  const availablePresetCategories = Array.from(
    new Set(availablePresets.map(p => p.category))
  ) as HouseRoutineCategory[];
  
  // Lock body scroll when any modal is open
  useScrollLock(isEssentialModalOpen || isHouseRoutineModalOpen || !!viewingHouseRoutineItem || showMapsChoiceModal || isPracticeIdeasModalOpen || showAddPresetsConfirm);
  
  // Dim status bar when sheet is open (iOS)
  useSheetTheme(isEssentialModalOpen || isHouseRoutineModalOpen || !!viewingHouseRoutineItem || showHelperUpgradeModal || showMapsChoiceModal || isPracticeIdeasModalOpen || showAddPresetsConfirm);

  // ─────────────────────────────────────────────────────────────────
  // Scroll State for Header Animation (using reusable hook)
  // ─────────────────────────────────────────────────────────────────
  const { isScrolled } = useScrollHeader();

  // ─────────────────────────────────────────────────────────────────
  // Stats Calculations
  // ─────────────────────────────────────────────────────────────────
  const essentialStats = {
    total: essentialItems.length,
  };

  const houseRoutineStats = {
    total: houseRoutineItems.length,
  };

  // Helper functions for getting item counts per category
  const getEssentialItemCount = (category: EssentialInfoCategory | "All"): number => {
    if (category === "All") return essentialItems.length;
    return essentialItems.filter(item => item.category === category).length;
  };

  const getHouseRoutineItemCount = (category: HouseRoutineCategory | "All"): number => {
    if (category === "All") return houseRoutineItems.length;
    return houseRoutineItems.filter(item => item.category === category).length;
  };

  // Category translation helpers
  const getEssentialCategoryLabel = (category: EssentialInfoCategory): string => {
    const categoryMap: Record<EssentialInfoCategory, string> = {
      'Home': t['info.category.home'] || category,
      'School': t['info.category.school'] || category,
      'Doctor': t['info.category.doctor'] || category,
      'Hospital': t['info.category.hospital'] || category,
      'Shops': t['info.category.shops'] || category,
      'Others': t['info.category.others'] || category,
    };
    return categoryMap[category] || category;
  };

  const getRoutineCategoryLabel = (category: HouseRoutineCategory): string => {
    const categoryMap: Record<HouseRoutineCategory, string> = {
      'Home Rules': t['routine.category.house_rules'] || category,
      'Routine': t['routine.category.routine'] || category,
      'Cooking': t['routine.category.cooking'] || category,
      'Child Care': t['routine.category.child_care'] || category,
      'Cleaning': t['routine.category.cleaning'] || category,
      'Grocery': t['routine.category.grocery'] || category,
      'Laundry': t['routine.category.laundry'] || category,
      'Pet Care': t['routine.category.pet_care'] || category,
      'Safety': t['routine.category.safety'] || category,
      'Utilities': t['routine.category.utilities'] || category,
                      'Helper Care': t['routine.category.helper_care'] || category,
      'Others': t['routine.category.others'] || category,
    };
    return categoryMap[category] || category;
  };

  // ─────────────────────────────────────────────────────────────────
  // Essential Info Handlers
  // ─────────────────────────────────────────────────────────────────
  const filteredEssentialItems =
    selectedEssentialCategory === "All"
      ? essentialItems
      : essentialItems.filter((item) => item.category === selectedEssentialCategory);

  const handleAddEssentialClick = () => {
    setEditingEssentialItem(null);
    setEssentialForm({
      category: selectedEssentialCategory === "All" ? "Home" : selectedEssentialCategory,
      name: "",
      address: "",
      countryCode: "+852",
      phone: "",
      note: "",
    });
    setIsEssentialModalOpen(true);
  };

  const handleEditEssentialClick = (item: EssentialInfo) => {
    setEditingEssentialItem(item);
    setEssentialForm({
      category: item.category,
      name: item.name || "",
      address: item.address || "",
      countryCode: item.countryCode || "+852",
      phone: item.phone || "",
      note: item.note || "",
    });
    setIsEssentialModalOpen(true);
  };

  const handleSaveEssential = async () => {
    // Close modal FIRST for instant feedback & double-click prevention
    setIsEssentialModalOpen(false);
    
    try {
      if (editingEssentialItem) {
        // Update existing - use optimistic handler
        await onUpdateEssentialInfo(editingEssentialItem.id, essentialForm);
      } else {
        // Detect language for new essential info
        const nameLang = essentialForm.name ? detectInputLanguage(currentLang) : null;
        const noteLang = essentialForm.note ? detectInputLanguage(currentLang) : null;
        
        const createData: CreateEssentialInfo = {
          ...essentialForm,
          nameLang: nameLang || null,
          nameTranslations: {},
          noteLang: noteLang || null,
          noteTranslations: {},
        };
        
        // Add new - use optimistic handler
        await onAddEssentialInfo(createData);
      }
    } catch (err) {
      console.error("Failed to save:", err);
      setError(t['error.save_essential_info'] || 'Failed to save. Please try again.');
    }
  };

  const handleDeleteEssential = async () => {
    if (!editingEssentialItem) return;
    
    const itemToDelete = editingEssentialItem;
    
    // Close modal immediately for responsive UX
    setIsEssentialModalOpen(false);
    
    // Use optimistic delete handler
    try {
      await onDeleteEssentialInfo(itemToDelete.id);
    } catch (err) {
      console.error("Failed to delete:", err);
      setError(t['error.delete_essential_info'] || 'Failed to delete. Please try again.');
    }
  };

  const openGoogleMaps = (address: string) => {
    const encoded = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      // iOS: Try Google Maps app first, ask user for Apple Maps if not installed
      let appOpened = false;
      
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
          appOpened = true;
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibility);
      
      // Try Google Maps app (URI scheme - works like tel:, returns where you left off)
      window.location.href = `comgooglemaps://?q=${encoded}`;
      
      // After 1 second, if app didn't open, show modal to ask user
      setTimeout(() => {
        document.removeEventListener('visibilitychange', handleVisibility);
        if (!appOpened && document.visibilityState === 'visible') {
          // Google Maps didn't open - show modal to ask user
          setPendingMapsAddress(encoded);
          setShowMapsChoiceModal(true);
        }
      }, 1000);
    } else if (isAndroid) {
      // Android: geo: URI opens default maps app (usually Google Maps if installed)
      // Works like tel: - returns exactly where you left off
      window.location.href = `geo:0,0?q=${encoded}`;
    } else {
      // Desktop: open Google Maps web in new tab
      window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, "_blank");
    }
  };
  
  const handleOpenAppleMaps = () => {
    setShowMapsChoiceModal(false);
    if (pendingMapsAddress) {
      window.location.href = `maps://maps.apple.com/?q=${pendingMapsAddress}`;
    }
  };

  const makeCall = (countryCode: string, phone: string) => {
    const fullNumber = `${countryCode}${phone.replace(/\D/g, "")}`;
    window.location.href = `tel:${fullNumber}`;
  };

  // ─────────────────────────────────────────────────────────────────
  // House Routine Handlers
  // ─────────────────────────────────────────────────────────────────
  const filteredHouseRoutineItems =
    selectedHouseRoutineCategory === "All"
      ? houseRoutineItems
      : houseRoutineItems.filter((item) => item.category === selectedHouseRoutineCategory);

  const handleAddHouseRoutineClick = () => {
    setEditingHouseRoutineItem(null);
    setHouseRoutineForm({
      category: selectedHouseRoutineCategory === "All" ? "Home Rules" : selectedHouseRoutineCategory,
      customCategory: "",
      name: "",
      note: "",
    });
    setIsHouseRoutineModalOpen(true);
  };

  const handleEditHouseRoutineClick = (item: HouseRoutine) => {
    setEditingHouseRoutineItem(item);
    setHouseRoutineForm({
      category: item.category,
      customCategory: item.customCategory || "",
      name: item.name,
      note: item.note || "",
    });
    setIsHouseRoutineModalOpen(true);
  };

  const handleViewHouseRoutineClick = (item: HouseRoutine) => {
    setViewingHouseRoutineItem(item);
  };

  const handleSaveHouseRoutine = async () => {
    // Close modal FIRST for instant feedback & double-click prevention
    setIsHouseRoutineModalOpen(false);
    
    try {
      if (editingHouseRoutineItem) {
        // Re-detect language if name or note changed
        const existingItem = houseRoutineItems.find(item => item.id === editingHouseRoutineItem.id);
        const nameChanged = existingItem && existingItem.name !== houseRoutineForm.name;
        const noteChanged = existingItem && existingItem.note !== houseRoutineForm.note;
        const nameLang = nameChanged ? detectInputLanguage(currentLang) : undefined;
        const noteLang = noteChanged ? detectInputLanguage(currentLang) : undefined;
        
        const updateData: Partial<CreateHouseRoutine> = { ...houseRoutineForm };
        if (nameChanged && nameLang !== undefined) {
          (updateData as any).nameLang = nameLang || null;
          (updateData as any).nameTranslations = {};
        }
        if (noteChanged && noteLang !== undefined) {
          (updateData as any).noteLang = noteLang || null;
          (updateData as any).noteTranslations = {};
        }
        
        // Update existing - use optimistic handler
        await onUpdateHouseRoutine(editingHouseRoutineItem.id, updateData);
      } else {
        // Detect language for new house routine
        const nameLang = houseRoutineForm.name ? detectInputLanguage(currentLang) : null;
        const noteLang = houseRoutineForm.note ? detectInputLanguage(currentLang) : null;
        
        const createData: CreateHouseRoutine = {
          ...houseRoutineForm,
          nameLang: nameLang || null,
          nameTranslations: {},
          noteLang: noteLang || null,
          noteTranslations: {},
        };
        
        // Add new - use optimistic handler
        await onAddHouseRoutine(createData);
      }
    } catch (err) {
      console.error("Failed to save house routine:", err);
      setError(t['error.save_house_routine'] || 'Failed to save. Please try again.');
    }
  };

  const handleDeleteHouseRoutine = async () => {
    if (!editingHouseRoutineItem) return;
    
    const itemToDelete = editingHouseRoutineItem;
    
    // Close modal immediately for responsive UX
    setIsHouseRoutineModalOpen(false);
    
    // Use optimistic delete handler
    try {
      await onDeleteHouseRoutine(itemToDelete.id);
    } catch (err) {
      console.error("Failed to delete house routine:", err);
      setError(t['error.delete_house_routine'] || 'Failed to delete. Please try again.');
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Practice Ideas Handlers
  // ─────────────────────────────────────────────────────────────────
  const handleTogglePreset = (presetId: string) => {
    setSelectedPresetIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(presetId)) {
        newSet.delete(presetId);
      } else {
        newSet.add(presetId);
      }
      return newSet;
    });
  };

  const handleSelectAllPresets = () => {
    if (selectedPresetIds.size === availablePresets.length) {
      // Deselect all
      setSelectedPresetIds(new Set());
    } else {
      // Select all
      setSelectedPresetIds(new Set(availablePresets.map(p => p.id)));
    }
  };

  const handleAddSelectedPresets = async () => {
    if (selectedPresetIds.size === 0) return;
    
    setIsAddingPresets(true);
    haptics.medium();
    
    try {
      // Get selected presets
      const presetsToAdd = availablePresets.filter(p => selectedPresetIds.has(p.id));
      
      // Add each preset as a new practice item
      for (const preset of presetsToAdd) {
        const createData: CreateHouseRoutine = {
          category: preset.category,
          name: preset.name,
          note: preset.note,
          nameLang: 'en', // Presets are in English
          nameTranslations: {},
          noteLang: 'en',
          noteTranslations: {},
          preset_id: preset.id, // Link to the preset
        };
        
        await onAddHouseRoutine(createData);
      }
      
      haptics.success();
      setShowAddPresetsConfirm(false);
      setIsPracticeIdeasModalOpen(false);
      setSelectedPresetIds(new Set());
    } catch (err) {
      console.error("Failed to add presets:", err);
      setError(t['error.save_house_routine'] || 'Failed to save. Please try again.');
      haptics.error();
      setShowAddPresetsConfirm(false);
    } finally {
      setIsAddingPresets(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY HEADER - Push Up (No Shrink) */}
        {/* Fixed size header, collapsible content fades out */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header 
          className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
          style={{ height: '120px', boxShadow: '0 10px 0 0 hsl(var(--background))' }}
        >
          <div className="flex items-center justify-between w-full">
            <h1>
              <span className="text-primary font-bold" style={{ fontSize: '20px' }}>{t['info.title'] || 'Family Info'}</span><br />
              <span className="text-display text-foreground">
                {activeSection === 'essentialInfo' ? (t['common.places'] || 'Places') : 
                 activeSection === 'houseRoutine' ? (t['common.practice'] || 'Practice') :
                 (t['common.helper'] || 'Helper')}
              </span>
            </h1>
            
            {/* Practice Ideas Button - SuperAdmin only, show when in Practice tab */}
            {activeSection === 'houseRoutine' && isSuperAdmin && availablePresets.length > 0 && (
              <button
                onClick={() => {
                  haptics.medium();
                  setSelectedPresetIds(new Set());
                  setIsPracticeIdeasModalOpen(true);
                }}
                className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-caption font-semibold flex items-center gap-1.5 shrink-0 mb-1"
              >
                <Lightbulb size={16} />
                {t['info.practice_ideas'] || 'Practice Ideas'}
              </button>
            )}
          </div>
        </header>

        {/* Error Banner */}
        <ErrorBanner 
          error={error} 
          onDismiss={() => setError(null)} 
          title={t['common.error'] || 'Error'}
        />

        {/* Section Toggle Cards - Scrollable Horizontal Layout */}
        <div className="mt-4 mb-2 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3">
            {/* Places Card */}
            <button
              onClick={() => setActiveSection("essentialInfo")}
              className={`flex-shrink-0 min-w-[130px] px-3 py-2.5 rounded-xl text-left transition-all ${
                activeSection === "essentialInfo"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-foreground shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                <span className="text-title">{t['common.places'] || 'Places'}</span>
              </div>
              <div className={`text-caption mt-1 ml-6 ${activeSection === "essentialInfo" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {essentialStats.total} {t['common.items'] || 'items'}
              </div>
            </button>

            {/* Practice Card */}
            <button
              onClick={() => setActiveSection("houseRoutine")}
              className={`flex-shrink-0 min-w-[130px] px-3 py-2.5 rounded-xl text-left transition-all ${
                activeSection === "houseRoutine"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-foreground shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2">
                <ListChecks size={16} />
                <span className="text-title">{t['common.practice'] || 'Practice'}</span>
              </div>
              <div className={`text-caption mt-1 ml-6 ${activeSection === "houseRoutine" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {houseRoutineStats.total} {t['common.items'] || 'items'}
              </div>
            </button>

            {/* Helper Card - Only available to Core and Pro users */}
            <button
              onClick={() => {
                if (hasHelperManagementAccess) {
                  setActiveSection("helper");
                } else {
                  setShowHelperUpgradeModal(true);
                }
              }}
              className={`flex-shrink-0 min-w-[130px] px-3 py-2.5 rounded-xl text-left transition-all ${
                !hasHelperManagementAccess
                  ? "bg-card text-muted-foreground shadow-sm"
                  : activeSection === "helper"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-foreground shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2">
                {hasHelperManagementAccess ? (
                  <HeartHandshake size={16} />
                ) : (
                  <Lock size={16} />
                )}
                <span className="text-title">{t['common.helper'] || 'Helper'}</span>
              </div>
              <div className={`text-caption mt-1 ml-6 ${
                !hasHelperManagementAccess 
                  ? "text-muted-foreground/60" 
                  : activeSection === "helper" 
                  ? "text-primary-foreground/70" 
                  : "text-muted-foreground"
              }`}>
                {hasHelperManagementAccess 
                  ? `${helpers.length} ${t['common.helpers'] || 'helpers'}`
                  : (t['common.upgrade_required'] || 'Upgrade')
                }
              </div>
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY TAB NAVIGATION */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div 
          className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
          style={{ 
            top: '118px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          {/* Essential Info Tabs */}
          {activeSection === "essentialInfo" && (
            <div 
              className="relative rounded-full overflow-hidden"
              style={{ backgroundColor: 'hsl(var(--muted))' }}
            >
              {/* Scrollable button container */}
              <div className="flex p-1 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setSelectedEssentialCategory("All")}
                  className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all ${
                    selectedEssentialCategory === "All"
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {t['common.all'] || 'All'} ({getEssentialItemCount("All")})
                </button>
                {ESSENTIAL_CATEGORIES.map((cat) => {
                  const getCategoryLabel = (category: EssentialInfoCategory) => {
                    const categoryMap: Record<EssentialInfoCategory, string> = {
                      'Home': t['info.category.home'] || category,
                      'School': t['info.category.school'] || category,
                      'Doctor': t['info.category.doctor'] || category,
                      'Hospital': t['info.category.hospital'] || category,
                      'Shops': t['info.category.shops'] || category,
                      'Others': t['info.category.others'] || category,
                    };
                    return categoryMap[category] || category;
                  };
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedEssentialCategory(cat)}
                      className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        selectedEssentialCategory === cat
                          ? "bg-card text-primary shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      {ESSENTIAL_CATEGORY_ICONS[cat]}
                      {getCategoryLabel(cat)} ({getEssentialItemCount(cat)})
                    </button>
                  );
                })}
              </div>
              {/* Inset shadow overlay - fixed to outer container, doesn't scroll */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
              />
            </div>
          )}

          {/* House Routine Tabs */}
          {activeSection === "houseRoutine" && (
            <div 
              className="relative rounded-full overflow-hidden"
              style={{ backgroundColor: 'hsl(var(--muted))' }}
            >
              {/* Scrollable button container */}
              <div className="flex p-1 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setSelectedHouseRoutineCategory("All")}
                  className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all ${
                    selectedHouseRoutineCategory === "All"
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {t['common.all'] || 'All'} ({getHouseRoutineItemCount("All")})
                </button>
                {HOUSE_ROUTINE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedHouseRoutineCategory(cat)}
                      className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        selectedHouseRoutineCategory === cat
                          ? "bg-card text-primary shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      {HOUSE_ROUTINE_CATEGORY_ICONS[cat]}
                      {getRoutineCategoryLabel(cat)} ({getHouseRoutineItemCount(cat)})
                    </button>
                ))}
              </div>
              {/* Inset shadow overlay - fixed to outer container, doesn't scroll */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
              />
            </div>
          )}

          {/* Helper Selector Tabs */}
          {activeSection === "helper" && hasHelperManagementAccess && helpers.length > 0 && (
            <div 
              className="relative rounded-full overflow-hidden"
              style={{ backgroundColor: 'hsl(var(--muted))' }}
            >
              {/* Scrollable button container */}
              <div className="flex p-1 overflow-x-auto scrollbar-hide">
                {helpers.map(helper => (
                  <button
                    key={helper.id}
                    onClick={() => setSelectedHelperId(helper.id)}
                    className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all ${
                      selectedHelperId === helper.id
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    {helper.name}
                  </button>
                ))}
              </div>
              {/* Inset shadow overlay - fixed to outer container, doesn't scroll */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
              />
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* MAIN CONTENT */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div className="pt-4">

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* ESSENTIAL INFO SECTION */}
        {/* ─────────────────────────────────────────────────────────────── */}
        {activeSection === "essentialInfo" && (
          <>

            {/* Cards List */}
            <div className="space-y-4">
              {filteredEssentialItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                    <MapPin size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-body text-foreground">{t['info.no_places_yet'] || 'No places yet'}</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    {t['info.add_places_hint'] || 'Add important places and contacts for your household'}
                  </p>
                </div>
              ) : (
                filteredEssentialItems.map((item) => (
                  <EssentialInfoCard
                    key={item.id}
                    item={item}
                    onEdit={() => handleEditEssentialClick(item)}
                    onOpenMap={() => item.address && openGoogleMaps(item.address)}
                    onCall={() => item.phone && makeCall(item.countryCode || "+852", item.phone)}
                    canEdit={!isHelper}
                    currentLang={currentLang}
                    householdId={householdId}
                    t={t}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* HOUSE ROUTINE SECTION */}
        {/* ─────────────────────────────────────────────────────────────── */}
        {activeSection === "houseRoutine" && (
          <>
            {/* House Routine Cards */}
            <div className="space-y-4">
              {filteredHouseRoutineItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                    <ListChecks size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-body text-foreground">{t['info.no_practice_yet'] || 'No practices yet'}</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    {t['info.add_practice_hint'] || 'Add household practices and instructions'}
                  </p>
                </div>
              ) : (
                filteredHouseRoutineItems.map((item) => (
                  <HouseRoutineCard
                    key={item.id}
                    item={item}
                    onEdit={() => handleEditHouseRoutineClick(item)}
                    onView={() => handleViewHouseRoutineClick(item)}
                    canEdit={!isHelper}
                    currentLang={currentLang}
                    householdId={householdId}
                    t={t}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* HELPER SECTION */}
        {/* ─────────────────────────────────────────────────────────────── */}
        {activeSection === "helper" && (
          <>
            {/* Show upgrade message for Free users */}
            {!hasHelperManagementAccess ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                  <Lock size={28} className="text-muted-foreground" />
                </div>
                <p className="text-body text-foreground mb-2">
                  {t['helper.upgrade_required_title'] || 'Helper Management'}
                </p>
                <p className="text-caption text-muted-foreground mb-4">
                  {t['helper.upgrade_required_desc'] || 'Upgrade to Core or Pro to access Helper Management features'}
                </p>
                <button
                  onClick={onNavigateToProfile}
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-body font-semibold "
                >
                  {t['common.view_plans'] || 'View Plans'}
                </button>
              </div>
            ) : (
              <>
                {/* Helper Content */}
                {selectedHelperId && (() => {
                  const selectedHelper = helpers.find(h => h.id === selectedHelperId);
                  if (!selectedHelper) return null;
                  return (
                    <HelperManagementContent
                      householdId={householdId}
                      helperId={selectedHelperId}
                      helper={selectedHelper}
                      currentUser={currentUser}
                      t={t}
                      onNavigateToProfile={onNavigateToProfile || (() => {})}
                      onEditHelper={onEditHelper}
                    />
                  );
                })()}
                
                {helpers.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-body text-muted-foreground">
                      {t['helper.no_helpers'] || 'No helpers in this household'}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        </div>
        {/* End of MAIN CONTENT */}

        {/* Footer */}
        <div className="helpy-footer">
          <span className="helpy-logo">helpy</span>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* FLOATING ACTION BUTTON */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {!isHelper && (
        <button
          onClick={activeSection === "essentialInfo" ? handleAddEssentialClick : handleAddHouseRoutineClick}
          className={`fixed bottom-28 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg  flex items-center justify-center z-30 ${
            (isEssentialModalOpen || isHouseRoutineModalOpen || viewingHouseRoutineItem || activeSection === "helper") ? 'fab-hiding' : ''
          }`}
          aria-label={activeSection === "essentialInfo" ? "Add Essential Info" : "Add House Routine"}
        >
          <Plus size={24} />
        </button>
      )}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* MODALS */}
      {/* ─────────────────────────────────────────────────────────────── */}

      {/* Essential Info Modal */}
      {isEssentialModalOpen && (
        <EssentialInfoModal
          isEditing={!!editingEssentialItem}
          form={essentialForm}
          setForm={setEssentialForm}
          onClose={() => setIsEssentialModalOpen(false)}
          onSave={handleSaveEssential}
          onDelete={handleDeleteEssential}
          t={t}
        />
      )}

      {/* House Routine Modal */}
      {isHouseRoutineModalOpen && (
        <HouseRoutineModal
          isEditing={!!editingHouseRoutineItem}
          form={houseRoutineForm}
          setForm={setHouseRoutineForm}
          onClose={() => setIsHouseRoutineModalOpen(false)}
          onSave={handleSaveHouseRoutine}
          onDelete={handleDeleteHouseRoutine}
          t={t}
        />
      )}

      {/* House Routine View Modal (for helpers - read-only) */}
      {viewingHouseRoutineItem && (
        <HouseRoutineViewModal
          item={viewingHouseRoutineItem}
          onClose={() => setViewingHouseRoutineItem(null)}
          currentLang={currentLang}
          householdId={householdId}
          t={t}
        />
      )}

      {/* Helper Upgrade Modal - Bottom Sheet */}
      {showHelperUpgradeModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setShowHelperUpgradeModal(false); }}
        >
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
            {/* Close Button */}
            <button 
              onClick={() => setShowHelperUpgradeModal(false)} 
              className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center right-4 top-4 text-muted-foreground"
              aria-label={t['common.close'] || 'Close'}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <HeartHandshake size={24} className="text-primary" />
                </div>
                <h2 className="text-title text-foreground">
                  {t['helper.management_title'] || 'Helper Management'}
                </h2>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-body text-muted-foreground">
                {t['helper.upgrade_modal_desc'] || "Manage your domestic helper's employment records. Track when they work on statutory holidays, record overtime or time-in-lieu, and confirm monthly payslips with digital signatures from both employer and helper."}
              </p>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border shrink-0">
              <button
                onClick={() => {
                  setShowHelperUpgradeModal(false);
                  localStorage.setItem('helpy_profile_target_section', 'plan');
                  onNavigateToProfile?.();
                }}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm"
              >
                {t['common.upgrade'] || 'Upgrade'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Maps Choice Modal (iOS - when Google Maps not installed) */}
      {showMapsChoiceModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMapsChoiceModal(false); }}
        >
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <h2 className="text-title text-foreground">{t['maps.open_in_maps'] || 'Open in Maps'}</h2>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-body text-muted-foreground">
                {t['maps.google_not_installed'] || 'Google Maps is not installed. Open in Apple Maps instead?'}
              </p>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
              <button
                onClick={() => setShowMapsChoiceModal(false)}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleOpenAppleMaps}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body"
              >
                {t['maps.open_apple_maps'] || 'Open Apple Maps'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Practice Ideas Modal - Full Screen Selection */}
      {isPracticeIdeasModalOpen && createPortal(
        <div 
          className="fixed inset-0 bg-background z-[60] flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Header */}
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border relative">
            {/* Close button - absolute top right */}
            <button
              onClick={() => {
                setIsPracticeIdeasModalOpen(false);
                setSelectedPresetIds(new Set());
              }}
              className="absolute z-10 right-4 top-4 w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
            >
              <X size={20} />
            </button>
            
            {/* Title and description - left aligned */}
            <div className="pr-12">
              <h2 className="text-title text-foreground">{t['info.practice_ideas_title'] || 'Practice Ideas'}</h2>
              <p className="text-body text-muted-foreground mt-1">
                {t['info.practice_ideas_subtitle'] || 'Choose from commonly used templates to help organize your home.'}
              </p>
              <p className="text-caption text-muted-foreground mt-3">
                {t['info.practice_ideas_disclaimer'] || "These templates are provided for convenience and inspiration. Please review and customize them to fit your family's needs and comply with local regulations."}
              </p>
            </div>
          </div>

          {/* Select All / Deselect All */}
          {availablePresets.length > 0 && (
            <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-body text-foreground">
                {selectedPresetIds.size} {t['info.practice_ideas_selected'] || 'selected'}
              </span>
              <button
                onClick={handleSelectAllPresets}
                className="text-body text-primary font-semibold"
              >
                {selectedPresetIds.size === availablePresets.length 
                  ? (t['info.practice_ideas_deselect_all'] || 'Deselect All')
                  : (t['info.practice_ideas_select_all'] || 'Select All')
                }
              </button>
            </div>
          )}

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {availablePresets.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check size={28} className="text-primary" />
                </div>
                <p className="text-body text-foreground">{t['info.practice_ideas_all_added'] || "You've added all suggested ideas!"}</p>
                <p className="text-caption text-muted-foreground mt-1">
                  {t['info.practice_ideas_all_added_desc'] || 'Great job setting up your household practices.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {availablePresetCategories.map(category => {
                  const categoryPresets = availablePresets.filter(p => p.category === category);
                  if (categoryPresets.length === 0) return null;
                  
                  const config = HOUSE_ROUTINE_CATEGORY_CONFIG[category];
                  
                  return (
                    <div key={category}>
                      {/* Category Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: config.bgColor, color: config.color }}
                        >
                          {HOUSE_ROUTINE_CATEGORY_ICONS[category]}
                        </div>
                        <span className="text-title text-foreground">{getRoutineCategoryLabel(category)}</span>
                        <span className="text-caption text-muted-foreground">({categoryPresets.length})</span>
                      </div>
                      
                      {/* Category Items */}
                      <div className="space-y-2">
                        {categoryPresets.map(preset => {
                          const isSelected = selectedPresetIds.has(preset.id);
                          return (
                            <button
                              key={preset.id}
                              onClick={() => handleTogglePreset(preset.id)}
                              className={`w-full text-left p-4 rounded-xl border transition-all ${
                                isSelected 
                                  ? 'bg-primary/5 border-primary' 
                                  : 'bg-card border-border'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                  isSelected 
                                    ? 'bg-primary border-primary' 
                                    : 'border-muted-foreground/30'
                                }`}>
                                  {isSelected && <Check size={14} className="text-primary-foreground" strokeWidth={3} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-body font-semibold text-foreground">{preset.name}</p>
                                  <p className="text-caption text-muted-foreground mt-1">{preset.note}</p>
                                </div>
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
          </div>

          {/* Footer - Add Button */}
          {availablePresets.length > 0 && (
            <div className="shrink-0 p-4 pb-6 border-t border-border">
              <button
                onClick={() => setShowAddPresetsConfirm(true)}
                disabled={selectedPresetIds.size === 0 || isAddingPresets}
                className={`w-full py-3.5 rounded-xl text-body font-semibold flex items-center justify-center gap-2 transition-all ${
                  selectedPresetIds.size > 0 && !isAddingPresets
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isAddingPresets ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t['info.practice_ideas_adding'] || 'Adding...'}
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    {t['info.practice_ideas_add_selected'] || 'Add Selected'} ({selectedPresetIds.size})
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      , document.body)}

      {/* Add Presets Confirmation Modal - Centered */}
      {showAddPresetsConfirm && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[70] flex items-center justify-center p-6"
          onClick={(e) => { if (e.target === e.currentTarget && !isAddingPresets) setShowAddPresetsConfirm(false); }}
        >
          <div className="bg-card w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            {/* Content */}
            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Lightbulb size={28} className="text-primary" />
              </div>
              <h3 className="text-title text-foreground text-center mb-2">
                {(t['info.practice_ideas_confirm_title'] || 'Add {count} Practice Ideas?').replace('{count}', String(selectedPresetIds.size))}
              </h3>
              <p className="text-body text-muted-foreground text-center">
                {t['info.practice_ideas_confirm_desc'] || 'You can edit or delete them anytime after adding.'}
              </p>
            </div>
            
            {/* Buttons - Helpy Theme Style */}
            <div className="p-5 pt-0 flex gap-3">
              <button
                onClick={() => setShowAddPresetsConfirm(false)}
                disabled={isAddingPresets}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body font-semibold disabled:opacity-50"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleAddSelectedPresets}
                disabled={isAddingPresets}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAddingPresets ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t['info.practice_ideas_adding'] || 'Adding...'}
                  </>
                ) : (
                  t['common.add'] || 'Add'
                )}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Essential Info Card Component
// ─────────────────────────────────────────────────────────────────
interface EssentialInfoCardProps {
  item: EssentialInfo;
  onEdit: () => void;
  onOpenMap: () => void;
  onCall: () => void;
  canEdit: boolean;
  currentLang: string;
  householdId: string;
  t: TranslationDictionary;
}

const EssentialInfoCard: React.FC<EssentialInfoCardProps> = ({
  item,
  onEdit,
  onOpenMap,
  onCall,
  canEdit,
  currentLang,
  householdId,
  t,
}) => {
  const config = CATEGORY_CONFIG[item.category];

  const getEssentialCategoryLabel = (category: EssentialInfoCategory): string => {
    const categoryMap: Record<EssentialInfoCategory, string> = {
      'Home': t['info.category.home'] || category,
      'School': t['info.category.school'] || category,
      'Doctor': t['info.category.doctor'] || category,
      'Hospital': t['info.category.hospital'] || category,
      'Shops': t['info.category.shops'] || category,
      'Others': t['info.category.others'] || category,
    };
    return categoryMap[category] || category;
  };

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: config.bgColor, color: config.color }}
          >
            {ESSENTIAL_CATEGORY_ICONS[item.category]}
          </div>
          <div>
            <h3 className="text-title text-foreground">
              <TranslatedEssentialName 
                info={item} 
                currentLang={currentLang} 
                onUpdate={(id, data) => updateEssentialInfo(householdId, id, data as any)} 
              />
            </h3>
            <span
              className="text-caption px-2 py-0.5 rounded-full"
              style={{ backgroundColor: config.bgColor, color: config.color }}
            >
              {getEssentialCategoryLabel(item.category)}
            </span>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-muted-foreground"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {/* Address */}
      {item.address && (
        <button
          onClick={onOpenMap}
          className="w-full text-left flex items-start gap-2 py-1.5 group"
        >
          <MapPin size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
          <span className="text-body text-foreground">{item.address}</span>
        </button>
      )}

      {/* Phone */}
      {item.phone && (
        <button
          onClick={onCall}
          className="w-full text-left flex items-center gap-2 py-1.5 group"
        >
          <Phone size={16} className="text-muted-foreground flex-shrink-0" />
          <span className="text-body text-foreground">
            {item.countryCode} {item.phone}
          </span>
        </button>
      )}

      {/* Note */}
      {item.note && (
        <div className="flex items-start gap-2 py-1.5">
          <FileText size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
          <span className="text-body text-muted-foreground whitespace-pre-wrap">
            <TranslatedEssentialNote 
              info={item} 
              currentLang={currentLang} 
              onUpdate={(id, data) => updateEssentialInfo(householdId, id, data as any)} 
            />
          </span>
        </div>
      )}
      </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// House Routine Card Component
// ─────────────────────────────────────────────────────────────────
interface HouseRoutineCardProps {
  item: HouseRoutine;
  onEdit: () => void;
  onView: () => void;
  canEdit: boolean;
  currentLang: string;
  householdId: string;
  t: TranslationDictionary;
}

const HouseRoutineCard: React.FC<HouseRoutineCardProps> = ({
  item,
  onEdit,
  onView,
  canEdit,
  currentLang,
  householdId,
  t,
}) => {
  const config = HOUSE_ROUTINE_CATEGORY_CONFIG[item.category];

  const getRoutineCategoryLabel = (category: HouseRoutineCategory): string => {
    const categoryMap: Record<HouseRoutineCategory, string> = {
      'Home Rules': t['routine.category.house_rules'] || category,
      'Routine': t['routine.category.routine'] || category,
      'Cooking': t['routine.category.cooking'] || category,
      'Child Care': t['routine.category.child_care'] || category,
      'Cleaning': t['routine.category.cleaning'] || category,
      'Grocery': t['routine.category.grocery'] || category,
      'Laundry': t['routine.category.laundry'] || category,
      'Pet Care': t['routine.category.pet_care'] || category,
      'Safety': t['routine.category.safety'] || category,
      'Utilities': t['routine.category.utilities'] || category,
                      'Helper Care': t['routine.category.helper_care'] || category,
      'Others': t['routine.category.others'] || category,
    };
    return categoryMap[category] || category;
  };

  const displayCategory = item.category === "Others" && item.customCategory
    ? item.customCategory
    : getRoutineCategoryLabel(item.category);

  // Use edit for owners, view for helpers
  const handleTap = canEdit ? onEdit : onView;

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: config.bgColor, color: config.color }}
          >
            {HOUSE_ROUTINE_CATEGORY_ICONS[item.category]}
          </div>
          <div>
            <h3 className="text-title text-foreground">
              <TranslatedHouseRoutineName 
                item={item} 
                currentLang={currentLang} 
                onUpdate={(id, data) => updateHouseRoutine(householdId, id, data as any)} 
              />
            </h3>
            <span
              className="text-caption px-2 py-0.5 rounded-full inline-block mt-1"
              style={{ backgroundColor: config.bgColor, color: config.color }}
            >
              {displayCategory}
            </span>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-muted-foreground"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {/* Note Preview */}
      {item.note && (
        <div 
          className="mt-3 pt-3 cursor-pointer"
          onClick={handleTap}
        >
          <p className="text-body text-muted-foreground whitespace-pre-wrap">
            <TranslatedHouseRoutineNote 
              item={item} 
              currentLang={currentLang} 
              onUpdate={(id, data) => updateHouseRoutine(householdId, id, data as any)} 
            />
          </p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Essential Info Modal
// ─────────────────────────────────────────────────────────────────
interface EssentialInfoModalProps {
  isEditing: boolean;
  form: CreateEssentialInfo;
  setForm: React.Dispatch<React.SetStateAction<CreateEssentialInfo>>;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  t: TranslationDictionary;
}

const EssentialInfoModal: React.FC<EssentialInfoModalProps> = ({
  isEditing,
  form,
  setForm,
  onClose,
  onSave,
  onDelete,
  t,
}) => {
  const [countryCodeSearch, setCountryCodeSearch] = useState('');
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
  
  const filteredCountryCodes = COUNTRY_CODES.filter(item =>
    item.country.toLowerCase().includes(countryCodeSearch.toLowerCase()) ||
    item.code.includes(countryCodeSearch)
  );

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.country-code-dropdown')) {
        setShowCountryCodeDropdown(false);
      }
    };
    
    if (showCountryCodeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCountryCodeDropdown]);

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Safe area bottom cover - fills the gap below the sheet */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-card"
        style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
      />
      <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
        {/* Header with X left, Title center, ✓ right */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          {/* X Close Button (left) */}
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
            aria-label={t['common.close'] || 'Close'}
          >
            <X size={20} />
          </button>
          
          {/* Title (center) */}
          <h2 className="text-title font-semibold text-foreground text-center flex-1">
            {isEditing ? (t['info.edit_place'] || "Edit Place") : (t['info.add_new_place'] || "Add New Place")}
          </h2>
          
          {/* ✓ Confirm Button (right) */}
          <button
            onClick={onSave}
            disabled={!form.name?.trim()}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              form.name?.trim()
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

        {/* Form */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Main Input: Name (big font) */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['info.name_of_the_place'] || 'Place Name'}
            </label>
            <input
              type="text"
              autoComplete="one-time-code"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t['info.place_placeholder'] || 'e.g., City General Hospital'}
              className="w-full px-4 py-3 bg-muted rounded-xl text-xl font-semibold text-foreground placeholder-light outline-none border border-transparent focus:border-primary transition-colors"
            />
          </div>
          
          {/* Category */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['common.category'] || 'Category'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ESSENTIAL_CATEGORIES.map((cat) => {
                const isSelected = form.category === cat;
                const getCatLabel = (category: EssentialInfoCategory): string => {
                  const categoryMap: Record<EssentialInfoCategory, string> = {
                    'Home': t['info.category.home'] || category,
                    'School': t['info.category.school'] || category,
                    'Doctor': t['info.category.doctor'] || category,
                    'Hospital': t['info.category.hospital'] || category,
                    'Shops': t['info.category.shops'] || category,
                    'Others': t['info.category.others'] || category,
                  };
                  return categoryMap[category] || category;
                };
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat })}
                    className={`px-3 py-2 rounded-xl text-body transition-all flex items-center justify-start gap-1.5 ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-card text-foreground ring-1 ring-border"
                    }`}
                  >
                    {ESSENTIAL_CATEGORY_ICONS[cat]}
                    {getCatLabel(cat)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['info.address'] || 'Address'}
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                autoComplete="one-time-code"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder={t['info.address_placeholder'] || '123 Main St, City'}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['info.phone_number'] || 'Phone Number'}
            </label>
            <div className="flex gap-2">
              <div className="relative w-28 country-code-dropdown">
                <input
                  type="text"
                  autoComplete="one-time-code"
                  readOnly
                  value={form.countryCode}
                  onClick={() => setShowCountryCodeDropdown(true)}
                  placeholder="+852"
                  className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none cursor-pointer transition-all text-body"
                />
                <Globe size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                {showCountryCodeDropdown && (
                  <div className="absolute z-50 bottom-full mb-1 w-64 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-hidden flex flex-col country-code-dropdown">
                    {/* Country list - scrollable area */}
                    <div className="py-1 overflow-y-auto flex-1">
                      {filteredCountryCodes.length > 0 ? (
                        filteredCountryCodes.map((item, index) => (
                          <button
                            key={`${item.code}-${item.country}-${index}`}
                            type="button"
                            onClick={() => {
                              setForm({ ...form, countryCode: item.code });
                              setShowCountryCodeDropdown(false);
                              setCountryCodeSearch('');
                            }}
                            className="w-full text-left px-4 py-2 flex items-center justify-between"
                          >
                            <span className="text-body text-foreground">{item.country}</span>
                            <span className="text-body font-medium text-muted-foreground">{item.code}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-body text-muted-foreground">{t['info.no_countries_found'] || 'No countries found'}</div>
                      )}
                    </div>
                    {/* Search input - at bottom when dropdown opens upward */}
                    <div className="p-2 bg-card border-t border-border shrink-0">
                      <input
                        type="text"
                        autoComplete="one-time-code"
                        value={countryCodeSearch}
                        onChange={(e) => setCountryCodeSearch(e.target.value)}
                        placeholder={t['placeholder.search_country'] || 'Search country...'}
                        className="w-full bg-muted border border-transparent rounded-xl px-3 py-2 text-body focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="relative flex-1">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  autoComplete="one-time-code"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => {
                    // Only allow digits, spaces, dashes, and parentheses for phone formatting
                    const value = e.target.value.replace(/[^\d\s\-()]/g, '');
                    setForm({ ...form, phone: value });
                  }}
                  placeholder={t['placeholder.mobile_number'] || 'Mobile number'}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body"
                />
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['info.note'] || 'Note'}
            </label>
            <textarea
              autoComplete="one-time-code"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t['info.note_placeholder'] || 'Any additional details...'}
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body resize-none"
            />
          </div>
        </div>

        {/* Footer - Delete button only (when editing), or invisible spacer */}
        {isEditing ? (
          <>
            {/* Footer separator */}
            <div className="px-5"><div className="h-px bg-border w-full"></div></div>
            {/* Footer with Delete button */}
            <div className="shrink-0 p-5 pb-8">
              <button
                onClick={onDelete}
                className="w-full py-3.5 rounded-xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"
              >
                <Trash2 size={20} />
                {t['info.delete_place'] || 'Delete Place'}
              </button>
            </div>
          </>
        ) : (
          /* Invisible spacer for consistent height */
          <div className="shrink-0 p-5 pb-8">
            <div className="h-[52px]"></div>
          </div>
        )}
      </div>
    </div>
  , document.body);
};

// ─────────────────────────────────────────────────────────────────
// House Routine Modal (Create/Edit)
// ─────────────────────────────────────────────────────────────────
interface HouseRoutineModalProps {
  isEditing: boolean;
  form: CreateHouseRoutine;
  setForm: React.Dispatch<React.SetStateAction<CreateHouseRoutine>>;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  t: TranslationDictionary;
}

const HouseRoutineModal: React.FC<HouseRoutineModalProps> = ({
  isEditing,
  form,
  setForm,
  onClose,
  onSave,
  onDelete,
  t,
}) => {
  return createPortal(
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Safe area bottom cover - fills the gap below the sheet */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-card"
        style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
      />
      <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
        {/* Header with X left, Title center, ✓ right */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          {/* X Close Button (left) */}
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
            aria-label={t['common.close'] || 'Close'}
          >
            <X size={20} />
          </button>
          
          {/* Title (center) */}
          <h2 className="text-title font-semibold text-foreground text-center flex-1">
            {isEditing ? (t['info.edit_practice'] || 'Edit Practice') : (t['info.add_practice'] || 'Add Practice')}
          </h2>
          
          {/* ✓ Confirm Button (right) */}
          <button
            onClick={onSave}
            disabled={!form.name?.trim()}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              form.name?.trim()
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

        {/* Form */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Main Input: Name (big font) */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['info.name_of_the_practice'] || 'Practice Name'}
            </label>
            <input
              type="text"
              autoComplete="one-time-code"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t['info.practice_placeholder'] || 'e.g., How to make the bed'}
              className="w-full px-4 py-3 bg-muted rounded-xl text-xl font-semibold text-foreground placeholder-light outline-none border border-transparent focus:border-primary transition-colors"
            />
          </div>

          {/* Instructions / Notes */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['info.instructions_notes'] || 'Instructions / Notes'}
            </label>
            <textarea
              autoComplete="one-time-code"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t['info.routine_note_placeholder'] || 'Enter the instructions, steps, or details...'}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all resize-none text-body"
            />
          </div>

          {/* Category - Compact 3-column grid for 4 rows */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['common.category'] || 'Category'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {HOUSE_ROUTINE_CATEGORIES.map((cat) => {
                const isSelected = form.category === cat;
                const getCatLabel = (category: HouseRoutineCategory): string => {
                  const categoryMap: Record<HouseRoutineCategory, string> = {
                    'Home Rules': t['routine.category.house_rules'] || category,
                    'Routine': t['routine.category.routine'] || category,
                    'Cooking': t['routine.category.cooking'] || category,
                    'Child Care': t['routine.category.child_care'] || category,
                    'Cleaning': t['routine.category.cleaning'] || category,
                    'Grocery': t['routine.category.grocery'] || category,
                    'Laundry': t['routine.category.laundry'] || category,
                    'Pet Care': t['routine.category.pet_care'] || category,
                    'Safety': t['routine.category.safety'] || category,
                    'Utilities': t['routine.category.utilities'] || category,
                    'Helper Care': t['routine.category.helper_care'] || category,
                    'Others': t['routine.category.others'] || category,
                  };
                  return categoryMap[category] || category;
                };
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat })}
                    className={`px-2 py-2 rounded-xl text-caption transition-all flex items-center justify-start gap-1.5 ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-card text-foreground ring-1 ring-border"
                    }`}
                  >
                    {HOUSE_ROUTINE_CATEGORY_ICONS[cat]}
                    {getCatLabel(cat)}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer - Delete button only (when editing), or invisible spacer */}
        {isEditing ? (
          <>
            {/* Footer separator */}
            <div className="px-5"><div className="h-px bg-border w-full"></div></div>
            {/* Footer with Delete button */}
            <div className="shrink-0 p-5 pb-8">
              <button
                onClick={onDelete}
                className="w-full py-3.5 rounded-xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"
              >
                <Trash2 size={20} />
                {t['info.delete_practice'] || 'Delete Practice'}
              </button>
            </div>
          </>
        ) : (
          /* Invisible spacer for consistent height */
          <div className="shrink-0 p-5 pb-8">
            <div className="h-[52px]"></div>
          </div>
        )}
      </div>
    </div>
  , document.body);
};

// ─────────────────────────────────────────────────────────────────
// House Routine View Modal (Read-only for Helpers)
// ─────────────────────────────────────────────────────────────────
interface HouseRoutineViewModalProps {
  item: HouseRoutine;
  onClose: () => void;
  currentLang: string;
  householdId: string;
  t: TranslationDictionary;
}

const HouseRoutineViewModal: React.FC<HouseRoutineViewModalProps> = ({
  item,
  onClose,
  currentLang,
  householdId,
  t,
}) => {
  const config = HOUSE_ROUTINE_CATEGORY_CONFIG[item.category];
  
  const getRoutineCategoryLabel = (category: HouseRoutineCategory): string => {
    const categoryMap: Record<HouseRoutineCategory, string> = {
      'Home Rules': t['routine.category.house_rules'] || category,
      'Routine': t['routine.category.routine'] || category,
      'Cooking': t['routine.category.cooking'] || category,
      'Child Care': t['routine.category.child_care'] || category,
      'Cleaning': t['routine.category.cleaning'] || category,
      'Grocery': t['routine.category.grocery'] || category,
      'Laundry': t['routine.category.laundry'] || category,
      'Pet Care': t['routine.category.pet_care'] || category,
      'Safety': t['routine.category.safety'] || category,
      'Utilities': t['routine.category.utilities'] || category,
                      'Helper Care': t['routine.category.helper_care'] || category,
      'Others': t['routine.category.others'] || category,
    };
    return categoryMap[category] || category;
  };

  const displayCategory = item.category === "Others" && item.customCategory
    ? item.customCategory
    : getRoutineCategoryLabel(item.category);

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Safe area bottom cover - fills the gap below the sheet */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-card"
        style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
      />
      <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
        {/* Header with X left, Title center */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          {/* X Close Button (left) */}
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
            aria-label={t['common.close'] || 'Close'}
          >
            <X size={20} />
          </button>
          
          {/* Title (center) */}
          <h2 className="text-title font-semibold text-foreground text-center flex-1">
            {displayCategory}
          </h2>
          
          {/* Invisible spacer (right) */}
          <div className="w-10 h-10" />
        </div>
        
        {/* Header separator */}
        <div className="px-5"><div className="h-px bg-border w-full"></div></div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div>
            <span
              className="text-caption px-2 py-0.5 rounded-full inline-block mb-2"
              style={{ backgroundColor: config.bgColor, color: config.color }}
            >
              {displayCategory}
            </span>
            <h2 className="text-xl font-semibold text-foreground">
              <TranslatedHouseRoutineName 
                item={item} 
                currentLang={currentLang} 
                onUpdate={(id, data) => updateHouseRoutine(householdId, id, data as any)} 
              />
            </h2>
          </div>

          <div className="prose prose-gray prose-sm">
            {item.note ? (
              <div className="whitespace-pre-wrap text-body text-foreground">
                <TranslatedHouseRoutineNote 
                  item={item} 
                  currentLang={currentLang} 
                  onUpdate={(id, data) => updateHouseRoutine(householdId, id, data as any)} 
                />
              </div>
            ) : (
              <p className="text-body text-muted-foreground">{t['info.no_note'] || 'No details provided.'}</p>
            )}
          </div>
        </div>

        {/* Invisible spacer for consistent height */}
        <div className="shrink-0 p-5 pb-8">
          <div className="h-[52px]"></div>
        </div>
      </div>
    </div>
  , document.body);
};

export default HouseholdInfo;
