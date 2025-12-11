import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Camera,
  PieChart as PieIcon,
  List,
  X,
  Image as ImageIcon,
  AlertCircle,
  Check,
  Edit,
  Trash2,
  Receipt,
  ReceiptText,
  Pencil,
  Plus,
  ArrowLeft,
  Home,
  ShoppingCart,
  Car,
  Heart,
  PartyPopper,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import { useScrollHeader } from '@/hooks/useScrollHeader';
import { useTranslatedContent } from '@/hooks/useTranslatedContent';
import { useScrollLock } from '@/hooks/useScrollLock';
import { Expense, BaseViewProps, User, UserRole } from '../types';
import { EXPENSE_CATEGORIES } from '../constants';
import { detectInputLanguage } from '../services/languageDetectionService';
import { formatCurrency, DEFAULT_CURRENCY, getCurrencySymbol } from '../currencyConfig';
import {
  uploadReceiptImage,
  createReceiptRecord,
  updateReceiptWithOCR,
  linkReceiptToExpense,
  deleteReceiptByExpenseId,
  getKnownMerchants,
} from '../services/receiptService';
import { processReceipt, ParsedReceipt } from '../services/visionService';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// Expense Category Config (colors and icons)
type ExpenseCategoryConfig = {
  color: string;
  bgColor: string;
  icon: React.ReactNode;
};

const EXPENSE_CATEGORY_CONFIG: Record<string, ExpenseCategoryConfig> = {
  'Housing & Utilities': { color: '#3EAFD2', bgColor: '#E6F7FB', icon: <Home size={18} /> },
  'Food & Daily Needs': { color: '#FF9800', bgColor: '#FFF3E0', icon: <ShoppingCart size={18} /> },
  'Transport & Travel': { color: '#7E57C2', bgColor: '#EDE7F6', icon: <Car size={18} /> },
  'Health & Personal Care': { color: '#4CAF50', bgColor: '#E8F5E9', icon: <Heart size={18} /> },
  'Fun & Lifestyle': { color: '#F06292', bgColor: '#FCE4EC', icon: <PartyPopper size={18} /> },
  'Miscellaneous': { color: '#757575', bgColor: '#F5F5F5', icon: <MoreHorizontal size={18} /> },
};

const getExpenseCategoryConfig = (category: string): ExpenseCategoryConfig => {
  return EXPENSE_CATEGORY_CONFIG[category] || EXPENSE_CATEGORY_CONFIG['Miscellaneous'];
};

// Zoomable Image Component with touch gestures
const ZoomableImage: React.FC<{ imageSrc: string; onClose: () => void; t: Record<string, string> }> = ({ imageSrc, onClose, t }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [lastTouch, setLastTouch] = useState<{ distance: number; center: { x: number; y: number } } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(1, Math.min(5, prev * delta)));
  };

  const getTouchDistance = (touches: TouchList) => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
  };

  const getTouchCenter = (touches: TouchList) => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      setLastTouch({ distance, center });
    } else if (e.touches.length === 1 && scale > 1) {
      const touch = e.touches[0];
      setLastTouch({
        distance: 0,
        center: { x: touch.clientX - position.x, y: touch.clientY - position.y },
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastTouch) {
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      const scaleChange = distance / lastTouch.distance;
      const newScale = Math.max(1, Math.min(5, scale * scaleChange));
      setScale(newScale);
      setLastTouch({ distance, center });
    } else if (e.touches.length === 1 && scale > 1 && lastTouch) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - lastTouch.center.x,
        y: touch.clientY - lastTouch.center.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setLastTouch(null);
    if (scale < 1) setScale(1);
    if (scale === 1) setPosition({ x: 0, y: 0 });
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-full max-h-full">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors z-10"
          aria-label={t['common.close'] || 'Close'}
        >
          <X size={24} />
        </button>
        <div 
          className="overflow-hidden max-h-[90vh] max-w-[90vw]"
          style={{ touchAction: 'none' }}
        >
          <img 
            ref={imgRef}
            src={imageSrc} 
            alt="Receipt" 
            className="max-w-full max-h-full object-contain select-none"
            onClick={(e) => e.stopPropagation()}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleClick}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: lastTouch ? 'none' : 'transform 0.1s ease-out',
            }}
            draggable={false}
          />
        </div>
                <p className="text-caption text-white/70 mt-4 text-center">
          {scale > 1 
            ? `${t['expenses.double_tap_reset'] || 'Double tap to reset'} • ${t['expenses.drag_to_pan'] || 'Drag to pan'}` 
            : `${t['expenses.pinch_to_zoom'] || 'Pinch to zoom'} • ${t['expenses.double_tap_zoom'] || 'Double tap to zoom'} • ${t['expenses.tap_outside_close'] || 'Tap outside to close'}`}
        </p>
      </div>
    </div>
  );
};

interface ExpensesProps extends BaseViewProps {
  expenses: Expense[];
  householdId: string;
  currentUser: User;
  onAdd: (expense: Expense) => Promise<Expense> | Expense | void;
  onUpdate?: (expense: Expense) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

interface PendingReceipt {
  receiptId: string;
  imageUrl: string;
  thumbnailBase64: string;
  parsed: ParsedReceipt;
}

// Sheet stages for the two-stage progressive design
type AddExpenseStage = 'closed' | 'options' | 'manual' | 'ocr';

// Component for displaying translated merchant name
const TranslatedMerchantName: React.FC<{
  expense: Expense;
  currentLang: string;
  onUpdate?: (expense: Expense) => Promise<void> | void;
}> = ({ expense, currentLang, onUpdate }) => {
  const translatedMerchant = useTranslatedContent({
    content: expense.merchant,
    contentLang: expense.merchantLang,
    currentLang,
    translations: expense.merchantTranslations || {},
    onTranslationUpdate: async (translation) => {
      // Update translations in database
      if (onUpdate) {
        const updatedExpense: Expense = {
          ...expense,
          merchantTranslations: {
            ...(expense.merchantTranslations || {}),
            [currentLang]: translation,
          },
        };
        await onUpdate(updatedExpense);
      }
    },
  });

  return <>{translatedMerchant}</>;
};

const Expenses: React.FC<ExpensesProps> = ({
  expenses,
  householdId,
  currentUser,
  onAdd,
  onUpdate,
  onDelete,
  t,
  currentLang,
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Role-based permissions
  // ─────────────────────────────────────────────────────────────────
  const isHelper = currentUser.role === UserRole.HELPER;

  const [view, setView] = useState<'list' | 'chart'>('list');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Month/Year Selection State
  const now = new Date();
  // Default to December of the current year
  const [selectedMonth, setSelectedMonth] = useState<number | null>(11); // 0-indexed, 11 = December
  const [selectedYear, setSelectedYear] = useState<number | null>(now.getFullYear());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear()); // Year shown in picker

  // Two-Stage Progressive Sheet State
  const [addExpenseStage, setAddExpenseStage] = useState<AddExpenseStage>('closed');

  // OCR State (for stage: 'ocr')
  const [pendingReceipt, setPendingReceipt] = useState<PendingReceipt | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  // Shared form fields (used by both OCR and Manual entry)
  const [editAmount, setEditAmount] = useState<string>('');
  const [editMerchant, setEditMerchant] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [editDate, setEditDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  // Existing Expense Modal State
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [confirmDeleteExisting, setConfirmDeleteExisting] = useState(false);
  const [savingExisting, setSavingExisting] = useState(false);

  const [exAmount, setExAmount] = useState<string>('');
  const [exMerchant, setExMerchant] = useState<string>('');
  const [exCategory, setExCategory] = useState<string>('');
  const [exDate, setExDate] = useState<string>('');

  const [localExpenses, setLocalExpenses] = useState<Expense[]>([...expenses]);

  // Scroll header hook
  const { isScrolled } = useScrollHeader();
  
  // Lock body scroll when any modal is open
  useScrollLock(addExpenseStage !== 'closed' || !!selectedExpense || isMonthPickerOpen);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalExpenses([...expenses]);
  }, [expenses]);

  useEffect(() => {
    if (!selectedExpense) return;
    setExAmount(selectedExpense.amount.toFixed(2));
    setExMerchant(selectedExpense.merchant || '');
    setExCategory(selectedExpense.category || EXPENSE_CATEGORIES[0]);
    // Normalize date to YYYY-MM-DD format
    let iso: string;
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(selectedExpense.date)) {
        iso = selectedExpense.date;
      } else {
        const parsed = new Date(selectedExpense.date);
        if (!isNaN(parsed.getTime())) {
          iso = parsed.toISOString().slice(0, 10);
        } else {
          iso = new Date().toISOString().slice(0, 10);
        }
      }
    } catch {
      iso = new Date().toISOString().slice(0, 10);
    }
    setExDate(iso);
  }, [selectedExpense]);

  // Auto-focus amount field when entering manual mode
  useEffect(() => {
    if (addExpenseStage === 'manual' && amountInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 100);
    }
  }, [addExpenseStage]);

  // Check if any modal is open
  const isModalOpen = addExpenseStage !== 'closed' || selectedExpense || isMonthPickerOpen;

  // Filter expenses by selected month/year and ownership (for Helper)
  // Handle multiple date formats: YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY, etc.
  const filteredExpenses = useMemo(() => {
    // First, filter by ownership for Helper users
    let baseExpenses = localExpenses;
    if (isHelper) {
      // Helper can only see expenses they created
      baseExpenses = localExpenses.filter(e => e.createdBy === currentUser.id);
    }
    
    // When no month/year is selected, show all (filtered) expenses
    if (selectedMonth === null || selectedYear === null) {
      return baseExpenses;
    }
    return baseExpenses.filter((expense) => {
      if (!expense.date || typeof expense.date !== 'string') {
        console.warn('[Expenses] Invalid date for expense:', expense.id, expense.date);
        return false;
      }

      let year: number | null = null;
      let month: number | null = null;

      // Try YYYY-MM-DD format first (standard ISO format)
      const isoMatch = expense.date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        year = parseInt(isoMatch[1], 10);
        month = parseInt(isoMatch[2], 10);
      } else {
        // Try DD-MM-YYYY format
        const ddmmyyyyMatch = expense.date.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (ddmmyyyyMatch) {
          year = parseInt(ddmmyyyyMatch[3], 10);
          month = parseInt(ddmmyyyyMatch[2], 10);
        } else {
          // Try MM/DD/YYYY format
          const mmddyyyyMatch = expense.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (mmddyyyyMatch) {
            year = parseInt(mmddyyyyMatch[3], 10);
            month = parseInt(mmddyyyyMatch[1], 10);
          } else {
            // Try DD/MM/YYYY format
            const ddmmyyyySlashMatch = expense.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (ddmmyyyySlashMatch) {
              year = parseInt(ddmmyyyySlashMatch[3], 10);
              month = parseInt(ddmmyyyySlashMatch[2], 10);
            } else {
              // Try parsing as Date object (fallback)
              try {
                const parsedDate = new Date(expense.date);
                if (!isNaN(parsedDate.getTime())) {
                  year = parsedDate.getFullYear();
                  month = parsedDate.getMonth() + 1; // getMonth() returns 0-11
                }
              } catch (e) {
                console.warn('[Expenses] Could not parse date:', expense.date, 'for expense:', expense.id);
                return false;
              }
            }
          }
        }
      }

      // Validate parsed values
      if (year === null || month === null || isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        console.warn('[Expenses] Invalid parsed date values:', { year, month, date: expense.date, expenseId: expense.id });
        return false;
      }

      // Compare with selected month/year (month is 0-indexed in selectedMonth)
      return (month - 1) === selectedMonth && year === selectedYear;
    });
  }, [localExpenses, selectedMonth, selectedYear, isHelper, currentUser.id]);

  // Month names for display - locale-based
  const langCode = currentLang === 'en' ? 'en-GB' : currentLang;
  const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => 
    new Date(2000, i, 1).toLocaleDateString(langCode, { month: 'short' })
  );
  const MONTH_NAMES_FULL = Array.from({ length: 12 }, (_, i) => 
    new Date(2000, i, 1).toLocaleDateString(langCode, { month: 'long' })
  );

  // Format selected month for display
  const isAllTime = selectedMonth === null || selectedYear === null;
  const selectedMonthLabel = isAllTime
    ? (t['expenses.all_expenses'] || 'All Expenses')
    : `${MONTH_NAMES_FULL[selectedMonth]} ${selectedYear}`;

  // ─────────────────────────────────────────────────────────────────
  // Open Add Expense Sheet
  // ─────────────────────────────────────────────────────────────────
  const openAddExpenseSheet = () => {
    // Reset form to defaults
    setEditAmount('');
    setEditMerchant('');
    setEditCategory(EXPENSE_CATEGORIES[0]);
    setEditDate(new Date().toISOString().split('T')[0]);
    setPendingReceipt(null);
    setError(null); // Clear any previous errors
    setAddExpenseStage('options');
  };

  const closeAddExpenseSheet = () => {
    setAddExpenseStage('closed');
    setPendingReceipt(null);
    setEditAmount('');
    setEditMerchant('');
    setEditCategory(EXPENSE_CATEGORIES[0]);
    setEditDate(new Date().toISOString().split('T')[0]);
  };

  // ─────────────────────────────────────────────────────────────────
  // Enter Manual Mode
  // ─────────────────────────────────────────────────────────────────
  const enterManualMode = () => {
    setAddExpenseStage('manual');
  };

  // ─────────────────────────────────────────────────────────────────
  // Receipt Scanning Flow
  // ─────────────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddExpenseStage('closed'); // Close sheet while scanning
    setIsScanning(true);
    setError(null);
    try {
      // Start fetching known merchants in parallel with file reading/OCR upload
      const knownMerchantsPromise = getKnownMerchants(householdId).catch(() => [] as string[]);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const thumbnailBase64 = base64;
      const base64Data = base64.split(',')[1];
      const fileType = file.type.split('/')[1] ?? 'jpeg';

      const { url, path } = await uploadReceiptImage(householdId, base64Data, fileType);
      const receiptId = await createReceiptRecord(householdId, path, url);
      const knownMerchants = await knownMerchantsPromise;
      const parsed = await processReceipt(base64Data, { knownMerchants });
      await updateReceiptWithOCR(receiptId, parsed);

      setPendingReceipt({ receiptId, imageUrl: url, thumbnailBase64, parsed });
      setEditAmount(parsed.total.toFixed(2));
      setEditMerchant(parsed.merchant);
      setEditCategory(parsed.category || EXPENSE_CATEGORIES[0]);
      setEditDate(parsed.date || new Date().toISOString().split('T')[0]);
      setAddExpenseStage('ocr'); // Show OCR confirmation
    } catch (err) {
      console.error('Receipt processing failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to process receipt');
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Save Expense (works for both OCR and Manual)
  // ─────────────────────────────────────────────────────────────────
  const handleSaveExpense = async () => {
    // Validate amount before saving
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0) {
      setError(t['expenses.error_invalid_amount'] || 'Please enter a valid amount');
      return;
    }

    setIsSaving(true);
    setError(null); // Clear any previous errors
    
    // Normalize date to YYYY-MM-DD format
    let normalizedDate = editDate || new Date().toISOString().split('T')[0];
    if (normalizedDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      try {
        const parsed = new Date(normalizedDate);
        if (!isNaN(parsed.getTime())) {
          normalizedDate = parsed.toISOString().split('T')[0];
        } else {
          normalizedDate = new Date().toISOString().split('T')[0];
        }
      } catch {
        normalizedDate = new Date().toISOString().split('T')[0];
      }
    }

    const newExpense: Expense = {
      id: Date.now().toString(),
      amount: amount,
      currency: DEFAULT_CURRENCY,
      merchant: editMerchant.trim() || 'Unknown',
      category: editCategory || 'Miscellaneous',
      date: normalizedDate,
      receiptUrl: pendingReceipt?.imageUrl || undefined,
      createdBy: currentUser.id,
      merchantLang: detectInputLanguage(currentLang) || null,
      merchantTranslations: {},
    };

    let savedExpenseId: string | null = null;
    // UI already shows the expense via optimistic update (handleAddExpense), so treat as "likely saved"
    let expenseLikelySaved = true;

    try {
      if (onAdd) {
        console.log('[Expenses] Calling onAdd with expense ID:', newExpense.id);
        const result = onAdd(newExpense);
        
        // Handle both sync and async onAdd
        let savedExpense: Expense | undefined;
        if (result && typeof result === 'object') {
          if ('then' in result && typeof result.then === 'function') {
            // It's a Promise
            savedExpense = await (result as Promise<Expense>);
          } else {
            // It's an Expense object directly
            savedExpense = result as Expense;
          }
        }
        
        console.log('[Expenses] onAdd returned expense:', savedExpense);
        
        // Use the actual UUID from database if returned
        if (savedExpense && savedExpense.id) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(savedExpense.id);
          if (isUuid) {
            savedExpenseId = savedExpense.id;
            console.log('[Expenses] Using UUID from database:', savedExpenseId);
          } else {
            console.warn('[Expenses] onAdd returned non-UUID ID:', savedExpense.id);
          }
        }
        expenseLikelySaved = true;
      }

      // Link receipt (non-blocking)
      if (pendingReceipt && savedExpenseId) {
        try {
          await new Promise(resolve => setTimeout(resolve, 200)); // ensure commit
          console.log('[Expenses] Linking receipt to expense ID (UUID):', savedExpenseId);
          await linkReceiptToExpense(pendingReceipt.receiptId, savedExpenseId);
          console.log('[Expenses] Receipt linked to expense successfully');
        } catch (linkError) {
          console.warn('[Expenses] Failed to link receipt (non-fatal):', linkError);
        }
      } else if (pendingReceipt) {
        console.warn('[Expenses] Cannot link receipt - no valid expense UUID available');
      }

    } catch (addError) {
      console.error('[Expenses] Error saving expense:', addError);
      if (!expenseLikelySaved) {
        setError(addError instanceof Error ? addError.message : 'Failed to save expense. Please try again.');
      } else {
        // Expense was likely saved (optimistic or returned), so avoid blocking banner
        console.warn('[Expenses] Expense likely saved; suppressing error banner.');
        setError(null);
      }
    } finally {
      // Always close dialog and clear saving state so the user isn't stuck
      closeAddExpenseSheet();
      setIsSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Existing Expense Modal
  // ─────────────────────────────────────────────────────────────────
  function openExistingModal(exp: Expense) {
    setSelectedExpense(exp);
    setIsEditingExisting(false);
    setConfirmDeleteExisting(false);
  }

  function closeExistingModal() {
    setSelectedExpense(null);
    setIsEditingExisting(false);
    setConfirmDeleteExisting(false);
  }

  async function saveExistingEdit() {
    if (!selectedExpense) return;
    setSavingExisting(true);
    try {
      // Re-detect language if merchant changed
      const merchantChanged = selectedExpense.merchant !== exMerchant;
      const detectedLang = merchantChanged ? detectInputLanguage(currentLang) : undefined;
      
      // Normalize date to YYYY-MM-DD format
      let normalizedDate = exDate || selectedExpense.date;
      if (normalizedDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
        // Try to parse and normalize the date
        try {
          const parsed = new Date(normalizedDate);
          if (!isNaN(parsed.getTime())) {
            normalizedDate = parsed.toISOString().split('T')[0];
          } else {
            normalizedDate = selectedExpense.date; // Fallback to original date
          }
        } catch {
          normalizedDate = selectedExpense.date; // Fallback to original date
        }
      }
      
      const updated: Expense = {
        ...selectedExpense,
        amount: parseFloat(exAmount) || selectedExpense.amount,
        merchant: exMerchant || selectedExpense.merchant,
        category: exCategory || selectedExpense.category,
        date: normalizedDate,
        ...(merchantChanged && detectedLang !== undefined ? {
          merchantLang: detectedLang || null,
          merchantTranslations: {} // Reset translations when merchant changes
        } : {}),
      };
      if (onUpdate) {
        await onUpdate(updated);
      }
      setLocalExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setSelectedExpense(updated);
      setIsEditingExisting(false);
    } catch (err) {
      console.error('Failed to update expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to update expense');
    } finally {
      setSavingExisting(false);
    }
  }

  async function confirmExistingDelete() {
    if (!selectedExpense) return;
    setSavingExisting(true);
    try {
      await deleteReceiptByExpenseId(selectedExpense.id);
      if (onDelete) {
        await onDelete(selectedExpense.id);
      }
      setLocalExpenses((prev) => prev.filter((e) => e.id !== selectedExpense.id));
      closeExistingModal();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setSavingExisting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Chart Data
  // ─────────────────────────────────────────────────────────────────
  // Breakdown data - categories with totals (filtered by selected month)
  const breakdownData = useMemo(() => {
    return EXPENSE_CATEGORIES.map((cat) => {
      const total = filteredExpenses
        .filter((e) => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
      return {
        category: cat,
        amount: total,
        config: getExpenseCategoryConfig(cat),
      };
    }).filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);


  // Total for selected month
  const totalAmount = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Category label translation helper
  const getCategoryLabel = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'Housing & Utilities': t['expenses.category.housing_utilities'] || category,
      'Food & Daily Needs': t['expenses.category.food_daily'] || category,
      'Transport & Travel': t['expenses.category.transport_travel'] || category,
      'Health & Personal Care': t['expenses.category.health_personal'] || category,
      'Fun & Lifestyle': t['expenses.category.fun_lifestyle'] || category,
      'Miscellaneous': t['expenses.category.miscellaneous'] || category,
    };
    return categoryMap[category] || category;
  };

  return (
    <div className="min-h-screen bg-background pb-40 animate-fade-in">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY HEADER - Push Up (No Shrink) */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 pt-12 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-display text-foreground">
              {t['expenses.title']}
            </h1>
            {/* Month Selector Button */}
          <button
              onClick={() => {
                setPickerYear(selectedYear ?? now.getFullYear());
                setIsMonthPickerOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors"
            >
              <Calendar size={16} />
              <span>{isAllTime ? t['common.all_expenses'] : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`}</span>
              <ChevronDown size={16} />
          </button>
          </div>
        </header>

        {/* Summary Card - Hidden for Helper */}
        {!isHelper && (
        <div className="mt-4 mb-6">
          <div className="bg-primary text-primary-foreground p-6 rounded-xl shadow-md">
            <p className="text-body opacity-80 mb-1">
              {isAllTime ? t['common.total_for_all'] : `${t['common.total_for_month']} ${MONTH_NAMES_FULL[selectedMonth]}`}
            </p>
            <h2 className="text-display">{formatCurrency(totalAmount)}</h2>
          </div>
        </div>
        )}

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY TAB NAVIGATION - Hidden for Helper (they only see list) */}
        {/* ─────────────────────────────────────────────────────────────── */}
        {!isHelper && (
        <div
          className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
          style={{
            top: '92px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          <div
            className="relative rounded-full overflow-hidden"
            style={{ backgroundColor: 'hsl(var(--muted))' }}
          >
            <div className="flex p-1">
          <button
            onClick={() => setView('list')}
                className={`flex-1 px-4 py-2 rounded-full text-body whitespace-nowrap transition-all flex items-center justify-center gap-2 ${
                  view === 'list'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List size={18} />
                {t['common.list']}
          </button>
          <button
                onClick={() => setView('chart')}
                className={`flex-1 px-4 py-2 rounded-full text-body whitespace-nowrap transition-all flex items-center justify-center gap-2 ${
                  view === 'chart'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PieIcon size={18} />
                {t['common.summary']}
          </button>
            </div>
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
            />
        </div>
      </div>
        )}

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* MAIN CONTENT */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <div className="pt-4">
          {/* Error Alert */}
      {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-destructive flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
                <p className="text-title text-destructive">{t['expenses.error'] || 'Error'}</p>
                <p className="text-body text-destructive/80">{error}</p>
          </div>
              <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive">
            <X size={16} />
          </button>
        </div>
      )}

          {/* Scanning Indicator */}
          {isScanning && (
            <div className="mb-4 p-4 bg-primary/10 rounded-xl text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-body text-primary">{t['expenses.analyzing']}</p>
              </div>
      </div>
          )}

          {/* Summary View - Not shown to Helper */}
          {view === 'chart' && !isHelper ? (
            <div className="space-y-4">
              {/* Pie Chart */}
              <div className="bg-card rounded-xl p-4 shadow-sm">
                {breakdownData.length > 0 ? (
                  <div className="h-64 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={breakdownData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="amount"
                          nameKey="category"
                          isAnimationActive={false}
                        >
                          {breakdownData.map((entry) => (
                            <Cell key={entry.category} fill={entry.config.color} stroke="none" />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Label - Month/Year or All */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-title text-foreground font-semibold">
                          {isAllTime ? (t['common.all'] || 'All') : MONTH_NAMES[selectedMonth]}
                        </p>
                        {!isAllTime && (
                          <p className="text-caption text-muted-foreground">{selectedYear}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                        <PieIcon size={28} className="text-muted-foreground" />
                      </div>
                      <p className="text-body text-foreground">{t['expenses.no_data'] || 'No expense data'}</p>
                      <p className="text-caption text-muted-foreground mt-1">
                        {t['expenses.add_to_start'] || 'Add an expense to get started'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Category Breakdown List */}
              {breakdownData.length > 0 && (
                <div className="bg-card rounded-xl shadow-sm overflow-hidden">
                  {breakdownData.map((item, index) => {
                    const percentage = totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(0) : 0;
                    return (
                      <div
                        key={item.category}
                        className={`p-4 flex items-center justify-between ${
                          index !== breakdownData.length - 1 ? 'list-item-separator' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: item.config.bgColor, color: item.config.color }}
                          >
                            {item.config.icon}
                          </div>
                          <div>
                            <span className="text-body text-foreground">{getCategoryLabel(item.category)}</span>
                            <span className="text-caption text-muted-foreground ml-2">{percentage}%</span>
                          </div>
                        </div>
                        <span className="text-title text-foreground">{formatCurrency(item.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* List View - Unified Card */
            <div>
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                    <Receipt size={28} className="text-muted-foreground" />
                  </div>
                      <p className="text-body text-foreground">
                        {isAllTime 
                          ? (t['expenses.no_expenses_yet'] || 'No expenses yet') 
                          : `${t['expenses.no_expenses_month'] || 'No expenses in'} ${MONTH_NAMES_FULL[selectedMonth]}`}
                      </p>
                  <p className="text-caption text-muted-foreground mt-1">
                    {t['expenses.tap_add_first'] || 'Tap + to add your first expense'}
                  </p>
                </div>
              ) : (
                <div className="bg-card rounded-xl shadow-sm overflow-hidden">
                  {filteredExpenses.map((expense, index) => {
                    const config = getExpenseCategoryConfig(expense.category);
                    return (
            <button
              key={expense.id}
              type="button"
              onClick={() => openExistingModal(expense)}
              className={`w-full p-4 flex items-start gap-4 text-left hover:bg-secondary/50 transition-colors ${
                index !== filteredExpenses.length - 1 ? 'list-item-separator' : ''
              }`}
            >
              {/* Category Icon */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: config.bgColor, color: config.color }}
              >
                {config.icon}
              </div>
              
              {/* Info - 3 Lines */}
              <div className="flex-1 min-w-0">
                <p className="text-title text-foreground truncate">
                  <TranslatedMerchantName expense={expense} currentLang={currentLang} onUpdate={onUpdate} />
                </p>
                <p className="text-caption text-muted-foreground">{getCategoryLabel(expense.category)}</p>
                <p className="text-caption text-muted-foreground">
                  {new Date(expense.date).toLocaleDateString(
                    currentLang === 'en' ? 'en-GB' : currentLang,
                    { day: 'numeric', month: 'short', year: 'numeric' }
                  )}
                </p>
              </div>
              
              {/* Right Side - Amount & Receipt Indicator */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-title text-foreground">{formatCurrency(expense.amount, expense.currency)}</span>
                {expense.receiptUrl ? (
                  <ReceiptText size={14} className="text-muted-foreground" />
                ) : null}
              </div>
            </button>
                    );
                  })}
        </div>
      )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="helpy-footer">
          <span className="helpy-logo">helpy</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* FLOATING ACTION BUTTON */}
      {/* ─────────────────────────────────────────────────────────────── */}
              <button
        onClick={openAddExpenseSheet}
        disabled={isScanning}
        className={`fixed bottom-28 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center z-30 disabled:opacity-50 ${
          isModalOpen ? 'fab-hiding' : ''
        }`}
        aria-label={t['expenses.add_expense'] || 'Add Expense'}
      >
        <Plus size={24} />
              </button>

      {/* Hidden file inputs */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileUpload}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* TWO-STAGE PROGRESSIVE SHEET */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {addExpenseStage !== 'closed' && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover - fills the gap below the sheet */}
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
              onClick={closeAddExpenseSheet}
              className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors right-4 top-4 text-muted-foreground"
              aria-label={t['common.close'] || 'Close'}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border">
              <div className={addExpenseStage !== 'options' ? 'ml-10' : ''}>
                <h2 className="text-title text-foreground">
                  {addExpenseStage === 'options' && (t['expenses.add_expense'] || 'Add Expense')}
                  {addExpenseStage === 'manual' && (t['expenses.enter_expense'] || 'Enter Expense')}
                  {addExpenseStage === 'ocr' && (t['expenses.confirm_receipt'] || 'Confirm Receipt')}
                </h2>
                <p className="text-body text-muted-foreground mt-1">{t['expenses.in_currency'] || 'in'} {getCurrencySymbol()}</p>
              </div>
          </div>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* STAGE 1: OPTIONS (Compact - Thumb Friendly) */}
            {/* ─────────────────────────────────────────────────────────────── */}
            {addExpenseStage === 'options' && (
              <div className="p-5 pb-8 space-y-3">
                {/* Scan Options - Side by side for quick access */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="py-6 rounded-xl bg-secondary border border-border flex flex-col items-center justify-center gap-2 text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <ImageIcon size={28} />
                    <span className="text-body font-medium">{t['expenses.upload_photo'] || 'Upload Photo'}</span>
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-6 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center gap-2 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Camera size={28} />
                    <span className="text-body font-medium">{t['expenses.scan_receipt'] || 'Scan Receipt'}</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-caption text-muted-foreground">{t['expenses.or'] || 'or'}</span>
                  <div className="flex-1 h-px bg-border" />
          </div>

                {/* Manual Entry Button - Full width at bottom for thumb reach */}
                <button
                  onClick={enterManualMode}
                  className="w-full py-4 rounded-xl bg-secondary border border-border flex items-center justify-center gap-3 text-title text-foreground hover:bg-secondary/80 transition-colors"
                >
                  <Pencil size={20} />
                  {t['expenses.enter_manually'] || 'Enter Manually'}
                </button>
        </div>
      )}

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* STAGE 2A: MANUAL ENTRY FORM */}
            {/* ─────────────────────────────────────────────────────────────── */}
            {addExpenseStage === 'manual' && (
              <>
                {/* Back Button */}
                <button
                  onClick={() => setAddExpenseStage('options')}
                  className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors left-4 top-4 text-muted-foreground"
                  aria-label={t['common.back'] || 'Back'}
                >
                  <ArrowLeft size={20} />
              </button>

                <div className="p-5 space-y-4 max-h-[50vh] overflow-y-auto overflow-x-hidden">
                  {/* Amount - Auto-focused */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                      {t['expenses.amount'] || 'Amount'}
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-display text-foreground flex-shrink-0">
                        {getCurrencySymbol()}
                      </span>
                      <input
                        ref={amountInputRef}
                        type="text"
                        inputMode="decimal"
                        value={editAmount}
                        onChange={(e) => {
                          // Only allow digits and one decimal point
                          const value = e.target.value.replace(/[^\d.]/g, '');
                          // Prevent multiple decimal points
                          const parts = value.split('.');
                          const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                          setEditAmount(formatted);
                        }}
                        placeholder="0.00"
                        className="flex-1 px-4 py-4 rounded-xl bg-muted border border-border focus:border-primary outline-none transition-all text-display"
                      />
                    </div>
            </div>

                  {/* Shop Name */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                      {t['expenses.shop_name'] || 'Shop Name'}
                    </label>
                    <input
                      type="text"
                      value={editMerchant}
                      onChange={(e) => setEditMerchant(e.target.value)}
                      placeholder={t['common.where_did_you_spend']}
                      className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary outline-none transition-all text-body"
                    />
                  </div>

                  {/* Category & Date - Side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                        {t['common.category'] || 'Category'}
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary outline-none transition-all text-body"
                      >
                        {EXPENSE_CATEGORIES.map((cat) => {
                          const getCategoryLabel = (category: string) => {
                            const categoryMap: Record<string, string> = {
                              'Housing & Utilities': t['expenses.category.housing_utilities'] || category,
                              'Food & Daily Needs': t['expenses.category.food_daily'] || category,
                              'Transport & Travel': t['expenses.category.transport_travel'] || category,
                              'Health & Personal Care': t['expenses.category.health_personal'] || category,
                              'Fun & Lifestyle': t['expenses.category.fun_lifestyle'] || category,
                              'Miscellaneous': t['expenses.category.miscellaneous'] || category,
                            };
                            return categoryMap[category] || category;
                          };
                          return (
                            <option key={cat} value={cat}>
                              {getCategoryLabel(cat)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                        {t['expenses.date'] || 'Date'}
                      </label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary outline-none transition-all text-body"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer - Actions at bottom for thumb reach */}
                <div className="p-5 pb-8 border-t border-border">
                  <button
                    onClick={handleSaveExpense}
                    disabled={isSaving || !editAmount}
                    className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <span className="animate-pulse">{t['common.saving'] || 'Saving...'}</span>
                    ) : (
                      <>
                        <Check size={18} /> {t['common.save'] || 'Save'}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* STAGE 2B: OCR CONFIRMATION */}
            {/* ─────────────────────────────────────────────────────────────── */}
            {addExpenseStage === 'ocr' && pendingReceipt && (
              <>
                {/* Back Button */}
                <button
                  onClick={() => {
                    setPendingReceipt(null);
                    setAddExpenseStage('options');
                  }}
                  className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors left-4 top-4 text-muted-foreground"
                  aria-label={t['common.back'] || 'Back'}
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="p-5 space-y-4 max-h-[50vh] overflow-y-auto overflow-x-hidden">
            {/* Receipt Thumbnail - Clickable to zoom */}
                  <div 
                    className="rounded-xl overflow-hidden border border-border cursor-pointer relative group"
                    onClick={() => setIsImageZoomed(true)}
                  >
              <img 
                src={pendingReceipt.thumbnailBase64} 
                alt="Receipt" 
                className="w-full h-32 object-contain bg-secondary transition-transform group-hover:scale-105" 
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <span className="text-caption text-white opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded">
                  {t['expenses.tap_to_zoom'] || 'Tap to zoom'}
                </span>
              </div>
            </div>

                  {/* Amount */}
              <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                      {t['expenses.amount'] || 'Amount'}
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-display text-foreground flex-shrink-0">
                        {getCurrencySymbol()}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editAmount}
                        onChange={(e) => {
                          // Only allow digits and one decimal point
                          const value = e.target.value.replace(/[^\d.]/g, '');
                          // Prevent multiple decimal points
                          const parts = value.split('.');
                          const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                          setEditAmount(formatted);
                        }}
                        placeholder="0.00"
                        className="flex-1 px-4 py-4 rounded-xl bg-muted border border-border focus:border-primary outline-none transition-all text-display"
                      />
                    </div>
              </div>

                  {/* Shop Name */}
              <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                      {t['expenses.shop_name'] || 'Shop Name'}
                    </label>
                <input
                  type="text"
                  value={editMerchant}
                  onChange={(e) => setEditMerchant(e.target.value)}
                  placeholder={t['common.store_name']}
                      className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary outline-none transition-all text-body"
                />
              </div>

                  {/* Category & Date - Side by side */}
                  <div className="grid grid-cols-2 gap-3">
              <div>
                      <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                        {t['common.category'] || 'Category'}
                      </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary outline-none transition-all text-body"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                      <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                        {t['expenses.date'] || 'Date'}
                      </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary outline-none transition-all text-body"
                />
                    </div>
              </div>
            </div>

                {/* Footer - Actions at bottom for thumb reach */}
                <div className="p-5 pb-8 border-t border-border">
                  <button
                    onClick={handleSaveExpense}
                    disabled={isSaving || !editAmount}
                    className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <span className="animate-pulse">{t['common.saving'] || 'Saving...'}</span>
                    ) : (
                      <>
                        <Check size={18} /> {t['common.save'] || 'Save'}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* EXISTING EXPENSE BOTTOM SHEET */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {selectedExpense && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover - fills the gap below the sheet */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div 
            className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" 
            style={{ maxHeight: '85vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}
          >
            {/* Close Button */}
            <button
              onClick={closeExistingModal}
              className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors right-4 top-4 text-muted-foreground"
              aria-label={t['common.close'] || 'Close'}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <h2 className="text-title text-foreground">{selectedExpense.merchant}</h2>
              <p className="text-caption text-muted-foreground">
                {getCategoryLabel(selectedExpense.category || 'Miscellaneous')} ·{' '}
                {new Date(selectedExpense.date).toLocaleDateString(
                  currentLang === 'en' ? 'en-GB' : currentLang,
                  { day: 'numeric', month: 'short', year: 'numeric' }
                )}
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-5 space-y-4">
            {/* Receipt Thumbnail */}
            <div className="rounded-xl overflow-hidden border border-border">
              {selectedExpense.receiptUrl ? (
                <img
                  src={selectedExpense.receiptUrl}
                  alt="Receipt"
                  className="w-full max-h-64 object-contain bg-secondary"
                />
              ) : (
                <div className="w-full h-28 bg-secondary flex items-center justify-center text-muted-foreground">
                  {t['expenses.no_receipt_image'] || 'No receipt image'}
                </div>
              )}
            </div>

              {/* Amount - only show when not editing */}
              {!isEditingExisting && (
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">{t['expenses.amount'] || 'Amount'}</span>
                  <span className="text-title text-foreground">{formatCurrency(selectedExpense.amount, selectedExpense.currency)}</span>
                </div>
              )}

              {/* Edit Form - inside scroll for form fields only */}
              {isEditingExisting && (
                <div className="space-y-4 border-t border-border pt-4">
                  {/* Amount - Full width, prominent */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                      {t['expenses.amount'] || 'Amount'}
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-display text-foreground flex-shrink-0">
                        {getCurrencySymbol()}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="flex-1 px-4 py-4 rounded-xl bg-muted border border-border focus:border-primary outline-none transition-all text-display"
                        value={exAmount}
                        onChange={(e) => {
                          // Only allow digits and one decimal point
                          const value = e.target.value.replace(/[^\d.]/g, '');
                          // Prevent multiple decimal points
                          const parts = value.split('.');
                          const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                          setExAmount(formatted);
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Shop Name - Full width */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                      {t['expenses.shop_name'] || 'Shop Name'}
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary outline-none transition-all text-body"
                      value={exMerchant}
                      onChange={(e) => setExMerchant(e.target.value)}
                      placeholder={t['common.where_did_you_spend']}
                    />
                  </div>

                  {/* Category & Date - Side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                        {t['common.category'] || 'Category'}
                      </label>
                      <select
                        className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary outline-none transition-all text-body"
                        value={exCategory}
                        onChange={(e) => setExCategory(e.target.value)}
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {getCategoryLabel(c)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                        {t['expenses.date'] || 'Date'}
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary outline-none transition-all text-body"
                        value={exDate}
                        onChange={(e) => setExDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Confirmation - inside scroll for the message */}
              {confirmDeleteExisting && (
                <div className="border-t border-border pt-4">
                  <p className="text-body text-foreground">
                    {t['confirm.delete_expense'] || 'Are you sure you want to delete this receipt/expense?'}
                  </p>
                </div>
              )}
            </div>

            {/* Fixed Footer - Action buttons always visible */}
            <div className="shrink-0 p-5 pb-8 border-t border-border bg-card space-y-3">
              {/* Default Actions */}
              {!isEditingExisting && !confirmDeleteExisting && (
                <div className="flex items-center gap-3">
                  {/* Delete button - Hidden for Helper */}
                  {!isHelper && (
                  <button
                    className="p-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-60 transition-colors"
                    onClick={() => {
                      setConfirmDeleteExisting(true);
                      setIsEditingExisting(false);
                    }}
                    disabled={savingExisting}
                  >
                    <Trash2 size={20} />
                  </button>
                  )}
                  <button
                    className="flex-1 rounded-xl bg-primary px-4 py-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-60 inline-flex items-center justify-center gap-2 text-body transition-colors shadow-sm"
                    onClick={() => {
                      setIsEditingExisting(true);
                      setConfirmDeleteExisting(false);
                    }}
                    disabled={savingExisting}
                  >
                    <Edit size={18} /> {t['common.edit'] || 'Edit'}
                  </button>
                </div>
              )}

              {/* Edit Actions */}
              {isEditingExisting && (
                <button
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                  onClick={saveExistingEdit}
                  disabled={savingExisting}
                >
                  {savingExisting ? (t['common.saving'] || 'Saving...') : (t['common.save'] || 'Save')}
                </button>
              )}

              {/* Delete Confirmation Actions */}
              {confirmDeleteExisting && (
                <div className="flex items-center gap-3">
                  <button
                    className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors"
                    onClick={() => setConfirmDeleteExisting(false)}
                    disabled={savingExisting}
                  >
                    {t['common.cancel'] || 'Cancel'}
                  </button>
                  <button
                    className="flex-1 py-3.5 rounded-xl bg-destructive text-primary-foreground text-body hover:bg-destructive/90 transition-colors disabled:opacity-50"
                    onClick={confirmExistingDelete}
                    disabled={savingExisting}
                  >
                    {savingExisting ? (t['common.deleting'] || 'Deleting...') : (t['expenses.yes_delete'] || 'Yes, delete')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* IMAGE ZOOM MODAL */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {isImageZoomed && pendingReceipt && (
        <ZoomableImage
          imageSrc={pendingReceipt.thumbnailBase64}
          onClose={() => setIsImageZoomed(false)}
          t={t}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* MONTH PICKER BOTTOM SHEET */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {isMonthPickerOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover - fills the gap below the sheet */}
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
              onClick={() => setIsMonthPickerOpen(false)}
              className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors right-4 top-4 text-muted-foreground"
              aria-label={t['common.close'] || 'Close'}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border">
              <h2 className="text-title text-foreground">{t['expenses.select_month'] || 'Select Month'}</h2>
    </div>

            {/* Year Selector */}
            <div className="flex items-center justify-center gap-4 py-4 border-b border-border">
              <button
                onClick={() => setPickerYear(pickerYear - 1)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground"
              >
                <ChevronLeft size={24} />
              </button>
              <span className="text-display text-foreground min-w-[100px] text-center">{pickerYear}</span>
              <button
                onClick={() => setPickerYear(pickerYear + 1)}
                disabled={pickerYear >= now.getFullYear()}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={24} />
              </button>
            </div>

            {/* Month Grid */}
            <div className="p-5">
              <div className="grid grid-cols-4 gap-2">
                {MONTH_NAMES.map((month, index) => {
                  const isSelected = index === selectedMonth && pickerYear === selectedYear;
                  const isFuture = pickerYear > now.getFullYear() || (pickerYear === now.getFullYear() && index > now.getMonth());
                  return (
                    <button
                      key={month}
                      onClick={() => {
                        if (!isFuture) {
                          setSelectedMonth(index);
                          setSelectedYear(pickerYear);
                          setIsMonthPickerOpen(false);
                        }
                      }}
                      disabled={isFuture}
                      className={`py-3 rounded-xl text-body transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : isFuture
                          ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed'
                          : 'bg-secondary text-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-5 pb-8 border-t border-border">
              <button
                onClick={() => {
                  setSelectedMonth(now.getMonth());
                  setSelectedYear(now.getFullYear());
                  setIsMonthPickerOpen(false);
                }}
                className="w-full py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors"
              >
                {t['expenses.go_current_month'] || 'Go to Current Month'}
              </button>
              <button
                onClick={() => {
                  setSelectedMonth(null);
                  setSelectedYear(null);
                  setIsMonthPickerOpen(false);
                }}
                className="w-full mt-3 py-3.5 rounded-xl bg-card text-foreground text-body border border-border hover:bg-secondary/60 transition-colors"
              >
                {t['expenses.show_all_expenses'] || 'Show All Expenses'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
