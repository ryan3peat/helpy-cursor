import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Youtube,
  Download,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

interface MealsProps extends BaseViewProps {
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
      // Update translations in database
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
  // ─────────────────────────────────────────────────────────────────
  // Role-based permissions
  // ─────────────────────────────────────────────────────────────────
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  const { isViewingAsHelper } = useDemoMode();
  // isHelper: true if actual Helper OR SuperAdmin viewing as Helper
  const isHelper = currentUser.role === UserRole.HELPER || (isSuperAdmin && isViewingAsHelper);

  const [view, setView] = useState<'day' | 'week'>('day');
  const [loadingAi, setLoadingAi] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentReady, setContentReady] = useState(false);
  
  
  // Scroll header hook for animation - lower threshold so shadow appears when card date gets covered
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

  // Quick Join Popover State (tracks which date's popover is open)
  const [quickJoinPopoverDate, setQuickJoinPopoverDate] = useState<string | null>(null);
  const quickJoinPopoverRef = useRef<HTMLDivElement | null>(null);

  // Ref: Day view container for auto-scroll to current day
  const dayViewRef = useRef<HTMLDivElement | null>(null);
  
  // Ref: Week view horizontal scroll container for auto-scroll to today column
  const weekScrollRef = useRef<HTMLDivElement | null>(null);

  // ─────────────────────────────────────────────────────────────────
  // AUTO-SCROLL TO TODAY - Only on initial mount
  // ─────────────────────────────────────────────────────────────────
  const hasInitiallyScrolled = useRef(false);
  const hasScrolledWeekView = useRef(false);
  const hasInitialized = useRef(false); // Tracks if first scroll completed (prevents flicker on view switch)

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
  // Colors based on brand palette: #3EAFD2, #FF9800, #7E57C2, #4CAF50, #F06292, #757575
  // When isSelected is true, icon inherits parent color (e.g., text-primary-foreground)
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
        return <UserIcon size={10} className="text-muted-foreground" />;
      case 'KIDS':
        return <Baby size={10} className="text-muted-foreground" />;
      case 'ALL':
      default:
        return (
          <span className="flex items-center gap-0.5">
            <UserIcon size={10} className="text-muted-foreground" />
            <Baby size={10} className="text-muted-foreground" />
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
    // Only include active users
    const activeUsers = users.filter(u => u.status === 'active');
    let filtered: User[];
    switch (audience) {
      case 'ALL': filtered = activeUsers; break;
      case 'ADULTS': filtered = activeUsers.filter(u => u.role !== UserRole.CHILD); break;
      case 'KIDS': filtered = activeUsers.filter(u => u.role === UserRole.CHILD); break;
    }
    
    // Sort users: SuperAdmin → Admin → Spouse → Child → Others → Helpers
    const getRolePriority = (user: User): number => {
      switch (user.role) {
        case UserRole.SUPERADMIN:
          return 0;
        case UserRole.MASTER:
          return 1;
        case UserRole.SPOUSE:
          return 2;
        case UserRole.CHILD:
          return 3;
        case UserRole.OTHER:
          return 4;
        case UserRole.HELPER:
          return 5;
        default:
          return 6;
      }
    };
    
    return [...filtered].sort((a, b) => {
      const priorityDiff = getRolePriority(a) - getRolePriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return a.name.localeCompare(b.name);
    });
  };

  // --- Quick RSVP ---
  const handleQuickRsvp = (meal: Meal, e: React.MouseEvent) => {
    e.stopPropagation();
    const isIn = isUserInMeal(meal);
    
    // Haptic feedback - success when joining, light when leaving
    if (isIn) {
      haptics.light();
    } else {
      haptics.success();
    }
    
    const newUserIds = isIn
      ? meal.forUserIds.filter(id => id !== currentUser.id)
      : [...meal.forUserIds, currentUser.id];
    
    try {
      // If leaving and meal becomes empty (no description AND no participants), delete it
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

  // Quick RSVP for empty slot - create availability entry
  const handleQuickRsvpEmpty = (date: Date, type: MealType) => {
    const dateStr = formatDateStr(date);
    const newMeal: Meal = {
      id: Date.now().toString(),
      date: dateStr,
      type,
      description: '',
      forUserIds: [currentUser.id],
      audience: currentUser.role === UserRole.CHILD ? 'KIDS' : 'ALL',
      createdBy: currentUser.id, // Track who created this meal for notifications
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
          <Avatar
            key={u.id}
            user={u}
            size="xs"
            isCurrentUser={u.id === currentUser.id}
            className="border-2 border-white"
          />
        ))}
        {remaining > 0 && (
          <span className="text-micro text-muted-foreground bg-muted rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
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
    // Auto-select all active users (including helpers)
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

  // When audience changes, auto-select appropriate users
  const handleAudienceChange = (newAudience: MealAudience) => {
    setModalAudience(newAudience);
    const eligibleUsers = getUsersForAudience(newAudience);
    // Auto-select all eligible users (including helpers)
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
            descriptionTranslations: {} // Reset translations when description changes
          } : {}),
        });
      } else {
        // Create new meal - detect language
        const detectedLang = detectInputLanguage(currentLang);
        const newMeal: Meal = {
          id: Date.now().toString(),
          date: dateStr,
          type: modalType,
          description,
          forUserIds: selectedUserIds,
          audience: modalAudience,
          createdBy: currentUser.id, // Track who created this meal for notifications
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

  // ─────────────────────────────────────────────────────────────────
  // PDF EXPORT
  // ─────────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setExportingPdf(true);
    haptics.medium();
    
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Format date range with year for PDF (always English for PDF compatibility)
      const pdfDateRange = `${weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      
      // Load and resize logo to prevent huge file size
      // Original is 4096x1889px, we resize to ~200px wide
      let logoDataUrl: string | null = null;
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/helpy-logo-blue.png';
        
        await new Promise<void>((resolve) => {
          logoImg.onload = () => {
            // Resize using canvas
            const canvas = document.createElement('canvas');
            const targetWidth = 200; // Small width for PDF
            const aspectRatio = logoImg.height / logoImg.width;
            const targetHeight = Math.round(targetWidth * aspectRatio);
            
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // White background for JPEG (no transparency)
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, targetWidth, targetHeight);
              ctx.drawImage(logoImg, 0, 0, targetWidth, targetHeight);
              // Convert to JPEG with 80% quality - much smaller than PNG
              logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            }
            resolve();
          };
          logoImg.onerror = () => resolve();
          setTimeout(() => resolve(), 2000); // Timeout fallback
        });
      } catch {
        // Logo loading failed, will use text fallback
      }
      
      // Add header content function
      const addHeader = () => {
        // Logo image (resized and compressed)
        if (logoDataUrl) {
          // Logo dimensions in PDF: ~24mm wide, maintain aspect ratio
          const logoWidth = 24;
          const logoHeight = logoWidth * (1889 / 4096); // Original aspect ratio ~0.46
          doc.addImage(logoDataUrl, 'JPEG', 14, 10, logoWidth, logoHeight);
        } else {
          // Text fallback if logo failed to load
          doc.setFontSize(20);
          doc.setTextColor('#3EAFD2');
          doc.setFont('helvetica', 'bold');
          doc.text('helpy', 14, 16);
        }
        
        // URL at top right
        doc.setFontSize(10);
        doc.setTextColor('#3EAFD2');
        doc.setFont('helvetica', 'normal');
        doc.text('www.helpyfam.com', pageWidth - 14, 16, { align: 'right' });
        
        // "Meal Planning: date range" underneath logo - bold and larger
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#1a1a1a');
        doc.text(`Meal Planning: ${pdfDateRange}`, 14, 26);
        
        // Reset font to normal for table
        doc.setFont('helvetica', 'normal');
      };
      
      // Build table data with participant counts (always English for PDF compatibility)
      const tableData = weekDays.map(day => {
        const dateStr = formatDateStr(day);
        const dateLabel = `${day.toLocaleDateString('en-GB', { weekday: 'short' })}, ${day.getDate()} ${day.toLocaleDateString('en-GB', { month: 'short' })}`;
        
        return [
          dateLabel,
          ...mealTypes.map(type => {
            const slotMeals = getMealsForSlot(day, type);
            if (slotMeals.length === 0) return '-';
            
            // Build structured data for each meal
            // Format: BOLD:mealname::COUNT:counttext separated by ::MEAL:: for multiple meals
            return slotMeals.map(meal => {
              const mealUsers = meal.forUserIds
                .map(uid => users.find(u => u.id === uid))
                .filter((u): u is User => !!u);
              const adultCount = mealUsers.filter(u => u.role !== UserRole.CHILD).length;
              const kidCount = mealUsers.filter(u => u.role === UserRole.CHILD).length;
              
              const mealName = meal.description || 'RSVP only';
              
              // Add participant counts (format: 1x Adult, 2x Kids)
              const counts: string[] = [];
              if (adultCount > 0) counts.push(`${adultCount}x Adult${adultCount > 1 ? 's' : ''}`);
              if (kidCount > 0) counts.push(`${kidCount}x Kid${kidCount > 1 ? 's' : ''}`);
              const countText = counts.length > 0 ? counts.join(', ') : '';
              
              // Structure: BOLD:name::COUNT:count
              return `BOLD:${mealName}${countText ? `::COUNT:${countText}` : ''}`;
            }).join('::MEAL::');
          })
        ];
      });
      
      // Meal type colors for headers
      const mealColors: Record<MealType, string> = {
        [MealType.BREAKFAST]: '#FF9800',
        [MealType.LUNCH]: '#4CAF50',
        [MealType.DINNER]: '#7E57C2',
        [MealType.SNACKS]: '#F06292',
      };
      
      // Add initial header
      addHeader();
      
      // Generate table with running headers (always English for PDF compatibility)
      autoTable(doc, {
        startY: 34,
        head: [[
          'Date',
          'Breakfast',
          'Lunch',
          'Dinner',
          'Snacks'
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: '#3EAFD2',
          textColor: '#ffffff',
          fontStyle: 'bold',
          halign: 'center',
          valign: 'top',
          fontSize: 10,
        },
        // Calculate equal column widths: A4 width is 210mm, margins ~14mm each side = 182mm usable
        // Date column: 32mm, remaining 150mm / 4 meal columns = ~37.5mm each
        columnStyles: {
          0: { cellWidth: 32, fontStyle: 'bold', halign: 'left', valign: 'top' },
          1: { cellWidth: 37.5, halign: 'left', valign: 'top' },
          2: { cellWidth: 37.5, halign: 'left', valign: 'top' },
          3: { cellWidth: 37.5, halign: 'left', valign: 'top' },
          4: { cellWidth: 37.5, halign: 'left', valign: 'top' },
        },
        styles: {
          fontSize: 9,
          cellPadding: { top: 4, right: 4, bottom: 4, left: 4 }, // Equal padding all sides
          valign: 'top',
          overflow: 'linebreak',
          minCellHeight: 0, // No minimum - let content determine height
        },
        alternateRowStyles: {
          fillColor: '#f8f9fa',
        },
        // Running header on each page
        showHead: 'everyPage',
        // Don't break rows across pages (keeps same-date meals together)
        rowPageBreak: 'avoid',
        // Custom cell rendering for meal columns (bold name, normal count)
        didParseCell: (data) => {
          // Convert structured format to plain text for proper height calculation
          if (data.section === 'body' && data.column.index >= 1) {
            const cellText = String(data.cell.raw || '');
            if (cellText.startsWith('BOLD:')) {
              // Convert to plain text for height calculation
              const meals = cellText.split('::MEAL::');
              const plainText = meals.map(mealData => {
                let mealName = '';
                let countText = '';
                if (mealData.includes('::COUNT:')) {
                  const parts = mealData.split('::COUNT:');
                  mealName = parts[0].replace('BOLD:', '');
                  countText = parts[1] || '';
                } else {
                  mealName = mealData.replace('BOLD:', '');
                }
                // Add extra line for count spacing
                return countText ? `${mealName}\n${countText}` : mealName;
              }).join('\n\n\n'); // Extra newline for spacing between meals
              
              // Set as array of lines for autoTable to calculate height
              data.cell.text = plainText.split('\n');
            }
          }
        },
        willDrawCell: (data) => {
          // For meal columns with our markers, we'll do custom drawing
          if (data.section === 'body' && data.column.index >= 1) {
            const cellText = String(data.cell.raw || '');
            if (cellText.startsWith('BOLD:')) {
              // Prevent default text drawing - we'll draw custom
              data.cell.text = [];
            }
          }
        },
        didDrawCell: (data) => {
          // For meal columns, draw meal name bold and count normal
          if (data.section === 'body' && data.column.index >= 1) {
            const cellText = String(data.cell.raw || '');
            if (cellText.startsWith('BOLD:')) {
              const cellPadding = 4; // Match table styles padding
              const fontSize = 9;
              const lineHeight = fontSize * 0.45; // line height in mm
              const maxWidth = data.cell.width - cellPadding * 2;
              let currentY = data.cell.y + cellPadding + fontSize * 0.35;
              
              // Split by ::MEAL:: to get individual meals
              const meals = cellText.split('::MEAL::');
              
              meals.forEach((mealData, mealIndex) => {
                // Add spacing between meals
                if (mealIndex > 0) {
                  currentY += lineHeight * 1.5; // Extra space between meals
                }
                
                // Parse meal data: BOLD:name::COUNT:count
                let mealName = '';
                let countText = '';
                
                if (mealData.includes('::COUNT:')) {
                  const parts = mealData.split('::COUNT:');
                  mealName = parts[0].replace('BOLD:', '');
                  countText = parts[1] || '';
                } else {
                  mealName = mealData.replace('BOLD:', '');
                }
                
                // Draw meal name in bold
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(fontSize);
                doc.setTextColor('#1a1a1a');
                const mealNameLines = doc.splitTextToSize(mealName, maxWidth);
                doc.text(mealNameLines, data.cell.x + cellPadding, currentY);
                currentY += mealNameLines.length * lineHeight;
                
                // Draw count text in normal weight, grey
                if (countText) {
                  currentY += lineHeight * 0.3; // Small gap before count
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(fontSize);
                  doc.setTextColor('#666666');
                  doc.text(countText, data.cell.x + cellPadding, currentY);
                  currentY += lineHeight;
                }
              });
              
              // Reset
              doc.setTextColor('#1a1a1a');
              doc.setFont('helvetica', 'normal');
            }
          }
        },
        // Add header and footer on each page
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          const currentPage = data.pageNumber;
          
          // Add header on subsequent pages
          if (currentPage > 1) {
            addHeader();
          }
          
          // Add footer with page numbers
          const footerY = doc.internal.pageSize.getHeight() - 10;
          doc.setFontSize(9);
          doc.setTextColor('#999999');
          doc.text(
            `Helpy Meal Planning | page ${currentPage} of ${pageCount}`,
            pageWidth / 2,
            footerY,
            { align: 'center' }
          );
        },
      });
      
      // Fix page count in footers (autoTable doesn't know total pages during generation)
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const footerY = doc.internal.pageSize.getHeight() - 10;
        
        // White rectangle to cover old footer
        doc.setFillColor(255, 255, 255);
        doc.rect(0, footerY - 5, pageWidth, 15, 'F');
        
        // Redraw footer with correct total
        doc.setFontSize(9);
        doc.setTextColor('#999999');
        doc.text(
          `Helpy Meal Planning | page ${i} of ${totalPages}`,
          pageWidth / 2,
          footerY,
          { align: 'center' }
        );
      }
      
      // Generate filename: "Helpy Meal Planning 12 Jan - 18 Jan 2026" (always English)
      const filenameDateRange = `${weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      const safeFilename = `Helpy Meal Planning ${filenameDateRange}.pdf`;
      
      // Save/Share using Web Share API
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], safeFilename, { type: 'application/pdf' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        // Native share (iOS/Android)
        haptics.success();
        await navigator.share({
          files: [file],
          title: `Helpy Meal Planning ${filenameDateRange}`,
          text: `Hi,\n\nI am sharing our Meal Plan PDF in the attachment.\n\nThis meal plan was generated from the Helpy App.\n\nThank you.`,
        });
      } else {
        // Fallback: download directly
        haptics.success();
        doc.save(safeFilename);
      }
    } catch (err) {
      // Don't show error if user just cancelled the share dialog
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled - not an error
        return;
      }
      console.error('Failed to export PDF:', err);
      haptics.error();
      setError(t['error.export_pdf'] || 'Failed to export PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const toggleUser = (uid: string) => {
    setSelectedUserIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  // Week cell click -> go to Day view
  const handleWeekCellClick = (date: Date) => {
    setCurrentViewDate(new Date(date));
    setView('day');
  };

  // ─────────────────────────────────────────────────────────────────
  // AUTO-SCROLL TO TODAY - On initial mount AND when switching to day view
  // Content is hidden until scroll completes to prevent flicker
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Skip if not in day view
    if (view !== 'day') return;
    
    // Skip if already scrolled in this day view session
    if (hasInitiallyScrolled.current) return;
    hasInitiallyScrolled.current = true;

    const headerOffset = 230;
    const targetDateStr = formatDateStr(new Date());
    
    // Use multiple attempts for reliability
    const scrollAttempts = [0, 50, 150];
    scrollAttempts.forEach((delay, index) => {
      setTimeout(() => {
        const targetEl = document.getElementById(`day-${targetDateStr}`);
        if (!targetEl) {
          // If element not found on last attempt, still show content
          if (index === scrollAttempts.length - 1) {
            setContentReady(true);
            hasInitialized.current = true;
          }
          return;
        }
        
        const rect = targetEl.getBoundingClientRect();
        const elementPosition = rect.top + window.scrollY;
        window.scrollTo({ top: elementPosition - headerOffset, behavior: 'auto' });
        
        // Show content after final scroll attempt
        if (index === scrollAttempts.length - 1) {
          setContentReady(true);
          hasInitialized.current = true;
          }
        }, delay);
    });
  }, [view]);

  // Reset day scroll flag when leaving day view
  // Only hide content on initial load, not when switching views
  useEffect(() => {
    if (view !== 'day') {
      hasInitiallyScrolled.current = false;
      if (!hasInitialized.current) {
        setContentReady(false);
      }
    }
  }, [view]);

  // ─────────────────────────────────────────────────────────────────
  // AUTO-SCROLL TO TODAY ROW IN WEEK VIEW
  // Content is hidden until scroll completes to prevent flicker
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'week') {
      hasScrolledWeekView.current = false;
      return;
    }
    
    // Only scroll once per week view entry
    if (hasScrolledWeekView.current) return;
    hasScrolledWeekView.current = true;
    
    // Find today's index in the week (0-6)
    const today = new Date();
    const todayIndex = weekDays.findIndex(d => d.toDateString() === today.toDateString());
    
    // Only scroll vertically if today is in the current week
    if (todayIndex === -1) {
      // Still scroll to top to show table header
      window.scrollTo({ top: 0, behavior: 'auto' });
      setContentReady(true);
      hasInitialized.current = true;
      return;
    }
    
    // Use multiple attempts for reliability (DOM needs time to render)
    const scrollAttempts = [0, 50, 150, 300];
    scrollAttempts.forEach((delay, index) => {
      setTimeout(() => {
        // Find the table row for today's date
        const dateStr = formatDateStr(weekDays[todayIndex]);
        const targetRow = document.getElementById(`week-row-${dateStr}`);
        if (!targetRow) {
          // If element not found on last attempt, still show content
          if (index === scrollAttempts.length - 1) {
            setContentReady(true);
            hasInitialized.current = true;
          }
          return;
        }
        
        // Calculate scroll position to center today's row
        const headerOffset = 250; // Approximate header height
        const rect = targetRow.getBoundingClientRect();
        const elementPosition = rect.top + window.scrollY;
        const targetScroll = elementPosition - headerOffset - (window.innerHeight / 2) + (rect.height / 2);
        
        // Use 'auto' for instant scroll (no visible animation)
        window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'auto' });
        
        // Show content after final scroll attempt
        if (index === scrollAttempts.length - 1) {
          setContentReady(true);
          hasInitialized.current = true;
          }
        }, delay);
    });
  }, [view, weekDays]);

  // Close quick join popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickJoinPopoverRef.current && !quickJoinPopoverRef.current.contains(event.target as Node)) {
        setQuickJoinPopoverDate(null);
      }
    };

    if (quickJoinPopoverDate) {
      // Use setTimeout to avoid the click that opened the popover from immediately closing it
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
  const dateRangeStr = `${weekDays[0].toLocaleDateString(langCode, { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString(langCode, { day: 'numeric', month: 'short' })}`;

  // --- Render Split Meal Card (for existing meals) ---
  const renderMealCard = (meal: Meal, compact: boolean = false) => {
    const hasDish = meal.description.trim().length > 0;
    const isIn = isUserInMeal(meal);
    const canJoin = canUserJoinMeal(meal);
    // Filter to only existing users (excludes deleted users)
    const eaters = meal.forUserIds
      .map(uid => users.find(u => u.id === uid))
      .filter((u): u is User => !!u);

  return (
      <div
        key={meal.id}
        className="rounded-xl border border-border bg-card overflow-hidden "
      >
        {/* Split Content: LEFT (Dish) | RIGHT (Who's Eating) */}
        <div className="flex divide-x divide-border min-h-[100px]">
          {/* LEFT: Dish Section */}
          <div 
            onClick={() => openEditModal(meal)}
            className="flex-1 p-3 cursor-pointer  flex flex-col"
          >
            {/* Audience Badge */}
            <span className={`text-caption font-semibold px-2 py-0.5 rounded-full self-start mb-2 ${getAudienceColor(meal.audience || 'ALL')}`}>
              {getAudienceLabel(meal.audience || 'ALL')}
            </span>
            
            {hasDish ? (
              <div className="flex-1 flex flex-col">
                <p className={`font-semibold text-foreground leading-tight flex-1 ${compact ? 'text-caption' : 'text-body'}`}>
                  <TranslatedMealDescription meal={meal} currentLang={currentLang} onUpdate={onUpdate} />
                </p>
                <button className="flex items-center gap-1 text-caption font-medium text-muted-foreground  mt-2">
                  <Pencil size={10} />
                  {t['meals.edit_dish'] ?? 'Edit dish'}
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <button className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-caption font-semibold text-muted-foreground transition-colors">
                  <Plus size={14} />
                  {t['meals.add_meal_plan'] ?? 'Add Meal Plan'}
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
              <span className="text-caption font-semibold text-muted-foreground tracking-wide">
                {t['meals.eating'] ?? 'Eating'} ({eaters.length})
              </span>
            </div>

            {/* Avatars Grid */}
            {eaters.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2 flex-1">
                {eaters.slice(0, 6).map(u => (
                  <div key={u.id} className="flex flex-col items-center">
                    <Avatar
                      user={u}
                      size="xs+"
                      isCurrentUser={u.id === currentUser.id}
                      className={`border-2 ${u.id === currentUser.id ? 'border-primary' : 'border-card'}`}
                    />
                    {!compact && (
                      <span className={`text-micro mt-0.5 ${
                        u.id === currentUser.id ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {u.id === currentUser.id ? (t['common.you'] ?? 'You') : u.name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                ))}
                {eaters.length > 6 && (
                  <div className="flex flex-col items-center">
                    <span className="w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-caption font-semibold text-muted-foreground">
                      +{eaters.length - 6}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-caption text-muted-foreground mb-2 flex-1">
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
                className={`text-caption font-semibold px-4 py-1.5 rounded-full transition-colors flex items-center justify-center gap-1.5 ${
                  isIn
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-primary/15 text-primary'
                }`}
              >
                {isIn ? (
                  <>
                    {t['meals.leave'] ?? 'Leave'} <X size={12} />
                  </>
                ) : (
                  <>
                    {t['meals.join'] ?? 'Join'} <Plus size={12} />
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
      <div className="rounded-xl border border-dashed border-border bg-card overflow-hidden">
        {/* Split Content: LEFT (Dish) | RIGHT (Who's Eating) */}
        <div className="flex divide-x divide-border min-h-[100px]">
          {/* LEFT: Plan Dish Section */}
          <div 
            onClick={() => openAddModal(date, type)}
            className="flex-1 p-3 cursor-pointer  flex flex-col items-center justify-center"
          >
            <button className="flex items-center gap-1.5 px-4 py-2.5 bg-muted rounded-xl text-caption font-semibold text-muted-foreground transition-colors">
              <Plus size={16} />
              {t['meals.add_meal_plan'] ?? 'Add Meal Plan'}
            </button>
            <span className="text-caption text-muted-foreground mt-2">
              {t['meals.whats_for'] ?? "What's for"} {getMealLabel(type).toLowerCase()}?
            </span>
          </div>

          {/* RIGHT: RSVP Section */}
          <div className="flex-1 p-3 flex flex-col">
            <div className="flex items-center gap-1 mb-2">
              <Users size={12} className="text-muted-foreground" />
              <span className="text-caption font-semibold text-muted-foreground tracking-wide">
                {t['meals.eating'] ?? 'Eating'} (0)
              </span>
            </div>

            <p className="text-caption text-muted-foreground italic mb-2 flex-1">
              {t['meals.no_one_yet'] ?? 'No one yet'}
            </p>

            {/* Quick RSVP Button */}
            <button
              onClick={() => handleQuickRsvpEmpty(date, type)}
              className="w-full py-2 rounded-lg text-caption font-semibold transition-colors flex items-center justify-center gap-1.5 bg-muted text-muted-foreground border border-dashed border-border"
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
        {/* STICKY HEADER - matches Family */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header 
          className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
          style={{ height: '120px' }}
        >
          <div className="flex items-center justify-between w-full">
            <h1 className="text-display text-foreground">
              {t['meals.title']}
            </h1>
            
            {/* Header Actions */}
            <div className="flex items-center gap-1">
              {/* Export PDF Button - Only visible in table view */}
              {view === 'week' && (
                    <button
                  onClick={handleExportPDF}
                  disabled={exportingPdf}
                  className="p-2 rounded-full text-muted-foreground transition-colors disabled:opacity-50"
                  aria-label={t['meals.export_pdf'] || 'Export PDF'}
                >
                  {exportingPdf ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Download size={20} />
                      )}
                    </button>
              )}
              
              {/* Day/Week Toggle - Simple state change like Family tabs */}
              <button
                onClick={() => setView(view === 'day' ? 'week' : 'day')}
                className="p-2 rounded-full text-muted-foreground transition-colors"
              >
                {view === 'day' ? <Sheet size={20} /> : <Rows3 size={20} />}
              </button>
            </div>
          </div>
        </header>
        {/* Error Banner */}
        <ErrorBanner 
          error={error} 
          onDismiss={() => setError(null)} 
          title={t['common.error'] || 'Error'}
        />
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* WEEK NAVIGATION - Same structure as Family Info tab nav */}
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
        {/* MAIN CONTENT - Hidden until scroll completes to prevent flicker */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div className="pt-1" style={{ opacity: contentReady ? 1 : 0 }}>

      {/* Day View */}
      {view === 'day' ? (
        <div ref={dayViewRef} className="space-y-4">
            {weekDays.map((dayDate) => {
              const dateStr = formatDateStr(dayDate);
              const isToday = dayDate.toDateString() === new Date().toDateString();
              const mealTypeOrder: Record<string, number> = { Breakfast: 1, Lunch: 2, Dinner: 3, Snacks: 4 };
              const dayMeals = meals
                .filter(m => m.date === dateStr)
                .sort((a, b) => (mealTypeOrder[a.type] || 99) - (mealTypeOrder[b.type] || 99));
            
              // Build rows: each meal + one "Add Meal Plan" row
              const mealRows = dayMeals.map(meal => ({ type: 'meal' as const, meal }));
              // Always add one "Add" row at the end
              const rows = [...mealRows, { type: 'add' as const, meal: null }];

              // Count helpers for display
              const getParticipantCounts = (userIds: string[]) => {
                const participants = userIds
                  .map(uid => users.find(u => u.id === uid))
                  .filter((u): u is User => !!u);
                const adultCount = participants.filter(u => u.role !== UserRole.CHILD).length;
                const kidCount = participants.filter(u => u.role === UserRole.CHILD).length;
                return { adultCount, kidCount };
              };

              return (
                <div 
                  key={dateStr} 
                  id={`day-${dateStr}`} 
                  className="bg-card rounded-xl overflow-hidden shadow-sm "
                >
                  {/* Prominent Date Header Bar */}
                  <div className={`px-4 py-3 ${isToday ? 'bg-primary' : 'bg-card'}`}>
                    <span className={`text-body font-bold ${isToday ? 'text-primary-foreground' : 'text-foreground'}`}>
                      {dayDate.toLocaleDateString(langCode, { weekday: 'short' })}, {dayDate.getDate()} {dayDate.toLocaleDateString(langCode, { month: 'short' })}
                    </span>
                  </div>

                  {/* Meal Rows - horizontal dividers with margin */}
                  <div className="[&>*]:mx-3 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-border">
                    {rows.map((row, idx) => {
                      if (row.type === 'meal' && row.meal) {
                        const meal = row.meal;
                        const hasDish = meal.description.trim().length > 0;
                        const isIn = isUserInMeal(meal);
                        const canJoin = canUserJoinMeal(meal);
                        const { adultCount, kidCount } = getParticipantCounts(meal.forUserIds);

                        return (
                          <div key={meal.id} className="grid grid-cols-[1fr_1px_4rem_1px_7rem] min-h-[80px] items-center">
                            {/* Left Column: Meal Info */}
                            <div 
                              onClick={() => openEditModal(meal)}
                              className="h-full p-3 cursor-pointer  flex flex-col justify-center min-w-0"
                            >
                              <span className="text-caption font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
                                {getMealIcon(meal.type)}
                                {getMealLabel(meal.type)}
                              </span>
                              {hasDish ? (
                                <span className="text-body font-semibold text-foreground leading-tight block">
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
                              className="self-stretch opacity-50 my-3"
                              style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 20%, hsl(var(--border)) 80%, transparent)' }}
                            />

                            {/* Middle Column: Participant Counts */}
                            <div 
                              onClick={() => openEditModal(meal)}
                              className="h-full p-2 cursor-pointer  flex flex-col items-center justify-center gap-0.5"
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
                              className="self-stretch opacity-50 my-3"
                              style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 20%, hsl(var(--border)) 80%, transparent)' }}
                            />

                            {/* Right Column: Join Button */}
                            <div className="h-full p-2 flex items-center justify-center">
                              {canJoin ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickRsvp(meal, e);
                                  }}
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
                        // Get existing meal types for this day to disable them in the picker
                        const existingMealTypes = dayMeals
                          .filter(m => m.description.trim() || m.forUserIds.length > 0)
                          .map(m => m.type);
                        
                        return (
                          <div key={`add-${idx}`} className="relative">
                            {/* Expanded: Meal type picker - absolute overlay */}
                            {isExpanded && (
                              <div 
                                ref={quickJoinPopoverRef}
                                className="absolute inset-0 bg-card z-10 flex items-center h-[80px] px-4"
                              >
                                {/* Left area: Meal type icons */}
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

                                {/* Right: Close button */}
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

                            {/* Grid row - same structure as meal rows */}
                            <div className="grid grid-cols-[1fr_1px_4rem_1px_7rem] min-h-[80px] items-center">
                              {/* Left Column: Add Meal Plan button */}
                              <div 
                                onClick={() => openAddModal(dayDate, MealType.DINNER)}
                                className="h-full p-3 cursor-pointer  flex flex-col justify-center min-w-0"
                              >
                                <button className="text-body font-semibold text-muted-foreground flex items-center gap-1.5">
                                  <Plus size={16} />
                                  {t['meals.add_meal_plan'] ?? 'Add Meal Plan'}
                                </button>
                              </div>

                              {/* Vertical Separator */}
                              <div 
                                className="self-stretch opacity-50 my-3"
                                style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 20%, hsl(var(--border)) 80%, transparent)' }}
                              />

                              {/* Middle Column: Empty counts placeholder */}
                              <div 
                                onClick={() => openAddModal(dayDate, MealType.DINNER)}
                                className="h-full p-2 cursor-pointer  flex flex-col items-center justify-center gap-0.5"
                              >
                                <div className="flex items-center gap-1">
                                  <UserIcon size={14} className="text-muted-foreground/40" />
                                  <span className="text-body font-medium text-muted-foreground/40">0</span>
                                </div>
                              </div>

                              {/* Vertical Separator */}
                              <div 
                                className="self-stretch opacity-50 my-3"
                                style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--border)) 20%, hsl(var(--border)) 80%, transparent)' }}
                              />

                              {/* Right Column: Join button */}
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
      ) : (
          /* Week View - Simple HTML Table */
          <div className="rounded-xl bg-card shadow-sm overflow-hidden">
            <div 
              ref={weekScrollRef}
              className="overflow-x-auto scrollbar-hide"
              style={{ overscrollBehavior: 'none' }}
            >
              <table style={{ 
                borderCollapse: 'separate', 
                borderSpacing: 0, 
                tableLayout: 'auto',
                minWidth: '490px',
                width: '100%'
              }}>
                {/* Define column minimum widths - 90px for date, 100px for each meal type */}
                <colgroup>
                  <col style={{ minWidth: '90px', width: '90px' }} />
                  {mealTypes.map((type) => (
                    <col key={type} style={{ minWidth: '100px', width: '100px' }} />
                  ))}
                </colgroup>
                {/* Table Header - Meal type names */}
                <thead>
                  <tr>
                    {/* Corner cell - sticky horizontally */}
                    <th 
                      className="p-2 bg-muted sticky left-0 z-10 border-b border-border"
                      style={{ 
                        boxShadow: '1px 0 0 0 #d1d5db',
                        minWidth: '90px'
                      }}
                    />
                    {/* Meal type headers - no sticky, scrolls with content */}
                    {mealTypes.map((type, typeIndex) => {
                      const isLastCol = typeIndex === mealTypes.length - 1;
                      return (
                        <th 
                          key={type}
                          className={`p-2 text-center border-b border-border ${!isLastCol ? 'border-r' : ''} bg-muted`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            {getMealIcon(type)}
                            <span className="text-caption font-semibold text-muted-foreground leading-tight text-center break-words">
                              {getMealLabel(type)}
                          </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                
                {/* Table Body - Date rows */}
                <tbody>
                {weekDays.map((day, dayIndex) => {
                    const dateStr = formatDateStr(day);
                  const isToday = day.toDateString() === new Date().toDateString();
                    const isLastRow = dayIndex === weekDays.length - 1;
                  return (
                      <tr key={dateStr} id={`week-row-${dateStr}`}>
                        {/* Date label cell - sticky horizontally */}
                        <td 
                      onClick={() => handleWeekCellClick(day)}
                          className={`p-2 text-center align-middle sticky left-0 z-10 cursor-pointer border-r border-border ${!isLastRow ? 'border-b border-border' : ''} ${isToday ? 'bg-primary' : 'bg-card'}`}
                          style={{ 
                            boxShadow: '1px 0 0 0 #d1d5db',
                            minWidth: '90px'
                          }}
                    >
                      <span className={`text-caption font-semibold block ${isToday ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {day.toLocaleDateString(langCode, { weekday: 'short' })}
                      </span>
                      <span className={`text-body font-bold block ${isToday ? 'text-primary-foreground' : 'text-foreground'}`}>
                            {day.getDate()} {day.toLocaleDateString(langCode, { month: 'short' })}
                      </span>
                        </td>

                        {/* Meal type cells for this date */}
                {mealTypes.map((type, typeIndex) => {
                        const slotMeals = getMealsForSlot(day, type);
                          const isLastCol = typeIndex === mealTypes.length - 1;
                        
                        return (
                            <td
                              key={`${dateStr}-${type}`}
                            onClick={() => handleWeekCellClick(day)}
                              className={`p-1.5 cursor-pointer align-top ${!isLastRow ? 'border-b border-border' : ''} ${!isLastCol ? 'border-r border-border' : ''}`}
                              style={{ minWidth: '100px' }}
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
                                              <UserIcon size={12} />
                                            {adultCount}
                                          </span>
                                        )}
                                        {kidCount > 0 && (
                                          <span className="flex items-center gap-0.5">
                                              <Baby size={12} />
                                            {kidCount}
                                          </span>
                                        )}
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
      {isModalOpen && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          {/* Safe area bottom cover - fills the gap below the sheet */}
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
              {/* X Close Button (left) */}
            <button
              onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
              aria-label={t['common.close'] || 'Close'}
            >
              <X size={20} />
            </button>

              {/* Title (center) */}
              <h2 className="text-title font-semibold text-foreground text-center flex-1">
                {`${modalDate.toLocaleDateString(langCode, { weekday: 'short' })}, ${modalDate.getDate()} ${modalDate.toLocaleDateString(langCode, { month: 'short' })}`}
              </h2>
              
              {/* ✓ Confirm Button (right) */}
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
                {/* Main Input: Dish Name (big font) */}
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

                {/* Search Recipe in YouTube - Right after meal name */}
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

                {/* Meal Type Selector - 2x2 grid */}
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
                {/* Footer separator */}
                <div className="px-5"><div className="h-px bg-border w-full"></div></div>
                {/* Footer with Delete button */}
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
              /* Invisible spacer for consistent height */
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

export default Meals;
