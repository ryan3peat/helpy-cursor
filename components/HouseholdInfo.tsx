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
  CheckCircle2,
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
} from "lucide-react";
import { BaseViewProps, User, UserRole } from "@/types";
import { useTranslatedContent } from "@/hooks/useTranslatedContent";
import { detectInputLanguage } from "@/services/languageDetectionService";

// Essential Info Types & Services
import type {
  EssentialInfo,
  CreateEssentialInfo,
  EssentialInfoCategory,
} from "@src/types/essentialInfo";
import { COUNTRY_CODES, CATEGORY_CONFIG } from "@src/types/essentialInfo";
import {
  createEssentialInfo,
  updateEssentialInfo,
  deleteEssentialInfo,
} from "@/services/essentialInfoService";

// Training Types & Services
import type {
  TrainingModule,
  CreateTrainingModule,
  TrainingCategory,
} from "@src/types/training";
import {
  TRAINING_CATEGORIES,
  TRAINING_CATEGORY_CONFIG,
} from "@src/types/training";
import {
  createTrainingModule,
  updateTrainingModule,
  deleteTrainingModule,
  completeTrainingModule,
} from "@/services/trainingService";

interface HouseholdInfoProps extends BaseViewProps {
  householdId: string;
  currentUser: User;
  users: User[];
  essentialItems: EssentialInfo[];
  trainingModules: TrainingModule[];
}

type ActiveSection = "essentialInfo" | "training";

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

// Map training categories to Lucide icons
const TRAINING_CATEGORY_ICONS: Record<TrainingCategory, React.ReactNode> = {
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
    bg: '#DBEAFE', 
    color: '#1D4ED8',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)'
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
// Family Profile Carousel Component
// ─────────────────────────────────────────────────────────────────
interface FamilyProfileCarouselProps {
  users: User[];
}

const FamilyProfileCarousel: React.FC<FamilyProfileCarouselProps> = ({ users }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const cardWidth = container.offsetWidth * 0.62;
      const newIndex = Math.round(container.scrollLeft / cardWidth);
      setActiveIndex(Math.min(Math.max(newIndex, 0), users.length - 1));
    }
  };

  const scrollToIndex = (index: number) => {
    if (scrollContainerRef.current) {
      const cardWidth = scrollContainerRef.current.offsetWidth * 0.62;
      scrollContainerRef.current.scrollTo({
        left: cardWidth * index,
        behavior: 'smooth'
      });
      setActiveIndex(index);
    }
  };

  if (users.length === 0) return null;

  return (
    <div className="mb-5">
      {/* Carousel Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-3"
      >
        {users.map((user, index) => {
          const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES[UserRole.HELPER];
          const isActive = index === activeIndex;
          
          return (
            <div
              key={user.id}
              className={`flex-shrink-0 w-[62%] snap-start rounded-2xl overflow-hidden transition-all duration-300 ${
                isActive ? 'shadow-md' : 'shadow-sm opacity-85'
              }`}
              style={{
                background: 'hsl(var(--card))',
              }}
            >
              <div className="p-4">
                {/* Profile Header */}
                <div className="flex items-start gap-3 mb-2">
                  {/* Avatar */}
                  <div 
                    className="relative w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 overflow-hidden"
                    style={{ 
                      background: roleStyle.gradient,
                      color: 'white',
                    }}
                  >
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.name} 
                        className="w-full h-full rounded-lg object-cover" 
                      />
                    ) : (
                      <span className="drop-shadow-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  
                  {/* Name & Role */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-title text-foreground truncate">
                      {user.name}
                    </h3>
                    <span 
                      className="text-caption px-2 py-0.5 rounded-full inline-flex items-center gap-1"
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
                <div className="space-y-2">
                  {/* Allergies & Medical */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={16} className="text-muted-foreground" />
                      <span className="text-body text-muted-foreground">
                        Allergies / Medical
                      </span>
                    </div>
                    {user.allergies && user.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 ml-6">
                        {user.allergies.slice(0, 4).map((allergy, i) => (
                          <span 
                            key={i}
                            className="text-caption px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: 'hsl(var(--destructive) / 0.1)',
                              color: 'hsl(var(--destructive))',
                            }}
                          >
                            {allergy}
                          </span>
                        ))}
                        {user.allergies.length > 4 && (
                          <span className="text-caption text-muted-foreground px-2 py-0.5">
                            +{user.allergies.length - 4} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-caption text-muted-foreground/60 italic ml-6">
                        None listed
                      </span>
                    )}
                  </div>

                  {/* Preferences */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Utensils size={16} className="text-muted-foreground" />
                      <span className="text-body text-muted-foreground">
                        Preferences
                      </span>
                    </div>
                    {user.preferences && user.preferences.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 ml-6">
                        {user.preferences.slice(0, 4).map((pref, i) => (
                          <span 
                            key={i}
                            className="text-caption px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: 'hsl(var(--secondary))',
                              color: 'hsl(var(--foreground))',
                            }}
                          >
                            {pref}
                          </span>
                        ))}
                        {user.preferences.length > 4 && (
                          <span className="text-caption text-muted-foreground px-2 py-0.5">
                            +{user.preferences.length - 4} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-caption text-muted-foreground/60 italic ml-6">
                        None listed
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
      {users.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-1">
          {users.map((_, index) => (
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

// Component for displaying translated TrainingModule name
const TranslatedTrainingName: React.FC<{
  module: TrainingModule;
  currentLang: string;
  onUpdate?: (id: string, data: Partial<TrainingModule>) => void;
}> = ({ module, currentLang, onUpdate }) => {
  const translatedName = useTranslatedContent({
    content: module.name,
    contentLang: module.nameLang,
    currentLang,
    translations: module.nameTranslations || {},
    onTranslationUpdate: async (translation) => {
      if (onUpdate) {
        const updatedTranslations = {
          ...(module.nameTranslations || {}),
          [currentLang]: translation,
        };
        await onUpdate(module.id, { nameTranslations: updatedTranslations });
      }
    },
  });

  return <>{translatedName}</>;
};

// Component for displaying translated TrainingModule content
const TranslatedTrainingContent: React.FC<{
  module: TrainingModule;
  currentLang: string;
  onUpdate?: (id: string, data: Partial<TrainingModule>) => void;
}> = ({ module, currentLang, onUpdate }) => {
  if (!module.content) return null;
  
  const translatedContent = useTranslatedContent({
    content: module.content,
    contentLang: module.contentLang,
    currentLang,
    translations: module.contentTranslations || {},
    onTranslationUpdate: async (translation) => {
      if (onUpdate) {
        const updatedTranslations = {
          ...(module.contentTranslations || {}),
          [currentLang]: translation,
        };
        await onUpdate(module.id, { contentTranslations: updatedTranslations });
      }
    },
  });

  return <>{translatedContent}</>;
};

const HouseholdInfo: React.FC<HouseholdInfoProps> = ({
  householdId,
  currentUser,
  users,
  essentialItems,
  trainingModules,
  t,
  currentLang,
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Section Toggle State
  // ─────────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<ActiveSection>("essentialInfo");
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
  // Training State (data comes from props, only UI state here)
  // ─────────────────────────────────────────────────────────────────
  const [selectedTrainingCategory, setSelectedTrainingCategory] = useState<TrainingCategory | "All">("All");
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [editingTrainingModule, setEditingTrainingModule] = useState<TrainingModule | null>(null);
  const [viewingTrainingModule, setViewingTrainingModule] = useState<TrainingModule | null>(null);
  
  // Lock body scroll when any modal is open
  useScrollLock(isEssentialModalOpen || isTrainingModalOpen || !!viewingTrainingModule);
  
  const [trainingForm, setTrainingForm] = useState<CreateTrainingModule>({
    category: "House Rules",
    customCategory: "",
    name: "",
    content: "",
    assigneeId: "",
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

  const trainingStats = {
    total: trainingModules.length,
    pending: trainingModules.filter((m) => !m.isCompleted).length,
    completed: trainingModules.filter((m) => m.isCompleted).length,
  };

  // Get helpers for assignee dropdown
  const helpers = users.filter((u) => u.role === UserRole.HELPER);

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
    try {
      if (editingEssentialItem) {
        await updateEssentialInfo(householdId, editingEssentialItem.id, essentialForm);
    } else {
        // Detect language for new essential info
        const nameLang = essentialForm.name ? detectInputLanguage(currentLang) : null;
        const noteLang = essentialForm.note ? detectInputLanguage(currentLang) : null;
        
        const createData: any = {
          ...essentialForm,
          nameLang: nameLang || null,
          nameTranslations: {},
          noteLang: noteLang || null,
          noteTranslations: {},
        };
        
        await createEssentialInfo(householdId, createData);
      }
      setIsEssentialModalOpen(false);
    } catch (error) {
      console.error("Failed to save:", error);
    }
  };

  const handleDeleteEssential = async () => {
    if (!editingEssentialItem) return;
    
    const itemToDelete = editingEssentialItem;
    
    // Close modal immediately for responsive UX
    setIsEssentialModalOpen(false);
    
    // Perform delete (subscription in App.tsx will update the data)
    try {
      await deleteEssentialInfo(householdId, itemToDelete.id);
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const openGoogleMaps = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, "_blank");
  };

  const makeCall = (countryCode: string, phone: string) => {
    const fullNumber = `${countryCode}${phone.replace(/\D/g, "")}`;
    window.location.href = `tel:${fullNumber}`;
  };

  // ─────────────────────────────────────────────────────────────────
  // Training Handlers
  // ─────────────────────────────────────────────────────────────────
  const filteredTrainingModules =
    selectedTrainingCategory === "All"
      ? trainingModules
      : trainingModules.filter((m) => m.category === selectedTrainingCategory);

  const handleAddTrainingClick = () => {
    setEditingTrainingModule(null);
    setTrainingForm({
      category: selectedTrainingCategory === "All" ? "House Rules" : selectedTrainingCategory,
      customCategory: "",
      name: "",
      content: "",
      assigneeId: helpers[0]?.id || "",
    });
    setIsTrainingModalOpen(true);
  };

  const handleEditTrainingClick = (module: TrainingModule) => {
    setEditingTrainingModule(module);
    setTrainingForm({
      category: module.category,
      customCategory: module.customCategory || "",
      name: module.name,
      content: module.content || "",
      assigneeId: module.assigneeId || "",
    });
    setIsTrainingModalOpen(true);
  };

  const handleViewTrainingClick = (module: TrainingModule) => {
    setViewingTrainingModule(module);
  };

  const handleSaveTraining = async () => {
    try {
      if (editingTrainingModule) {
        // Re-detect language if name or content changed
        const existingModule = trainingModules.find(m => m.id === editingTrainingModule.id);
        const nameChanged = existingModule && existingModule.name !== trainingForm.name;
        const contentChanged = existingModule && existingModule.content !== trainingForm.content;
        const nameLang = nameChanged ? detectInputLanguage(currentLang) : undefined;
        const contentLang = contentChanged ? detectInputLanguage(currentLang) : undefined;
        
        const updateData: any = { ...trainingForm };
        if (nameChanged && nameLang !== undefined) {
          updateData.nameLang = nameLang || null;
          updateData.nameTranslations = {};
        }
        if (contentChanged && contentLang !== undefined) {
          updateData.contentLang = contentLang || null;
          updateData.contentTranslations = {};
        }
        
        await updateTrainingModule(householdId, editingTrainingModule.id, updateData);
      } else {
        // Detect language for new training module
        const nameLang = trainingForm.name ? detectInputLanguage(currentLang) : null;
        const contentLang = trainingForm.content ? detectInputLanguage(currentLang) : null;
        
        const createData: any = {
          ...trainingForm,
          nameLang: nameLang || null,
          nameTranslations: {},
          contentLang: contentLang || null,
          contentTranslations: {},
        };
        
        await createTrainingModule(householdId, createData, currentUser.id);
      }
      setIsTrainingModalOpen(false);
    } catch (error) {
      console.error("Failed to save training:", error);
    }
  };

  const handleDeleteTraining = async () => {
    if (!editingTrainingModule) return;
    
    const moduleToDelete = editingTrainingModule;
    
    // Close modal immediately for responsive UX
    setIsTrainingModalOpen(false);
    
    // Perform delete (subscription in App.tsx will update the data)
    try {
      await deleteTrainingModule(householdId, moduleToDelete.id);
    } catch (error) {
      console.error("Failed to delete training:", error);
    }
  };

  const handleCompleteTraining = async (module: TrainingModule) => {
    try {
      await completeTrainingModule(householdId, module.id);
      setViewingTrainingModule(null);
    } catch (error) {
      console.error("Failed to complete training:", error);
    }
  };

  // Get assignee name
  const getAssigneeName = (assigneeId?: string) => {
    if (!assigneeId) return "Unassigned";
    const user = users.find((u) => u.id === assigneeId);
    return user?.name || "Unknown";
  };

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY HEADER - Option B: Shrink Title Only, Snap Padding */}
        {/* Padding snaps instantly (no transition), title scales smoothly */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header 
          className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-hidden"
          style={{ 
            paddingTop: isScrolled ? '12px' : '48px',
            paddingBottom: '12px'
          }}
        >
          {/* Title - shrinks to 50% on scroll (GPU-accelerated) */}
          <h1 
            className="text-display text-foreground transition-transform duration-300 origin-left will-change-transform"
            style={{ transform: isScrolled ? 'scale(0.5)' : 'scale(1)' }}
          >
            Family Info
          </h1>
        </header>

        {/* Section Toggle Cards - opacity fades, layout snaps */}
        <div 
          className="transition-opacity duration-200 overflow-hidden"
          style={{
            opacity: isScrolled ? 0 : 1,
            maxHeight: isScrolled ? '0px' : '120px',
            marginBottom: isScrolled ? '0px' : '24px',
            marginTop: isScrolled ? '0px' : '16px',
            pointerEvents: isScrolled ? 'none' : 'auto',
          }}
        >
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
                <FileText size={16} />
                <span className="text-title">Essential Info</span>
              </div>
              <div className={`text-caption mt-1 ml-6 ${activeSection === "essentialInfo" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {essentialStats.total} places saved
              </div>
            </button>

            {/* Training Card */}
            <button
              onClick={() => setActiveSection("training")}
              className={`px-3 py-2.5 rounded-xl text-left transition-all ${
                activeSection === "training"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-foreground shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2">
                <GraduationCap size={16} />
                <span className="text-title">Training</span>
              </div>
              <div className={`text-caption mt-1 ml-6 ${activeSection === "training" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {trainingStats.pending} pending, {trainingStats.completed} done
              </div>
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY TAB NAVIGATION - position snaps, shadow fades */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div 
          className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
          style={{ 
            top: isScrolled ? '52px' : '96px',
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
                  All
                </button>
                {ESSENTIAL_CATEGORIES.map((cat) => (
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
                    {cat}
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

          {/* Training Tabs */}
          {activeSection === "training" && (
            <div 
              className="relative rounded-full overflow-hidden"
              style={{ backgroundColor: 'hsl(var(--muted))' }}
            >
              {/* Scrollable button container */}
              <div className="flex p-1 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setSelectedTrainingCategory("All")}
                  className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all ${
                    selectedTrainingCategory === "All"
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                {TRAINING_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedTrainingCategory(cat)}
                    className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedTrainingCategory === cat
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {TRAINING_CATEGORY_ICONS[cat]}
                    {cat}
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
          <FamilyProfileCarousel users={users} />
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
                    <FileText size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-body text-foreground">No entries yet</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    Add important contacts and places for your household
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
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* TRAINING SECTION */}
        {/* ─────────────────────────────────────────────────────────────── */}
        {activeSection === "training" && (
          <>
            {/* Training Cards */}
            <div className="space-y-4">
              {filteredTrainingModules.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                    <GraduationCap size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-body text-foreground">No training modules yet</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    {isHelper
                      ? "No training assigned to you yet"
                      : "Add training modules for your helpers"}
                  </p>
                </div>
              ) : (
                filteredTrainingModules.map((module) => (
                  <TrainingCard
                    key={module.id}
                    module={module}
                    assigneeName={getAssigneeName(module.assigneeId)}
                    onEdit={() => handleEditTrainingClick(module)}
                    onView={() => handleViewTrainingClick(module)}
                    isHelper={isHelper}
                    currentLang={currentLang}
                    householdId={householdId}
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
          onClick={activeSection === "essentialInfo" ? handleAddEssentialClick : handleAddTrainingClick}
          className={`fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center z-30 ${
            (isEssentialModalOpen || isTrainingModalOpen || viewingTrainingModule) ? 'fab-hiding' : ''
          }`}
          aria-label={activeSection === "essentialInfo" ? "Add Essential Info" : "Add Training Module"}
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
        />
      )}

      {/* Training Modal (Create/Edit) */}
      {isTrainingModalOpen && (
        <TrainingModal
          isEditing={!!editingTrainingModule}
          form={trainingForm}
          setForm={setTrainingForm}
          helpers={helpers}
          onClose={() => setIsTrainingModalOpen(false)}
          onSave={handleSaveTraining}
          onDelete={handleDeleteTraining}
        />
      )}

      {/* Training View Modal (for helpers to view and complete) */}
      {viewingTrainingModule && (
        <TrainingViewModal
          module={viewingTrainingModule}
          assigneeName={getAssigneeName(viewingTrainingModule.assigneeId)}
          onClose={() => setViewingTrainingModule(null)}
          onComplete={() => handleCompleteTraining(viewingTrainingModule)}
          isHelper={isHelper}
          currentLang={currentLang}
          householdId={householdId}
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
}

const EssentialInfoCard: React.FC<EssentialInfoCardProps> = ({
  item,
  onEdit,
  onOpenMap,
  onCall,
  canEdit,
  currentLang,
  householdId,
}) => {
  const config = CATEGORY_CONFIG[item.category];

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
              {item.category}
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
// Training Card Component
// ─────────────────────────────────────────────────────────────────
interface TrainingCardProps {
  module: TrainingModule;
  assigneeName: string;
  onEdit: () => void;
  onView: () => void;
  isHelper: boolean;
  currentLang: string;
  householdId: string;
}

const TrainingCard: React.FC<TrainingCardProps> = ({
  module,
  assigneeName,
  onEdit,
  onView,
  isHelper,
  currentLang,
  householdId,
}) => {
  const config = TRAINING_CATEGORY_CONFIG[module.category];
  const displayCategory = module.category === "Others" && module.customCategory
    ? module.customCategory
    : module.category;

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-title text-foreground">
              <TranslatedTrainingName 
                module={module} 
                currentLang={currentLang} 
                onUpdate={(id, data) => updateTrainingModule(householdId, id, data as any)} 
              />
            </h3>
            {module.isCompleted && (
              <CheckCircle2 size={16} className="text-[#4CAF50]" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-caption px-2 py-0.5 rounded-full"
              style={{ backgroundColor: config.bgColor, color: config.color }}
            >
              {displayCategory}
            </span>
              </div>
            </div>
        {isHelper ? (
          <button
            onClick={onView}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-body hover:bg-primary/20 transition-colors"
          >
            {module.isCompleted ? "View" : "Start"}
          </button>
        ) : (
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {/* Assignee & Status */}
      <div className="flex items-center justify-between text-body">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Assigned to: {assigneeName}</span>
        </div>
        <div className="flex items-center gap-1">
          {module.isCompleted ? (
            <span className="text-[#4CAF50] flex items-center gap-1">
              <CheckCircle2 size={14} />
              Completed
            </span>
          ) : (
            <span className="text-[#FF9800] flex items-center gap-1">
              <Clock size={14} />
              Pending
            </span>
          )}
        </div>
      </div>
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
}

const EssentialInfoModal: React.FC<EssentialInfoModalProps> = ({
  isEditing,
  form,
  setForm,
  onClose,
  onSave,
  onDelete,
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
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
          {/* Drag Handle */}
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
          <h2 className="text-title text-foreground text-center">
            {isEditing ? "Edit Info" : "Add New Info"}
          </h2>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              {/* Category */}
              <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {ESSENTIAL_CATEGORIES.map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const isSelected = form.category === cat;
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
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., City General Hospital"
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-foreground outline-none transition-all text-body"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              Address
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Main St, City"
                className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary border border-border focus:border-foreground outline-none transition-all text-body"
              />
            </div>
              </div>

          {/* Phone */}
              <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              Phone Number
            </label>
            <div className="flex gap-2">
              <select
                value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                className="w-32 px-3 py-3 rounded-lg bg-secondary border border-border focus:border-foreground outline-none transition-all text-body"
              >
                {COUNTRY_CODES.map((cc, index) => (
                  <option key={`${cc.code}-${cc.country}-${index}`} value={cc.code}>
                    {cc.code} ({cc.country})
                  </option>
                ))}
              </select>
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
                  placeholder="812 345 6789"
                  className="w-full pl-11 pr-4 py-3 rounded-lg bg-secondary border border-border focus:border-foreground outline-none transition-all text-body"
                />
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              Note
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Any additional details..."
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-foreground outline-none transition-all text-body"
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
            {isEditing ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Training Modal (Create/Edit)
// ─────────────────────────────────────────────────────────────────
interface TrainingModalProps {
  isEditing: boolean;
  form: CreateTrainingModule;
  setForm: React.Dispatch<React.SetStateAction<CreateTrainingModule>>;
  helpers: User[];
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}

const TrainingModal: React.FC<TrainingModalProps> = ({
  isEditing,
  form,
  setForm,
  helpers,
  onClose,
  onSave,
  onDelete,
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
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="pt-6 pb-4 px-5 border-b border-border">
          {/* Drag Handle */}
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
          <h2 className="text-title text-foreground text-center">
            {isEditing ? "Edit Training" : "Add Training Module"}
          </h2>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Category */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as TrainingCategory })}
              className="w-full pl-4 pr-14 py-3 rounded-lg bg-secondary border border-border focus:border-foreground outline-none transition-all text-body"
            >
              {TRAINING_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Category (for Others) */}
          {form.category === "Others" && (
            <div>
              <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                Custom Category Name
              </label>
              <input
                type="text"
                value={form.customCategory}
                onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                placeholder="Enter custom category"
                className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-foreground outline-none transition-all text-body"
              />
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              Training Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Morning Routine Checklist"
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-foreground outline-none transition-all text-body"
                />
              </div>

              {/* Content */}
              <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              Training Content
            </label>
                <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Enter the training instructions, steps, or details..."
                  rows={6}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-foreground outline-none transition-all resize-none text-body"
            />
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
              Assign To
            </label>
            <select
              value={form.assigneeId}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              className="w-full pl-4 pr-14 py-3 rounded-lg bg-secondary border border-border focus:border-foreground outline-none transition-all text-body"
            >
              <option value="">Select a helper</option>
              {helpers.map((helper) => (
                <option key={helper.id} value={helper.id}>
                  {helper.name}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 pb-8 border-t border-border flex gap-3">
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
            {isEditing ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Training View Modal (for helpers)
// ─────────────────────────────────────────────────────────────────
interface TrainingViewModalProps {
  module: TrainingModule;
  assigneeName: string;
  onClose: () => void;
  onComplete: () => void;
  isHelper: boolean;
  currentLang: string;
  householdId: string;
}

const TrainingViewModal: React.FC<TrainingViewModalProps> = ({
  module,
  assigneeName,
  onClose,
  onComplete,
  isHelper,
  currentLang,
  householdId,
}) => {
  const config = TRAINING_CATEGORY_CONFIG[module.category];
  const displayCategory = module.category === "Others" && module.customCategory
    ? module.customCategory
    : module.category;

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
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
          {/* Drag Handle */}
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
          <span
            className="text-caption px-2 py-0.5 rounded-full inline-block mb-2"
            style={{ backgroundColor: config.bgColor, color: config.color }}
          >
            {displayCategory}
          </span>
          <h2 className="text-display text-foreground">
            <TranslatedTrainingName 
              module={module} 
              currentLang={currentLang} 
              onUpdate={(id, data) => updateTrainingModule(householdId, id, data as any)} 
            />
          </h2>
          <div className="flex items-center gap-3 mt-2 text-body text-muted-foreground">
            <span>Assigned to: {assigneeName}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="prose prose-slate prose-sm">
            {module.content ? (
              <div className="whitespace-pre-wrap text-body text-foreground">
                <TranslatedTrainingContent 
                  module={module} 
                  currentLang={currentLang} 
                  onUpdate={(id, data) => updateTrainingModule(householdId, id, data as any)} 
                />
              </div>
            ) : (
              <p className="text-body text-muted-foreground italic">No content provided.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pb-8 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors"
          >
            Close
          </button>
          {isHelper && !module.isCompleted && (
            <button
              onClick={onComplete}
              className="flex-1 py-3.5 rounded-xl bg-[#4CAF50] text-white text-body hover:bg-[#43A047] transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              Mark Complete
            </button>
          )}
          {module.isCompleted && (
            <div className="flex-1 py-3.5 rounded-xl bg-[#E8F5E9] text-[#4CAF50] text-body flex items-center justify-center gap-2">
              <CheckCircle2 size={18} />
              Completed
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HouseholdInfo;
