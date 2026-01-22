// components/HelperManagementContent.tsx
// ============================================================================
// Salary Slip Management for Helpers
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, 
  FilePenLine,
  Check, 
  X, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight,
  Download,
  Trash2,
  Loader2,
  Plus,
  Pencil,
  Info,
  Signature,
} from 'lucide-react';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import ErrorBanner from './ui/ErrorBanner';
import BottomSheet from './ui/BottomSheet';
import type { User, TranslationDictionary, UsageStatus } from '@/types';
import { UserRole } from '@/types';
import { incrementSalarySignCount, calculateUsageStatus } from '../services/trialService';
import type { HelperContract, SalarySlip } from '@src/types/helperManagement';
import { useDemoMode } from '../contexts/DemoModeContext';
import { useScrollLock } from '../hooks/useScrollLock';
import { useSheetTheme } from '../hooks/useSheetTheme';
import { haptics } from '../utils/haptics';
import { getCachedSupabaseUuid, isUserCachePopulated } from '../services/supabaseService';
import { useSupabaseReady } from '../contexts/SupabaseContext';
import { logger } from '../utils/logger';
import {
  getHelperContract,
  getSalarySlips,
  createHelperContract,
  updateHelperContract,
  createSalarySlip,
  deleteSalarySlip,
  signAsEmployer,
  signAsHelper,
  canManageSalarySlips,
} from '../services/salarySlipService';

interface Props {
  householdId: string;
  helperId: string;
  helper: User;
  currentUser: User;
  users: User[];
  // Cached data from App.tsx (for instant load)
  cachedContracts: HelperContract[];
  cachedSlips: SalarySlip[];
  onContractsChange: (contracts: HelperContract[]) => void;
  onSlipsChange: (slips: SalarySlip[]) => void;
  t: TranslationDictionary;
  currentLang: string;
  onNavigateToProfile: () => void;
  onEditHelper?: (helperId: string) => void;
  // Callback when FAB is clicked (for creating salary slips)
  onCreateSlipClick?: () => void;
  // Increment this to trigger a data refresh (e.g., after creating a slip from outside)
  refreshKey?: number;
  // Usage-based limits support
  usageStatus?: UsageStatus;
  onShowUsageLimitModal?: () => void;
  onUsageStatusChange?: (usageStatus: UsageStatus) => void;
}

export const HelperManagementContent: React.FC<Props> = ({
  householdId,
  helperId,
  helper,
  currentUser,
  users,
  cachedContracts,
  cachedSlips,
  onContractsChange,
  onSlipsChange,
  t,
  currentLang,
  onNavigateToProfile,
  onEditHelper,
  onCreateSlipClick,
  refreshKey,
  usageStatus,
  onShowUsageLimitModal,
  onUsageStatusChange,
}) => {
  // ─────────────────────────────────────────────────────────────────
  // State - Initialize from cached data for instant display
  // ─────────────────────────────────────────────────────────────────
  // Convert helperId (Clerk ID) to Supabase UUID for comparison
  // Contracts store userId as Supabase UUID, but helperId prop is Clerk ID
  const helperUuid = useMemo(() => getCachedSupabaseUuid(helperId), [helperId]);
  
  // Find this helper's contract from cached contracts
  // CRITICAL: Compare UUID to UUID (contract.userId is UUID, helperId is Clerk ID)
  const cachedContract = useMemo(() => 
    cachedContracts.find(c => c.userId === helperUuid) || null,
    [cachedContracts, helperUuid]
  );
  // Filter this helper's slips from cached slips
  // CRITICAL: Compare UUID to UUID (slip.helperId is UUID, helperId is Clerk ID)
  const cachedHelperSlips = useMemo(() => 
    cachedSlips.filter(s => s.helperId === helperUuid),
    [cachedSlips, helperUuid]
  );
  
  // State for fresh data fetched from database (null/empty until fetched)
  const [freshContract, setFreshContract] = useState<HelperContract | null>(null);
  const [freshSlips, setFreshSlips] = useState<SalarySlip[]>([]);
  
  // INSTANT DISPLAY: Use cached data immediately, override with fresh when available
  // This ensures content shows on FIRST render without waiting for any useEffect
  const contract = freshContract ?? cachedContract;
  const salarySlips = freshSlips.length > 0 ? freshSlips : cachedHelperSlips;
  
  // isLoading is only for async operations (save, delete, sign), not for initial display
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showContractSheet, setShowContractSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSignConfirm, setShowSignConfirm] = useState<{ slipId: string; type: 'employer' | 'helper' } | null>(null);
  const [selectedSignerForSlip, setSelectedSignerForSlip] = useState<Record<string, string>>({});
  
  // Contract form state
  const [contractForm, setContractForm] = useState({
    employmentStartDate: '',
    baseSalary: '',
    foodAllowance: '',
  });
  
  // Expanded slips state
  const [expandedSlips, setExpandedSlips] = useState<Set<string>>(new Set());
  const [showPastSlips, setShowPastSlips] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [showSalaryInfo, setShowSalaryInfo] = useState(false);
  
  const { isDemoMode, isViewingAsHelper } = useDemoMode();
  
  // Wait for Supabase auth to be ready before making database queries
  // This ensures the authenticated client is available for RLS-compliant queries
  const isAuthReady = useSupabaseReady();
  
  // Role checks
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  const isAdmin = currentUser.role === UserRole.MASTER;
  const isSpouse = currentUser.role === UserRole.SPOUSE;
  // isHelper: true if actual Helper OR SuperAdmin viewing as Helper
  const isHelper = currentUser.role === UserRole.HELPER || currentUser.role === 'Helper' || (isSuperAdmin && isViewingAsHelper);
  // Helpers can ONLY view - they cannot edit or delete anything
  const canManage = !isHelper && canManageSalarySlips(currentUser.role);
  
  // Get eligible signers (SuperAdmin, Admin, Spouse)
  const eligibleSigners = useMemo(() => {
    return users.filter(u => 
      u.role === UserRole.SUPERADMIN || 
      u.role === UserRole.MASTER || 
      u.role === UserRole.SPOUSE
    );
  }, [users]);
  
  // Scroll lock and sheet theme for modals
  useScrollLock(showContractSheet || showDeleteConfirm !== null || showSignConfirm !== null || showSalaryInfo);
  useSheetTheme(showContractSheet || showDeleteConfirm !== null || showSignConfirm !== null || showSalaryInfo);
  
  // Language code for date formatting
  const langCode = currentLang === 'en' ? 'en-GB' : currentLang;

  // ─────────────────────────────────────────────────────────────────
  // Data Loading - Cached data shows instantly, fresh data fetched in background
  // ─────────────────────────────────────────────────────────────────
  
  // Track if fresh data has been loaded successfully
  const [freshDataLoaded, setFreshDataLoaded] = useState(false);
  
  // Fetch fresh data when:
  // 1. Auth is ready (Supabase client has JWT for RLS)
  // 2. Helper/household changes
  // 3. refreshKey changes (e.g., after creating a slip from outside)
  useEffect(() => {
    // Wait for auth to be ready before making database queries
    // This ensures RLS policies can properly authenticate the user
    if (isAuthReady || isDemoMode) {
      logger.log('[HelperManagementContent] Auth ready, loading data...');
      loadData();
    } else {
      logger.log('[HelperManagementContent] Waiting for Supabase auth to be ready...');
    }
  }, [helperId, householdId, refreshKey, isAuthReady, isDemoMode]);
  
  // Retry loading if cache wasn't populated even after auth is ready
  // This handles edge cases where users table data hasn't arrived yet
  useEffect(() => {
    if (!freshDataLoaded && !isDemoMode && isAuthReady) {
      let retryCount = 0;
      const maxRetries = 20; // 20 retries * 500ms = 10 seconds max
      
      const retryInterval = setInterval(() => {
        retryCount++;
        const cachePopulated = isUserCachePopulated();
        
        if (cachePopulated) {
          logger.log(`[HelperManagementContent] User cache populated after ${retryCount} attempts, loading data...`);
          loadData();
          clearInterval(retryInterval);
        } else if (retryCount >= maxRetries) {
          logger.warn(`[HelperManagementContent] Cache not populated after ${maxRetries} retries. Using fallback query.`);
          // Try one more time - the database fallback in salarySlipService should work now
          loadData();
          clearInterval(retryInterval);
        } else if (retryCount % 4 === 0) {
          // Log every 2 seconds (4 * 500ms) to show progress
          logger.log(`[HelperManagementContent] Waiting for user cache... (attempt ${retryCount}/${maxRetries})`);
        }
      }, 500);
      
      return () => {
        clearInterval(retryInterval);
      };
    }
  }, [freshDataLoaded, isDemoMode, isAuthReady]);
  
  const loadData = async () => {
    // No loading spinner for initial display - content appears instantly from cache
    // isLoading is only used for user-initiated actions (save, delete, sign)
    setError(null);
    
    try {
      if (isDemoMode) {
        // Demo data
        const demoContract: HelperContract = {
          id: 'demo-contract',
          userId: helperId,
          householdId,
          status: 'active',
          employmentStartDate: '2024-03-15',
          baseSalary: 5100,
          foodAllowance: 1236,
        };
        // 6 months of salary history with mix of signed/unsigned
        const demoSlips: SalarySlip[] = [
          // January 2026 - Current month, employer signed, helper not signed
          {
            id: 'demo-slip-1',
            householdId,
            helperId,
            contractId: 'demo-contract',
            paymentPeriodStart: '2026-01-01',
            paymentPeriodEnd: '2026-01-31',
            baseSalary: 5100,
            foodAllowance: 1236,
            extraSalary: 500,
            salaryDeduction: -200,
            totalPayout: 6636,
            note: 'January salary',
            employerSignerId: 'demo-employer',
            employerSignerName: 'David',
            employerSignedAt: '2026-01-28T10:00:00Z',
            helperSignedAt: null,
          },
          // December 2025 (late slip) - Neither signed
          {
            id: 'demo-slip-1b',
            householdId,
            helperId,
            contractId: 'demo-contract',
            paymentPeriodStart: '2025-12-15',
            paymentPeriodEnd: '2025-12-31',
            baseSalary: 2550,
            foodAllowance: 618,
            extraSalary: 0,
            salaryDeduction: 0,
            totalPayout: 3168,
            note: 'Partial month - late entry',
            employerSignerId: null,
            employerSignerName: null,
          employerSignedAt: null,
          helperSignedAt: null,
          },
          // December 2025 - Both signed
          {
            id: 'demo-slip-2',
            householdId,
            helperId,
            contractId: 'demo-contract',
            paymentPeriodStart: '2025-12-01',
            paymentPeriodEnd: '2025-12-31',
            baseSalary: 5100,
            foodAllowance: 1236,
            extraSalary: 800,
            salaryDeduction: 0,
            totalPayout: 7136,
            note: 'December salary + Christmas bonus',
            employerSignerId: 'demo-employer',
            employerSignerName: 'David',
            employerSignedAt: '2025-12-28T10:00:00Z',
            helperSignedAt: '2025-12-28T14:30:00Z',
          },
          // November 2025 - Both signed
          {
            id: 'demo-slip-3',
            householdId,
            helperId,
            contractId: 'demo-contract',
            paymentPeriodStart: '2025-11-01',
            paymentPeriodEnd: '2025-11-30',
            baseSalary: 5100,
            foodAllowance: 1236,
            extraSalary: 0,
            salaryDeduction: -150,
            totalPayout: 6186,
            note: 'November salary',
            employerSignerId: 'demo-employer',
            employerSignerName: 'David',
            employerSignedAt: '2025-11-28T10:00:00Z',
            helperSignedAt: '2025-11-29T09:00:00Z',
          },
          // October 2025 - Both signed
          {
            id: 'demo-slip-4',
            householdId,
            helperId,
            contractId: 'demo-contract',
            paymentPeriodStart: '2025-10-01',
            paymentPeriodEnd: '2025-10-31',
            baseSalary: 5100,
            foodAllowance: 1236,
            extraSalary: 300,
            salaryDeduction: 0,
            totalPayout: 6636,
            note: 'October salary',
            employerSignerId: 'demo-employer',
            employerSignerName: 'Sarah',
            employerSignedAt: '2025-10-30T10:00:00Z',
            helperSignedAt: '2025-10-30T15:00:00Z',
          },
          // September 2025 - Both signed
          {
            id: 'demo-slip-5',
            householdId,
            helperId,
            contractId: 'demo-contract',
            paymentPeriodStart: '2025-09-01',
            paymentPeriodEnd: '2025-09-30',
            baseSalary: 5100,
            foodAllowance: 1236,
            extraSalary: 0,
            salaryDeduction: 0,
            totalPayout: 6336,
            note: null,
            employerSignerId: 'demo-employer',
            employerSignerName: 'David',
            employerSignedAt: '2025-09-28T10:00:00Z',
            helperSignedAt: '2025-09-28T16:00:00Z',
          },
          // August 2025 - Both signed
          {
            id: 'demo-slip-6',
            householdId,
            helperId,
            contractId: 'demo-contract',
            paymentPeriodStart: '2025-08-01',
            paymentPeriodEnd: '2025-08-31',
            baseSalary: 5100,
            foodAllowance: 1236,
            extraSalary: 200,
            salaryDeduction: -100,
            totalPayout: 6436,
            note: 'August salary',
            employerSignerId: 'demo-employer',
            employerSignerName: 'David',
            employerSignedAt: '2025-08-29T10:00:00Z',
            helperSignedAt: '2025-08-29T11:00:00Z',
          },
        ];
        setFreshContract(demoContract);
        setFreshSlips(demoSlips);
        setFreshDataLoaded(true);
        return;
      }
      
      // Load fresh data from database
      const contractData = await getHelperContract(helperId, householdId);
      const slipsData = await getSalarySlips(helperId, householdId);
      
      // Check if UUID resolution succeeded (cache was populated)
      // If both return null/empty AND cache isn't populated, retry will happen
      const cacheReady = isUserCachePopulated();
      
      // Update local state
      setFreshContract(contractData);
      setFreshSlips(slipsData);
      
      // Only sync and mark as loaded if cache was ready (data is valid)
      if (cacheReady) {
        setFreshDataLoaded(true);
        
        // Get fresh UUID now that cache is populated
        // (useMemo helperUuid might still have old value from before cache was ready)
        const actualHelperUuid = getCachedSupabaseUuid(helperId);
        
        // Sync back to parent cache (merge with existing data for other helpers)
        // Always sync contracts back (even if null, to clear old cache for this helper)
        // CRITICAL: Use actualHelperUuid (fresh from cache) since contract.userId is UUID
        const updatedContracts = cachedContracts.filter(c => c.userId !== actualHelperUuid);
        if (contractData) {
          updatedContracts.push(contractData);
        }
        onContractsChange(updatedContracts);
        
        // Always sync slips back (even if empty, to clear old cache for this helper)
        // CRITICAL: Use actualHelperUuid (fresh from cache) since slip.helperId is UUID
        const otherSlips = cachedSlips.filter(s => s.helperId !== actualHelperUuid);
        onSlipsChange([...otherSlips, ...slipsData]);
      } else {
        logger.log('[HelperManagementContent] Cache not ready, will retry...');
      }
    } catch (err) {
      logger.error('Failed to load helper data:', err);
      setError(t['error.load_data'] || 'Failed to load data. Please try again.');
    }
  };

  // Auto-expand slips that are not fully signed OR the most recent slip
  useEffect(() => {
    if (salarySlips.length > 0) {
      const toExpand = new Set<string>();
      
      // Sort slips by date (most recent first)
      const sortedSlips = [...salarySlips].sort((a, b) => 
        new Date(b.paymentPeriodEnd).getTime() - new Date(a.paymentPeriodEnd).getTime()
      );
      
      // Always expand the most recent slip
      if (sortedSlips[0]) {
        toExpand.add(sortedSlips[0].id);
      }
      
      // Also expand any slip that is not signed by both parties
      salarySlips.forEach(slip => {
        if (!slip.employerSignedAt || !slip.helperSignedAt) {
          toExpand.add(slip.id);
        }
      });
      
      setExpandedSlips(toExpand);
    }
  }, [salarySlips]);

  // ─────────────────────────────────────────────────────────────────
  // Contract Handlers
  // ─────────────────────────────────────────────────────────────────
  const handleContractSubmit = async () => {
    if (!contractForm.employmentStartDate || !contractForm.baseSalary) {
      setError(t['error.required_fields'] || 'Please fill in all required fields');
        return;
      }
    
    setIsLoading(true);
    try {
      if (contract) {
        // Update existing
        await updateHelperContract(contract.id, {
          employmentStartDate: contractForm.employmentStartDate,
          baseSalary: parseInt(contractForm.baseSalary) || 0,
          foodAllowance: parseInt(contractForm.foodAllowance) || 0,
        });
      } else {
        // Create new
        await createHelperContract({
          userId: helperId,
        householdId,
          employmentStartDate: contractForm.employmentStartDate,
          baseSalary: parseInt(contractForm.baseSalary) || 0,
          foodAllowance: parseInt(contractForm.foodAllowance) || 0,
        });
      }
      
      haptics.success();
      setShowContractSheet(false);
      loadData();
    } catch (err) {
      logger.error('Failed to save contract:', err);
      setError(t['error.save_contract'] || 'Failed to save employment details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openContractSheet = () => {
    if (contract) {
      setContractForm({
        employmentStartDate: contract.employmentStartDate,
        baseSalary: contract.baseSalary.toString(),
        foodAllowance: contract.foodAllowance.toString(),
      });
    } else {
      setContractForm({
        employmentStartDate: '',
        baseSalary: '5100',
        foodAllowance: '1236',
      });
    }
    setShowContractSheet(true);
  };

  // ─────────────────────────────────────────────────────────────────
  // Salary Slip Handlers
  // ─────────────────────────────────────────────────────────────────
  const handleDeleteSlip = async (slipId: string) => {
    setIsLoading(true);
    try {
      await deleteSalarySlip(slipId);
      haptics.success();
      setShowDeleteConfirm(null);
      loadData();
    } catch (err) {
      logger.error('Failed to delete slip:', err);
      setError(t['error.delete_slip'] || 'Failed to delete salary slip. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSign = async () => {
    if (!showSignConfirm) return;
    
    const { slipId, type } = showSignConfirm;
    
    // Check if user has paid subscription or remaining free signatures
    const hasPaidSub = usageStatus?.hasPaidSubscription ?? false;
    const canSign = usageStatus?.canUseSalarySign ?? true;
    
    if (!hasPaidSub && !canSign) {
      // Show usage limit modal
      if (onShowUsageLimitModal) {
        onShowUsageLimitModal();
      }
      setShowSignConfirm(null);
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (type === 'employer') {
        const signerId = selectedSignerForSlip[slipId] || currentUser.id;
        const signer = users.find(u => u.id === signerId);
        const signerName = signer ? (signer.firstName || signer.name?.split(' ')[0] || 'Employer') : 'Employer';
        await signAsEmployer(slipId, signerId, signerName);
      } else {
        // Pass current user ID for security verification
        await signAsHelper(slipId, currentUser.id);
      }
      
      // Increment signature count for free users after successful signature
      if (!hasPaidSub && onUsageStatusChange && usageStatus) {
        const newCount = await incrementSalarySignCount(householdId);
        if (newCount >= 0) {
          // Update usage status with new count
          const newUsageStatus = calculateUsageStatus(
            usageStatus.aiScanCount,
            newCount,
            usageStatus.trialStartedAt,
            usageStatus.hasPaidSubscription
          );
          onUsageStatusChange(newUsageStatus);
        }
      }
      
      haptics.success();
      setShowSignConfirm(null);
      loadData();
    } catch (err: any) {
      logger.error('Failed to sign slip:', err);
      setError(err.message || t['error.sign_slip'] || 'Failed to sign. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSlipExpanded = (slipId: string) => {
    setExpandedSlips(prev => {
      const next = new Set(prev);
      if (next.has(slipId)) {
        next.delete(slipId);
      } else {
        next.add(slipId);
      }
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────
  // PDF Export
  // ─────────────────────────────────────────────────────────────────
  const handleExportPDF = async (slip: SalarySlip) => {
    haptics.medium();
    
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;
      
      // Load logo
      let logoDataUrl: string | null = null;
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/helpy-logo-blue.png';
        
        await new Promise<void>((resolve) => {
          logoImg.onload = () => {
            const canvas = document.createElement('canvas');
            const targetWidth = 200;
            const aspectRatio = logoImg.height / logoImg.width;
            const targetHeight = Math.round(targetWidth * aspectRatio);
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, targetWidth, targetHeight);
              ctx.drawImage(logoImg, 0, 0, targetWidth, targetHeight);
              logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            }
            resolve();
          };
          logoImg.onerror = () => resolve();
          setTimeout(() => resolve(), 2000);
        });
      } catch {
        // Logo loading failed
      }
      
      // Header
      if (logoDataUrl) {
        const logoWidth = 24;
        const logoHeight = logoWidth * (1889 / 4096);
        doc.addImage(logoDataUrl, 'JPEG', margin, y, logoWidth, logoHeight);
      } else {
        doc.setFontSize(20);
        doc.setTextColor('#3EAFD2');
        doc.setFont('helvetica', 'bold');
        doc.text('helpy', margin, y + 6);
      }
      
      doc.setFontSize(10);
      doc.setTextColor('#3EAFD2');
      doc.setFont('helvetica', 'normal');
      doc.text('www.helpyfam.com', pageWidth - margin, y + 6, { align: 'right' });
      
      y += 20;
      
      // Title (always English for PDF compatibility)
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#1a1a1a');
      doc.text('Salary Slip', margin, y);
      y += 12;
      
      // Helper info box
      doc.setFillColor('#f5f5f5');
      doc.roundedRect(margin, y, pageWidth - margin * 2, 30, 3, 3, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(helper.firstName || helper.name?.split(' ')[0] || 'Helper', margin + 5, y + 8);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#666666');
      
      if (contract?.employmentStartDate) {
        const startDate = new Date(contract.employmentStartDate);
        doc.text(
          `Started: ${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
          margin + 5,
          y + 16
        );
      }
      
      const periodStart = new Date(slip.paymentPeriodStart);
      const periodEnd = new Date(slip.paymentPeriodEnd);
      doc.text(
        `Payment Period: ${periodStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        margin + 5,
        y + 24
      );
      
      y += 40;
      
      // Salary breakdown (always English for PDF compatibility)
      doc.setTextColor('#1a1a1a');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Salary Breakdown', margin, y);
      y += 8;
      
      // Table
      const tableData = [
        ['Base Salary', `HK$${slip.baseSalary.toLocaleString()}`],
        ['Food Allowance', `HK$${slip.foodAllowance.toLocaleString()}`],
        ['Additional Pay', `HK$${slip.extraSalary.toLocaleString()}`],
        ['Pay Deduction', `HK$${slip.salaryDeduction.toLocaleString()}`],
      ];
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      tableData.forEach(([label, value]) => {
        doc.text(label, margin, y);
        doc.text(value, pageWidth - margin, y, { align: 'right' });
        y += 7;
      });
      
      // Total line
      y += 3;
      doc.setDrawColor('#1a1a1a');
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Total Salary', margin, y);
      doc.setTextColor('#3EAFD2');
      doc.text(`HK$${slip.totalPayout.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
      
      y += 15;
      
      // Note
      if (slip.note) {
        doc.setTextColor('#1a1a1a');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Note', margin, y);
        y += 7;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#666666');
        const noteLines = doc.splitTextToSize(slip.note, pageWidth - margin * 2);
        doc.text(noteLines, margin, y);
        y += noteLines.length * 5 + 10;
      }
      
      // Signatures section (always English for PDF compatibility)
      y += 10;
      doc.setTextColor('#1a1a1a');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Signatures', margin, y);
      y += 10;
      
      const sigBoxWidth = (pageWidth - margin * 2 - 10) / 2;
      const sigBoxHeight = 40;
      
      // Employer signature box
      doc.setDrawColor('#cccccc');
      doc.setFillColor('#fafafa');
      doc.roundedRect(margin, y, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#1a1a1a');
      doc.text('Employer', margin + 5, y + 8);
      
      if (slip.employerSignedAt) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#22c55e');
        doc.text(slip.employerSignerName || 'Signed', margin + 5, y + 18);
        doc.setFontSize(8);
        doc.setTextColor('#666666');
        const signDate = new Date(slip.employerSignedAt);
        doc.text(signDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), margin + 5, y + 25);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#999999');
        doc.text('Not signed', margin + 5, y + 20);
      }
      
      // Helper signature box
      doc.setDrawColor('#cccccc');
      doc.setFillColor('#fafafa');
      doc.roundedRect(margin + sigBoxWidth + 10, y, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#1a1a1a');
      doc.text('Helper', margin + sigBoxWidth + 15, y + 8);
      
      if (slip.helperSignedAt) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#22c55e');
        doc.text(helper.firstName || helper.name?.split(' ')[0] || 'Signed', margin + sigBoxWidth + 15, y + 18);
        doc.setFontSize(8);
        doc.setTextColor('#666666');
        const signDate = new Date(slip.helperSignedAt);
        doc.text(signDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), margin + sigBoxWidth + 15, y + 25);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#999999');
        doc.text('Not signed', margin + sigBoxWidth + 15, y + 20);
      }
      
      // Footer
      const footerY = doc.internal.pageSize.getHeight() - 15;
      doc.setFontSize(9);
      doc.setTextColor('#999999');
      doc.text(
        'Generated by Helpy',
        pageWidth / 2,
        footerY,
        { align: 'center' }
      );
      
      // Generate filename (always English)
      const helperName = helper.firstName || helper.name?.split(' ')[0] || 'Helper';
      const periodStr = `${periodStart.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
      const safeFilename = `Salary Slip - ${helperName} - ${periodStr}.pdf`;
      
      // Share or download
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], safeFilename, { type: 'application/pdf' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        haptics.success();
        await navigator.share({
          files: [file],
          title: safeFilename,
          text: safeFilename, // Message body for social media / email subject
        });
      } else {
        haptics.success();
        doc.save(safeFilename);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // User cancelled
      }
      logger.error('Failed to export PDF:', err);
      setError(t['error.export_pdf'] || 'Failed to export PDF. Please try again.');
    }
  };

  // Helper function to generate PDF blob for a single slip (for zip export)
  const generatePDFBlob = async (slip: SalarySlip): Promise<{ blob: Blob; filename: string }> => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;
    
    // Load logo
    let logoDataUrl: string | null = null;
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = '/helpy-logo-blue.png';
      
      await new Promise<void>((resolve) => {
        logoImg.onload = () => {
          const canvas = document.createElement('canvas');
          const targetWidth = 200;
          const aspectRatio = logoImg.height / logoImg.width;
          const targetHeight = Math.round(targetWidth * aspectRatio);
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(logoImg, 0, 0, targetWidth, targetHeight);
            logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          }
          resolve();
        };
        logoImg.onerror = () => resolve();
        setTimeout(() => resolve(), 2000);
      });
    } catch {
      // Logo loading failed
    }
    
    // Header
    if (logoDataUrl) {
      const logoWidth = 24;
      const logoHeight = logoWidth * (1889 / 4096);
      doc.addImage(logoDataUrl, 'JPEG', margin, y, logoWidth, logoHeight);
    } else {
      doc.setFontSize(20);
      doc.setTextColor('#3EAFD2');
      doc.setFont('helvetica', 'bold');
      doc.text('helpy', margin, y + 6);
    }
    
    doc.setFontSize(10);
    doc.setTextColor('#3EAFD2');
    doc.setFont('helvetica', 'normal');
    doc.text('www.helpyfam.com', pageWidth - margin, y + 6, { align: 'right' });
    
    y += 20;
    
    // Title (always English for PDF compatibility)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#1a1a1a');
    doc.text('Salary Slip', margin, y);
    y += 12;
    
    // Helper info box
    doc.setFillColor('#f5f5f5');
    doc.roundedRect(margin, y, pageWidth - margin * 2, 30, 3, 3, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(helper.firstName || helper.name?.split(' ')[0] || 'Helper', margin + 5, y + 8);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    
    if (contract?.employmentStartDate) {
      const startDate = new Date(contract.employmentStartDate);
      doc.text(
        `Started: ${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        margin + 5,
        y + 16
      );
    }
    
    const periodStart = new Date(slip.paymentPeriodStart);
    const periodEnd = new Date(slip.paymentPeriodEnd);
    doc.text(
      `Payment Period: ${periodStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      margin + 5,
      y + 24
    );
    
    y += 40;
    
    // Salary breakdown (always English for PDF compatibility)
    doc.setTextColor('#1a1a1a');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Salary Breakdown', margin, y);
    y += 8;
    
    // Table
    const tableData = [
      ['Base Salary', `HK$${slip.baseSalary.toLocaleString()}`],
      ['Food Allowance', `HK$${slip.foodAllowance.toLocaleString()}`],
      ['Additional Pay', `HK$${slip.extraSalary.toLocaleString()}`],
      ['Pay Deduction', `HK$${slip.salaryDeduction.toLocaleString()}`],
    ];
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    tableData.forEach(([label, value]) => {
      doc.text(label, margin, y);
      doc.text(value, pageWidth - margin, y, { align: 'right' });
      y += 7;
    });
    
    // Total line
    y += 3;
    doc.setDrawColor('#1a1a1a');
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Total Payout', margin, y);
    doc.setTextColor('#3EAFD2');
    doc.text(`HK$${slip.totalPayout.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
    
    y += 15;
    
    // Note
    if (slip.note) {
      doc.setTextColor('#1a1a1a');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Note', margin, y);
      y += 7;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#666666');
      const noteLines = doc.splitTextToSize(slip.note, pageWidth - margin * 2);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 5 + 10;
    }
    
    // Signatures section (always English for PDF compatibility)
    y += 10;
    doc.setTextColor('#1a1a1a');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Signatures', margin, y);
    y += 10;
    
    const sigBoxWidth = (pageWidth - margin * 2 - 10) / 2;
    const sigBoxHeight = 40;
    
    // Employer signature box
    doc.setDrawColor('#cccccc');
    doc.setFillColor('#fafafa');
    doc.roundedRect(margin, y, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#1a1a1a');
    doc.text('Employer', margin + 5, y + 8);
    
    if (slip.employerSignedAt) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#22c55e');
      doc.text(slip.employerSignerName || 'Signed', margin + 5, y + 18);
      doc.setFontSize(8);
      doc.setTextColor('#666666');
      const signDate = new Date(slip.employerSignedAt);
      doc.text(signDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), margin + 5, y + 25);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#999999');
      doc.text('Not signed', margin + 5, y + 20);
    }
    
    // Helper signature box
    doc.setDrawColor('#cccccc');
    doc.setFillColor('#fafafa');
    doc.roundedRect(margin + sigBoxWidth + 10, y, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#1a1a1a');
    doc.text('Helper', margin + sigBoxWidth + 15, y + 8);
    
    if (slip.helperSignedAt) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#22c55e');
      doc.text(helper.firstName || helper.name?.split(' ')[0] || 'Signed', margin + sigBoxWidth + 15, y + 18);
      doc.setFontSize(8);
      doc.setTextColor('#666666');
      const signDate = new Date(slip.helperSignedAt);
      doc.text(signDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), margin + sigBoxWidth + 15, y + 25);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#999999');
      doc.text('Not signed', margin + sigBoxWidth + 15, y + 20);
    }
    
    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(9);
    doc.setTextColor('#999999');
    doc.text(
      'Generated by Helpy',
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    
    // Generate filename: "Helpy Salary Slip - Anna - 1 Jan 2025 - 31 Jan 2025.pdf"
    const helperName = helper.firstName || helper.name?.split(' ')[0] || 'Helper';
    const fromDate = periodStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const toDate = periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const filename = `Helpy Salary Slip - ${helperName} - ${fromDate} - ${toDate}.pdf`;
    
    return { blob: doc.output('blob'), filename };
  };

  // Export all salary slips as a zip file
  const handleExportAllPDFs = async () => {
    if (salarySlips.length === 0) return;
    
    haptics.medium();
    setIsExportingAll(true);
    
    try {
      const zip = new JSZip();
      const helperName = helper.firstName || helper.name?.split(' ')[0] || 'Helper';
      
      // Generate PDFs for all slips
      for (const slip of salarySlips) {
        const { blob, filename } = await generatePDFBlob(slip);
        zip.file(filename, blob);
      }
      
      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFilename = `Helpy Salary Slip - ${helperName} - All.zip`;
      const file = new File([zipBlob], zipFilename, { type: 'application/zip' });
      
      // Share or download
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        haptics.success();
        await navigator.share({
          files: [file],
          title: zipFilename,
          text: zipFilename, // Message body for social media / email subject
        });
      } else {
        haptics.success();
        // Create download link
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // User cancelled
      }
      logger.error('Failed to export all PDFs:', err);
      setError(t['error.export_pdf'] || 'Failed to export PDFs. Please try again.');
    } finally {
      setIsExportingAll(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Separate slips into unsigned and signed
  // ─────────────────────────────────────────────────────────────────
  const unsignedSlips = salarySlips.filter(s => !s.employerSignedAt || !s.helperSignedAt);
  const signedSlips = salarySlips.filter(s => s.employerSignedAt && s.helperSignedAt);

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  // No loading spinner - render immediately like other pages (ToDo, Meals, Expenses)
  // Empty states are handled in the JSX below

  return (
    <div>
      {/* Error Banner */}
      <ErrorBanner 
        error={error} 
        onDismiss={() => setError(null)} 
        title={t['common.error'] || 'Error'}
      />
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HELPER INFO HEADER */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="pb-2">
        <div className="flex items-center gap-2">
          <p className="text-body font-bold text-foreground" style={{ fontSize: '20px' }}>
            {helper.firstName || helper.name?.split(' ')[0] || 'Helper'}
          </p>
          {helper.status === 'pending' && (
            <span className="text-caption px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {t['common.pending'] || 'Pending'}
            </span>
          )}
        </div>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EMPLOYMENT DETAILS SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="mt-4 mb-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-primary" />
            <h3 className="text-title font-semibold">
              {t['salary.contract'] || 'Employment Details'}
            </h3>
          </div>
          {canManage && contract && (
          <button
              onClick={openContractSheet}
              className="text-primary p-1"
              aria-label="Edit"
          >
              <Pencil size={16} />
          </button>
          )}
        </div>
        
        <div className="bg-card rounded-xl p-4 shadow-sm">
          {contract ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-body text-muted-foreground">{t['salary.start_date'] || 'Employment Start Date'}</span>
                <span className="text-body text-foreground">
                  {new Date(contract.employmentStartDate).toLocaleDateString(langCode, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                  </div>
              <div className="flex justify-between">
                <span className="text-body text-muted-foreground">{t['salary.base_salary'] || 'Base Salary'}</span>
                <span className="text-body text-foreground">HK${contract.baseSalary.toLocaleString()}</span>
                </div>
              <div className="flex justify-between">
                <span className="text-body text-muted-foreground">{t['salary.food_allowance'] || 'Food Allowance'}</span>
                <span className="text-body text-foreground">HK${contract.foodAllowance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-body font-bold text-foreground">{t['salary.monthly_total'] || 'Monthly Total'}</span>
                <span className="text-body font-bold text-foreground">HK${(contract.baseSalary + contract.foodAllowance).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-body text-muted-foreground mb-3">
                {t['salary.no_contract'] || 'No details set up yet'}
              </p>
              {canManage && (
                  <button
                  onClick={openContractSheet}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg transition-colors"
                >
                  {t['salary.setup_contract'] || 'Set Up Details'}
                  </button>
              )}
                </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SALARY SLIPS SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FilePenLine size={20} className="text-primary" />
          <h3 className="text-title font-semibold">
              {t['salary.slips'] || 'Salary Slips'}
          </h3>
            <button
              onClick={() => setShowSalaryInfo(true)}
              className="text-destructive p-0.5"
              aria-label="Info"
            >
              <Info size={16} />
            </button>
        </div>
          {salarySlips.length > 0 && (
              <button
              onClick={handleExportAllPDFs}
              disabled={isExportingAll}
              className="flex items-center gap-2 text-body text-muted-foreground disabled:opacity-50"
            >
              {isExportingAll ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {t['salary.export_all'] || 'Export All'}
              </button>
            )}
        </div>
        
        {salarySlips.length === 0 ? (
          <div className="bg-card rounded-xl p-4 shadow-sm text-center py-6">
            <p className="text-body text-muted-foreground">
              {t['salary.no_slips'] || 'No salary slips yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Unsigned Slips */}
            <div className="space-y-3">
              {unsignedSlips.map(slip => (
                <SalarySlipCard
                  key={slip.id}
                  slip={slip}
                  helper={helper}
                  contract={contract}
                  isExpanded={expandedSlips.has(slip.id)}
                  onToggle={() => toggleSlipExpanded(slip.id)}
                  canManage={canManage}
                  isHelper={isHelper}
                  canSignAsHelper={isHelper && currentUser.id === helper.id}
                  eligibleSigners={eligibleSigners}
                  selectedSigner={selectedSignerForSlip[slip.id]}
                  onSignerChange={(signerId) => setSelectedSignerForSlip(prev => ({ ...prev, [slip.id]: signerId }))}
                  onSignEmployer={() => setShowSignConfirm({ slipId: slip.id, type: 'employer' })}
                  onSignHelper={() => setShowSignConfirm({ slipId: slip.id, type: 'helper' })}
                  onDelete={() => setShowDeleteConfirm(slip.id)}
                  onExportPDF={() => handleExportPDF(slip)}
                  t={t}
                  langCode={langCode}
                />
              ))}
            </div>
            
            {/* Past & Signed Toggle - OUTSIDE space-y-3 for proper mt-12 */}
            {signedSlips.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center justify-between mb-2 px-2">
                  <button
                    onClick={() => setShowPastSlips(!showPastSlips)}
                    className="flex items-center gap-2"
                  >
                    {showPastSlips ? (
                      <ChevronDown size={16} className="text-muted-foreground" />
                    ) : (
                      <ChevronRight size={16} className="text-muted-foreground" />
                    )}
                    <span className="text-body text-muted-foreground">
                      {t['salary.past_signed'] || 'Past & Signed Slips'} ({signedSlips.length})
                    </span>
                  </button>
                </div>
                
                {showPastSlips && (
                  <div className="space-y-3">
                    {signedSlips.map(slip => (
                      <SalarySlipCard
                        key={slip.id}
                        slip={slip}
                        helper={helper}
                        contract={contract}
                        isExpanded={expandedSlips.has(slip.id)}
                        onToggle={() => toggleSlipExpanded(slip.id)}
                        canManage={canManage}
                        isHelper={isHelper}
                        canSignAsHelper={isHelper && currentUser.id === helper.id}
                        eligibleSigners={eligibleSigners}
                        selectedSigner={selectedSignerForSlip[slip.id]}
                        onSignerChange={(signerId) => setSelectedSignerForSlip(prev => ({ ...prev, [slip.id]: signerId }))}
                        onSignEmployer={() => setShowSignConfirm({ slipId: slip.id, type: 'employer' })}
                        onSignHelper={() => setShowSignConfirm({ slipId: slip.id, type: 'helper' })}
                        onDelete={() => setShowDeleteConfirm(slip.id)}
                        onExportPDF={() => handleExportPDF(slip)}
                        t={t}
                        langCode={langCode}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CONTRACT SHEET */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <BottomSheet isOpen={showContractSheet} onClose={() => setShowContractSheet(false)} showCloseButton={false} maxHeight="85vh">
        {/* Header with X left, Title center, ✓ right */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          {/* X Close Button (left) */}
              <button
            onClick={() => setShowContractSheet(false)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
            aria-label={t['common.close'] || 'Close'}
              >
            <X size={20} />
              </button>
          
          {/* Title (center) */}
          <h2 className="text-title font-semibold text-foreground text-center flex-1">
            {contract ? (t['salary.edit_contract'] || 'Edit Details') : (t['salary.setup_contract'] || 'Set Up Details')}
              </h2>

          {/* ✓ Save Button (right) */}
              <button
            onClick={handleContractSubmit}
            disabled={isLoading || !contractForm.employmentStartDate || !contractForm.baseSalary}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              contractForm.employmentStartDate && contractForm.baseSalary && !isLoading
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground'
            }`}
            aria-label={t['common.save'] || 'Save'}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Check size={20} strokeWidth={3} />
            )}
              </button>
            </div>

        {/* Header separator */}
        <div className="px-5"><div className="h-px bg-border w-full"></div></div>
        
        {/* Info note - only show when editing existing contract */}
        {contract && (
          <div className="px-5 pt-4">
            <p className="text-caption text-muted-foreground">
              {t['salary.edit_note'] || 'Changes to salary and food allowance will only apply to new salary slips. Existing slips are not affected.'}
            </p>
            </div>
        )}
        
        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Helper Name */}
          <div className="flex items-center gap-2">
            <p className="text-black font-bold" style={{ fontSize: '20px' }}>
              {helper.firstName || helper.name?.split(' ')[0] || 'Helper'}
            </p>
            {helper.status === 'pending' && (
              <span className="text-caption px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {t['common.pending'] || 'Pending'}
              </span>
            )}
          </div>
          
          {/* Employment Start Date */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2">
              {t['salary.start_date'] || 'Employment Start Date'} *
            </label>
            <input
              type="date"
              value={contractForm.employmentStartDate}
              onChange={(e) => setContractForm(prev => ({ ...prev, employmentStartDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
            />
            </div>

          {/* Base Salary */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2">
              {t['salary.base_salary'] || 'Base Salary'} *
                </label>
                <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                HK$
              </span>
                  <input
                type="text"
                    autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                value={contractForm.baseSalary}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d]/g, '');
                  setContractForm(prev => ({ ...prev, baseSalary: value }));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="5100"
                className="w-full pl-16 pr-4 py-3 bg-muted rounded-xl text-lg font-semibold text-foreground outline-none border border-transparent focus:border-primary transition-colors text-right"
                  />
                </div>
              </div>
              
          {/* Food Allowance */}
          <div>
            <label className="block text-caption text-muted-foreground mb-2">
              {t['salary.food_allowance'] || 'Food Allowance'}
                </label>
                <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                HK$
              </span>
                  <input
                type="text"
                    autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                value={contractForm.foodAllowance}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d]/g, '');
                  setContractForm(prev => ({ ...prev, foodAllowance: value }));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="1236"
                className="w-full pl-16 pr-4 py-3 bg-muted rounded-xl text-lg font-semibold text-foreground outline-none border border-transparent focus:border-primary transition-colors text-right"
                  />
                </div>
              </div>
            </div>
      </BottomSheet>
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DELETE CONFIRMATION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <BottomSheet isOpen={showDeleteConfirm !== null} onClose={() => setShowDeleteConfirm(null)}>
        <BottomSheet.Header>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={20} className="text-destructive" />
            </div>
            <h2 className="text-title text-foreground">
              {t['salary.delete_confirm_title'] || 'Delete Salary Slip?'}
            </h2>
          </div>
        </BottomSheet.Header>
        <BottomSheet.Body>
          <p className="text-body text-muted-foreground">
            {t['salary.delete_confirm_message'] || 'This action cannot be undone. The salary slip will be permanently deleted.'}
          </p>
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <div className="flex gap-3">
              <button
              onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
              onClick={() => showDeleteConfirm && handleDeleteSlip(showDeleteConfirm)}
                disabled={isLoading}
              className="flex-1 py-3.5 rounded-xl bg-destructive text-white text-body font-semibold disabled:opacity-50"
              >
              {isLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : (t['common.delete'] || 'Delete')}
              </button>
            </div>
        </BottomSheet.Footer>
      </BottomSheet>
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SIGN CONFIRMATION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <BottomSheet isOpen={showSignConfirm !== null} onClose={() => setShowSignConfirm(null)}>
        <BottomSheet.Header>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <h2 className="text-title text-foreground">
              {t['salary.sign_confirm_title'] || 'Confirm Signature'}
                </h2>
              </div>
        </BottomSheet.Header>
        <BottomSheet.Body>
          <p className="text-body text-muted-foreground">
            {t['salary.sign_confirm_message'] || 'This action CANNOT be reversed. Please make sure you have checked everything before signing.'}
          </p>
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <div className="flex gap-3">
              <button
              onClick={() => setShowSignConfirm(null)}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
              onClick={handleSign}
                disabled={isLoading}
              className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold disabled:opacity-50"
              >
              {isLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : (t['salary.confirm_sign'] || 'Confirm & Sign')}
              </button>
            </div>
        </BottomSheet.Footer>
      </BottomSheet>
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SALARY INFO */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <BottomSheet isOpen={showSalaryInfo} onClose={() => setShowSalaryInfo(false)}>
        <BottomSheet.Header>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Info size={20} className="text-primary" />
          </div>
            <h2 className="text-title text-foreground">
              {t['salary.info_title'] || 'Important Information'}
            </h2>
        </div>
        </BottomSheet.Header>
        <BottomSheet.Body>
          <p className="text-body text-muted-foreground">
            {t['salary.info_message'] || 'Salary records will be removed if you delete the helper user. If you would like to keep the salary records, please use the Export All function to download all slips before deletion.'}
          </p>
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <button
            onClick={() => setShowSalaryInfo(false)}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold"
          >
            {t['common.got_it'] || 'Got it'}
          </button>
        </BottomSheet.Footer>
      </BottomSheet>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SALARY SLIP CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface SalarySlipCardProps {
  slip: SalarySlip;
  helper: User;
  contract: HelperContract | null;
  isExpanded: boolean;
  onToggle: () => void;
  canManage: boolean;
  isHelper: boolean;
  canSignAsHelper: boolean; // true only if current user IS this specific helper
  eligibleSigners: User[];
  selectedSigner?: string;
  onSignerChange: (signerId: string) => void;
  onSignEmployer: () => void;
  onSignHelper: () => void;
  onDelete: () => void;
  onExportPDF: () => void;
  t: TranslationDictionary;
  langCode: string;
}

const SalarySlipCard: React.FC<SalarySlipCardProps> = ({
  slip,
  helper,
  contract,
  isExpanded,
  onToggle,
  canManage,
  isHelper,
  canSignAsHelper,
  eligibleSigners,
  selectedSigner,
  onSignerChange,
  onSignEmployer,
  onSignHelper,
  onDelete,
  onExportPDF,
  t,
  langCode,
}) => {
  const isBothSigned = slip.employerSignedAt && slip.helperSignedAt;
  const periodStart = new Date(slip.paymentPeriodStart);
  const periodEnd = new Date(slip.paymentPeriodEnd);
  
  const formatDate = (date: Date) => date.toLocaleDateString(langCode, { day: 'numeric', month: 'short' });
  const formatFullDate = (date: Date) => date.toLocaleDateString(langCode, { day: 'numeric', month: 'short', year: 'numeric' });
  
  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      {/* Collapsed Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-body font-bold text-foreground">
            {formatFullDate(periodStart)} - {formatFullDate(periodEnd)}
          </span>
          {isBothSigned && (
            <Signature size={16} className="text-green-600" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-body font-semibold text-foreground">
            HK${slip.totalPayout.toLocaleString()}
          </span>
          {isExpanded ? (
            <ChevronDown size={18} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={18} className="text-muted-foreground" />
          )}
        </div>
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Separator */}
          <div className="border-t border-border mb-4"></div>
      
      {/* Salary Breakdown */}
          <div className="space-y-2 mb-4 pr-6">
            <div className="flex justify-between">
              <span className="text-body text-muted-foreground">{t['salary.base_salary'] || 'Base Salary'}</span>
              <span className="text-body tabular-nums">HK${slip.baseSalary.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-muted-foreground">{t['salary.food_allowance'] || 'Food Allowance'}</span>
              <span className="text-body tabular-nums">HK${slip.foodAllowance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-muted-foreground">{t['salary.extra_salary'] || 'Additional Pay'}</span>
              <span className="text-body tabular-nums">HK${slip.extraSalary.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-muted-foreground">{t['salary.deduction'] || 'Pay Deduction'}</span>
              <span className="text-body text-destructive tabular-nums">HK${slip.salaryDeduction.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-body font-bold">{t['salary.total_salary'] || 'Total Salary'}</span>
              <span className="text-body font-bold text-primary tabular-nums">HK${slip.totalPayout.toLocaleString()}</span>
          </div>
        </div>
      
          {/* Note */}
          {slip.note && (
            <div className="mb-4 p-3 bg-secondary/50 rounded-lg">
              <p className="text-body text-muted-foreground">{slip.note}</p>
    </div>
      )}
      
      {/* Signature Section */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Employer Signature */}
        <div>
              <p className="text-body text-muted-foreground mb-2">{t['salary.employer'] || 'Employer'}</p>
              {slip.employerSignedAt ? (
                <div className="rounded-xl p-3 bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-1 text-green-600">
                <Signature size={16} />
                    <span className="text-body font-medium">{t['salary.signed'] || 'Signed'}</span>
              </div>
                  <p className="text-body text-muted-foreground mt-1">{slip.employerSignerName}</p>
                  <p className="text-body text-muted-foreground">
                    {formatFullDate(new Date(slip.employerSignedAt))}
                  </p>
            </div>
              ) : canManage ? (
                <div className="space-y-2">
                  {/* Signer Dropdown */}
                  <select
                    value={selectedSigner || ''}
                    onChange={(e) => onSignerChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-body"
                  >
                    <option value="">{t['salary.select_signer'] || 'Select signer'}</option>
                    {eligibleSigners.map(signer => (
                      <option key={signer.id} value={signer.id}>
                        {signer.firstName || signer.name?.split(' ')[0]}
                      </option>
                    ))}
                  </select>
        <button 
                    onClick={onSignEmployer}
                    disabled={!selectedSigner}
                    className="w-full px-4 py-2 rounded-xl bg-secondary text-foreground text-body disabled:opacity-50"
                  >
                    {t['salary.sign'] || 'Sign'}
        </button>
      </div>
              ) : (
                <div className="rounded-xl p-3 bg-muted">
                  <p className="text-body text-muted-foreground">{t['salary.not_signed'] || 'Not signed'}</p>
                </div>
                    )}
                  </div>
        
            {/* Helper Signature */}
        <div>
              <p className="text-body text-muted-foreground mb-2">{t['salary.helper'] || 'Helper'}</p>
              {slip.helperSignedAt ? (
                <div className="rounded-xl p-3 bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-1 text-green-600">
                <Signature size={16} />
                    <span className="text-body font-medium">{t['salary.signed'] || 'Signed'}</span>
                </div>
                  <p className="text-body text-muted-foreground mt-1">
                    {helper.firstName || helper.name?.split(' ')[0]}
                  </p>
                  <p className="text-body text-muted-foreground">
                    {formatFullDate(new Date(slip.helperSignedAt))}
                  </p>
                </div>
              ) : canSignAsHelper ? (
            <button
                  onClick={onSignHelper}
                  className="w-full px-4 py-2 rounded-xl bg-secondary text-foreground text-body"
                >
                  {t['salary.sign'] || 'Sign'}
            </button>
              ) : (
                <div className="rounded-xl p-3 bg-muted">
                  <p className="text-body text-muted-foreground">{t['salary.awaiting_signature'] || 'Awaiting signature'}</p>
              </div>
          )}
          </div>
      </div>
          
          {/* Separator */}
          <div className="border-t border-border mb-4"></div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            {/* Delete button - Helpers cannot delete, only Admin/Spouse can */}
            {canManage && !isHelper && (
          <button
                onClick={onDelete}
                className="py-2.5 px-4 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
          </button>
            )}
      <button
              onClick={onExportPDF}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-sm text-body"
            >
              <Download size={16} />
              {t['salary.export_pdf'] || 'Export PDF'}
      </button>
      </div>
    </div>
      )}
  </div>
  );
};

export default HelperManagementContent;
