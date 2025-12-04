import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Circle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Calendar,
  User as UserIcon,
  Repeat,
  ShoppingCart,
  ClipboardList,
  Trash2,
  Home,
  Users,
  MoreHorizontal,
  SlidersHorizontal,
  ArrowUpDown,
} from 'lucide-react';
import { useScrollHeader } from '@/hooks/useScrollHeader';
import { useTranslatedContent } from '@/hooks/useTranslatedContent';
import { useScrollLock } from '@/hooks/useScrollLock';
import { ToDoItem, ToDoType, ShoppingCategory, TaskCategory, RecurrenceFrequency, User, UserRole, BaseViewProps } from '../types';
import { detectInputLanguage } from '../services/languageDetectionService';

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
}

const SHOPPING_CATEGORIES = Object.values(ShoppingCategory);
const TASK_CATEGORIES = Object.values(TaskCategory);

const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
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
const SHOPPING_CATEGORY_ICONS: Record<string, React.ReactNode> = {
  [ShoppingCategory.SUPERMARKET]: <ShoppingCart size={16} />,
  [ShoppingCategory.WET_MARKET]: <Home size={16} />,
  [ShoppingCategory.OTHERS]: <MoreHorizontal size={16} />,
};

const TASK_CATEGORY_ICONS: Record<string, React.ReactNode> = {
  [TaskCategory.HOME_CARE]: <Home size={16} />,
  [TaskCategory.FAMILY_CARE]: <Users size={16} />,
  [TaskCategory.OTHERS]: <MoreHorizontal size={16} />,
};

// ─────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────

const getDefaultAssignee = (users: User[], currentUser: User): string => {
  const helper = users.find(u => u.role === UserRole.HELPER);
  return helper?.id || currentUser.id;
};

// Returns badge styling for category (background + text color)
// Colors based on brand palette: #3EAFD2, #FF9800, #7E57C2, #4CAF50, #F06292, #AB47BC, #757575
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
      return 'bg-[#F5F5F5] text-[#757575]'; // Gray
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
      return 'bg-[#F5F5F5] text-[#757575] border-[#757575]/40'; // Gray
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
    // Format: 18:05 (24h)
    dateStr += `, ${dueTime}`;
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
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Scroll Header Hook
  // ─────────────────────────────────────────────────────────────────
  const { isScrolled } = useScrollHeader();

  // ─────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────
  
  const [activeSection, setActiveSection] = useState<ToDoType>(initialSection || 'shopping');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // Lock body scroll when sheet is open
  useScrollLock(isSheetOpen);
  
  const [sheetForm, setSheetForm] = useState<Partial<ToDoItem>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null); // Track if editing existing item
  const [showCompleted, setShowCompleted] = useState(false);
  const [showSuggested, setShowSuggested] = useState(true);
  const [optimisticItems, setOptimisticItems] = useState<ToDoItem[]>([]);
  const [optimisticCompleted, setOptimisticCompleted] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  
  // Track items animating to completed (iOS-style delayed move)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  
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
  const categoryIcons = activeSection === 'shopping' ? SHOPPING_CATEGORY_ICONS : TASK_CATEGORY_ICONS;
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
    
    const optimisticFiltered = optimisticItems.filter(opt =>
      opt.type === activeSection &&
      !sectionItems.some(real =>
        real.name.trim().toLowerCase() === opt.name.trim().toLowerCase() &&
        real.category === opt.category
      )
    );
    
    const merged = [...sectionItems, ...optimisticFiltered].map(item => ({
      ...item,
      completed: optimisticCompleted[item.id] ?? item.completed,
    }));
    
    let filtered = merged;
    
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
  }, [items, optimisticItems, activeSection, selectedCategory, optimisticCompleted, deletingIds, sortBy, showOnlyMine, currentUser.id]);
  
  // Items completing stay in active list during animation, then move to completed
  const activeItems = mergedItems.filter(i => !i.completed || completingIds.has(i.id));
  const completedItems = mergedItems.filter(i => i.completed && !completingIds.has(i.id));
  
  const suggestions = useMemo(() => {
    const sectionItems = items.filter(i => i.type === activeSection);
    const activeNames = new Set(sectionItems.filter(i => !i.completed).map(i => i.name.toLowerCase()));
    
    const counts: Record<string, { name: string; category: string; count: number }> = {};
    sectionItems.forEach(item => {
      const key = item.name.toLowerCase();
      if (!activeNames.has(key)) {
        if (!counts[key]) {
          counts[key] = { name: item.name, category: item.category, count: 0 };
        }
        counts[key].count++;
      }
    });
    
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
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
    const today = new Date().toISOString().split('T')[0];
    
    // Detect language for the new item
    const detectedLang = detectInputLanguage(currentLang);
    
    const newItem: ToDoItem = {
      id: `temp-${Date.now()}`,
      type: activeSection,
      name,
      category,
      completed: false,
      assigneeId: getDefaultAssignee(users, currentUser),
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
    } catch (error) {
      console.error('Failed to add item:', error);
      setOptimisticItems(prev => prev.filter(i => i.id !== newItem.id));
    }
  };
  
  const handleSuggestionClick = async (suggestion: { name: string; category: string }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Detect language for the new item
    const detectedLang = detectInputLanguage(currentLang);
    
    const newItem: ToDoItem = {
      id: `temp-${Date.now()}`,
      type: activeSection,
      name: suggestion.name,
      category: suggestion.category,
      completed: false,
      assigneeId: getDefaultAssignee(users, currentUser),
      createdAt: new Date().toISOString(),
      nameLang: detectedLang || null,
      nameTranslations: {},
      ...(activeSection === 'shopping' ? { quantity: '1' } : { dueDate: today }),
    };
    
    setOptimisticItems(prev => [...prev, newItem]);
    
    try {
      await onAdd(newItem);
    } catch (error) {
      console.error('Failed to add item:', error);
      setOptimisticItems(prev => prev.filter(i => i.id !== newItem.id));
    }
  };
  
  // Track items in collapse phase (height animating to 0)
  const [collapsingIds, setCollapsingIds] = useState<Set<string>>(new Set());
  
  const handleToggleComplete = async (id: string, completed: boolean) => {
    if (completed) {
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
      } catch (error) {
        console.error('Failed to update item:', error);
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
      }
    } else {
      // Uncompleting: instant, no animation
      setOptimisticCompleted(prev => ({ ...prev, [id]: false }));
      
      try {
        await onUpdate(id, { completed: false });
      } catch (error) {
        console.error('Failed to update item:', error);
        setOptimisticCompleted(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
  };
  
  const handleDelete = async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    
    try {
      await onDelete(id);
    } catch (error) {
      console.error('Failed to delete item:', error);
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };
  
  const handleClearAllCompleted = async () => {
    const confirmed = window.confirm(
      'Delete all completed items?\n\nThis action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    // Get all completed item IDs for current section
    const completedIds = completedItems.map(item => item.id);
    
    // Optimistically remove all
    completedIds.forEach(id => {
      setDeletingIds(prev => new Set(prev).add(id));
    });
    
    // Delete each item
    try {
      await Promise.all(completedIds.map(id => onDelete(id)));
    } catch (error) {
      console.error('Failed to delete some items:', error);
      // Rollback on error
      completedIds.forEach(id => {
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
    }
  };
  
  const openDetailedSheet = () => {
    const today = new Date().toISOString().split('T')[0];
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
        ? { quantity: '1', unit: '' }
        : { dueDate: today, dueTime: '', recurrence: { frequency: 'NONE' } }
      ),
    });
    
    // Clear inline input after carrying over to sheet
    setInlineInputValue('');
    setIsAddingInline(false);
    
    setIsSheetOpen(true);
  };
  
  const openEditSheet = (item: ToDoItem) => {
    setEditingItemId(item.id);
    setSheetForm({
      type: item.type,
      name: item.name,
      category: item.category,
      assigneeId: item.assigneeId,
      quantity: item.quantity,
      unit: item.unit,
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      recurrence: item.recurrence,
    });
    setIsSheetOpen(true);
  };
  
  const handleSheetSave = async () => {
    if (!sheetForm.name?.trim()) return;
    
    if (editingItemId) {
      // Editing existing item - ALWAYS recalculate dayOfWeek/dayOfMonth from current dueDate
      const dueDate = sheetForm.dueDate ? new Date(sheetForm.dueDate + 'T00:00:00') : new Date();
      
      let recurrence = undefined;
      if (sheetForm.recurrence?.frequency && sheetForm.recurrence.frequency !== 'NONE') {
        recurrence = {
          frequency: sheetForm.recurrence.frequency,
          dayOfWeek: sheetForm.recurrence.frequency === 'WEEKLY' ? dueDate.getDay() : undefined,
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
        dueDate: sheetForm.dueDate,
        dueTime: sheetForm.dueTime,
        recurrence,
        ...(nameChanged && detectedLang !== undefined ? { 
          nameLang: detectedLang || null,
          nameTranslations: {} // Reset translations when name changes
        } : {}),
      };
      
      const itemId = editingItemId; // Capture before clearing
      setIsSheetOpen(false);
      setEditingItemId(null);
      
      try {
        await onUpdate(itemId, updates);
      } catch (error) {
        console.error('Failed to update item:', error);
      }
    } else {
      // Adding new item
      // Detect language for the new item
      const detectedLang = detectInputLanguage(currentLang);
      
      const newItem: ToDoItem = {
        id: `temp-${Date.now()}`,
        type: activeSection,
        name: sheetForm.name!,
        category: sheetForm.category || defaultCategory,
        completed: false,
        assigneeId: sheetForm.assigneeId,
        createdAt: new Date().toISOString(),
        nameLang: detectedLang || null,
        nameTranslations: {},
        quantity: sheetForm.quantity || '1',
        unit: sheetForm.unit,
        dueDate: sheetForm.dueDate,
        dueTime: sheetForm.dueTime,
        recurrence: sheetForm.recurrence,
      };
      
      setOptimisticItems(prev => [...prev, newItem]);
      setIsSheetOpen(false);
      
      try {
        await onAdd(newItem);
      } catch (error) {
        console.error('Failed to add item:', error);
        setOptimisticItems(prev => prev.filter(i => i.id !== newItem.id));
      }
    }
  };
  
  const getUserName = (userId?: string): string => {
    if (!userId) return '';
    if (userId === currentUser.id) return 'You';
    const user = users.find(u => u.id === userId);
    return user?.name.split(' ')[0] || '';
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
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 pt-12 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-display text-foreground">
              {t['todo.title'] || 'To Do'}
            </h1>
            
            {/* Filter/Sort Button */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={`p-2 rounded-full transition-colors relative ${
                  isFilterDropdownOpen ? 'bg-muted' : 'hover:bg-muted'
                }`}
              >
                <SlidersHorizontal size={20} className="text-muted-foreground" />
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
                    <p className="text-caption text-muted-foreground tracking-wide mb-2">Sort by</p>
                    <div className="space-y-1">
                      {(activeSection === 'shopping' ? SHOPPING_SORT_OPTIONS : TASK_SORT_OPTIONS).map(option => (
                        <button
                          key={option.value}
                          onClick={() => setSortBy(option.value as SortOption)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-body transition-colors flex items-center justify-between ${
                            sortBy === option.value
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground hover:bg-muted'
                          }`}
                        >
                          {option.label}
                          {sortBy === option.value && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Separator with padding */}
                  <div className="mx-3 border-t border-border" />
                  
                  {/* Filter Section */}
                  <div className="p-3 pt-2">
                    <p className="text-caption text-muted-foreground tracking-wide mb-2">Show</p>
                    <button
                      onClick={() => setShowOnlyMine(!showOnlyMine)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-body transition-colors flex items-center justify-between ${
                        showOnlyMine
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <UserIcon size={16} />
                        My Items Only
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
                          className="w-full px-3 py-2 rounded-lg text-body text-muted-foreground hover:bg-muted transition-colors text-center"
                        >
                          Reset to Default
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Section Toggle Cards - fade out on scroll (keep height to prevent bounce) */}
        <div 
          className="transition-all duration-300"
          style={{
            opacity: isScrolled ? 0 : 1,
            pointerEvents: isScrolled ? 'none' : 'auto',
            marginBottom: '24px',
            marginTop: '16px'
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            {/* Shopping Card */}
            <button
              onClick={() => setActiveSection('shopping')}
              className={`px-3 py-2.5 rounded-xl text-left transition-all ${
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
                {shoppingStats.total} items to buy
              </div>
            </button>

            {/* Tasks Card */}
            <button
              onClick={() => setActiveSection('task')}
              className={`px-3 py-2.5 rounded-xl text-left transition-all ${
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
                {taskStats.total} pending
              </div>
            </button>
          </div>
        </div>

        {/* Sticky Tab Navigation */}
        <div 
          className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
          style={{ 
            top: '92px',
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
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({getItemCount('All')})
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedCategory === cat
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {categoryIcons[cat]}
                  {cat}
                </button>
              ))}
            </div>
            <div 
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
            />
          </div>
        </div>

        {/* Suggestions - Collapsible */}
        {suggestions.length > 0 && (
          <div className="mt-4 mb-2">
            <button
              onClick={() => setShowSuggested(!showSuggested)}
              className="flex items-center gap-2 mb-2"
            >
              {showSuggested ? (
                <ChevronDown size={16} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={16} className="text-muted-foreground" />
              )}
              <span className="text-caption text-muted-foreground tracking-wide">
                {t['todo.suggested'] || 'Suggested'} ({suggestions.length})
              </span>
            </button>
            
            {showSuggested && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className={`px-3 py-1.5 rounded-full text-body font-medium transition-all flex items-center gap-1 border hover:opacity-80 ${getSuggestionPillStyle(s.category)}`}
                  >
                    <Plus size={14} />
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Item List Card */}
        <div className="mt-4 bg-card rounded-xl shadow-sm overflow-hidden">
          {/* Inline Add Row at TOP - always visible for rapid entry */}
          <div
            className={`flex items-center gap-3 p-4 ${
              activeItems.length > 0 ? 'list-item-separator' : ''
            } ${!isAddingInline ? 'hover:bg-muted/30 cursor-pointer' : ''}`}
            onClick={() => !isAddingInline && setIsAddingInline(true)}
          >
            <div className="text-muted-foreground/50 shrink-0">
              <Circle size={22} />
            </div>
            
            {/* Content area with consistent height */}
            <div className="flex-1 flex items-center gap-2 min-h-[28px]">
              {isAddingInline ? (
                <input
                  ref={inlineInputRef}
                  type="text"
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
                  placeholder={activeSection === 'shopping' ? 'Add item...' : 'Add task...'}
                  className="flex-1 bg-transparent text-body text-foreground placeholder-muted-foreground outline-none"
                />
              ) : (
                <span className="flex-1 text-body text-muted-foreground">
                  {activeSection === 'shopping' ? 'Add item...' : 'Add task...'}
                </span>
              )}
              
              {/* Plus button - always visible for detailed add */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDetailedSheet();
                }}
                className="p-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
                title="Add with details"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          
          {/* Items list */}
          {activeItems.map((item, index) => {
            const isCompleting = completingIds.has(item.id);
            const isCollapsing = collapsingIds.has(item.id);
            
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 ${
                  index !== activeItems.length - 1 && !isCollapsing ? 'list-item-separator' : ''
                } overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors`}
                style={{
                  transition: isCollapsing 
                    ? 'max-height 0.2s ease-out, padding 0.2s ease-out, opacity 0.2s ease-out'
                    : 'opacity 0.2s ease-out, transform 0.2s ease-out, background-color 0.15s ease',
                  opacity: isCompleting ? 0 : 1,
                  transform: isCompleting && !isCollapsing ? 'translateX(16px)' : 'translateX(0)',
                  maxHeight: isCollapsing ? '0px' : '120px',
                  padding: isCollapsing ? '0 1rem' : '1rem',
                }}
                onClick={() => !isCompleting && openEditSheet(item)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Don't open edit when clicking checkbox
                    !isCompleting && handleToggleComplete(item.id, true);
                  }}
                  className="mt-0.5 shrink-0 transition-all"
                >
                  {isCompleting ? (
                    <div className="w-[22px] h-[22px] rounded-full bg-primary flex items-center justify-center">
                      <Check size={14} className="text-primary-foreground" strokeWidth={3} />
                    </div>
                  ) : (
                    <Circle size={22} className="text-muted-foreground/50 hover:text-primary transition-colors" />
                  )}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <span className={`text-body ${isCompleting ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      <TranslatedItemName item={item} currentLang={currentLang} onUpdate={onUpdate} />
                      {item.type === 'shopping' && item.quantity && item.quantity !== '1' && (
                        <span className="text-muted-foreground font-normal">
                          {' · '}{item.quantity}{item.unit ? ` ${item.unit}` : ''}
                        </span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                    {/* Category Badge */}
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getCategoryBadgeStyle(item.category)}`}>
                      {item.category}
                    </span>
                    {item.type === 'task' && item.dueDate && (
                      <span className={`flex items-center gap-1 text-caption ${isOverdue(item.dueDate) ? 'text-[#F06292]' : 'text-muted-foreground'}`}>
                        <Calendar size={11} />
                        {formatDateTime(item.dueDate, item.dueTime)}
                      </span>
                    )}
                  </div>
                  
                  {item.type === 'task' && item.recurrence && item.recurrence.frequency !== 'NONE' && (
                    <div className="flex items-center gap-1 mt-1 text-caption text-primary">
                      <Repeat size={12} />
                      {formatRecurrence(item.recurrence)}
                    </div>
                  )}
                </div>
                
                {/* Assignee - positioned on the right */}
                {item.assigneeId && (
                  <span className="text-caption text-muted-foreground shrink-0 self-center">
                    {getUserName(item.assigneeId)}
                  </span>
                )}
              </div>
            );
          })}
          
          {/* Empty State */}
          {activeItems.length === 0 && !isAddingInline && (
            <div className="p-8 text-center border-t border-border">
              <p className="text-body text-foreground">
                {activeSection === 'shopping' 
                  ? (t['todo.no_shopping'] || 'No shopping items yet')
                  : (t['todo.no_tasks'] || 'No tasks yet')
                }
              </p>
              <p className="text-caption text-muted-foreground mt-1">Tap above to add one</p>
            </div>
          )}
        </div>

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
              
              {/* Clear All Button */}
              {showCompleted && (
                <button
                  onClick={handleClearAllCompleted}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-caption text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                  Clear All
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
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium opacity-50 ${getCategoryBadgeStyle(item.category)}`}>
                        {item.category}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
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
      {isSheetOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bottom-sheet-backdrop">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsSheetOpen(false)}
          />
          
          {/* Safe area bottom cover - fills the gap below the sheet */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          
          <div className="relative w-full max-w-lg bg-card rounded-t-3xl bottom-sheet-content flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
            {/* Drag Handle */}
            <div className="flex justify-center pt-4 pb-2 shrink-0">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 shrink-0">
              <h2 className="text-title text-foreground">
                {editingItemId 
                  ? (sheetForm.type === 'shopping' ? 'Edit Shopping Item' : 'Edit Task')
                  : (activeSection === 'shopping' ? 'Add Shopping Item' : 'Add Task')
                }
              </h2>
              <button
                onClick={() => {
                  setIsSheetOpen(false);
                  setEditingItemId(null);
                }}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>
            
            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div className="space-y-5">
              {/* Name Input */}
              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                  {activeSection === 'shopping' ? 'Item Name' : 'Task Name'}
                </label>
                <input
                  type="text"
                  value={sheetForm.name || ''}
                  onChange={e => setSheetForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={activeSection === 'shopping' ? 'e.g., Milk' : 'e.g., Clean bathroom'}
                  className="w-full px-4 py-3 bg-muted rounded-xl text-body text-foreground placeholder-muted-foreground outline-none border border-transparent focus:border-foreground transition-colors"
                  autoFocus={!editingItemId}
                />
              </div>
              
              {/* Shopping-specific fields */}
              {activeSection === 'shopping' && (
                <div className="flex gap-3">
                  <div className="w-24">
                    <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                      Qty
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={sheetForm.quantity ?? ''}
                      onChange={e => {
                        // Allow digits, decimal point, and fractions like 1/2
                        const value = e.target.value.replace(/[^\d./]/g, '');
                        setSheetForm(prev => ({ ...prev, quantity: value }));
                      }}
                      onFocus={e => e.target.select()}
                      placeholder="Qty"
                      className="w-full px-4 py-3 bg-muted rounded-xl text-body text-foreground text-center outline-none border border-transparent focus:border-foreground transition-colors placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={sheetForm.unit || ''}
                      onChange={e => setSheetForm(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="pcs, kg, L..."
                      className="w-full px-4 py-3 bg-muted rounded-xl text-body text-foreground placeholder-muted-foreground outline-none border border-transparent focus:border-foreground transition-colors"
                    />
                  </div>
                </div>
              )}
              
              {/* Task-specific fields */}
              {activeSection === 'task' && (
                <>
                  <div>
                    <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                      Due Date & Time
                    </label>
                    {/* Hidden native picker - positioned off-screen */}
                    <input
                      id="datetime-picker"
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
                      className="sr-only"
                    />
                    {/* Display formatted date */}
                    <button 
                      type="button"
                      className="w-full px-4 py-3 bg-muted rounded-xl text-body cursor-pointer border border-transparent hover:border-foreground/30 transition-colors flex items-center justify-between text-left"
                      onClick={() => {
                        const input = document.getElementById('datetime-picker') as HTMLInputElement;
                        input?.showPicker?.();
                      }}
                    >
                      <span className={sheetForm.dueDate ? 'text-foreground' : 'text-muted-foreground'}>
                        {sheetForm.dueDate 
                          ? formatDateTime(sheetForm.dueDate, sheetForm.dueTime || '09:00')
                          : 'Select date & time'
                        }
                      </span>
                      <Calendar size={18} className="text-muted-foreground" />
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                      Repeat
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
                            dayOfWeek: frequency === 'WEEKLY' ? dueDate.getDay() : undefined,
                            dayOfMonth: frequency === 'MONTHLY' ? dueDate.getDate() : undefined,
                          },
                        }));
                      }}
                      className="w-full px-4 py-3 bg-muted rounded-xl text-body text-foreground outline-none border border-transparent focus:border-foreground transition-colors"
                    >
                      {RECURRENCE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                          {opt.value === 'WEEKLY' && sheetForm.dueDate && 
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
                  Category
                </label>
                <div className="flex gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSheetForm(prev => ({ ...prev, category: cat }))}
                      className={`flex-1 px-2 py-2 rounded-xl text-sm transition-all flex items-center justify-center gap-1 ${
                        sheetForm.category === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-foreground ring-1 ring-neutral-300 hover:ring-neutral-400'
                      }`}
                    >
                      {categoryIcons[cat]}
                      <span className="truncate">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Assignee Selection */}
              <div>
                <label className="block text-caption text-muted-foreground tracking-wide mb-2">
                  Assign to
                </label>
                <div className="flex flex-wrap gap-2">
                  {users.map(user => (
                    <button
                      key={user.id}
                      onClick={() => setSheetForm(prev => ({ ...prev, assigneeId: user.id }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-body transition-all ${
                        sheetForm.assigneeId === user.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-foreground ring-1 ring-neutral-300 hover:ring-neutral-400'
                      }`}
                    >
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <UserIcon size={14} className="text-muted-foreground" />
                        </div>
                      )}
                      <span>{user.id === currentUser.id ? 'You' : user.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              </div>
            </div>
            
            {/* Fixed Footer with Delete + Save */}
            <div className="shrink-0 px-6 pt-4 pb-6 bg-card border-t border-border flex gap-3">
              {editingItemId && (
                <button
                  onClick={async () => {
                    const itemId = editingItemId;
                    setIsSheetOpen(false);
                    setEditingItemId(null);
                    await handleDelete(itemId);
                  }}
                  className="p-4 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button
                onClick={handleSheetSave}
                disabled={!sheetForm.name?.trim()}
                className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl text-body hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
              >
                <Check size={18} />
                {editingItemId 
                  ? 'Save Changes'
                  : (activeSection === 'shopping' ? 'Add Item' : 'Add Task')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToDo;
