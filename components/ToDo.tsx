import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Circle,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  User as UserIcon,
  Repeat,
  ShoppingCart,
  ShoppingBag,
  Trash2,
  Home,
  HandHeart,
  Stone,
  ArrowDownUp,
  ClipboardList,
  Calendar,
  Loader2,
} from 'lucide-react';
import Avatar from './ui/Avatar';
import ErrorBanner from './ui/ErrorBanner';
import { useScrollHeader } from '@/hooks/useScrollHeader';
import { useTranslatedContent } from '@/hooks/useTranslatedContent';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useSheetTheme } from '@/hooks/useSheetTheme';
import { ToDoItem, ToDoType, ShoppingCategory, TaskCategory, RecurrenceFrequency, User, UserRole, BaseViewProps } from '../types';
import { detectInputLanguage } from '../services/languageDetectionService';
import { haptics } from '../utils/haptics';
import { useDemoMode } from '../contexts/DemoModeContext';

// ─────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────

interface ToDoProps extends BaseViewProps {
  items: ToDoItem[];
  users: User[];
  currentUser: User;
  onAdd: (item: ToDoItem) => Promise<void>;
  onUpdate: (id: string, data: Partial<ToDoItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  initialSection?: 'shopping' | 'task';
  onSectionChange?: (section: string) => void;
  autoOpenSheet?: boolean; // Auto-open add sheet when navigating from Dashboard (+) button
}

const SHOPPING_CATEGORIES = Object.values(ShoppingCategory);
const TASK_CATEGORIES = Object.values(TaskCategory);

// Unit suggestions for shopping items - shown as autocomplete options
const UNIT_SUGGESTIONS = [
  'catty',
  'tael',
  'g',
  'kg',
  'lb',
  'ml',
  'l',
  'piece',
  'dozen',
  'bunch',
  'bottle',
  'jar',
  'bag',
  'can',
  'tube',
  'pack',
];

const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; labelKey: string }[] = [
  { value: 'NONE', labelKey: 'tasks.recurrence' },
  { value: 'DAILY', labelKey: 'tasks.daily' },
  { value: 'WEEKLY', labelKey: 'tasks.weekly' },
  { value: 'BIWEEKLY', labelKey: 'tasks.biweekly' },
  { value: 'MONTHLY', labelKey: 'tasks.monthly' },
];

// Sort options - Shopping only has Added Date (no due dates)
type SortOption = 'addedDate-desc' | 'addedDate-asc' | 'dueDate-desc' | 'dueDate-asc';

const SHOPPING_SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'addedDate-desc', label: 'Added Date (newest)' },
  { value: 'addedDate-asc', label: 'Added Date (oldest)' },
];

const TASK_SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'addedDate-desc', label: 'Added Date (newest)' },
  { value: 'addedDate-asc', label: 'Added Date (oldest)' },
  { value: 'dueDate-desc', label: 'Due Date (newest)' },
  { value: 'dueDate-asc', label: 'Due Date (oldest)' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Category icons for tabs
// When isSelected is true, icon inherits parent color (e.g., text-primary-foreground)
const getShoppingCategoryIcon = (category: string, isSelected = false) => {
  const className = isSelected ? '' : undefined;
  switch (category) {
    case ShoppingCategory.SUPERMARKET: return <ShoppingCart size={16} className={className} />;
    case ShoppingCategory.WET_MARKET: return <Home size={16} className={className} />;
    case ShoppingCategory.OTHERS: return <Stone size={16} className={className} />;
    default: return null;
  }
};

const getTaskCategoryIcon = (category: string, isSelected = false) => {
  const className = isSelected ? '' : undefined;
  switch (category) {
    case TaskCategory.HOME_CARE: return <Home size={16} className={className} />;
    case TaskCategory.FAMILY_CARE: return <HandHeart size={16} className={className} />;
    case TaskCategory.OTHERS: return <Stone size={16} className={className} />;
    default: return null;
  }
};

// ─────────────────────────────────────────────────────────────────
// Helper Functions`
// ─────────────────────────────────────────────────────────────────

const getDefaultAssignee = (users: User[], currentUser: User): string => {
  const helper = users.find(u => u.role === UserRole.HELPER && u.status === 'active');
  return helper?.id || currentUser.id;
};

// Sort users for "Assign to" selection:
// If helper exists: Helper → Myself → Spouse → Others → Child
// If no helper: Myself → Spouse → Others → Child
const getSortedUsersForAssignment = (users: User[], currentUser: User): User[] => {
  const activeUsers = users.filter(u => u.status === 'active');
  const hasHelper = activeUsers.some(u => u.role === UserRole.HELPER);
  
  const getRolePriority = (user: User): number => {
    // Myself always gets special priority
    if (user.id === currentUser.id) {
      return hasHelper ? 1 : 0; // After helper if helper exists, first if no helper
    }
    
    switch (user.role) {
      case UserRole.HELPER:
        return 0; // Helper first (only if hasHelper)
      case UserRole.MASTER:
      case UserRole.SUPERADMIN:
        return 1; // Admin roles (but currentUser check above takes precedence)
      case UserRole.SPOUSE:
        return 2;
      case UserRole.OTHER:
        return 3;
      case UserRole.CHILD:
        return 4;
      default:
        return 5;
    }
  };
  
  return [...activeUsers].sort((a, b) => {
    const priorityDiff = getRolePriority(a) - getRolePriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return a.name.localeCompare(b.name);
  });
};

// Returns badge styling for category (background + text color)
// Colors based on brand palette: #3EAFD2, #FF9800, #7E57C2, #4CAF50, #F06292, #757575
const getCategoryBadgeStyle = (category: string): string => {
  switch (category) {
    case ShoppingCategory.SUPERMARKET:
      return 'bg-[#E6F7FB] text-[#3EAFD2]'; // Primary cyan
    case ShoppingCategory.WET_MARKET:
      return 'bg-[#E8F5E9] text-[#4CAF50]'; // Green
    case TaskCategory.HOME_CARE:
      return 'bg-[#FFF3E0] text-[#FF9800]'; // Orange
    case TaskCategory.FAMILY_CARE:
      return 'bg-[#FCE4EC] text-[#F06292]'; // Magenta
    default:
      return 'bg-secondary text-muted-foreground'; // Gray
  }
};

// Returns pill styling for suggestions (background + text + border color)
const getSuggestionPillStyle = (category: string): string => {
  switch (category) {
    case ShoppingCategory.SUPERMARKET:
      return 'bg-[#E6F7FB] text-[#3EAFD2] border-[#3EAFD2]/40'; // Primary cyan
    case ShoppingCategory.WET_MARKET:
      return 'bg-[#E8F5E9] text-[#4CAF50] border-[#4CAF50]/40'; // Green
    case TaskCategory.HOME_CARE:
      return 'bg-[#FFF3E0] text-[#FF9800] border-[#FF9800]/40'; // Orange
    case TaskCategory.FAMILY_CARE:
      return 'bg-[#FCE4EC] text-[#F06292] border-[#F06292]/40'; // Magenta
    default:
      return 'bg-secondary text-muted-foreground border-muted-foreground/40'; // Gray
  }
};

// Returns just the text color for category icons (used in suggestion cards)
const getCategoryIconColor = (category: string): string => {
  switch (category) {
    case ShoppingCategory.SUPERMARKET:
      return 'text-[#3EAFD2]'; // Primary cyan
    case ShoppingCategory.WET_MARKET:
      return 'text-[#4CAF50]'; // Green
    case TaskCategory.HOME_CARE:
      return 'text-[#FF9800]'; // Orange
    case TaskCategory.FAMILY_CARE:
      return 'text-[#F06292]'; // Magenta
    default:
      return 'text-muted-foreground'; // Gray
  }
};

const formatRecurrence = (recurrence?: { frequency: RecurrenceFrequency; dayOfWeek?: number; dayOfMonth?: number }): string => {
  if (!recurrence || recurrence.frequency === 'NONE') return '';
  
  switch (recurrence.frequency) {
    case 'DAILY':
      return 'Repeats every day';
    case 'WEEKLY':
      const day = recurrence.dayOfWeek !== undefined ? DAYS_OF_WEEK[recurrence.dayOfWeek] : '';
      return day ? `Every ${day}` : 'Weekly';
    case 'BIWEEKLY':
      const biweeklyDay = recurrence.dayOfWeek !== undefined ? DAYS_OF_WEEK[recurrence.dayOfWeek] : '';
      return biweeklyDay ? `Every other ${biweeklyDay}` : 'Every 2 weeks';
    case 'MONTHLY':
      const date = recurrence.dayOfMonth;
      if (date) {
        const suffix = date === 1 || date === 21 || date === 31 ? 'st' 
          : date === 2 || date === 22 ? 'nd' 
          : date === 3 || date === 23 ? 'rd' : 'th';
        return `On the ${date}${suffix} of each month`;
      }
      return 'Monthly';
    default:
      return '';
  }
};

const formatDateTime = (dueDate?: string, dueTime?: string): string => {
  if (!dueDate) return '';
  
  const date = new Date(dueDate + 'T00:00:00');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Format: Mon, 1 Jan 2025
  const dayName = dayNames[date.getDay()];
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  
  let dateStr = `${dayName}, ${day} ${month} ${year}`;
  
  if (dueTime) {
    // Format: 18:05 (24h) - strip seconds if present
    const timeWithoutSeconds = dueTime.split(':').slice(0, 2).join(':');
    dateStr += `, ${timeWithoutSeconds}`;
  }
  
  return dateStr;
};

const isOverdue = (dueDate?: string): boolean => {
  if (!dueDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate + 'T00:00:00');
  
  return due < today;
};

// Get today's date as YYYY-MM-DD string in LOCAL timezone (not UTC)
// Using toISOString() would convert to UTC which causes date to be wrong after midnight in timezones ahead of UTC
const getLocalDateString = (date: Date = new Date()): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────────────────────────
// Date Grouping for Task List
// ─────────────────────────────────────────────────────────────────

type DateGroup = 'overdue' | 'noDate' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'later';

const getDateGroup = (dueDate?: string): DateGroup => {
  if (!dueDate) return 'noDate';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  
  // Calculate end of this week (Sunday)
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const daysUntilEndOfWeek = 7 - dayOfWeek;
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + daysUntilEndOfWeek);
  
  if (due <= endOfWeek) return 'thisWeek';
  
  // End of next week
  const endOfNextWeek = new Date(endOfWeek);
  endOfNextWeek.setDate(endOfWeek.getDate() + 7);
  
  if (due <= endOfNextWeek) return 'nextWeek';
  
  return 'later';
};

// Group items by date
const groupItemsByDate = (items: ToDoItem[]): Record<DateGroup, ToDoItem[]> => {
  const groups: Record<DateGroup, ToDoItem[]> = {
    overdue: [],
    noDate: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    nextWeek: [],
    later: [],
  };
  
  items.forEach(item => {
    const group = getDateGroup(item.dueDate);
    groups[group].push(item);
  });
  
  return groups;
};

// Section order for rendering
const DATE_GROUP_ORDER: DateGroup[] = ['overdue', 'noDate', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'later'];

// ─────────────────────────────────────────────────────────────────
// Component for displaying translated item name
// ─────────────────────────────────────────────────────────────────

const TranslatedItemName: React.FC<{
  item: ToDoItem;
  currentLang: string;
  onUpdate?: (id: string, data: Partial<ToDoItem>) => Promise<void>;
}> = ({ item, currentLang, onUpdate }) => {
  const translatedName = useTranslatedContent({
    content: item.name,
    contentLang: item.nameLang,
    currentLang,
    translations: item.nameTranslations || {},
    onTranslationUpdate: async (translation) => {
      // Update translations in database
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

// ─────────────────────────────────────────────────────────────────
// Section Divider Component (for date-grouped task list)
// ─────────────────────────────────────────────────────────────────

const SectionDivider: React.FC<{ 
  label: string; 
  type: 'overdue' | 'today' | 'future';
}> = ({ label, type }) => {
  const colorClass = type === 'overdue' 
    ? 'text-destructive' 
    : type === 'today' 
      ? 'text-primary' 
      : 'text-muted-foreground';
  
  return (
    <div className="px-4 py-2.5 bg-card">
      <span className={`text-base font-bold ${colorClass}`}>
        {label}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Unique ID Generator (prevents collisions on rapid adds)
// ─────────────────────────────────────────────────────────────────
let optimisticIdCounter = 0;
const generateOptimisticId = (): string => {
  optimisticIdCounter += 1;
  return `temp-${Date.now()}-${optimisticIdCounter}`;
};

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────

const ToDo: React.FC<ToDoProps> = ({
  items,
  users,
  currentUser,
  onAdd,
  onUpdate,
  onDelete,
  t,
  currentLang,
  initialSection,
  onSectionChange,
  autoOpenSheet,
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Role-based permissions
  // ─────────────────────────────────────────────────────────────────
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  const { isViewingAsHelper } = useDemoMode();
  // isHelper: true if actual Helper OR SuperAdmin viewing as Helper
  const isHelper = currentUser.role === UserRole.HELPER || (isSuperAdmin && isViewingAsHelper);

  // ─────────────────────────────────────────────────────────────────
  // Scroll Header Hook
  // ─────────────────────────────────────────────────────────────────
  const { isScrolled } = useScrollHeader();

  // ─────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────
  
  const [activeSection, setActiveSection] = useState<ToDoType>(initialSection || 'task');
  
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
  
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showClearCompletedConfirm, setShowClearCompletedConfirm] = useState(false);
  
  // Shopping Mode - Full-screen distraction-free shopping list
  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [shoppingModeCategory, setShoppingModeCategory] = useState<string>('All');
  const [shoppingModeScrolled, setShoppingModeScrolled] = useState(false);
  
  // Lock body scroll when sheet or shopping mode is open
  useScrollLock(isSheetOpen || showClearCompletedConfirm || isShoppingMode);
  
  // Dim status bar when sheet is open (iOS) - not for shopping mode since it's full screen
  useSheetTheme(isSheetOpen || showClearCompletedConfirm);
  
  const [sheetForm, setSheetForm] = useState<Partial<ToDoItem>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null); // Track if editing existing item
  const [showUnitSuggestions, setShowUnitSuggestions] = useState(false);
  const unitInputRef = useRef<HTMLInputElement>(null);
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [optimisticItems, setOptimisticItems] = useState<ToDoItem[]>([]);
  const [optimisticCompleted, setOptimisticCompleted] = useState<Record<string, boolean>>({});
  const [optimisticEdits, setOptimisticEdits] = useState<Record<string, Partial<ToDoItem>>>({});
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false); // Prevent double-click duplicate submissions
  
  // Track items animating to completed (iOS-style delayed move)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  
  // Swipe gesture tracking
  const [swipeState, setSwipeState] = useState<{
    id: string | null;
    startX: number;
    offset: number;
    isDragging: boolean;
  }>({ id: null, startX: 0, offset: 0, isDragging: false });
  
  // Sort & Filter
  const [sortBy, setSortBy] = useState<SortOption>('addedDate-desc');
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterDropdownOpen]);

  // ─────────────────────────────────────────────────────────────────
  // Derived Data
  // ─────────────────────────────────────────────────────────────────
  
  const categories = activeSection === 'shopping' ? SHOPPING_CATEGORIES : TASK_CATEGORIES;
  const getCategoryIcon = activeSection === 'shopping' 
    ? (cat: string, isSelected = false) => getShoppingCategoryIcon(cat, isSelected)
    : (cat: string, isSelected = false) => getTaskCategoryIcon(cat, isSelected);
  // Legacy categoryIcons for segmented control (uses bg-card, not bg-primary)
  const categoryIcons: Record<string, React.ReactNode> = {};
  categories.forEach(cat => {
    categoryIcons[cat] = getCategoryIcon(cat, false);
  });
  const defaultCategory = activeSection === 'shopping' ? ShoppingCategory.SUPERMARKET : TaskCategory.HOME_CARE;
  
  // Stats for section cards
  const shoppingStats = {
    total: items.filter(i => i.type === 'shopping' && !i.completed).length,
    completed: items.filter(i => i.type === 'shopping' && i.completed).length,
  };
  
  const taskStats = {
    total: items.filter(i => i.type === 'task' && !i.completed).length,
    completed: items.filter(i => i.type === 'task' && i.completed).length,
  };

  useEffect(() => {
    setSelectedCategory('All');
    // Reset sort to added date when switching to shopping if currently sorting by due date
    if (activeSection === 'shopping' && sortBy.startsWith('dueDate')) {
      setSortBy('addedDate-desc');
    }
  }, [activeSection]);
  
  useEffect(() => {
    if (isAddingInline && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [isAddingInline]);

  // Reset sheet scroll position when it opens
  useEffect(() => {
    if (isSheetOpen && sheetContentRef.current) {
      sheetContentRef.current.scrollTop = 0;
    }
  }, [isSheetOpen]);

  // Reset sheet scroll position when it opens
  useEffect(() => {
    if (isSheetOpen && sheetContentRef.current) {
      sheetContentRef.current.scrollTop = 0;
    }
  }, [isSheetOpen]);
  
  useEffect(() => {
    setOptimisticCompleted(prev => {
      const next = { ...prev };
      items.forEach(item => {
        if (next[item.id] !== undefined && next[item.id] === item.completed) {
          delete next[item.id];
        }
      });
      return next;
    });
  }, [items]);
  
  const mergedItems = useMemo(() => {
    const sectionItems = items.filter(i => i.type === activeSection);
    
    // Build key for dedup matching - must match suggestions logic
    // Shopping: name + brand + quantity + unit + category
    // Tasks: name + category
    const getItemKey = (item: ToDoItem): string => {
      if (item.type === 'shopping') {
        return `${item.name.trim().toLowerCase()}|${(item.brand || '').toLowerCase()}|${item.quantity || ''}|${(item.unit || '').toLowerCase()}|${item.category}`;
      } else {
        return `${item.name.trim().toLowerCase()}|${item.category}`;
      }
    };
    
    // Filter out optimistic items that already exist in real items (by full key)
    const realKeys = new Set(sectionItems.map(getItemKey));
    const optimisticFiltered = optimisticItems.filter(opt =>
      opt.type === activeSection && !realKeys.has(getItemKey(opt))
    );
    
    const merged = [...sectionItems, ...optimisticFiltered].map(item => ({
      ...item,
      completed: optimisticCompleted[item.id] ?? item.completed,
      ...(optimisticEdits[item.id] || {}), // Apply optimistic edits immediately
    }));
    
    // For LIST VIEW: Deduplicate recurring task instances - show only ONE per series
    // Keep the NEXT upcoming instance (earliest dueDate that's not completed)
    // NOTE: Items with seriesId but recurrence.frequency === 'NONE' are "orphaned" from split series
    // and should be treated as standalone tasks (not grouped/deduplicated)
    const deduplicatedMerged = (() => {
      const seriesMap = new Map<string, ToDoItem[]>();
      const nonSeriesItems: ToDoItem[] = [];
      
      merged.forEach(item => {
        // Only group items that are ACTIVELY recurring (not orphaned from split series)
        const isActivelyRecurring = item.seriesId && 
          item.recurrence && 
          item.recurrence.frequency !== 'NONE';
        
        if (isActivelyRecurring) {
          if (!seriesMap.has(item.seriesId!)) {
            seriesMap.set(item.seriesId!, []);
          }
          seriesMap.get(item.seriesId!)!.push(item);
        } else {
          // Standalone task OR orphaned from split series
          nonSeriesItems.push(item);
        }
      });
      
      // For each series, keep only the next upcoming instance
      const dedupedSeriesItems: ToDoItem[] = [];
      seriesMap.forEach((seriesItems) => {
        // Sort by dueDate ascending, then pick the first non-completed one
        const sorted = seriesItems.sort((a, b) => {
          const dateA = a.dueDate ? new Date(a.dueDate + 'T00:00:00').getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate + 'T00:00:00').getTime() : Infinity;
          return dateA - dateB;
        });
        
        // Find the next upcoming non-completed instance
        const nextUpcoming = sorted.find(item => !item.completed);
        if (nextUpcoming) {
          dedupedSeriesItems.push(nextUpcoming);
        }
        
        // Also include all completed instances (they show in completed section)
        sorted.filter(item => item.completed).forEach(item => {
          dedupedSeriesItems.push(item);
        });
      });
      
      return [...nonSeriesItems, ...dedupedSeriesItems];
    })();
    
    let filtered = deduplicatedMerged;
    
    // Category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(i => i.category === selectedCategory);
    }
    
    // "My Items Only" filter
    if (showOnlyMine) {
      filtered = filtered.filter(i => i.assigneeId === currentUser.id);
    }
    
    // Exclude deleting items
    filtered = filtered.filter(i => !deletingIds.has(i.id));
    
    // Sort based on selected option
    return filtered.sort((a, b) => {
      const [field, order] = sortBy.split('-') as ['addedDate' | 'dueDate', 'asc' | 'desc'];
      
      let valueA: number;
      let valueB: number;
      
      if (field === 'dueDate') {
        // For due date, items without dueDate go to the end
        valueA = a.dueDate ? new Date(a.dueDate + 'T00:00:00').getTime() : (order === 'asc' ? Infinity : -Infinity);
        valueB = b.dueDate ? new Date(b.dueDate + 'T00:00:00').getTime() : (order === 'asc' ? Infinity : -Infinity);
      } else {
        // Added date (createdAt)
        valueA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        valueB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }
      
      return order === 'desc' ? valueB - valueA : valueA - valueB;
    });
  }, [items, optimisticItems, activeSection, selectedCategory, optimisticCompleted, optimisticEdits, deletingIds, sortBy, showOnlyMine, currentUser.id]);
  
  // Items completing stay in active list during animation, then move to completed
  const activeItems = mergedItems.filter(i => !i.completed || completingIds.has(i.id));
  const completedItems = mergedItems.filter(i => i.completed && !completingIds.has(i.id));
  
  // Shopping Mode items - uses same data source, filtered for shopping only
  const shoppingModeItems = useMemo(() => {
    // Get all shopping items (not filtered by current view's category or other filters)
    const allShoppingItems = items.filter(i => i.type === 'shopping');
    
    // Apply optimistic state
    const withOptimistic = [...allShoppingItems, ...optimisticItems.filter(i => i.type === 'shopping')].map(item => ({
      ...item,
      completed: optimisticCompleted[item.id] ?? item.completed,
    }));
    
    // Filter out completed and deleting items
    let filtered = withOptimistic.filter(i => 
      !i.completed && 
      !deletingIds.has(i.id) && 
      !completingIds.has(i.id)
    );
    
    // Apply shopping mode category filter
    if (shoppingModeCategory !== 'All') {
      filtered = filtered.filter(i => i.category === shoppingModeCategory);
    }
    
    // Sort by added date (newest first)
    return filtered.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [items, optimisticItems, optimisticCompleted, deletingIds, completingIds, shoppingModeCategory]);
  
  const suggestions = useMemo(() => {
    const sectionItems = items.filter(i => i.type === activeSection);
    
    // Build a set of active item keys to exclude from suggestions
    // Shopping: name + brand + quantity + unit + category
    // Tasks: name + category
    const getItemKey = (item: ToDoItem): string => {
      if (item.type === 'shopping') {
        return `${item.name.toLowerCase()}|${(item.brand || '').toLowerCase()}|${item.quantity || ''}|${(item.unit || '').toLowerCase()}|${item.category}`;
      } else {
        return `${item.name.toLowerCase()}|${item.category}`;
      }
    };
    
    const activeKeys = new Set(
      sectionItems.filter(i => !i.completed).map(getItemKey)
    );
    
    // Get completed items that aren't currently in the active list
    const completedSuggestions = sectionItems
      .filter(item => item.completed && !activeKeys.has(getItemKey(item)))
      // Sort by completedAt DESCENDING (newest first) for deduplication
      .sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA; // Descending: newest completed first
      });
    
    // Keep only unique items (first occurrence = NEWEST completed)
    // Shopping: dedup by name + brand + quantity + unit + category
    // Tasks: dedup by name + category
    const uniqueByKey: Record<string, ToDoItem> = {};
    completedSuggestions.forEach(item => {
      const key = getItemKey(item);
      if (!uniqueByKey[key]) {
        uniqueByKey[key] = item;
      }
    });
    
    // Sort final results by completedAt ASCENDING for display (oldest left, newest right)
    return Object.values(uniqueByKey)
      .sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateA - dateB; // Ascending: oldest completed first for display
      })
      .slice(0, 8);
  }, [items, activeSection]);

  // ─────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────
  
  const getItemCount = (category: string): number => {
    const sectionItems = items.filter(i => i.type === activeSection && !i.completed);
    if (category === 'All') return sectionItems.length;
    return sectionItems.filter(i => i.category === category).length;
  };
  
  const handleInlineAdd = async () => {
    const name = inlineInputValue.trim();
    if (!name) return;
    
    const category = selectedCategory !== 'All' ? selectedCategory : defaultCategory;
    const today = getLocalDateString();
    
    // Detect language for the new item
    const detectedLang = detectInputLanguage(currentLang);
    
    const optimisticId = generateOptimisticId();
    const newItem: ToDoItem = {
      id: optimisticId,
      type: activeSection,
      name,
      category,
      completed: false,
      assigneeId: getDefaultAssignee(users, currentUser),
      createdBy: currentUser.id, // Track who created this item for notifications
      createdAt: new Date().toISOString(),
      nameLang: detectedLang || null,
      nameTranslations: {},
      ...(activeSection === 'shopping' ? { quantity: '1' } : { dueDate: today }),
    };
    
    setOptimisticItems(prev => [...prev, newItem]);
    setInlineInputValue('');
    inlineInputRef.current?.focus();
    
    try {
      await onAdd(newItem);
      // Success: clear optimistic item, real item comes from App state
      // Use functional update with the captured optimisticId to ensure we remove the correct item
      setOptimisticItems(prev => prev.filter(i => i.id !== optimisticId));
    } catch (err) {
      console.error('Failed to add item:', err);
      setOptimisticItems(prev => prev.filter(i => i.id !== optimisticId));
      setError(t['error.add_item'] || 'Failed to add item. Please try again.');
    }
  };
  
  const handleSuggestionClick = async (suggestion: ToDoItem) => {
    const today = getLocalDateString();
    
    // Detect language for the new item
    const detectedLang = detectInputLanguage(currentLang);
    
    const optimisticId = generateOptimisticId();
    const newItem: ToDoItem = {
      id: optimisticId,
      type: activeSection,
      name: suggestion.name,
      category: suggestion.category,
      completed: false,
      // Use suggestion's assignee if available, otherwise default
      assigneeId: suggestion.assigneeId || getDefaultAssignee(users, currentUser),
      createdBy: currentUser.id, // Track who created this item for notifications
      createdAt: new Date().toISOString(),
      nameLang: detectedLang || null,
      nameTranslations: {},
      // For shopping: use suggestion's brand/quantity/unit if available
      quantity: suggestion.quantity || '1',
      unit: suggestion.unit,
      brand: suggestion.brand,
      // For tasks: use today's date
      ...(activeSection === 'task' ? { dueDate: today } : {}),
    };
    
    setOptimisticItems(prev => [...prev, newItem]);
    
    try {
      await onAdd(newItem);
      // Success: clear optimistic item, real item comes from App state
      setOptimisticItems(prev => prev.filter(i => i.id !== optimisticId));
    } catch (err) {
      console.error('Failed to add item:', err);
      setOptimisticItems(prev => prev.filter(i => i.id !== optimisticId));
      setError(t['error.add_item'] || 'Failed to add item. Please try again.');
    }
  };
  
  // Track items in collapse phase (height animating to 0)
  const [collapsingIds, setCollapsingIds] = useState<Set<string>>(new Set());
  
  const handleToggleComplete = async (id: string, completed: boolean) => {
    if (completed) {
      // Haptic feedback on task completion
      haptics.success();
      
      // Phase 1: Show check + fade out (200ms)
      setCompletingIds(prev => new Set(prev).add(id));
      setOptimisticCompleted(prev => ({ ...prev, [id]: true }));
      
      // Phase 2: Start collapse (after fade, 200ms collapse)
      setTimeout(() => {
        setCollapsingIds(prev => new Set(prev).add(id));
      }, 200);
      
      // Phase 3: Remove from list (after collapse completes)
      setTimeout(() => {
        setCompletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setCollapsingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 400);
      
      try {
        await onUpdate(id, { completed: true });
      } catch (err) {
        console.error('Failed to update item:', err);
        // Rollback on error
        setCompletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setCollapsingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setOptimisticCompleted(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setError(t['error.update_item'] || 'Failed to update item. Please try again.');
      }
    } else {
      // Uncompleting: instant, no animation
      setOptimisticCompleted(prev => ({ ...prev, [id]: false }));
      
      try {
        await onUpdate(id, { completed: false });
      } catch (err) {
        console.error('Failed to update item:', err);
        setOptimisticCompleted(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setError(t['error.update_item'] || 'Failed to update item. Please try again.');
      }
    }
  };
  
  const handleDelete = async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    
    try {
      await onDelete(id);
      // Success: Keep in deletingIds briefly to prevent "ghost returns" from real-time sync
      // Real-time subscription might fire before delete propagates to DB
      setTimeout(() => {
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 1000); // Keep filtered for 1 second after delete completes
    } catch (err) {
      console.error('Failed to delete item:', err);
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setError(t['error.delete_item'] || 'Failed to delete item. Please try again.');
    }
  };
  
  const handleClearAllCompleted = () => {
    setShowClearCompletedConfirm(true);
  };
  
  const confirmClearAllCompleted = async () => {
    setShowClearCompletedConfirm(false);
    
    // Get all completed item IDs for current section
    const completedIds = completedItems.map(item => item.id);
    
    // Optimistically remove all
    completedIds.forEach(id => {
      setDeletingIds(prev => new Set(prev).add(id));
    });
    
    // Delete each item
    try {
      await Promise.all(completedIds.map(id => onDelete(id)));
    } catch (err) {
      console.error('Failed to delete some items:', err);
      // Rollback on error
      completedIds.forEach(id => {
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
      setError(t['error.delete_items'] || 'Failed to delete some items. Please try again.');
    }
  };
  
  const openDetailedSheet = () => {
    const today = getLocalDateString();
    // If user is in "All" view, don't pre-select any category
    const category = selectedCategory !== 'All' ? selectedCategory : undefined;
    
    // Carry over any text from inline input
    const nameFromInline = inlineInputValue.trim();
    
    setEditingItemId(null); // New item, not editing
    setSheetForm({
      type: activeSection,
      name: nameFromInline,
      category,
      assigneeId: getDefaultAssignee(users, currentUser),
      ...(activeSection === 'shopping' 
        ? { quantity: '1', unit: '', brand: '' }
        : { dueDate: today, dueTime: '', recurrence: { frequency: 'NONE' } }
      ),
    });
    
    // Clear inline input after carrying over to sheet
    setInlineInputValue('');
    setIsAddingInline(false);
    
    setIsSheetOpen(true);
  };
  
  // Auto-open add sheet when navigating from Dashboard (+) button
  useEffect(() => {
    if (autoOpenSheet) {
      // Small delay to ensure section is set first
      const timer = setTimeout(() => {
        openDetailedSheet();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoOpenSheet]);
  
  const openEditSheet = (item: ToDoItem) => {
    setEditingItemId(item.id);
    setSheetForm({
      type: item.type,
      name: item.name,
      category: item.category,
      assigneeId: item.assigneeId,
      quantity: item.quantity,
      unit: item.unit,
      brand: item.brand,
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      recurrence: item.recurrence,
    });
    setIsSheetOpen(true);
  };
  
  const handleSheetSave = async () => {
    if (!sheetForm.name?.trim() || isSaving) return; // Prevent double-click
    
    setIsSaving(true);
    
    if (editingItemId) {
      // Editing existing item - ALWAYS recalculate dayOfWeek/dayOfMonth from current dueDate
      const dueDate = sheetForm.dueDate ? new Date(sheetForm.dueDate + 'T00:00:00') : new Date();
      
      let recurrence = undefined;
      if (sheetForm.recurrence?.frequency && sheetForm.recurrence.frequency !== 'NONE') {
        recurrence = {
          frequency: sheetForm.recurrence.frequency,
          dayOfWeek: (sheetForm.recurrence.frequency === 'WEEKLY' || sheetForm.recurrence.frequency === 'BIWEEKLY') ? dueDate.getDay() : undefined,
          dayOfMonth: sheetForm.recurrence.frequency === 'MONTHLY' ? dueDate.getDate() : undefined,
        };
      }
      
      // Re-detect language if name changed
      const existingItem = items.find(i => i.id === editingItemId);
      const nameChanged = existingItem && existingItem.name !== sheetForm.name;
      const detectedLang = nameChanged ? detectInputLanguage(currentLang) : undefined;
      
      const updates: Partial<ToDoItem> = {
        name: sheetForm.name!,
        category: sheetForm.category,
        assigneeId: sheetForm.assigneeId,
        quantity: sheetForm.quantity || '1',
        unit: sheetForm.unit,
        brand: sheetForm.brand,
        dueDate: sheetForm.dueDate,
        dueTime: sheetForm.dueTime,
        recurrence,
        ...(nameChanged && detectedLang !== undefined ? { 
          nameLang: detectedLang || null,
          nameTranslations: {} // Reset translations when name changes
        } : {}),
      };
      
      const itemId = editingItemId; // Capture before clearing
      
      // Apply optimistic edit IMMEDIATELY for instant feedback
      setOptimisticEdits(prev => ({ ...prev, [itemId]: updates }));
      setIsSheetOpen(false);
      setEditingItemId(null);
      
      try {
        await onUpdate(itemId, updates);
        // Clear optimistic edit after success (real data now in props)
        setOptimisticEdits(prev => {
          const { [itemId]: _, ...rest } = prev;
          return rest;
        });
      } catch (err) {
        // Clear optimistic edit on failure too
        setOptimisticEdits(prev => {
          const { [itemId]: _, ...rest } = prev;
          return rest;
        });
        console.error('Failed to update item:', err);
        setError(t['error.update_item'] || 'Failed to update item. Please try again.');
      } finally {
        setIsSaving(false);
      }
    } else {
      // Adding new item
      // Detect language for the new item
      const detectedLang = detectInputLanguage(currentLang);
      
      const optimisticId = generateOptimisticId();
      const newItem: ToDoItem = {
        id: optimisticId,
        type: activeSection,
        name: sheetForm.name!,
        category: sheetForm.category || defaultCategory,
        completed: false,
        assigneeId: sheetForm.assigneeId,
        createdBy: currentUser.id, // Track who created this item for notifications
        createdAt: new Date().toISOString(),
        nameLang: detectedLang || null,
        nameTranslations: {},
        quantity: sheetForm.quantity || '1',
        unit: sheetForm.unit,
        brand: sheetForm.brand,
        dueDate: sheetForm.dueDate,
        dueTime: sheetForm.dueTime,
        recurrence: sheetForm.recurrence,
      };
      
      setOptimisticItems(prev => [...prev, newItem]);
      setIsSheetOpen(false);
      
      try {
        await onAdd(newItem);
        // Success: clear optimistic item, real item comes from App state
        setOptimisticItems(prev => prev.filter(i => i.id !== optimisticId));
      } catch (err) {
        console.error('Failed to add item:', err);
        setOptimisticItems(prev => prev.filter(i => i.id !== optimisticId));
        setError(t['error.add_item'] || 'Failed to add item. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };
  
  const getUserName = (userId?: string): string => {
    if (!userId) return '';
    if (userId === currentUser.id) return t['common.you'] || 'You';
    const user = users.find(u => u.id === userId);
    if (!user) return t['common.deleted_user'] || 'Deleted User';
    return user.name.split(' ')[0] || '';
  };

  // ─────────────────────────────────────────────────────────────────
  // Swipe Gesture Handlers
  // ─────────────────────────────────────────────────────────────────

  const handleTouchStart = (e: React.TouchEvent, itemId: string) => {
    // Don't start swipe if already completing
    if (completingIds.has(itemId)) return;
    
    setSwipeState({
      id: itemId,
      startX: e.touches[0].clientX,
      offset: 0,
      isDragging: true,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeState.isDragging || !swipeState.id) return;
    
    const delta = e.touches[0].clientX - swipeState.startX;
    // Only allow right swipe, cap at 100px
    // Allow swipe up to ~75% of card width for iOS-style feel
    const newOffset = Math.max(0, Math.min(delta, 280));
    setSwipeState(prev => ({ ...prev, offset: newOffset }));
  };

  const handleTouchEnd = (itemId: string) => {
    if (!swipeState.isDragging || swipeState.id !== itemId) return;
    
    if (swipeState.offset > 90) {
      // Threshold reached (~22-25% of card width) - complete the item
      handleToggleComplete(itemId, true);
    }
    
    // Reset swipe state
    setSwipeState({ id: null, startX: 0, offset: 0, isDragging: false });
  };

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  
  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY HEADER - Push Up (No Shrink) */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header 
          className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
          style={{ 
            height: '120px', 
            boxShadow: '0 10px 0 0 hsl(var(--background))' 
          }}
        >
          <div className="flex items-center justify-between w-full">
            <h1>
              <span className="text-primary font-bold" style={{ fontSize: '20px' }}>{t['todo.title'] || 'To Do'}</span><br />
              <span className="text-display text-foreground">{activeSection === 'shopping' ? (t['todo.shopping'] || 'Shopping') : (t['todo.tasks'] || 'Tasks')}</span>
            </h1>
            
            {/* Header Actions */}
            <div className="flex items-center gap-2 shrink-0">
            {/* Shopping Mode Button - only show when shopping section is active and has items */}
            {activeSection === 'shopping' && shoppingStats.total > 0 && (
              <button
                onClick={() => {
                  haptics.medium();
                  setShoppingModeCategory('All');
                  setIsShoppingMode(true);
                }}
                className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-caption font-semibold flex items-center gap-1.5"
              >
                <ShoppingBag size={16} />
                {t['todo.shopping_mode'] || 'Shopping Mode'}
              </button>
            )}
            
            {/* Filter/Sort Button */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={`w-9 h-9 rounded-full transition-colors relative flex items-center justify-center ${
                  isFilterDropdownOpen ? 'bg-muted' : ''
                }`}
              >
                <ArrowDownUp size={20} className="text-muted-foreground" />
                {/* Active indicator dot */}
                {(sortBy !== 'addedDate-desc' || showOnlyMine) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </button>
              
              {/* Dropdown */}
              {isFilterDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl shadow-lg overflow-hidden z-50">
                  {/* Sort Section */}
                  <div className="p-3 pb-2">
                    <p className="text-caption text-muted-foreground tracking-wide mb-2">{t['common.sort_by']}</p>
                    <div className="space-y-1">
                      {(activeSection === 'shopping' ? SHOPPING_SORT_OPTIONS : TASK_SORT_OPTIONS).map(option => {
                        const getSortLabel = (value: SortOption) => {
                          switch (value) {
                            case 'addedDate-desc': return t['common.added_date_newest'];
                            case 'addedDate-asc': return t['common.added_date_oldest'];
                            case 'dueDate-desc': return t['common.due_date_newest'];
                            case 'dueDate-asc': return t['common.due_date_oldest'];
                            default: return option.label;
                          }
                        };
                        return (
                          <button
                            key={option.value}
                            onClick={() => setSortBy(option.value as SortOption)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-body transition-colors flex items-center justify-between ${
                              sortBy === option.value
                                ? 'bg-primary/10 text-primary'
                                : 'text-foreground'
                            }`}
                          >
                            {getSortLabel(option.value)}
                            {sortBy === option.value && <Check size={16} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Separator with padding */}
                  <div className="mx-3 border-t border-border" />
                  
                  {/* Filter Section */}
                  <div className="p-3 pt-2">
                    <p className="text-caption text-muted-foreground tracking-wide mb-2">{t['common.show']}</p>
                    <button
                      onClick={() => setShowOnlyMine(!showOnlyMine)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-body transition-colors flex items-center justify-between ${
                        showOnlyMine
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <UserIcon size={16} />
                        {t['common.my_items_only']}
                      </span>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        showOnlyMine ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {showOnlyMine && <Check size={12} className="text-primary-foreground" />}
                      </div>
                    </button>
                  </div>
                  
                  {/* Reset Button */}
                  {(sortBy !== 'addedDate-desc' || showOnlyMine) && (
                    <>
                      <div className="mx-3 border-t border-border" />
                      <div className="p-3 pt-2">
                        <button
                          onClick={() => {
                            setSortBy('addedDate-desc');
                            setShowOnlyMine(false);
                          }}
                          className="w-full px-3 py-2 rounded-lg text-body text-muted-foreground text-center"
                        >
                          {t['common.reset_to_default']}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        <ErrorBanner 
          error={error} 
          onDismiss={() => setError(null)} 
          title={t['common.error'] || 'Error'}
        />

        {/* Section Toggle Cards */}
        <div className="mt-4 mb-2 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <div className="flex gap-3">
            {/* Tasks Card */}
            <button
              onClick={() => setActiveSection('task')}
              className={`flex-1 px-3 py-2.5 rounded-xl text-left transition-all ${
                activeSection === 'task'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-card text-foreground shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2">
                <ClipboardList size={16} />
                <span className="text-title">{t['todo.tasks'] || 'Tasks'}</span>
              </div>
              <div className={`text-caption mt-1 ml-6 ${activeSection === 'task' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {taskStats.total} {t['dashboard.pending'] || 'pending'}
              </div>
            </button>

            {/* Shopping Card */}
            <button
              onClick={() => setActiveSection('shopping')}
              className={`flex-1 px-3 py-2.5 rounded-xl text-left transition-all ${
                activeSection === 'shopping'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-card text-foreground shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} />
                <span className="text-title">{t['todo.shopping'] || 'Shopping'}</span>
              </div>
              <div className={`text-caption mt-1 ml-6 ${activeSection === 'shopping' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {shoppingStats.total} {t['dashboard.items_to_buy'] || 'items to buy'}
              </div>
            </button>
          </div>
        </div>

        {/* Sticky Tab Navigation */}
        {(
        <div 
          className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
          style={{ 
            top: '118px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          <div 
            className="relative rounded-full overflow-hidden"
            style={{ backgroundColor: 'hsl(var(--muted))' }}
          >
            <div className="flex p-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setSelectedCategory('All')}
                className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all ${
                  selectedCategory === 'All'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                All ({getItemCount('All')})
              </button>
              {categories.map(cat => {
                const getCategoryLabel = (category: string) => {
                  if (activeSection === 'shopping') {
                    if (category === ShoppingCategory.SUPERMARKET) return t['todo.category.supermarket'] || t['category.supermarket'] || category;
                    if (category === ShoppingCategory.WET_MARKET) return t['todo.category.wet_market'] || t['category.wet_market'] || category;
                    if (category === ShoppingCategory.OTHERS) return t['todo.category.others'] || t['category.others'] || category;
                  } else {
                    if (category === TaskCategory.HOME_CARE) return t['todo.category.home_care'] || category;
                    if (category === TaskCategory.FAMILY_CARE) return t['todo.category.family_care'] || category;
                    if (category === TaskCategory.OTHERS) return t['todo.category.others'] || category;
                  }
                  return category;
                };
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedCategory === cat
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {categoryIcons[cat]}
                    {getCategoryLabel(cat)} ({getItemCount(cat)})
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
        )}

        {/* Suggestions - Collapsible Carousel */}
        {suggestions.length > 0 && (
          <div className="mt-4 mb-2">
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:-mx-6 sm:px-6 pb-2">
              <div className="flex gap-3" style={{ paddingRight: '1rem' }}>
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSuggestionClick(s)}
                    className="relative flex-shrink-0 bg-card rounded-lg px-3 py-2 shadow-sm text-left flex"
                    style={{ width: '144px', height: '72px' }}
                  >
                      {/* Left: Text content */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        {activeSection === 'shopping' ? (
                          <>
                            {/* Shopping: Line 1 - Name */}
                            <p className="text-body text-foreground font-semibold truncate">
                              {s.name}
                            </p>
                            {/* Shopping: Line 2 - Brand */}
                            <p className="text-caption text-muted-foreground truncate">
                              {s.brand || '-'}
                            </p>
                            {/* Shopping: Line 3 - Quantity */}
                            <p className="text-caption text-muted-foreground truncate">
                              {s.quantity && s.unit ? `${s.quantity} ${s.unit}` : (s.quantity !== '1' ? s.quantity : '-')}
                            </p>
                          </>
                        ) : (
                          <>
                            {/* Tasks: Lines 1-2 - Name (2-line clamp) */}
                            <p 
                              className="text-body text-foreground font-semibold leading-tight"
                              style={{ 
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {s.name}
                            </p>
                            {/* Tasks: Line 3 - Assignee */}
                            <p className="text-caption text-muted-foreground truncate">
                              {getUserName(s.assigneeId) || '-'}
                            </p>
                          </>
                        )}
                      </div>
                      
                      {/* Right: Icons column (vertically aligned) */}
                      <div className="flex flex-col justify-between items-center shrink-0 ml-2">
                        <div className={`mt-0.5 ${getCategoryIconColor(s.category)}`}>
                          {activeSection === 'shopping' 
                            ? getShoppingCategoryIcon(s.category)
                            : getTaskCategoryIcon(s.category)
                          }
                        </div>
                        <Plus size={18} className="text-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Item List Card - Unified Card with Date-Grouped Sections */}
        {(() => {
          // For tasks, group items by date; for shopping, keep flat list
          const groupedItems = activeSection === 'task' ? groupItemsByDate(activeItems) : null;
          
          // Helper to get section label translation
          const getSectionLabel = (group: DateGroup): string => {
            switch (group) {
              case 'overdue': return t['tasks.section.overdue'] || 'Overdue';
              case 'noDate': return t['tasks.section.noDate'] || 'No Due Date';
              case 'today': return t['tasks.section.today'] || 'Today';
              case 'tomorrow': return t['tasks.section.tomorrow'] || 'Tomorrow';
              case 'thisWeek': return t['tasks.section.thisWeek'] || 'This Week';
              case 'nextWeek': return t['tasks.section.nextWeek'] || 'Next Week';
              case 'later': return t['tasks.section.later'] || 'Later';
              default: return '';
            }
          };
          
          // Helper to get section type for coloring
          const getSectionType = (group: DateGroup): 'overdue' | 'today' | 'future' => {
            if (group === 'overdue') return 'overdue';
            if (group === 'today') return 'today';
            return 'future';
          };
          
          // Render a single task item
          const renderTaskItem = (item: ToDoItem, isLastInSection: boolean) => {
            const isCompleting = completingIds.has(item.id);
            const isCollapsing = collapsingIds.has(item.id);
            const isSwiping = swipeState.id === item.id;
            const swipeOffset = isSwiping ? swipeState.offset : 0;
            const swipeThresholdReached = swipeOffset > 90;
            
            return (
              <div
                key={item.id}
                className="relative overflow-hidden"
                style={{
                  transition: isCollapsing 
                    ? 'max-height 0.2s ease-out, opacity 0.2s ease-out'
                    : undefined,
                  maxHeight: isCollapsing ? '0px' : '150px',
                }}
              >
                {/* iOS-style swipe reveal - full width background */}
                <div 
                  className="absolute inset-0 flex items-center pl-5 transition-colors duration-150"
                  style={{ 
                    backgroundColor: swipeOffset > 0 || isCompleting
                      ? (swipeThresholdReached || isCompleting
                          ? 'hsl(var(--primary))' 
                          : 'hsl(var(--primary) / 0.25)')
                      : 'transparent',
                  }}
                >
                  {(swipeOffset > 30 || isCompleting) && (
                    <div 
                      className="text-primary-foreground transition-all duration-150"
                      style={{ 
                        transform: swipeThresholdReached || isCompleting ? 'scale(1.1)' : 'scale(1)',
                        opacity: isCompleting ? 1 : Math.min(swipeOffset / 50, 1),
                      }}
                    >
                      <Check size={22} strokeWidth={3} />
                    </div>
                  )}
                </div>
                
                {/* Item card - iOS style slide as one unit */}
                <div
                  className="flex items-start gap-3 p-4 bg-card cursor-pointer relative"
                  style={{
                    transition: isSwiping 
                      ? 'none' 
                      : isCompleting 
                        ? 'opacity 0.2s ease-out, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    opacity: isCompleting ? 0 : 1,
                    transform: isCompleting && !isCollapsing 
                      ? 'translateX(100%)' 
                      : `translateX(${swipeOffset}px)`,
                    boxShadow: swipeOffset > 10 
                      ? `0 2px 12px rgba(0, 0, 0, ${Math.min(swipeOffset / 150, 0.12)})` 
                      : 'none',
                  }}
                  onTouchStart={(e) => handleTouchStart(e, item.id)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={() => handleTouchEnd(item.id)}
                  onClick={() => !isCompleting && !isSwiping && openEditSheet(item)}
                >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                      !isCompleting && handleToggleComplete(item.id, true);
                    }}
                    className="mt-0.5 shrink-0 transition-all"
                  >
                    {isCompleting ? (
                      <div className="w-[22px] h-[22px] rounded-full bg-primary flex items-center justify-center">
                        <Check size={14} className="text-primary-foreground" strokeWidth={3} />
                      </div>
                    ) : (
                      <Circle size={22} className="text-muted-foreground/50" />
                    )}
              </button>
                  
                  <div className="flex-1 min-w-0">
                    {/* Task name */}
                    <div className="flex items-center">
                      <span className={`text-body ${isCompleting ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        <TranslatedItemName item={item} currentLang={currentLang} onUpdate={onUpdate} />
                      </span>
            </div>
                    
                    {/* Date info */}
                    {item.dueDate && (
                      <div className="flex items-center gap-1 mt-1 text-caption text-muted-foreground">
                        <Calendar size={11} />
                        {formatDateTime(item.dueDate, item.dueTime)}
          </div>
                    )}
                    
                    {/* Recurrence info */}
                    {item.recurrence && item.recurrence.frequency !== 'NONE' && (
                      <div className="flex items-center gap-1 mt-1 text-caption text-primary">
                        <Repeat size={12} />
                        {formatRecurrence(item.recurrence)}
                      </div>
                    )}
                  </div>
                  
                  {/* Right side: Assignee name + Category icon */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {item.assigneeId && (
                      <span className="text-caption text-muted-foreground">
                        {getUserName(item.assigneeId)}
                      </span>
                    )}
                    {/* Category icon */}
                    {item.category === TaskCategory.HOME_CARE ? (
                      <Home size={16} className="text-[#FF9800]" />
                    ) : item.category === TaskCategory.FAMILY_CARE ? (
                      <HandHeart size={16} className="text-[#F06292]" />
                    ) : (
                      <Stone size={16} className="text-muted-foreground" />
                    )}
                  </div>
                </div>
                
                {/* Bottom separator - only show if not last in section */}
                {!isLastInSection && !isCollapsing && (
                  <div 
                    className="absolute bottom-0 h-px bg-border" 
                    style={{ left: '1rem', right: '1rem' }}
                  />
                )}
              </div>
            );
          };
          
          // Render a shopping item (same as before, with category badge)
          const renderShoppingItem = (item: ToDoItem, index: number, total: number) => {
            const isCompleting = completingIds.has(item.id);
            const isCollapsing = collapsingIds.has(item.id);
            const isSwiping = swipeState.id === item.id;
            const swipeOffset = isSwiping ? swipeState.offset : 0;
            const swipeThresholdReached = swipeOffset > 90;
            const isLast = index === total - 1;
            
            return (
              <div
                key={item.id}
                className={`relative ${
                  !isLast && !isCollapsing ? 'list-item-separator' : ''
                } overflow-hidden`}
                style={{
                  transition: isCollapsing 
                    ? 'max-height 0.2s ease-out, opacity 0.2s ease-out'
                    : undefined,
                  maxHeight: isCollapsing ? '0px' : '150px',
                }}
              >
                {/* iOS-style swipe reveal */}
                <div 
                  className="absolute inset-0 flex items-center pl-5 transition-colors duration-150"
                  style={{ 
                    backgroundColor: swipeOffset > 0 || isCompleting
                      ? (swipeThresholdReached || isCompleting
                          ? 'hsl(var(--primary))' 
                          : 'hsl(var(--primary) / 0.25)')
                      : 'transparent',
                  }}
                >
                  {(swipeOffset > 30 || isCompleting) && (
                    <div 
                      className="text-primary-foreground transition-all duration-150"
                      style={{ 
                        transform: swipeThresholdReached || isCompleting ? 'scale(1.1)' : 'scale(1)',
                        opacity: isCompleting ? 1 : Math.min(swipeOffset / 50, 1),
                      }}
                    >
                      <Check size={22} strokeWidth={3} />
                    </div>
                  )}
                </div>
                
                {/* Item card */}
                <div
                  className="flex items-start gap-3 p-4 bg-card cursor-pointer relative"
                  style={{
                    transition: isSwiping 
                      ? 'none' 
                      : isCompleting 
                        ? 'opacity 0.2s ease-out, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    opacity: isCompleting ? 0 : 1,
                    transform: isCompleting && !isCollapsing 
                      ? 'translateX(100%)' 
                      : `translateX(${swipeOffset}px)`,
                    boxShadow: swipeOffset > 10 
                      ? `0 2px 12px rgba(0, 0, 0, ${Math.min(swipeOffset / 150, 0.12)})` 
                      : 'none',
                  }}
                  onTouchStart={(e) => handleTouchStart(e, item.id)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={() => handleTouchEnd(item.id)}
                  onClick={() => !isCompleting && !isSwiping && openEditSheet(item)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      !isCompleting && handleToggleComplete(item.id, true);
                    }}
                    className="mt-0.5 shrink-0 transition-all"
                  >
                    {isCompleting ? (
                      <div className="w-[22px] h-[22px] rounded-full bg-primary flex items-center justify-center">
                        <Check size={14} className="text-primary-foreground" strokeWidth={3} />
                      </div>
                    ) : (
                      <Circle size={22} className="text-muted-foreground/50" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    {/* Item name with brand and quantity */}
                    <div className="flex items-center">
                      <span className={`text-body ${isCompleting ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        <TranslatedItemName item={item} currentLang={currentLang} onUpdate={onUpdate} />
                        {item.brand && (
                          <span className="text-muted-foreground font-normal">
                            {' ('}{item.brand}{')'}
                          </span>
                        )}
                        {item.quantity && (item.quantity !== '1' || item.unit) && (
                          <span className="text-muted-foreground font-normal">
                            {' · '}{item.quantity}{item.unit ? ` ${item.unit}` : ''}
                          </span>
                        )}
                      </span>
                    </div>
                    </div>
                    
                  {/* Right side: Assignee name + Category icon */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {item.assigneeId && (
                      <span className="text-caption text-muted-foreground">
                        {getUserName(item.assigneeId)}
                        </span>
                      )}
                    {/* Category icon */}
                    {item.category === ShoppingCategory.SUPERMARKET ? (
                      <ShoppingCart size={16} className="text-[#3EAFD2]" />
                    ) : item.category === ShoppingCategory.WET_MARKET ? (
                      <Home size={16} className="text-[#4CAF50]" />
                    ) : (
                      <Stone size={16} className="text-muted-foreground" />
                    )}
                    </div>
                      </div>
                  </div>
            );
          };
          
          return (
            <div className="mt-4 bg-card rounded-2xl shadow-sm overflow-hidden">
              {/* Add Input Row (hero - always first) */}
              <div className="relative">
                <div
                  className={`flex items-center gap-3 p-4 bg-card ${!isAddingInline ? 'cursor-pointer' : ''}`}
                  onClick={() => !isAddingInline && setIsAddingInline(true)}
                >
                  <div className="text-muted-foreground/50 shrink-0">
                    <Circle size={22} />
                  </div>
                  
                  <div className="flex-1 flex items-center gap-2 min-h-[28px]">
                    {isAddingInline ? (
                      <input
                        ref={inlineInputRef}
                        type="text"
                        autoComplete="one-time-code"
                        value={inlineInputValue}
                        onChange={e => setInlineInputValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleInlineAdd();
                          } else if (e.key === 'Escape') {
                            setIsAddingInline(false);
                            setInlineInputValue('');
                          }
                        }}
                        onBlur={() => {
                          if (!inlineInputValue.trim()) {
                            setIsAddingInline(false);
                          }
                        }}
                        placeholder={t['todo.add_hint'] || 'Press Enter to add | tap + to set details'}
                        className="flex-1 bg-transparent text-body text-foreground placeholder-muted-foreground/50 outline-none"
                      />
                    ) : (
                      <span className="flex-1 text-body text-muted-foreground">
                        {activeSection === 'shopping' ? (t['todo.add_item'] || 'Add item...') : (t['todo.add_task'] || 'Add task...')}
                    </span>
                  )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetailedSheet();
                      }}
                      className="p-1.5 rounded-full bg-primary text-primary-foreground shrink-0"
                      title={t['common.add_with_details'] || 'Add with details'}
                    >
                      <Plus size={16} />
                    </button>
                </div>
              </div>
                {/* Bottom line - 1rem inset to match list items */}
                <div 
                  className="absolute bottom-0 h-px bg-border" 
                  style={{ left: '1rem', right: '1rem' }}
                />
              </div>
              
              {/* Tasks: Date-grouped sections */}
              {activeSection === 'task' && groupedItems && (
                <>
                  {DATE_GROUP_ORDER.map(group => {
                    const items = groupedItems[group];
                    if (items.length === 0) return null;
                    
                    return (
                      <React.Fragment key={group}>
                        <SectionDivider 
                          label={getSectionLabel(group)} 
                          type={getSectionType(group)} 
                        />
                        {items.map((item, index) => 
                          renderTaskItem(item, index === items.length - 1)
                        )}
                      </React.Fragment>
            );
          })}
                </>
              )}
              
              {/* Shopping: Flat list */}
              {activeSection === 'shopping' && (
                <>
                  {activeItems.map((item, index) => 
                    renderShoppingItem(item, index, activeItems.length)
                  )}
                </>
              )}
          
          {/* Empty State */}
          {activeItems.length === 0 && !isAddingInline && (
            <div className="p-8 text-center">
              <p className="text-body text-foreground">
                {activeSection === 'shopping' 
                  ? (t['todo.no_shopping'] || 'No shopping items yet')
                  : (t['todo.no_tasks'] || 'No tasks yet')
                }
              </p>
              <p className="text-caption text-muted-foreground mt-1">{t['todo.tap_to_add'] || 'Tap above to add one'}</p>
            </div>
          )}
        </div>
          );
        })()}

        {/* Completed Section */}
        {completedItems.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2 px-2">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2"
              >
                {showCompleted ? (
                  <ChevronDown size={16} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={16} className="text-muted-foreground" />
                )}
                <span className="text-body text-muted-foreground">
                  {t['todo.completed'] || 'Completed'} ({completedItems.length})
                </span>
              </button>
              
              {/* Clear All Button - Hidden for Helper */}
                              {showCompleted && !isHelper && (
                <button
                  onClick={handleClearAllCompleted}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-caption text-destructive rounded-lg"
                >
                  <Trash2 size={14} />
                  {t['todo.clear_all'] || 'Clear All'}
                </button>
              )}
            </div>
            
            {showCompleted && (
              <div className="bg-muted/50 rounded-xl overflow-hidden border border-border">
                {completedItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-4 ${
                      index !== completedItems.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <button
                      onClick={() => handleToggleComplete(item.id, false)}
                      className="shrink-0"
                    >
                      <div className="w-[22px] h-[22px] rounded-full bg-primary flex items-center justify-center">
                        <Check size={14} className="text-primary-foreground" strokeWidth={3} />
                      </div>
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <span className="text-body text-muted-foreground line-through">
                        <TranslatedItemName item={item} currentLang={currentLang} onUpdate={onUpdate} />
                      </span>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-micro opacity-50 ${getCategoryBadgeStyle(item.category)}`}>
                        {item.category}
                      </span>
                    </div>
                    
                    {/* Delete button - Hidden for Helper */}
                    {!isHelper && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-muted-foreground shrink-0"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="helpy-footer">
          <span className="helpy-logo">helpy</span>
        </div>
      </div>

      {/* Detailed Sheet Overlay */}
      {isSheetOpen && createPortal(
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover - fills the gap below the sheet */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div 
            className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col"
            style={{ maxHeight: 'calc(100dvh - 60px)', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setIsSheetOpen(false);
                setEditingItemId(null);
              }}
              className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center right-4 top-4 text-muted-foreground"
              aria-label={t['common.close'] || 'Close'}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <h2 className="text-title text-foreground">
                {editingItemId 
                  ? (sheetForm.type === 'shopping' 
                      ? (t['todo.edit_shopping_item'] || 'Edit Shopping Item') 
                      : (t['todo.edit_task'] || 'Edit Task'))
                  : (activeSection === 'shopping' 
                      ? (t['todo.add_shopping_item'] || 'Add Shopping Item') 
                      : (t['common.add_task'] || 'Add Task'))
                }
              </h2>
            </div>
            
            {/* Scrollable Form Content */}
            <div ref={sheetContentRef} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Name & Brand Row - 50/50 for Shopping, full width for Tasks */}
              <div className={activeSection === 'shopping' ? 'flex gap-3' : ''}>
                <div className={activeSection === 'shopping' ? 'flex-1' : 'w-full'}>
                  <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                    {activeSection === 'shopping' ? t['common.item_name'] : t['common.task_name']}
                  </label>
                  <input
                    type="text"
                    autoComplete="one-time-code"
                    value={sheetForm.name || ''}
                    onChange={e => setSheetForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={activeSection === 'shopping' ? t['common.eg_milk'] : t['common.eg_clean_bathroom']}
                    className="w-full px-4 py-3 bg-muted rounded-xl text-body text-foreground placeholder-muted-foreground outline-none border border-transparent focus:border-primary transition-colors"
                  />
                </div>
                
                {/* Brand - Shopping only, 50% width */}
                {activeSection === 'shopping' && (
                  <div className="flex-1">
                    <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                      {t['common.brand'] || 'Brand'}
                    </label>
                    <input
                      type="text"
                      autoComplete="one-time-code"
                      value={sheetForm.brand || ''}
                      onChange={e => setSheetForm(prev => ({ ...prev, brand: e.target.value }))}
                      placeholder={t['common.brand_placeholder'] || 'Your favorite brand'}
                      className="w-full px-4 py-3 bg-muted rounded-xl text-body text-foreground placeholder-muted-foreground outline-none border border-transparent focus:border-primary transition-colors"
                    />
                  </div>
                )}
              </div>
              
              {/* Shopping-specific fields */}
              {activeSection === 'shopping' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                      {t['common.qty']}
                    </label>
                    <input
                      type="text"
                      autoComplete="one-time-code"
                      inputMode="decimal"
                      value={sheetForm.quantity ?? ''}
                      onChange={e => {
                        // Allow digits, decimal point, and fractions like 1/2
                        const value = e.target.value.replace(/[^\d./]/g, '');
                        setSheetForm(prev => ({ ...prev, quantity: value }));
                      }}
                      onFocus={e => e.target.select()}
                      placeholder={t['common.qty']}
                      className="w-full px-4 py-3 bg-muted rounded-xl text-body text-foreground outline-none border border-transparent focus:border-primary transition-colors placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                      {t['common.unit']}
                    </label>
                    <input
                      ref={unitInputRef}
                      type="text"
                      autoComplete="one-time-code"
                      value={sheetForm.unit || ''}
                      onChange={e => {
                        setSheetForm(prev => ({ ...prev, unit: e.target.value }));
                        setShowUnitSuggestions(true);
                      }}
                      onFocus={() => setShowUnitSuggestions(true)}
                      onBlur={() => {
                        // Delay to allow click on suggestion
                        setTimeout(() => setShowUnitSuggestions(false), 150);
                      }}
                      placeholder={t['common.unit_placeholder']}
                      className="w-full px-4 py-3 bg-muted rounded-xl text-body text-foreground placeholder-muted-foreground outline-none border border-transparent focus:border-primary transition-colors"
                    />
                    
                    {/* Unit suggestions dropdown */}
                    {showUnitSuggestions && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-card rounded-xl shadow-md border border-border max-h-48 overflow-y-auto z-30">
                        {UNIT_SUGGESTIONS
                          .filter(unit => 
                            !sheetForm.unit || 
                            unit.toLowerCase().includes((sheetForm.unit || '').toLowerCase())
                          )
                          .map(unit => (
                            <button
                              key={unit}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                setSheetForm(prev => ({ ...prev, unit }));
                                setShowUnitSuggestions(false);
                                unitInputRef.current?.blur();
                              }}
                              className="w-full px-4 py-2.5 text-left text-body text-foreground transition-colors first:rounded-t-xl last:rounded-b-xl"
                            >
                              {unit}
                            </button>
                          ))
                        }
                        {sheetForm.unit && 
                          !UNIT_SUGGESTIONS.some(u => u.toLowerCase() === (sheetForm.unit || '').toLowerCase()) && 
                          UNIT_SUGGESTIONS.filter(u => u.toLowerCase().includes((sheetForm.unit || '').toLowerCase())).length === 0 && (
                          <div className="px-4 py-2.5 text-caption text-muted-foreground">
                            {t['common.use_custom'] || 'Use'} "{sheetForm.unit}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Task-specific fields */}
              {activeSection === 'task' && (
                <>
                  <div>
                    <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                      {t['todo.due_date_time'] || 'Due Date & Time'}
                    </label>
                    {/* Date/time picker - native input as clickable overlay */}
                    <div className="relative">
                      {/* Visual display layer (underneath, for display only) */}
                      <div 
                        className="w-full px-4 py-3 bg-muted rounded-xl text-body border border-transparent flex items-center justify-between"
                      >
                        <span className={sheetForm.dueDate ? 'text-foreground' : 'text-muted-foreground'}>
                          {sheetForm.dueDate 
                            ? formatDateTime(sheetForm.dueDate, sheetForm.dueTime || '09:00')
                            : (t['todo.select_date_time'] || 'Select date & time')
                          }
                        </span>
                        <Calendar size={18} className="text-muted-foreground" />
                      </div>
                      {/* Native input as clickable overlay - taps go directly to this */}
                      <input
                        id="due-date-picker"
                        type="datetime-local"
                        value={sheetForm.dueDate && sheetForm.dueTime 
                          ? `${sheetForm.dueDate}T${sheetForm.dueTime}`
                          : sheetForm.dueDate 
                            ? `${sheetForm.dueDate}T09:00`
                            : ''
                        }
                        onChange={e => {
                          const [date, time] = e.target.value.split('T');
                          setSheetForm(prev => ({ ...prev, dueDate: date, dueTime: time }));
                        }}
                        className="absolute inset-0 w-full h-full opacity-0"
                        style={{ WebkitAppearance: 'none' }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                      {t['todo.repeat'] || 'Repeat'}
                    </label>
                    <select
                      value={sheetForm.recurrence?.frequency || 'NONE'}
                      onChange={e => {
                        const frequency = e.target.value as RecurrenceFrequency;
                        // Use T00:00:00 to parse as local time, not UTC
                        const dueDate = sheetForm.dueDate ? new Date(sheetForm.dueDate + 'T00:00:00') : new Date();
                        setSheetForm(prev => ({
                          ...prev,
                          recurrence: {
                            frequency,
                            dayOfWeek: (frequency === 'WEEKLY' || frequency === 'BIWEEKLY') ? dueDate.getDay() : undefined,
                            dayOfMonth: frequency === 'MONTHLY' ? dueDate.getDate() : undefined,
                          },
                        }));
                      }}
                      className="w-full px-4 py-3 bg-muted rounded-xl text-body text-foreground outline-none border border-transparent focus:border-primary transition-colors"
                    >
                      {RECURRENCE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {t[opt.labelKey] || opt.value}
                          {opt.value === 'WEEKLY' && sheetForm.dueDate && 
                            ` (${DAYS_OF_WEEK[new Date(sheetForm.dueDate + 'T00:00:00').getDay()]}s)`}
                          {opt.value === 'BIWEEKLY' && sheetForm.dueDate && 
                            ` (${DAYS_OF_WEEK[new Date(sheetForm.dueDate + 'T00:00:00').getDay()]}s)`}
                          {opt.value === 'MONTHLY' && sheetForm.dueDate && 
                            ` (${new Date(sheetForm.dueDate + 'T00:00:00').getDate()}${
                              ['st','nd','rd'][((new Date(sheetForm.dueDate + 'T00:00:00').getDate() + 90) % 100 - 10) % 10 - 1] || 'th'
                            })`}
                        </option>
                      ))}
                    </select>
                    {sheetForm.recurrence?.frequency && sheetForm.recurrence.frequency !== 'NONE' && (
                      <p className="mt-2 text-caption text-primary flex items-center gap-1">
                        <Repeat size={12} />
                        {formatRecurrence(sheetForm.recurrence)}
                      </p>
                    )}
                  </div>
                </>
              )}
              
              {/* Category Selection */}
              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                  {t['common.category'] || 'Category'}
                </label>
                <div className="flex gap-2">
                  {categories.map(cat => {
                    const getCatLabel = (category: string): string => {
                      if (activeSection === 'shopping') {
                        if (category === ShoppingCategory.SUPERMARKET) return t['todo.category.supermarket'] || category;
                        if (category === ShoppingCategory.WET_MARKET) return t['todo.category.wet_market'] || category;
                        if (category === ShoppingCategory.OTHERS) return t['todo.category.others'] || category;
                      } else {
                        if (category === TaskCategory.HOME_CARE) return t['todo.category.home_care'] || category;
                        if (category === TaskCategory.FAMILY_CARE) return t['todo.category.family_care'] || category;
                        if (category === TaskCategory.OTHERS) return t['todo.category.others'] || category;
                      }
                      return category;
                    };
                    return (
                      <button
                        key={cat}
                        onClick={() => setSheetForm(prev => ({ ...prev, category: cat }))}
                        className={`flex-1 px-2 py-2 rounded-xl text-sm transition-all flex items-center justify-center gap-1 ${
                          sheetForm.category === cat
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-foreground ring-1 ring-border'
                        }`}
                      >
                        {getCategoryIcon(cat, sheetForm.category === cat)}
                        <span className="truncate">{getCatLabel(cat)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Assignee Selection */}
              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                  {t['todo.assign_to'] || 'Assign to'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {getSortedUsersForAssignment(users, currentUser).map(user => (
                    <button
                      key={user.id}
                      onClick={() => setSheetForm(prev => ({ ...prev, assigneeId: user.id }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-body transition-all ${
                        sheetForm.assigneeId === user.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-foreground ring-1 ring-border'
                      }`}
                    >
                      <Avatar
                        user={user}
                        size="xs"
                      />
                      <span>{user.id === currentUser.id ? (t['todo.you'] || 'You') : user.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Fixed Footer with Delete + Save */}
            <div className="shrink-0 p-5 pb-8 border-t border-border flex gap-3">
              {/* Delete button - Hidden for Helper */}
              {editingItemId && !isHelper && (
                <button
                  onClick={async () => {
                    const itemId = editingItemId;
                    setIsSheetOpen(false);
                    setEditingItemId(null);
                    await handleDelete(itemId);
                  }}
                  className="p-3 rounded-xl bg-destructive/10 text-destructive"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button
                onClick={handleSheetSave}
                disabled={!sheetForm.name?.trim() || isSaving}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Check size={18} />
                )}
                {editingItemId 
                  ? (t['common.update'] || 'Update')
                  : (activeSection === 'shopping' ? (t['common.add_item'] || 'Add Item') : (t['common.add_task'] || 'Add Task'))
                }
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Shopping Mode Full-Screen Overlay */}
      {isShoppingMode && createPortal(
        <div className="fixed inset-0 bg-background z-[9999] flex flex-col">
          {/* Header */}
          <div className="shrink-0 px-5 pt-safe-top pb-4 bg-background transition-shadow duration-200" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)', boxShadow: shoppingModeScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none' }}>
            <div>
              <h1 className="text-display text-foreground">{t['todo.shopping_mode'] || 'Shopping Mode'}</h1>
              <p className="text-caption text-muted-foreground mt-1">
                {t['todo.shopping_mode_hint'] || 'Tap or swipe to complete. Editing is disabled.'}
              </p>
            </div>
            
            {/* Category Filter Tabs */}
            <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
              {['All', ShoppingCategory.SUPERMARKET, ShoppingCategory.WET_MARKET].map((cat) => {
                const isActive = shoppingModeCategory === cat;
                const label = cat === 'All' 
                  ? (t['common.all'] || 'All')
                  : cat === ShoppingCategory.SUPERMARKET 
                    ? (t['todo.category.supermarket'] || 'Supermarket')
                    : (t['todo.category.wet_market'] || 'Wet Market');
                const count = cat === 'All'
                  ? items.filter(i => i.type === 'shopping' && !i.completed && !deletingIds.has(i.id) && !completingIds.has(i.id)).length
                  : items.filter(i => i.type === 'shopping' && !i.completed && i.category === cat && !deletingIds.has(i.id) && !completingIds.has(i.id)).length;
                
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      haptics.selection();
                      setShoppingModeCategory(cat);
                    }}
                    className={`px-4 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-foreground'
                    }`}
                    style={{ fontSize: '16px' }}
                  >
                    {cat === ShoppingCategory.SUPERMARKET && <ShoppingCart size={18} />}
                    {cat === ShoppingCategory.WET_MARKET && <Home size={18} />}
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Items List */}
          <div 
            className="flex-1 overflow-y-auto"
            onScroll={(e) => {
              const scrollTop = (e.target as HTMLDivElement).scrollTop;
              setShoppingModeScrolled(scrollTop > 0);
            }}
          >
            {shoppingModeItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <ShoppingCart size={64} className="text-muted-foreground/20 mb-4" />
                <p className="text-title text-muted-foreground">
                  {shoppingModeCategory === 'All' 
                    ? (t['todo.shopping_list_empty'] || 'Shopping list is empty')
                    : (t['todo.no_items_in_category'] || 'No items in this category')
                  }
                </p>
                <p className="text-body text-muted-foreground/70 mt-2">
                  {t['todo.add_items_first'] || 'Add items to your shopping list first'}
                </p>
              </div>
            ) : (
              <div className="bg-card">
                {shoppingModeItems.map((item, index) => {
                  const isCompleting = completingIds.has(item.id);
                  const isCollapsing = collapsingIds.has(item.id);
                  const isSwiping = swipeState.id === item.id;
                  const swipeOffset = isSwiping ? swipeState.offset : 0;
                  const swipeThresholdReached = swipeOffset > 90;
                  const isLast = index === shoppingModeItems.length - 1;
                  
                  return (
                    <div
                      key={item.id}
                      className={`relative ${!isLast && !isCollapsing ? 'list-item-separator' : ''} overflow-hidden`}
                      style={{
                        transition: isCollapsing 
                          ? 'max-height 0.2s ease-out, opacity 0.2s ease-out'
                          : undefined,
                        maxHeight: isCollapsing ? '0px' : '200px',
                      }}
                    >
                      {/* iOS-style swipe reveal */}
                      <div 
                        className="absolute inset-0 flex items-center pl-6 transition-colors duration-150"
                        style={{ 
                          backgroundColor: swipeOffset > 0 || isCompleting
                            ? (swipeThresholdReached || isCompleting
                                ? 'hsl(var(--primary))' 
                                : 'hsl(var(--primary) / 0.25)')
                            : 'transparent',
                        }}
                      >
                        {(swipeOffset > 30 || isCompleting) && (
                          <div 
                            className="text-primary-foreground transition-all duration-150"
                            style={{ 
                              transform: swipeThresholdReached || isCompleting ? 'scale(1.2)' : 'scale(1)',
                              opacity: isCompleting ? 1 : Math.min(swipeOffset / 50, 1),
                            }}
                          >
                            <Check size={28} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      
                      {/* Item card */}
                      <div
                        className="flex items-center gap-4 px-5 py-5 bg-card relative"
                        style={{
                          transition: isSwiping 
                            ? 'none' 
                            : isCompleting 
                              ? 'opacity 0.2s ease-out, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                              : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                          opacity: isCompleting ? 0 : 1,
                          transform: isCompleting && !isCollapsing 
                            ? 'translateX(100%)' 
                            : `translateX(${swipeOffset}px)`,
                          boxShadow: swipeOffset > 10 
                            ? `0 2px 12px rgba(0, 0, 0, ${Math.min(swipeOffset / 150, 0.12)})` 
                            : 'none',
                        }}
                        onTouchStart={(e) => handleTouchStart(e, item.id)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={() => handleTouchEnd(item.id)}
                      >
                        {/* Checkbox - tap area for completing */}
                        <button
                          onClick={() => {
                            if (!isCompleting) {
                              handleToggleComplete(item.id, true);
                            }
                          }}
                          className="shrink-0 w-12 h-12 flex items-center justify-center -ml-2"
                        >
                          {isCompleting ? (
                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                              <Check size={18} className="text-primary-foreground" strokeWidth={3} />
                            </div>
                          ) : (
                            <Circle size={28} className="text-muted-foreground/40" />
                          )}
                        </button>
                        
                        {/* Item content - Large font */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium ${isCompleting ? 'text-muted-foreground line-through' : 'text-foreground'}`} style={{ fontSize: '20px', lineHeight: '1.3' }}>
                            <TranslatedItemName item={item} currentLang={currentLang} onUpdate={onUpdate} />
                            {item.brand && (
                              <span className="text-muted-foreground font-normal" style={{ fontSize: '16px' }}>
                                {' ('}{item.brand}{')'}
                              </span>
                            )}
                          </div>
                          {/* Quantity info */}
                          {item.quantity && (item.quantity !== '1' || item.unit) && (
                            <div className="text-muted-foreground mt-1" style={{ fontSize: '16px' }}>
                              {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                            </div>
                          )}
                        </div>
                        
                        {/* Category icon */}
                        <div className="shrink-0">
                          {item.category === ShoppingCategory.SUPERMARKET ? (
                            <ShoppingCart size={20} className="text-[#3EAFD2]" />
                          ) : item.category === ShoppingCategory.WET_MARKET ? (
                            <Home size={20} className="text-[#4CAF50]" />
                          ) : (
                            <Stone size={20} className="text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Footer with item count */}
          <div className="shrink-0 px-5 py-4 bg-primary" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
            <div className="flex items-center justify-between">
              <span className="text-body text-primary-foreground">
                {shoppingModeItems.length} {shoppingModeItems.length === 1 
                  ? (t['todo.item_remaining'] || 'item remaining')
                  : (t['todo.items_remaining'] || 'items remaining')
                }
              </span>
              <button
                onClick={() => {
                  haptics.light();
                  setIsShoppingMode(false);
                  setShoppingModeCategory('All');
                  setShoppingModeScrolled(false);
                }}
                className="px-4 py-2.5 rounded-xl bg-white text-primary text-body font-semibold"
              >
                {t['todo.done_shopping'] || 'Done Shopping'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Clear Completed Confirmation Modal */}
      {showClearCompletedConfirm && createPortal(
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <h2 className="text-title text-foreground">{t['todo.clear_completed_title'] || 'Clear Completed Items'}</h2>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-body text-muted-foreground">
                {t['confirm.clear_completed'] || 'Delete all completed items? This action cannot be undone.'}
              </p>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
              <button
                onClick={() => setShowClearCompletedConfirm(false)}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={confirmClearAllCompleted}
                className="flex-1 py-3.5 rounded-xl bg-destructive/10 text-destructive text-body"
              >
                {t['common.clear_all'] || 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default ToDo;
