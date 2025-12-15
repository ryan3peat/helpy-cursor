// components/HouseholdInfo.tsx
import React, { useEffect, useState, useRef } from "react";
import { useScrollHeader } from "@/hooks/useScrollHeader";
import { useScrollLock } from "@/hooks/useScrollLock";
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
  MoreHorizontal,
  Clock,
  ChevronRight,
  ClipboardList,
  UtensilsCrossed,
  Baby,
  Sparkles,
  Shirt,
  ShieldAlert,
  Zap,
  Heart,
  AlertTriangle,
  Utensils,
  Info,
  Lamp,
  BookOpen,
} from "lucide-react";
import Avatar from "./ui/Avatar";
import { BaseViewProps, User, UserRole, TranslationDictionary } from "@/types";
import { useTranslatedContent } from "@/hooks/useTranslatedContent";
import { detectInputLanguage } from "@/services/languageDetectionService";

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
}

type ActiveSection = "essentialInfo" | "houseRoutine";

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
  Others: <MoreHorizontal size={18} />,
};

// Map house routine categories to Lucide icons
const HOUSE_ROUTINE_CATEGORY_ICONS: Record<HouseRoutineCategory, React.ReactNode> = {
  'House Rules': <ClipboardList size={18} />,
  'Routine': <Clock size={18} />,
  'Meal Preparations': <UtensilsCrossed size={18} />,
  'Child Care': <Baby size={18} />,
  'Cleaning': <Sparkles size={18} />,
  'Grocery & Market': <ShoppingCart size={18} />,
  'Laundry & Wardrobe': <Shirt size={18} />,
  'Safety & Emergency': <ShieldAlert size={18} />,
  'Energy & Bills': <Zap size={18} />,
  'Helper Self-Care': <Heart size={18} />,
  'Others': <MoreHorizontal size={18} />,
};

// ─────────────────────────────────────────────────────────────────
// ROLE STYLING CONFIG
// ─────────────────────────────────────────────────────────────────
const ROLE_STYLES: Record<UserRole, { bg: string; color: string; gradient: string }> = {
  [UserRole.MASTER]: { 
    bg: '#E6F7FB', 
    color: '#3EAFD2', // Helpy blue
    gradient: 'linear-gradient(135deg, #3EAFD2 0%, #2E99BB 100%)'
  },
  [UserRole.SPOUSE]: { 
    bg: '#FCE4EC', 
    color: '#F06292',
    gradient: 'linear-gradient(135deg, #F06292 0%, #C74B7A 100%)'
  },
  [UserRole.HELPER]: { 
    bg: '#D1FAE5', 
    color: '#047857',
    gradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)'
  },
  [UserRole.CHILD]: { 
    bg: '#FEF3C7', 
    color: '#D97706',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
  },
  [UserRole.OTHER]: { 
    bg: '#FCE4EC', 
    color: '#F06292',
    gradient: 'linear-gradient(135deg, #F48FB1 0%, #F06292 100%)'
  },
};

// ─────────────────────────────────────────────────────────────────
// Role priority for consistent sorting across all family members
// ─────────────────────────────────────────────────────────────────
const ROLE_PRIORITY: Record<string, number> = {
  'Admin': 1,
  'Spouse': 2,
  'Helper': 3,
  'Child': 4,
  'Other': 5,
};

// ─────────────────────────────────────────────────────────────────
// Family Profile Carousel Component
// ─────────────────────────────────────────────────────────────────
interface FamilyProfileCarouselProps {
  users: User[];
  t: TranslationDictionary;
}

const FamilyProfileCarousel: React.FC<FamilyProfileCarouselProps> = ({ users, t }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter to active users only, then sort by role priority
  const sortedUsers = React.useMemo(() => {
    return [...users]
      .filter(u => u.status === 'active')
      .sort((a, b) => {
        const priorityA = ROLE_PRIORITY[a.role] ?? 99;
        const priorityB = ROLE_PRIORITY[b.role] ?? 99;
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
              <div className="p-5 flex-1">
                {/* Profile Header */}
                <div className="flex items-start gap-3 mb-4">
                  {/* Avatar */}
                  <Avatar
                    user={user}
                    size="sm"
                  />
                  
                  {/* Name & Role */}
                  <div className="flex-1 min-w-0">
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
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Section Toggle State
  // ─────────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<ActiveSection>(initialSection || "essentialInfo");
  
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
  const isHelper = currentUser.role === UserRole.HELPER;

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
  
  // Lock body scroll when any modal is open
  useScrollLock(isEssentialModalOpen || isHouseRoutineModalOpen || !!viewingHouseRoutineItem);
  
  const [houseRoutineForm, setHouseRoutineForm] = useState<CreateHouseRoutine>({
    category: "House Rules",
    customCategory: "",
    name: "",
    note: "",
  });

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
      'House Rules': t['routine.category.house_rules'] || category,
      'Routine': t['routine.category.routine'] || category,
      'Meal Preparations': t['routine.category.meal_preparations'] || category,
      'Child Care': t['routine.category.child_care'] || category,
      'Cleaning': t['routine.category.cleaning'] || category,
      'Grocery & Market': t['routine.category.grocery_market'] || category,
      'Laundry & Wardrobe': t['routine.category.laundry_wardrobe'] || category,
      'Safety & Emergency': t['routine.category.safety_emergency'] || category,
      'Energy & Bills': t['routine.category.energy_bills'] || category,
      'Helper Self-Care': t['routine.category.helper_self_care'] || category,
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
    } catch (error) {
      console.error("Failed to save:", error);
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
    } catch (error) {
      console.error("Failed to delete:", error);
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
      
      // After 1 second, if app didn't open, ASK user (prevents double-open race condition)
      setTimeout(() => {
        document.removeEventListener('visibilitychange', handleVisibility);
        if (!appOpened && document.visibilityState === 'visible') {
          // Google Maps didn't open - ask user instead of auto-opening
          const openAppleMaps = window.confirm(
            t['maps.google_not_installed'] || 'Google Maps is not installed.\n\nOpen in Apple Maps instead?'
          );
          if (openAppleMaps) {
            // Apple Maps URI scheme - returns where you left off
            window.location.href = `maps://maps.apple.com/?q=${encoded}`;
          }
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
      category: selectedHouseRoutineCategory === "All" ? "House Rules" : selectedHouseRoutineCategory,
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
    } catch (error) {
      console.error("Failed to save house routine:", error);
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
    } catch (error) {
      console.error("Failed to delete house routine:", error);
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
          style={{ height: '120px' }}
        >
          <h1 className="w-full">
            <span className="text-foreground font-bold" style={{ fontSize: '20px' }}>{t['info.title'] || 'Family Info'}</span><br />
            <span className="text-display text-foreground">{activeSection === 'essentialInfo' ? (t['common.essential_info'] || 'Essential') : (t['common.house_routine'] || 'House Routine')}</span>
          </h1>
        </header>

        {/* Section Toggle Cards */}
        <div className="mt-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            {/* Essential Info Card */}
            <button
              onClick={() => setActiveSection("essentialInfo")}
              className={`px-3 py-2.5 rounded-xl text-left transition-all ${
                activeSection === "essentialInfo"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-foreground shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2">
                <BookOpen size={16} className={activeSection === "essentialInfo" ? "" : undefined} />
                <span className="text-title">{t['common.essential_info'] || 'Essential'}</span>
              </div>
              <div className={`text-caption mt-1 ml-6 ${activeSection === "essentialInfo" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {essentialStats.total} {t['common.items'] || 'items'}
              </div>
            </button>

            {/* House Routine Card */}
            <button
              onClick={() => setActiveSection("houseRoutine")}
              className={`px-3 py-2.5 rounded-xl text-left transition-all ${
                activeSection === "houseRoutine"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-foreground shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2">
                <Lamp size={16} className={activeSection === "houseRoutine" ? "" : undefined} />
                <span className="text-title">{t['common.house_routine'] || 'House Routine'}</span>
              </div>
              <div className={`text-caption mt-1 ml-6 ${activeSection === "houseRoutine" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {houseRoutineStats.total} {t['common.items'] || 'items'}
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
            top: '116px',
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
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t['common.all'] || 'All'}
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
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {ESSENTIAL_CATEGORY_ICONS[cat]}
                      {getCategoryLabel(cat)}
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
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t['common.all'] || 'All'}
                </button>
                {HOUSE_ROUTINE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedHouseRoutineCategory(cat)}
                      className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        selectedHouseRoutineCategory === cat
                          ? "bg-card text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {HOUSE_ROUTINE_CATEGORY_ICONS[cat]}
                      {getRoutineCategoryLabel(cat)}
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
        {/* FAMILY PROFILE CAROUSEL - Only visible in Essential Info section */}
        {/* ─────────────────────────────────────────────────────────────── */}
        {activeSection === "essentialInfo" && (
          <FamilyProfileCarousel users={users} t={t} />
        )}

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
                    <BookOpen size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-body text-foreground">{t['info.no_entries_yet'] || 'No entries yet'}</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    {t['info.add_contacts_hint'] || 'Add important contacts and places for your household'}
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
                    <Lamp size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-body text-foreground">{t['info.no_routines'] || 'No routines yet'}</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    {t['info.add_routines_hint'] || 'Add house routines and instructions for your household'}
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
          className={`fixed bottom-28 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center z-30 ${
            (isEssentialModalOpen || isHouseRoutineModalOpen || viewingHouseRoutineItem) ? 'fab-hiding' : ''
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
    <div className="bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
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
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {/* Address */}
      {item.address && (
        <button
          onClick={onOpenMap}
          className="w-full text-left flex items-start gap-2 py-1.5 hover:text-primary transition-colors group"
        >
          <MapPin size={16} className="text-muted-foreground group-hover:text-primary mt-0.5 flex-shrink-0" />
          <span className="text-body text-foreground group-hover:text-primary">{item.address}</span>
        </button>
      )}

      {/* Phone */}
      {item.phone && (
        <button
          onClick={onCall}
          className="w-full text-left flex items-center gap-2 py-1.5 hover:text-primary transition-colors group"
        >
          <Phone size={16} className="text-muted-foreground group-hover:text-primary flex-shrink-0" />
          <span className="text-body text-foreground group-hover:text-primary">
            {item.countryCode} {item.phone}
          </span>
        </button>
      )}

      {/* Note */}
      {item.note && (
        <div className="flex items-start gap-2 py-1.5">
          <FileText size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
          <span className="text-body text-muted-foreground">
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
      'House Rules': t['routine.category.house_rules'] || category,
      'Routine': t['routine.category.routine'] || category,
      'Meal Preparations': t['routine.category.meal_preparations'] || category,
      'Child Care': t['routine.category.child_care'] || category,
      'Cleaning': t['routine.category.cleaning'] || category,
      'Grocery & Market': t['routine.category.grocery_market'] || category,
      'Laundry & Wardrobe': t['routine.category.laundry_wardrobe'] || category,
      'Safety & Emergency': t['routine.category.safety_emergency'] || category,
      'Energy & Bills': t['routine.category.energy_bills'] || category,
      'Helper Self-Care': t['routine.category.helper_self_care'] || category,
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
    <div className="bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
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
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {/* Note Preview */}
      {item.note && (
        <div 
          className="mt-3 pt-3 border-t border-border cursor-pointer"
          onClick={handleTap}
        >
          <p className="text-body text-muted-foreground line-clamp-3">
            <TranslatedHouseRoutineNote 
              item={item} 
              currentLang={currentLang} 
              onUpdate={(id, data) => updateHouseRoutine(householdId, id, data as any)} 
            />
          </p>
          {item.note.length > 150 && (
            <span className="text-caption text-primary mt-1 inline-block">
              {t['info.tap_see_more'] || 'tap to see more'}
            </span>
          )}
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

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
      {/* Safe area bottom cover - fills the gap below the sheet */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-card"
        style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
      />
      <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors right-4 top-4 text-muted-foreground"
          aria-label={t['common.close'] || 'Close'}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
          <h2 className="text-title text-foreground">
            {isEditing ? (t['info.edit_info'] || "Edit Info") : (t['info.add_new_info'] || "Add New Info")}
          </h2>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              {/* Category */}
              <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['common.category'] || 'Category'}
            </label>
            <div className="flex flex-wrap gap-2">
              {ESSENTIAL_CATEGORIES.map((cat) => {
                const config = CATEGORY_CONFIG[cat];
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
                    className={`px-3 py-2 rounded-lg text-body transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? "text-white shadow-sm"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    }`}
                    style={isSelected ? { backgroundColor: config.color } : undefined}
                  >
                    {ESSENTIAL_CATEGORY_ICONS[cat]}
                    {getCatLabel(cat)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['common.name'] || 'Name'}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t['info.name_placeholder'] || 'e.g., City General Hospital'}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
            />
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
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder={t['info.address_placeholder'] || '123 Main St, City'}
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
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
                  readOnly
                  value={form.countryCode}
                  onClick={() => setShowCountryCodeDropdown(true)}
                  placeholder="+852"
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none cursor-pointer transition-all text-body"
                />
                <Phone size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
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
                            className="w-full text-left px-4 py-2 hover:bg-secondary transition-colors flex items-center justify-between"
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
                        value={countryCodeSearch}
                        onChange={(e) => setCountryCodeSearch(e.target.value)}
                        placeholder={t['placeholder.search_country'] || 'Search country...'}
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-body focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="relative flex-1">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => {
                    // Only allow digits, spaces, dashes, and parentheses for phone formatting
                    const value = e.target.value.replace(/[^\d\s\-()]/g, '');
                    setForm({ ...form, phone: value });
                  }}
                  placeholder={t['placeholder.mobile_number'] || 'Mobile number'}
                  className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                />
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['info.note'] || 'Note'}
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t['info.note_placeholder'] || 'Any additional details...'}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
          {isEditing && (
            <button
              onClick={onDelete}
              className="p-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button
            onClick={onSave}
            className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body hover:bg-primary/90 transition-colors shadow-sm"
          >
            {isEditing ? t['common.update'] : t['common.save']}
          </button>
        </div>
      </div>
    </div>
  );
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
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
      {/* Safe area bottom cover - fills the gap below the sheet */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-card"
        style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
      />
      <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors right-4 top-4 text-muted-foreground"
          aria-label={t['common.close'] || 'Close'}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
          <h2 className="text-title text-foreground">
            {isEditing ? (t['info.edit_routine'] || 'Edit Routine') : (t['info.add_routine'] || 'Add Routine')}
          </h2>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Category */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['common.category'] || 'Category'}
            </label>
            <div className="flex flex-wrap gap-2">
              {HOUSE_ROUTINE_CATEGORIES.map((cat) => {
                const config = HOUSE_ROUTINE_CATEGORY_CONFIG[cat];
                const isSelected = form.category === cat;
                const getCatLabel = (category: HouseRoutineCategory): string => {
                  const categoryMap: Record<HouseRoutineCategory, string> = {
                    'House Rules': t['routine.category.house_rules'] || category,
                    'Routine': t['routine.category.routine'] || category,
                    'Meal Preparations': t['routine.category.meal_preparations'] || category,
                    'Child Care': t['routine.category.child_care'] || category,
                    'Cleaning': t['routine.category.cleaning'] || category,
                    'Grocery & Market': t['routine.category.grocery_market'] || category,
                    'Laundry & Wardrobe': t['routine.category.laundry_wardrobe'] || category,
                    'Safety & Emergency': t['routine.category.safety_emergency'] || category,
                    'Energy & Bills': t['routine.category.energy_bills'] || category,
                    'Helper Self-Care': t['routine.category.helper_self_care'] || category,
                    'Others': t['routine.category.others'] || category,
                  };
                  return categoryMap[category] || category;
                };
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat })}
                    className={`px-3 py-2 rounded-lg text-body transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? "text-white shadow-sm"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    }`}
                    style={isSelected ? { backgroundColor: config.color } : undefined}
                  >
                    {HOUSE_ROUTINE_CATEGORY_ICONS[cat]}
                    {getCatLabel(cat)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Category (for Others) */}
          {form.category === "Others" && (
            <div>
              <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                {t['info.custom_category'] || 'Custom Category Name'}
              </label>
              <input
                type="text"
                value={form.customCategory}
                onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                placeholder={t['info.custom_category_placeholder'] || 'Enter custom category'}
                className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
              />
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['common.name'] || 'Name'}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t['info.routine_name_placeholder'] || 'e.g., How to make the bed'}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              {t['common.note'] || 'Note'}
            </label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t['info.routine_note_placeholder'] || 'Enter the instructions, steps, or details...'}
              rows={6}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all resize-none text-body"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
          {isEditing && (
            <button
              onClick={onDelete}
              className="p-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button
            onClick={onSave}
            className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body hover:bg-primary/90 transition-colors shadow-sm"
          >
            {isEditing ? t['common.update'] : t['common.save']}
          </button>
        </div>
      </div>
    </div>
  );
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
      'House Rules': t['routine.category.house_rules'] || category,
      'Routine': t['routine.category.routine'] || category,
      'Meal Preparations': t['routine.category.meal_preparations'] || category,
      'Child Care': t['routine.category.child_care'] || category,
      'Cleaning': t['routine.category.cleaning'] || category,
      'Grocery & Market': t['routine.category.grocery_market'] || category,
      'Laundry & Wardrobe': t['routine.category.laundry_wardrobe'] || category,
      'Safety & Emergency': t['routine.category.safety_emergency'] || category,
      'Energy & Bills': t['routine.category.energy_bills'] || category,
      'Helper Self-Care': t['routine.category.helper_self_care'] || category,
      'Others': t['routine.category.others'] || category,
    };
    return categoryMap[category] || category;
  };

  const displayCategory = item.category === "Others" && item.customCategory
    ? item.customCategory
    : getRoutineCategoryLabel(item.category);

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
      {/* Safe area bottom cover - fills the gap below the sheet */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-card"
        style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
      />
      <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors right-4 top-4 text-muted-foreground"
          aria-label={t['common.close'] || 'Close'}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
          <span
            className="text-caption px-2 py-0.5 rounded-full inline-block mb-2"
            style={{ backgroundColor: config.bgColor, color: config.color }}
          >
            {displayCategory}
          </span>
          <h2 className="text-display text-foreground">
            <TranslatedHouseRoutineName 
              item={item} 
              currentLang={currentLang} 
              onUpdate={(id, data) => updateHouseRoutine(householdId, id, data as any)} 
            />
          </h2>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto">
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

        {/* Footer */}
        <div className="p-5 pb-8 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors"
          >
            {t['common.close'] || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HouseholdInfo;
