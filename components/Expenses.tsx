import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getHKDateString } from '../utils/dateUtils';
import { createPortal } from 'react-dom';
import {
  Camera,
  PieChart as PieIcon,
  List,
  X,
  Image as ImageIcon,
  AlertCircle,
  Check,
  Trash2,
  Receipt,
  ReceiptText,
  Plus,
  ArrowLeft,
  Home,
  ShoppingCart,
  Car,
  Heart,
  Handbag,
  Stone,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Lock,
  ZoomIn,
  Loader2,
} from 'lucide-react';
import { useScrollHeader } from '@/hooks/useScrollHeader';
import { useTranslatedContent } from '@/hooks/useTranslatedContent';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useSheetTheme } from '@/hooks/useSheetTheme';
import { Expense, BaseViewProps, User, UserRole, HouseholdPlan, UsageStatus } from '../types';
import { FREE_AI_SCAN_LIMIT } from '../services/trialService';
import { EXPENSE_CATEGORIES } from '../constants';
import { detectInputLanguage } from '../services/languageDetectionService';
import { haptics } from '../utils/haptics';
import { formatCurrency, DEFAULT_CURRENCY, getCurrencySymbol } from '../currencyConfig';
import {
  uploadReceiptImage,
  createReceiptRecord,
  updateReceiptWithOCR,
  linkReceiptToExpense,
  deleteReceiptByExpenseId,
  getKnownMerchants,
} from '../services/receiptService';
import { supabase } from '../services/supabase';
import { processReceipt, ParsedReceipt } from '../services/visionService';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useDemoMode } from '../contexts/DemoModeContext';
import { logger } from '../utils/logger';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraSource, CameraResultType } from '@capacitor/camera';

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
  'Fun & Lifestyle': { color: '#F06292', bgColor: '#FCE4EC', icon: <Handbag size={18} /> },
  'Misc': { color: '#757575', bgColor: '#F5F5F5', icon: <Stone size={18} /> },
};

const getExpenseCategoryConfig = (category: string): ExpenseCategoryConfig => {
  return EXPENSE_CATEGORY_CONFIG[category] || EXPENSE_CATEGORY_CONFIG['Misc'];
};

const getLocalDateString = getHKDateString;

// Zoomable Image Component - optimized for smooth, jitter-free gestures with bounds
const ZoomableImage: React.FC<{ imageSrc: string; onClose: () => void; t: Record<string, string> }> = ({ imageSrc, onClose, t }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  // Store transform values in refs to avoid re-renders during gestures
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const gestureRef = useRef({
    isGesturing: false,
    startDistance: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    startCenterX: 0,
    startCenterY: 0,
    lastTouchX: 0,
    lastTouchY: 0,
  });
  
  // Only used for UI display (instructions text)
  const [isZoomed, setIsZoomed] = useState(false);

  // Constrain position to keep image within bounds
  const constrainPosition = (x: number, y: number, scale: number) => {
    if (!imageRef.current || !imageContainerRef.current) return { x, y };
    
    const img = imageRef.current;
    const container = imageContainerRef.current;
    
    // Get the natural dimensions and displayed dimensions
    const containerRect = container.getBoundingClientRect();
    const imgWidth = img.offsetWidth;
    const imgHeight = img.offsetHeight;
    
    // Calculate how much the image extends beyond the container when scaled
    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;
    
    // Calculate max allowed pan (half the overflow on each side)
    const maxPanX = Math.max(0, (scaledWidth - containerRect.width) / 2);
    const maxPanY = Math.max(0, (scaledHeight - containerRect.height) / 2);
    
    // Constrain position
    const constrainedX = Math.max(-maxPanX, Math.min(maxPanX, x));
    const constrainedY = Math.max(-maxPanY, Math.min(maxPanY, y));
    
    return { x: constrainedX, y: constrainedY };
  };

  // Apply transform directly to DOM for smooth updates (no React re-render)
  const applyTransform = (constrain = false) => {
    if (imageRef.current) {
      const t = transformRef.current;
      
      if (constrain) {
        const constrained = constrainPosition(t.x, t.y, t.scale);
        t.x = constrained.x;
        t.y = constrained.y;
      }
      
      imageRef.current.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
    }
  };

  // Use non-passive touch event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefaultTouch = (e: TouchEvent) => {
      if (e.touches.length >= 1) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    return () => container.removeEventListener('touchmove', preventDefaultTouch);
  }, []);

  const getDistance = (t1: Touch, t2: Touch) => {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const g = gestureRef.current;
    const t = transformRef.current;
    
    if (e.touches.length === 2) {
      // Pinch start
      g.isGesturing = true;
      g.startDistance = getDistance(e.touches[0], e.touches[1]);
      g.startScale = t.scale;
      g.startX = t.x;
      g.startY = t.y;
      g.startCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      g.startCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      // Disable CSS transition during gesture
      if (imageRef.current) {
        imageRef.current.style.transition = 'none';
      }
    } else if (e.touches.length === 1 && t.scale > 1) {
      // Pan start
      g.isGesturing = true;
      g.lastTouchX = e.touches[0].clientX;
      g.lastTouchY = e.touches[0].clientY;
      
      if (imageRef.current) {
        imageRef.current.style.transition = 'none';
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const g = gestureRef.current;
    const t = transformRef.current;
    
    if (e.touches.length === 2 && g.startDistance > 0) {
      // Pinch zoom
      const distance = getDistance(e.touches[0], e.touches[1]);
      const currentCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const currentCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      // Calculate new scale
      const newScale = Math.max(1, Math.min(5, g.startScale * (distance / g.startDistance)));
      const scaleChange = newScale / g.startScale;
      
      // Calculate new position to keep focal point under fingers
      let newX = g.startX - (g.startCenterX - g.startX) * (scaleChange - 1) + (currentCenterX - g.startCenterX);
      let newY = g.startY - (g.startCenterY - g.startY) * (scaleChange - 1) + (currentCenterY - g.startCenterY);
      
      // Constrain position during pinch
      const constrained = constrainPosition(newX, newY, newScale);
      
      // Update refs and apply directly to DOM
      t.scale = newScale;
      t.x = constrained.x;
      t.y = constrained.y;
      applyTransform();
      
    } else if (e.touches.length === 1 && g.isGesturing && t.scale > 1) {
      // Pan with constraints
      const deltaX = e.touches[0].clientX - g.lastTouchX;
      const deltaY = e.touches[0].clientY - g.lastTouchY;
      
      const newX = t.x + deltaX;
      const newY = t.y + deltaY;
      
      // Apply constraints
      const constrained = constrainPosition(newX, newY, t.scale);
      t.x = constrained.x;
      t.y = constrained.y;
      
      g.lastTouchX = e.touches[0].clientX;
      g.lastTouchY = e.touches[0].clientY;
      
      applyTransform();
    }
  };

  const handleTouchEnd = () => {
    const g = gestureRef.current;
    const t = transformRef.current;
    
    g.isGesturing = false;
    g.startDistance = 0;
    
    // Re-enable transition for snap-back animation
    if (imageRef.current) {
      imageRef.current.style.transition = 'transform 0.2s ease-out';
    }
    
    // Reset if zoomed out
    if (t.scale <= 1) {
      t.scale = 1;
      t.x = 0;
      t.y = 0;
      applyTransform();
      setIsZoomed(false);
    } else {
      // Apply final constraints with animation
      applyTransform(true);
      setIsZoomed(true);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const t = transformRef.current;
    
    if (imageRef.current) {
      imageRef.current.style.transition = 'transform 0.25s ease-out';
    }
    
    if (t.scale > 1) {
      // Reset
      t.scale = 1;
      t.x = 0;
      t.y = 0;
      setIsZoomed(false);
    } else {
      // Zoom towards tap point - get tap position relative to image center
      const imgRect = imageRef.current?.getBoundingClientRect();
      if (imgRect) {
        const targetScale = 2.5;
        const imgCenterX = imgRect.left + imgRect.width / 2;
        const imgCenterY = imgRect.top + imgRect.height / 2;
        
        // Calculate offset from center to tap point
        const offsetX = e.clientX - imgCenterX;
        const offsetY = e.clientY - imgCenterY;
        
        // New position moves opposite to offset, scaled
        let newX = -offsetX * (targetScale - 1);
        let newY = -offsetY * (targetScale - 1);
        
        // Apply constraints
        const constrained = constrainPosition(newX, newY, targetScale);
        t.x = constrained.x;
        t.y = constrained.y;
        t.scale = targetScale;
        setIsZoomed(true);
      } else {
        t.scale = 2.5;
        setIsZoomed(true);
      }
    }
    
    applyTransform();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const t = transformRef.current;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    t.scale = Math.max(1, Math.min(5, t.scale * delta));
    applyTransform(true);
    setIsZoomed(t.scale > 1);
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      style={{ touchAction: 'none', zIndex: 99999 }}
    >
      <div className="relative w-full max-w-lg flex flex-col items-center">
        {/* Close button - helpy blue with white X */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute -top-2 -right-2 text-white z-10 w-10 h-10 rounded-full bg-primary shadow-lg flex items-center justify-center"
          aria-label={t['common.close'] || 'Close'}
        >
          <X size={20} />
        </button>
        
        {/* Image container - helpy white background */}
        <div 
          ref={imageContainerRef}
          className="overflow-hidden rounded-2xl bg-card w-full shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <img 
            ref={imageRef}
            src={imageSrc} 
            alt="Receipt" 
            className="w-full object-contain select-none"
            style={{
              maxHeight: '70vh',
              transform: 'translate(0px, 0px) scale(1)',
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-out',
              touchAction: 'none',
              willChange: 'transform',
            }}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleClick}
            draggable={false}
          />
        </div>
        
        {/* Instructions - pill style for visibility */}
        <p className="text-caption text-primary mt-4 text-center bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm">
          {isZoomed 
            ? `${t['expenses.double_tap_reset'] || 'Double tap to reset'} · ${t['expenses.drag_to_pan'] || 'Drag to pan'}` 
            : `${t['expenses.pinch_to_zoom'] || 'Pinch to zoom'} · ${t['expenses.double_tap_zoom'] || 'Double tap to zoom'}`}
        </p>
      </div>
    </div>
  );
};

interface ExpensesProps extends BaseViewProps {
  expenses: Expense[];
  householdId: string;
  currentUser: User;
  householdPlan?: HouseholdPlan | null;
  onNavigateToPlan?: () => void;
  onAdd: (expense: Expense) => Promise<Expense> | Expense | void;
  onUpdate?: (expense: Expense) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  autoOpenSheet?: boolean; // Auto-open add sheet when navigating from Home (+) button
  // Usage-based limits support
  usageStatus?: UsageStatus;
  onShowUsageLimitModal?: (feature: 'aiScan' | 'salarySign' | 'spendingSummary') => void;
  onIncrementAiScan?: () => Promise<void>;
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
  householdPlan,
  onNavigateToPlan,
  onAdd,
  onUpdate,
  onDelete,
  t,
  currentLang,
  autoOpenSheet,
  usageStatus,
  onShowUsageLimitModal,
  onIncrementAiScan,
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Role-based permissions
  // ─────────────────────────────────────────────────────────────────
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  
  // Get demo mode toggles (SuperAdmin only feature)
  const { isSimulatingFreeUser, isViewingAsHelper } = useDemoMode();
  
  // isHelper: true if actual Helper OR SuperAdmin viewing as Helper
  const isHelper = currentUser.role === UserRole.HELPER || (isSuperAdmin && isViewingAsHelper);

  const planKey = (householdPlan?.plan || 'free') as 'free' | 'core' | 'pro' | 'test';
  // SuperAdmin bypasses plan restrictions UNLESS simulating free user
  const isOnFreePlan = planKey === 'free' && (!isSuperAdmin || isSimulatingFreeUser);
  
  // Usage-based access checks
  const canUseAiScan = usageStatus?.canUseAiScan ?? true;
  const canUseSpendingSummary = usageStatus?.canUseSpendingSummary ?? true;
  const hasPaidSubscription = usageStatus?.hasPaidSubscription ?? false;
  
  // AI scan is restricted if: on free plan AND no scans remaining
  const isAiScanRestricted = isOnFreePlan && !canUseAiScan && !hasPaidSubscription;
  
  // Spending summary is restricted if: on free plan AND trial expired
  const isSpendingSummaryRestricted = isOnFreePlan && !canUseSpendingSummary && !hasPaidSubscription;
  
  // For backwards compatibility with existing code
  const isFreePlan = isOnFreePlan && !hasPaidSubscription;
  
  const planLabel =
    planKey === 'core' ? 'Core' : planKey === 'pro' ? 'Pro' : planKey === 'test' ? 'Test' : 'Free';
  
  // Helper function to show usage limit modal when limits are reached
  const showAiScanLimitModal = () => {
    if (onShowUsageLimitModal) {
      onShowUsageLimitModal('aiScan');
    }
  };
  
  const showSpendingSummaryLimitModal = () => {
    if (onShowUsageLimitModal) {
      onShowUsageLimitModal('spendingSummary');
    }
  };

  const [view, setView] = useState<'list' | 'chart'>('list');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Month/Year Selection State
  const now = new Date();
  // Default to current month of the current year
  const [selectedMonth, setSelectedMonth] = useState<number | null>(now.getMonth()); // 0-indexed (0 = January, 11 = December)
  const [selectedYear, setSelectedYear] = useState<number | null>(now.getFullYear());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear()); // Year shown in picker

  // Two-Stage Progressive Sheet State
  const [addExpenseStage, setAddExpenseStage] = useState<AddExpenseStage>('closed');

  // OCR State (for stage: 'ocr')
  const [pendingReceipt, setPendingReceipt] = useState<PendingReceipt | null>(null);
  const [zoomImageSrc, setZoomImageSrc] = useState<string | null>(null);

  // Shared form fields (used by both OCR and Manual entry)
  const [editAmount, setEditAmount] = useState<string>('');
  const [editMerchant, setEditMerchant] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [editDate, setEditDate] = useState<string>(getLocalDateString());
  const [isSaving, setIsSaving] = useState(false);

  // Existing Expense Modal State
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [confirmDeleteExisting, setConfirmDeleteExisting] = useState(false);
  const [savingExisting, setSavingExisting] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [triedReceiptRefresh, setTriedReceiptRefresh] = useState(false);
  const [receiptImageLoaded, setReceiptImageLoaded] = useState(false);

  const [exAmount, setExAmount] = useState<string>('');
  const [exMerchant, setExMerchant] = useState<string>('');
  const [exCategory, setExCategory] = useState<string>('');
  const [exDate, setExDate] = useState<string>('');

  const [localExpenses, setLocalExpenses] = useState<Expense[]>([...expenses]);
  const [showFreeUpgradeBanner, setShowFreeUpgradeBanner] = useState(false);
  const [showSummaryUpgradeModal, setShowSummaryUpgradeModal] = useState(false);

  // Scroll header hook
  const { isScrolled } = useScrollHeader();
  
  // Lock body scroll when any modal is open
  useScrollLock(addExpenseStage !== 'closed' || !!selectedExpense || isMonthPickerOpen);
  
  // Dim status bar when sheet is open (iOS)
  useSheetTheme(addExpenseStage !== 'closed' || !!selectedExpense || isMonthPickerOpen || showSummaryUpgradeModal);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  // Cache for preloaded receipt URLs - maps expense ID to signed URL
  const preloadedReceiptUrls = useRef<Map<string, string>>(new Map());
  
  // Track previous selected expense ID to avoid resetting image on same-expense updates
  const prevSelectedExpenseId = useRef<string | null>(null);

  useEffect(() => {
    setLocalExpenses([...expenses]);
  }, [expenses]);
  
  // Preload receipt images in background when expenses load
  useEffect(() => {
    const preloadReceipts = async () => {
      // Only preload expenses with receipts that aren't already cached
      const expensesWithReceipts = localExpenses.filter(
        (e) => e.receiptUrl && !preloadedReceiptUrls.current.has(e.id)
      );
      
      // Limit to recent 10 expenses to avoid too many requests
      const toPreload = expensesWithReceipts.slice(0, 10);
      
      for (const expense of toPreload) {
        if (!expense.receiptUrl) continue;
        
        try {
          // Get fresh signed URL
          let path = expense.receiptUrl;
          if (path.startsWith('http')) {
            const parsed = new URL(path);
            const marker = '/receipts/';
            const idx = parsed.pathname.indexOf(marker);
            if (idx !== -1) {
              path = decodeURIComponent(parsed.pathname.slice(idx + marker.length));
            }
          }
          
          const { data, error } = await supabase.storage
            .from('receipts')
            .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
          
          if (!error && data?.signedUrl) {
            // Cache the signed URL
            preloadedReceiptUrls.current.set(expense.id, data.signedUrl);
            
            // Preload the actual image into browser cache
            const img = new Image();
            img.src = data.signedUrl;
          }
        } catch (err) {
          // Silently fail - this is just preloading
        }
      }
    };
    
    preloadReceipts();
  }, [localExpenses]);

  useEffect(() => {
    if (!selectedExpense) {
      setReceiptPreviewUrl(null);
      setTriedReceiptRefresh(false);
      setReceiptImageLoaded(false);
      prevSelectedExpenseId.current = null;
      return;
    }
    
    // Check if this is the same expense (just updated) or a different one
    const isSameExpense = prevSelectedExpenseId.current === selectedExpense.id;
    prevSelectedExpenseId.current = selectedExpense.id;
    
    // Only reset image loading state when switching to a DIFFERENT expense
    if (!isSameExpense) {
      setReceiptImageLoaded(false);
      setTriedReceiptRefresh(false);
    }
    
    setExAmount((selectedExpense.amount ?? 0).toFixed(2));
    setExMerchant(selectedExpense.merchant || '');
    setExCategory(selectedExpense.category || EXPENSE_CATEGORIES[0]);
    // Normalize date to YYYY-MM-DD format
    let iso: string;
    try {
      if (selectedExpense.date && /^\d{4}-\d{2}-\d{2}$/.test(selectedExpense.date)) {
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

    // Only fetch/set receipt URL when switching to a different expense
    if (!isSameExpense) {
      // Check if we have a preloaded URL - use it instantly!
      const preloadedUrl = preloadedReceiptUrls.current.get(selectedExpense.id);
      if (preloadedUrl) {
        setReceiptPreviewUrl(preloadedUrl);
        // Image should already be in browser cache, so it will load instantly
        return;
      }

      // Fallback: use the stored URL and refresh in background
      setReceiptPreviewUrl(selectedExpense.receiptUrl || null);
      
      // Proactively refresh signed receipt URLs so images remain viewable even when cached links expire
      let cancelled = false;
      (async () => {
        if (!selectedExpense.receiptUrl) return;
        const refreshed = await refreshReceiptUrl(selectedExpense.receiptUrl);
        if (!cancelled && refreshed) {
          setReceiptPreviewUrl(refreshed);
          // Also cache for future use
          preloadedReceiptUrls.current.set(selectedExpense.id, refreshed);
        }
      })();

      return () => {
        cancelled = true;
      };
    }
  }, [selectedExpense]);

  // Note: Auto-focus removed for better UX on sheets

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
    
    // Filter by month/year if selected
    let filtered: Expense[];
    if (selectedMonth === null || selectedYear === null) {
      // When no month/year is selected, show all (filtered) expenses
      filtered = baseExpenses;
    } else {
      filtered = baseExpenses.filter((expense) => {
        if (!expense.date || typeof expense.date !== 'string') {
          logger.warn('[Expenses] Invalid date for expense:', expense.id, expense.date);
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
                  logger.warn('[Expenses] Could not parse date:', expense.date, 'for expense:', expense.id);
                  return false;
                }
              }
            }
          }
        }

        // Validate parsed values
        if (year === null || month === null || isNaN(year) || isNaN(month) || month < 1 || month > 12) {
          logger.warn('[Expenses] Invalid parsed date values:', { year, month, date: expense.date, expenseId: expense.id });
          return false;
        }

        // Compare with selected month/year (month is 0-indexed in selectedMonth)
        return (month - 1) === selectedMonth && year === selectedYear;
      });
    }
    
    // Sort by date (newest first)
    return filtered.sort((a, b) => {
      // YYYY-MM-DD format is naturally sortable as strings
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA); // Descending order (newest first)
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
    setEditDate(getLocalDateString());
    setPendingReceipt(null);
    setError(null); // Clear any previous errors
    
    // Show upgrade banner if AI scan limit reached, otherwise show scan options
    const showUpgradeBanner = isAiScanRestricted;
    setShowFreeUpgradeBanner(showUpgradeBanner);
    
    // If user can still scan (has remaining scans or paid plan), show options
    // Otherwise, go straight to manual entry
    setAddExpenseStage(showUpgradeBanner ? 'manual' : 'options');
  };

  // Auto-open add sheet when navigating from Home (+) button
  useEffect(() => {
    if (autoOpenSheet) {
      openAddExpenseSheet();
    }
  }, [autoOpenSheet]);

  const closeAddExpenseSheet = () => {
    setAddExpenseStage('closed');
    setPendingReceipt(null);
    setEditAmount('');
    setEditMerchant('');
    setEditCategory(EXPENSE_CATEGORIES[0]);
    setEditDate(getLocalDateString());
    setShowFreeUpgradeBanner(false);
  };

  // ─────────────────────────────────────────────────────────────────
  // Enter Manual Mode
  // ─────────────────────────────────────────────────────────────────
  const enterManualMode = () => {
    setAddExpenseStage('manual');
  };

  const handleExpenseUpgrade = () => {
    localStorage.setItem('helpy_profile_target_section', 'plan');
    onNavigateToPlan?.();
    closeAddExpenseSheet();
  };

  const handleExpenseReturn = () => {
    closeAddExpenseSheet();
  };

  // ─────────────────────────────────────────────────────────────────
  // Receipt Scanning Flow
  // ─────────────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check if AI scan is restricted (limit reached)
    if (isAiScanRestricted) {
      showAiScanLimitModal();
      e.target.value = '';
      return;
    }
    
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

      logger.log('[OCR] Parsed receipt:', {
        total: parsed.total,
        merchant: parsed.merchant,
        lineItemsCount: parsed.lineItems?.length || 0,
        lineItems: parsed.lineItems,
      });
      
      // Increment AI scan count after successful scan (for free plan users)
      if (!hasPaidSubscription && onIncrementAiScan) {
        onIncrementAiScan();
      }
      
      setPendingReceipt({ receiptId, imageUrl: url, thumbnailBase64, parsed });
      setEditAmount(parsed.total.toFixed(2));
      setEditMerchant(parsed.merchant);
      setEditCategory(parsed.category || EXPENSE_CATEGORIES[0]);
      setEditDate(parsed.date || getLocalDateString());
      setAddExpenseStage('ocr'); // Show OCR confirmation
    } catch (err) {
      logger.error('Receipt processing failed:', err);
      // Check for specific OCR errors and show user-friendly messages
      const errorMsg = err instanceof Error ? err.message.toLowerCase() : '';
      if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
        setError(t['error.ocr_busy'] || 'Receipt scanning is busy. Please try again in a moment.');
      } else {
        setError(t['error.ocr_failed'] || 'Could not read this receipt. Please try a clearer photo.');
      }
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  // Native camera capture: opens device camera directly (fixes Android file picker issue)
  const handleCameraCapture = async () => {
    if (isAiScanRestricted) {
      showAiScanLimitModal();
      return;
    }
    const isNative = Capacitor.isNativePlatform();
    if (isNative) {
      setAddExpenseStage('closed');
      setIsScanning(true);
      setError(null);
      try {
        const photo = await CapacitorCamera.getPhoto({
          source: CameraSource.CAMERA,
          quality: 0.9,
          resultType: CameraResultType.Base64,
        });
        if (!photo.base64String) throw new Error('No image captured');
        const base64Data = photo.base64String;
        const fileType = (photo.format || 'jpeg') as string;
        const thumbnailBase64 = `data:image/${fileType};base64,${base64Data}`;
        const knownMerchantsPromise = getKnownMerchants(householdId).catch(() => [] as string[]);
        const { url, path } = await uploadReceiptImage(householdId, base64Data, fileType);
        const receiptId = await createReceiptRecord(householdId, path, url);
        const knownMerchants = await knownMerchantsPromise;
        const parsed = await processReceipt(base64Data, { knownMerchants });
        await updateReceiptWithOCR(receiptId, parsed);
        logger.log('[OCR] Parsed receipt:', { total: parsed.total, merchant: parsed.merchant, lineItemsCount: parsed.lineItems?.length || 0 });
        if (!hasPaidSubscription && onIncrementAiScan) onIncrementAiScan();
        setPendingReceipt({ receiptId, imageUrl: url, thumbnailBase64, parsed });
        setEditAmount(parsed.total.toFixed(2));
        setEditMerchant(parsed.merchant);
        setEditCategory(parsed.category || EXPENSE_CATEGORIES[0]);
        setEditDate(parsed.date || getLocalDateString());
        setAddExpenseStage('ocr');
      } catch (err) {
        const msg = (err as { message?: string })?.message ?? '';
        if (/cancel/i.test(msg)) return; // User cancelled - don't show error
        logger.error('Receipt processing failed:', err);
        const errorMsg = err instanceof Error ? err.message.toLowerCase() : '';
        setError(errorMsg.includes('rate limit') || errorMsg.includes('429')
          ? (t['error.ocr_busy'] || 'Receipt scanning is busy. Please try again in a moment.')
          : (t['error.ocr_failed'] || 'Could not read this receipt. Please try a clearer photo.'));
      } finally {
        setIsScanning(false);
      }
    } else {
      cameraInputRef.current?.click();
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
    let normalizedDate = editDate || getLocalDateString();
    if (normalizedDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      try {
        const parsed = new Date(normalizedDate);
        if (!isNaN(parsed.getTime())) {
          normalizedDate = getLocalDateString(parsed);
        } else {
          normalizedDate = getLocalDateString();
        }
      } catch {
        normalizedDate = getLocalDateString();
      }
    }

    const extractedLineItems = pendingReceipt?.parsed.lineItems || [];
    logger.log('[Save] Line items being saved:', {
      hasPendingReceipt: !!pendingReceipt,
      lineItemsCount: extractedLineItems.length,
      lineItems: extractedLineItems,
    });

    const newExpense: Expense = {
      id: Date.now().toString(),
      amount: amount,
      currency: DEFAULT_CURRENCY,
      merchant: editMerchant.trim() || 'Unknown',
      category: editCategory || 'Misc',
      date: normalizedDate,
      receiptUrl: pendingReceipt?.imageUrl || undefined,
      createdBy: currentUser.id,
      lineItems: extractedLineItems,
      merchantLang: detectInputLanguage(currentLang) || null,
      merchantTranslations: {},
    };

    let savedExpenseId: string | null = null;
    // Track whether save actually succeeded - only set to true AFTER successful save
    let expenseLikelySaved = false;

    try {
      if (onAdd) {
        logger.log('[Expenses] Calling onAdd with expense ID:', newExpense.id);
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
        
        logger.log('[Expenses] onAdd returned expense:', savedExpense);
        
        // Use the actual UUID from database if returned
        if (savedExpense && savedExpense.id) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(savedExpense.id);
          if (isUuid) {
            savedExpenseId = savedExpense.id;
            logger.log('[Expenses] Using UUID from database:', savedExpenseId);
          } else {
            logger.warn('[Expenses] onAdd returned non-UUID ID:', savedExpense.id);
          }
        }
        expenseLikelySaved = true;
      }

      // Link receipt (non-blocking)
      if (pendingReceipt && savedExpenseId) {
        try {
          await new Promise(resolve => setTimeout(resolve, 200)); // ensure commit
          logger.log('[Expenses] Linking receipt to expense ID (UUID):', savedExpenseId);
          await linkReceiptToExpense(pendingReceipt.receiptId, savedExpenseId);
          logger.log('[Expenses] Receipt linked to expense successfully');
        } catch (linkError) {
          logger.warn('[Expenses] Failed to link receipt (non-fatal):', linkError);
        }
      } else if (pendingReceipt) {
        logger.warn('[Expenses] Cannot link receipt - no valid expense UUID available');
      }

      // Haptic feedback on successful save
      haptics.success();
      
      // Success - close the modal
      closeAddExpenseSheet();
      
    } catch (addError) {
      logger.error('[Expenses] Error saving expense:', addError);
      if (!expenseLikelySaved) {
        // Save failed - show error and keep modal open so user can retry
        setError(t['error.save_expense'] || "Couldn't save expense. Please try again.");
        haptics.error();
        // DON'T close modal - let user see the error and retry
      } else {
        // Expense was likely saved (optimistic or returned), so close modal
        logger.warn('[Expenses] Expense likely saved; closing modal.');
        setError(null);
        haptics.success();
        closeAddExpenseSheet();
      }
    } finally {
      // Always clear saving state so the user isn't stuck
      setIsSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Existing Expense Modal
  // ─────────────────────────────────────────────────────────────────
  function openExistingModal(exp: Expense) {
    setSelectedExpense(exp);
    setConfirmDeleteExisting(false);
  }

  function closeExistingModal() {
    setSelectedExpense(null);
    setConfirmDeleteExisting(false);
  }

  // Refresh a receipt URL with a fresh signed link when the stored one has expired or is private
  async function refreshReceiptUrl(originalUrl?: string): Promise<string | null> {
    if (!originalUrl) return null;
    try {
      let path = originalUrl;

      // If we were given a full URL, extract the path after the bucket name
      if (originalUrl.startsWith('http')) {
        const parsed = new URL(originalUrl);
        const marker = '/receipts/';
        const idx = parsed.pathname.indexOf(marker);
        if (idx === -1) return null;
        path = decodeURIComponent(parsed.pathname.slice(idx + marker.length));
      }

      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

      if (error) {
        logger.warn('[Expenses] Failed to refresh signed receipt URL:', error.message);
        return null;
      }
      return data?.signedUrl || null;
    } catch (err) {
      logger.warn('[Expenses] Could not parse receipt URL for signing:', err);
      return null;
    }
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
            normalizedDate = getLocalDateString(parsed);
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
      // Close modal after successful save (no more View mode)
      closeExistingModal();
    } catch (err) {
      logger.error('Failed to update expense:', err);
      setError(t['error.update_expense'] || "Couldn't update expense. Please check your connection and try again.");
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
      logger.error('Failed to delete expense:', err);
      setError(t['error.delete_expense'] || "Couldn't delete expense. Please check your connection and try again.");
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
      'Misc': t['expenses.category.miscellaneous'] || category,
    };
    return categoryMap[category] || category;
  };

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* STICKY HEADER - Push Up (No Shrink) */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header 
          className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6" 
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <div 
            className="pb-3 flex items-end"
            style={{ height: '120px', boxShadow: '0 10px 0 0 hsl(var(--background))' }}
          >
            <div className="flex items-center justify-between w-full">
            <h1 className="text-display text-foreground">
              {t['expenses.title']}
            </h1>
            {/* Month Selector Button */}
            <button
              onClick={() => {
                setPickerYear(selectedYear ?? now.getFullYear());
                setIsMonthPickerOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary text-foreground text-body font-medium"
            >
              <Calendar size={16} />
              <span>{selectedMonth === null || selectedYear === null ? t['common.all_expenses'] : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`}</span>
              <ChevronDown size={16} />
          </button>
            </div>
          </div>
        </header>

        {/* Summary Card - Same structure as section cards */}
        {!isHelper && (
        <div className="mt-4 mb-2 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-full px-3 py-2 rounded-xl text-left bg-transparent">
              <div className="flex items-center justify-between" style={{ height: '47px' }}>
                <span className="font-bold text-foreground" style={{ fontSize: '1.25rem' }}>
                  {selectedMonth === null ? (t['common.all_expenses'] || 'All Expenses') : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
                </span>
                <span className="font-bold text-foreground" style={{ fontSize: '1.25rem' }}>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
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
            top: '118px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          <div
            className="relative rounded-full overflow-hidden"
            style={{ backgroundColor: 'hsl(var(--muted))' }}
          >
            <div className="flex p-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setView('list')}
                className={`flex-1 px-4 py-2 rounded-full text-body font-medium whitespace-nowrap transition-all flex items-center justify-center gap-2 ${
                  view === 'list'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                <List size={18} />
                {t['common.list']}
          </button>
          <button
                onClick={() => {
                  if (isSpendingSummaryRestricted) {
                    showSpendingSummaryLimitModal();
                  } else {
                    setView('chart');
                  }
                }}
                className={`flex-1 px-4 py-2 rounded-full text-body font-medium whitespace-nowrap transition-all flex items-center justify-center gap-2 ${
                  view === 'chart' && !isSpendingSummaryRestricted
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                {isSpendingSummaryRestricted ? <Lock size={18} /> : <PieIcon size={18} />}
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
            <div className="mt-4 mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-destructive flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
                <p className="text-title text-destructive">{t['expenses.error'] || 'Error'}</p>
                <p className="text-body font-medium text-destructive/80">{error}</p>
          </div>
              <button onClick={() => setError(null)} className="text-destructive/60">
            <X size={16} />
          </button>
        </div>
      )}

          {/* Scanning Indicator */}
          {isScanning && (
            <div className="mb-4 p-4 bg-primary/10 rounded-xl text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-body font-medium text-primary">{t['expenses.analyzing']}</p>
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
                          {selectedMonth === null ? (t['common.all'] || 'All') : MONTH_NAMES[selectedMonth]}
                        </p>
                        {selectedMonth !== null && selectedYear !== null && (
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
                      <p className="text-body font-medium text-foreground">{t['expenses.no_data'] || 'No expense data'}</p>
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
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: item.config.bgColor, color: item.config.color }}
                          >
                            {item.config.icon}
                          </div>
                          <div>
                            <span className="text-body font-medium text-foreground">{getCategoryLabel(item.category)}</span>
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
                      <p className="text-body font-medium text-foreground">
                        {selectedMonth === null 
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
                        className={`w-full p-4 flex items-start gap-4 text-left ${
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
                          <p className="text-body font-bold text-foreground truncate">
                            <TranslatedMerchantName expense={expense} currentLang={currentLang} onUpdate={onUpdate} />
                          </p>
                          <p className="text-caption text-muted-foreground">{getCategoryLabel(expense.category)}</p>
                          <p className="text-caption text-muted-foreground">
                            {expense.date ? new Date(expense.date).toLocaleDateString(
                              currentLang === 'en' ? 'en-GB' : currentLang,
                              { day: 'numeric', month: 'short', year: 'numeric' }
                            ) : '-'}
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
        className={`fixed bottom-28 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-30 disabled:bg-[#9CA3AF] ${
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
      {addExpenseStage !== 'closed' && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] bottom-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setAddExpenseStage('closed'); }}
        >
          <div 
            className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content flex flex-col absolute bottom-0 left-0 right-0 mx-auto"
            style={{ maxHeight: 'min(80vh, calc(100dvh - env(safe-area-inset-top)))' }}
          >
            {/* Header with X left, Title center, ✓ right */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              {/* X Close Button (left) - or Back button for OCR */}
              {addExpenseStage === 'ocr' ? (
                <button
                  onClick={() => {
                    setPendingReceipt(null);
                    setAddExpenseStage('manual');
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
                  aria-label={t['common.back'] || 'Back'}
                >
                  <ArrowLeft size={20} />
                </button>
              ) : (
                <button
                  onClick={closeAddExpenseSheet}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
                  aria-label={t['common.close'] || 'Close'}
                >
                  <X size={20} />
                </button>
              )}
              
              {/* Title (center) */}
              <h2 className="text-title font-semibold text-foreground text-center flex-1">
                {addExpenseStage === 'ocr' 
                  ? (t['expenses.confirm_receipt'] || 'Confirm Receipt')
                  : (t['expenses.add_expense'] || 'Add Expense')
                }
              </h2>
              
              {/* ✓ Confirm Button (right) */}
              <button
                onClick={handleSaveExpense}
                disabled={isSaving || !editAmount}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  editAmount && !isSaving
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground'
                }`}
                aria-label={t['common.save'] || 'Save'}
              >
                {isSaving ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Check size={20} strokeWidth={3} />
                )}
              </button>
            </div>
            
            {/* Header separator */}
            <div className="px-5"><div className="h-px bg-border w-full"></div></div>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* UNIFIED ADD EXPENSE FORM (Manual + OCR at top for paid) */}
            {/* ─────────────────────────────────────────────────────────────── */}
            {(addExpenseStage === 'manual' || addExpenseStage === 'options') && (
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                {/* OCR Options - Show if user has scans available */}
                {!isAiScanRestricted && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-3.5 rounded-xl bg-primary flex items-center justify-center gap-2 text-primary-foreground shadow-sm"
                      >
                        <ImageIcon size={18} />
                        <span className="text-body font-semibold">{t['expenses.from_photos'] || 'From Photos'}</span>
                      </button>
                      <button
                        onClick={handleCameraCapture}
                        className="px-4 py-3.5 rounded-xl bg-primary flex items-center justify-center gap-2 text-primary-foreground shadow-sm"
                      >
                        <Camera size={18} />
                        <span className="text-body font-semibold">{t['expenses.scan_receipt'] || 'Scan Receipt'}</span>
                      </button>
                    </div>
                    {/* Show used scans badge for free users */}
                    {!hasPaidSubscription && usageStatus && (
                      <p className="text-caption text-center text-muted-foreground">
                        {(t['trial.ai_scan_badge'] || '{used} of {total} free scans used')
                          .replace('{used}', usageStatus.aiScanCount.toString())
                          .replace('{total}', FREE_AI_SCAN_LIMIT.toString())}
                      </p>
                    )}
                  </>
                )}

                {/* Upgrade Banner for Free Users */}
                  {showFreeUpgradeBanner && (
                    <button
                      onClick={handleExpenseUpgrade}
                    className="w-full p-4 rounded-xl bg-muted flex items-center gap-4 text-left"
                    >
                      {/* Lock icon in circle */}
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <Lock size={20} className="text-muted-foreground" />
                      </div>
                      
                      {/* Text */}
                      <div className="flex-1 min-w-0">
                      <p className="text-body font-semibold text-foreground">
                          {t['expenses.receipt_scanner'] || 'Receipt Scanner'}
                        </p>
                      <p className="text-caption text-muted-foreground mt-0.5">
                          {t['expenses.scanner_locked_desc'] || 'Upgrade to scan or upload receipts'}
                        </p>
                      </div>
                      
                      {/* Chevron */}
                      <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
                    </button>
                  )}

                {/* Main Input: Amount (big font) */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                    {t['expenses.how_much'] || 'Amount'}
                    </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                        {getCurrencySymbol()}
                      </span>
                      <input
                        ref={amountInputRef}
                        type="text"
                        autoComplete="one-time-code"
                        inputMode="decimal"
                        value={editAmount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d.]/g, '');
                          const parts = value.split('.');
                          const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                          setEditAmount(formatted);
                        }}
                        onFocus={(e) => {
                          // Select all text for easy replacement (best practice for number inputs)
                          e.target.select();
                          // Prevent iOS from pushing sheet - scroll input into view within container
                          setTimeout(() => {
                            e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                          }, 100);
                        }}
                        placeholder="0.00"
                      className="w-full pl-16 pr-4 py-3 bg-muted rounded-xl text-xl font-semibold text-foreground placeholder-light outline-none border border-transparent focus:border-primary transition-colors text-right"
                      />
                    </div>
            </div>

                {/* Date */}
                    <div>
                      <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                        {t['expenses.date'] || 'Date'}
                      </label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body font-medium"
                      />
                    </div>

                  {/* Shop Name */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                    {t['expenses.where_spend'] || 'Where did you spend?'}
                    </label>
                    <input
                      type="text"
                      autoComplete="one-time-code"
                      value={editMerchant}
                      onChange={(e) => setEditMerchant(e.target.value)}
                      onFocus={(e) => {
                        // Prevent iOS from pushing sheet - scroll input into view within container
                        setTimeout(() => {
                          e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }, 100);
                      }}
                    placeholder={t['expenses.merchant_placeholder'] || "e.g., Wellcome, McDonald's"}
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body font-medium"
                    />
                  </div>

                {/* Category - Dropdown */}
                <div>
                  <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                    {t['common.category'] || 'Category'}
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => {
                      setEditCategory(e.target.value);
                      haptics.selection();
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body font-medium appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {getCategoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* OCR CONFIRMATION - Photo on right, text on left */}
            {/* ─────────────────────────────────────────────────────────────── */}
            {addExpenseStage === 'ocr' && pendingReceipt && (
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                {/* Receipt confirmation banner - text left, photo right */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted">
                  <div className="flex-1">
                    <p className="text-body font-semibold text-foreground">
                      {t['expenses.receipt_scanned'] || 'Receipt scanned successfully.'}
                    </p>
                    <p className="text-caption text-muted-foreground mt-1">
                      {t['expenses.adjust_details'] || 'You can still manually adjust the details below if needed.'}
                    </p>
                  </div>
                <button
                    onClick={() => setZoomImageSrc(pendingReceipt.thumbnailBase64)}
                    className="w-16 h-20 rounded-lg overflow-hidden border border-border flex-shrink-0"
                  >
                    <img 
                      src={pendingReceipt.thumbnailBase64} 
                      alt="Receipt" 
                      className="w-full h-full object-cover" 
                    />
                  </button>
                  </div>

                {/* Main Input: Amount (big font) */}
              <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                    {t['expenses.how_much'] || 'Amount'}
                    </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                        {getCurrencySymbol()}
                      </span>
                      <input
                        type="text"
                        autoComplete="one-time-code"
                        inputMode="decimal"
                        value={editAmount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d.]/g, '');
                          const parts = value.split('.');
                          const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                          setEditAmount(formatted);
                        }}
                        onFocus={(e) => {
                          // Select all text for easy replacement (best practice for number inputs)
                          e.target.select();
                          // Prevent iOS from pushing sheet - scroll input into view within container
                          setTimeout(() => {
                            e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                          }, 100);
                        }}
                        placeholder="0.00"
                      className="w-full pl-16 pr-4 py-3 bg-muted rounded-xl text-xl font-semibold text-foreground placeholder-light outline-none border border-transparent focus:border-primary transition-colors text-right"
                      />
                    </div>
              </div>

                {/* Date */}
              <div>
                      <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                        {t['expenses.date'] || 'Date'}
                      </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body font-medium"
                />
                    </div>

                  {/* Shop Name */}
              <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                    {t['expenses.where_spend'] || 'Where did you spend?'}
                    </label>
                <input
                  type="text"
                  autoComplete="one-time-code"
                  value={editMerchant}
                  onChange={(e) => setEditMerchant(e.target.value)}
                  onFocus={(e) => {
                    // Prevent iOS from pushing sheet - scroll input into view within container
                    setTimeout(() => {
                      e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }, 100);
                  }}
                    placeholder={t['expenses.merchant_placeholder'] || "e.g., Wellcome, McDonald's"}
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body font-medium"
                />
              </div>

                {/* Category - Dropdown */}
                <div>
                  <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                    {t['common.category'] || 'Category'}
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => {
                      setEditCategory(e.target.value);
                      haptics.selection();
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body font-medium appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {getCategoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Invisible spacer for consistent height */}
            <div className="shrink-0 p-5 pb-8">
              <div className="h-[52px]"></div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* EXISTING EXPENSE BOTTOM SHEET */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {selectedExpense && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] bottom-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedExpense(null); }}
        >
          <div 
            className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content flex flex-col absolute bottom-0 left-0 right-0 mx-auto" 
            style={{ maxHeight: 'min(80vh, calc(100dvh - env(safe-area-inset-top)))' }}
          >
            {/* Header with X left, Title center, ✓ or Edit right */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              {/* X Close Button (left) */}
              <button
                onClick={closeExistingModal}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
                aria-label={t['common.close'] || 'Close'}
              >
                <X size={20} />
              </button>

              {/* Title (center) */}
              <h2 className="text-title font-semibold text-foreground text-center flex-1">
                {t['expenses.edit_expense'] || 'Edit Expense'}
              </h2>
              
              {/* ✓ Confirm Button (right) */}
              <button
                onClick={saveExistingEdit}
                disabled={savingExisting}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  !savingExisting
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground'
                }`}
                aria-label={t['common.save'] || 'Save'}
              >
                {savingExisting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Check size={20} strokeWidth={3} />
                )}
              </button>
            </div>
            
            {/* Header separator */}
            <div className="px-5"><div className="h-px bg-border w-full"></div></div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-5 space-y-4">
            {/* Receipt Thumbnail - Only show if receipt exists */}
            {selectedExpense.receiptUrl && (
              <div className="rounded-xl overflow-hidden border border-border">
                <button
                  type="button"
                  className="relative w-full block"
                  onClick={() => {
                    // Use already-preloaded URL immediately (no delay)
                    const urlToUse = receiptPreviewUrl || selectedExpense.receiptUrl;
                    setZoomImageSrc(urlToUse);
                  }}
                >
                  {/* Fixed height container to prevent layout shift */}
                  <div className="relative" style={{ minHeight: '200px' }}>
                    {/* Loading skeleton - shown while image loads */}
                    {!receiptImageLoaded && (
                      <div className="absolute inset-0 bg-secondary animate-pulse flex items-center justify-center rounded-xl">
                        <Receipt size={32} className="text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Image - positioned on top of skeleton */}
                    <div className="max-h-72 overflow-y-auto overflow-x-hidden">
                      <img
                        src={receiptPreviewUrl || selectedExpense.receiptUrl}
                        alt="Receipt"
                        className={`w-full block transition-opacity duration-300 ${receiptImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => setReceiptImageLoaded(true)}
                        onError={async () => {
                          if (triedReceiptRefresh) return;
                          setTriedReceiptRefresh(true);
                          const refreshed = await refreshReceiptUrl(selectedExpense.receiptUrl);
                          if (refreshed) {
                            setReceiptPreviewUrl(refreshed);
                          }
                        }}
                      />
                    </div>
                  </div>
                  {/* Zoom icon overlay - only show when image is loaded */}
                  {receiptImageLoaded && (
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white rounded-full p-2">
                      <ZoomIn size={18} />
                    </div>
                  )}
                </button>
              </div>
            )}

              {/* Edit Form */}
              {selectedExpense && (
                <div className={`space-y-4 ${selectedExpense.receiptUrl ? 'border-t border-border pt-4' : ''}`}>
                  {/* Main Input: Amount (big font) */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                      {t['expenses.how_much'] || 'Amount'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                        {getCurrencySymbol()}
                      </span>
                      <input
                        type="text"
                        autoComplete="one-time-code"
                        inputMode="decimal"
                        className="w-full pl-16 pr-4 py-3 bg-muted rounded-xl text-xl font-semibold text-foreground placeholder-light outline-none border border-transparent focus:border-primary transition-colors text-right"
                        value={exAmount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d.]/g, '');
                          const parts = value.split('.');
                          const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                          setExAmount(formatted);
                        }}
                        onFocus={(e) => {
                          // Select all text for easy replacement (best practice for number inputs)
                          e.target.select();
                          // Prevent iOS from pushing sheet - scroll input into view within container
                          setTimeout(() => {
                            e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                          }, 100);
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Date */}
                    <div>
                      <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                        {t['expenses.date'] || 'Date'}
                      </label>
                      <input
                        type="date"
                      className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body font-medium"
                        value={exDate}
                        onChange={(e) => setExDate(e.target.value)}
                      />
                  </div>

                  {/* Shop Name */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                      {t['expenses.where_spend'] || 'Where did you spend?'}
                    </label>
                    <input
                      type="text"
                      autoComplete="one-time-code"
                      className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body font-medium"
                      value={exMerchant}
                      onChange={(e) => setExMerchant(e.target.value)}
                      onFocus={(e) => {
                        // Prevent iOS from pushing sheet - scroll input into view within container
                        setTimeout(() => {
                          e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }, 100);
                      }}
                      placeholder={t['expenses.merchant_placeholder'] || "e.g., Wellcome, McDonald's"}
                    />
                  </div>

                  {/* Category - Dropdown */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">
                      {t['common.category'] || 'Category'}
                    </label>
                    <select
                      value={exCategory}
                      onChange={(e) => {
                        setExCategory(e.target.value);
                        haptics.selection();
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body font-medium appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {getCategoryLabel(cat)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

            </div>

            {/* Footer - Delete button only (when not editing), confirmation, or spacer */}
            {confirmDeleteExisting ? (
              <>
                {/* Footer separator */}
                <div className="px-5"><div className="h-px bg-border w-full"></div></div>
                {/* Delete Confirmation Actions */}
                <div className="shrink-0 p-5 pb-8 space-y-3">
                  <p className="text-body font-medium text-foreground text-center mb-3">
                    {t['confirm.delete_expense'] || 'Are you sure you want to delete this receipt/expense?'}
                  </p>
                <div className="flex items-center gap-3">
                  <button
                      className="flex-1 py-3.5 rounded-xl bg-card text-foreground text-body ring-1 ring-border font-semibold"
                      onClick={() => setConfirmDeleteExisting(false)}
                    disabled={savingExisting}
                  >
                      {t['common.cancel'] || 'Cancel'}
                  </button>
                  <button
                      className="flex-1 py-3.5 rounded-xl bg-destructive text-primary-foreground text-body font-semibold disabled:opacity-50"
                      onClick={confirmExistingDelete}
                    disabled={savingExisting}
                  >
                      {savingExisting ? (t['common.deleting'] || 'Deleting...') : (t['expenses.yes_delete'] || 'Yes, delete')}
                  </button>
                </div>
                </div>
              </>
            ) : !isHelper ? (
              <>
                {/* Footer separator */}
                <div className="px-5"><div className="h-px bg-border w-full"></div></div>
                {/* Footer with Delete button */}
                <div className="shrink-0 p-5 pb-8">
                  <button
                    onClick={() => setConfirmDeleteExisting(true)}
                    disabled={savingExisting}
                    className="w-full py-3.5 rounded-xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"
                  >
                    <Trash2 size={20} />
                    {t['expenses.delete_expense'] || 'Delete Expense'}
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

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* IMAGE ZOOM MODAL */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {/* IMAGE ZOOM MODAL - Rendered via Portal to escape stacking context */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {zoomImageSrc && createPortal(
        <ZoomableImage
          imageSrc={zoomImageSrc}
          onClose={() => setZoomImageSrc(null)}
          t={t}
        />,
        document.body
      )}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* MONTH PICKER BOTTOM SHEET */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {isMonthPickerOpen && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] bottom-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setIsMonthPickerOpen(false); }}
        >
          <div 
            className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content flex flex-col absolute bottom-0 left-0 right-0 mx-auto"
            style={{ maxHeight: 'min(80vh, calc(100dvh - env(safe-area-inset-top)))' }}
          >
            {/* Header with X left, Title center */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              {/* X Close Button (left) */}
            <button
              onClick={() => setIsMonthPickerOpen(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
              aria-label={t['common.close'] || 'Close'}
            >
              <X size={20} />
            </button>

              {/* Title (center) */}
              <h2 className="text-title font-semibold text-foreground text-center flex-1">
                {t['expenses.select_month'] || 'Select Month'}
              </h2>
              
              {/* Invisible spacer (right) */}
              <div className="w-10 h-10" />
    </div>
            
            {/* Header separator */}
            <div className="px-5"><div className="h-px bg-border w-full"></div></div>

            {/* Year Selector */}
            <div className="flex items-center justify-center gap-4 py-4 border-b border-border">
              <button
                onClick={() => setPickerYear(pickerYear - 1)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
              >
                <ChevronLeft size={24} />
              </button>
              <span className="text-display text-foreground min-w-[100px] text-center">{pickerYear}</span>
              <button
                onClick={() => setPickerYear(pickerYear + 1)}
                disabled={pickerYear >= now.getFullYear()}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed"
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
                      className={`py-3 rounded-xl text-body font-medium transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : isFuture
                          ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed'
                          : 'bg-secondary text-foreground'
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
                className="w-full py-3.5 rounded-xl bg-secondary text-foreground text-body font-medium"
              >
                {t['expenses.go_current_month'] || 'Go to Current Month'}
              </button>
              <button
                onClick={() => {
                  setSelectedMonth(null);
                  setSelectedYear(null);
                  setIsMonthPickerOpen(false);
                }}
                className="w-full mt-3 py-3.5 rounded-xl bg-card text-foreground text-body font-medium border border-border"
              >
                {t['expenses.show_all_expenses'] || 'Show All Expenses'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* SUMMARY UPGRADE MODAL - Bottom Sheet */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {showSummaryUpgradeModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] bottom-sheet-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSummaryUpgradeModal(false); }}
        >
          <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content flex flex-col absolute bottom-0 left-0 right-0 mx-auto" style={{ maxHeight: 'min(80vh, calc(100dvh - env(safe-area-inset-top)))' }}>
            {/* Close Button */}
            <button 
              onClick={() => setShowSummaryUpgradeModal(false)} 
              className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center right-4 top-4 text-muted-foreground"
              aria-label={t['common.close'] || 'Close'}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <PieIcon size={24} className="text-primary" />
                </div>
                <h2 className="text-title text-foreground">
                  {t['expenses.summary_title'] || 'Monthly Summary'}
                </h2>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-body font-medium text-muted-foreground">
                {t['expenses.summary_upgrade_desc'] || "Get insights into your spending habits. View your expenses broken down by category with visual charts, and track your monthly totals at a glance."}
              </p>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border shrink-0">
              <button
                onClick={() => {
                  setShowSummaryUpgradeModal(false);
                  localStorage.setItem('helpy_profile_target_section', 'plan');
                  onNavigateToPlan?.();
                }}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm"
              >
                {t['common.upgrade'] || 'Upgrade'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default Expenses;
