// components/CreateSalarySlipSheet.tsx
// ============================================================================
// Bottom sheet for creating a new salary slip
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2, ChevronLeft, AlertTriangle } from 'lucide-react';
import BottomSheet from './ui/BottomSheet';
import type { User, TranslationDictionary } from '@/types';
import { UserRole } from '@/types';
import type { HelperContract, CreateSalarySlip } from '@src/types/helperManagement';
import { useScrollLock } from '../hooks/useScrollLock';
import { useSheetTheme } from '../hooks/useSheetTheme';
import { haptics } from '../utils/haptics';
import {
  getHelperContract,
  createSalarySlip,
} from '../services/salarySlipService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  currentUser: User;
  users: User[];
  t: TranslationDictionary;
  currentLang: string;
  onSuccess?: () => void;
  // Pre-selected helper (optional)
  preSelectedHelperId?: string;
}

const CreateSalarySlipSheet: React.FC<Props> = ({
  isOpen,
  onClose,
  householdId,
  currentUser,
  users,
  t,
  currentLang,
  onSuccess,
  preSelectedHelperId,
}) => {
  // ─────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingContract, setLoadingContract] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [selectedHelperId, setSelectedHelperId] = useState<string>('');
  const [contract, setContract] = useState<HelperContract | null>(null);
  const [paymentPeriodStart, setPaymentPeriodStart] = useState<string>('');
  const [paymentPeriodEnd, setPaymentPeriodEnd] = useState<string>('');
  const [baseSalary, setBaseSalary] = useState<string>('');
  const [extraSalary, setExtraSalary] = useState<string>('0');
  const [salaryDeduction, setSalaryDeduction] = useState<string>('0');
  const [note, setNote] = useState<string>('');
  
  // Scroll lock and sheet theme
  useScrollLock(isOpen);
  useSheetTheme(isOpen);
  
  // Language code for date formatting
  const langCode = currentLang === 'en' ? 'en-GB' : currentLang;
  
  // Get helpers from users
  const helpers = useMemo(() => {
    return users.filter(u => u.role === UserRole.HELPER);
  }, [users]);
  
  // Get eligible signers (for display in confirmation)
  const eligibleSigners = useMemo(() => {
    return users.filter(u => 
      u.role === UserRole.SUPERADMIN || 
      u.role === UserRole.MASTER || 
      u.role === UserRole.SPOUSE
    );
  }, [users]);
  
  // Calculate total payout
  const totalPayout = useMemo(() => {
    const base = parseInt(baseSalary) || 0;
    const extra = parseInt(extraSalary) || 0;
    const deduction = parseInt(salaryDeduction) || 0;
    // Deduction should be negative or zero
    const actualDeduction = deduction > 0 ? -deduction : deduction;
    return base + extra + actualDeduction;
  }, [baseSalary, extraSalary, salaryDeduction]);
  
  // Get selected helper details
  const selectedHelper = useMemo(() => {
    return users.find(u => u.id === selectedHelperId);
  }, [users, selectedHelperId]);

  // ─────────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────────
  
  // Reset form when sheet opens
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setError(null);
      setContract(null);
      
      // Set default payment period (current month)
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setPaymentPeriodStart(firstDay.toISOString().split('T')[0]);
      setPaymentPeriodEnd(lastDay.toISOString().split('T')[0]);
      
      // Reset other fields
      setBaseSalary('');
      setExtraSalary('0');
      setSalaryDeduction('0');
      setNote('');
      
      // Pre-select helper if provided
      if (preSelectedHelperId) {
        setSelectedHelperId(preSelectedHelperId);
      } else if (helpers.length === 1) {
        // Auto-select if only one helper
        setSelectedHelperId(helpers[0].id);
      } else {
        setSelectedHelperId('');
      }
    }
  }, [isOpen]); // Only depend on isOpen, not helpers or preSelectedHelperId
  
  // Load contract when helper is selected
  useEffect(() => {
    if (isOpen && selectedHelperId && householdId) {
      loadContract();
    }
  }, [isOpen, selectedHelperId, householdId]);
  
  const loadContract = async () => {
    if (!selectedHelperId) return;
    
    setLoadingContract(true);
    try {
      const contractData = await getHelperContract(selectedHelperId, householdId);
      setContract(contractData);
      
      // Auto-fill base salary from contract
      if (contractData) {
        setBaseSalary(contractData.baseSalary.toString());
      } else {
        setBaseSalary('');
      }
    } catch (err) {
      console.error('Failed to load contract:', err);
    } finally {
      setLoadingContract(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────
  
  const handleProceed = () => {
    // Validation
    if (!selectedHelperId) {
      setError(t['error.select_helper'] || 'Please select a helper');
      return;
    }
    if (!paymentPeriodStart || !paymentPeriodEnd) {
      setError(t['error.select_dates'] || 'Please select payment period dates');
      return;
    }
    if (!baseSalary || parseInt(baseSalary) <= 0) {
      setError(t['error.enter_salary'] || 'Please enter a valid base salary');
      return;
    }
    
    // Check date validity
    if (new Date(paymentPeriodEnd) < new Date(paymentPeriodStart)) {
      setError(t['error.invalid_dates'] || 'End date must be after start date');
      return;
    }
    
    setError(null);
    setStep('confirm');
  };
  
  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare deduction (ensure it's negative or zero)
      const deduction = parseInt(salaryDeduction) || 0;
      const actualDeduction = deduction > 0 ? -deduction : deduction;
      
      const slipData: CreateSalarySlip = {
        householdId,
        helperId: selectedHelperId,
        contractId: contract?.id,
        paymentPeriodStart,
        paymentPeriodEnd,
        baseSalary: parseInt(baseSalary) || 0,
        extraSalary: parseInt(extraSalary) || 0,
        salaryDeduction: actualDeduction,
        totalPayout,
        note: note.trim() || undefined,
        createdBy: currentUser.id,
      };
      
      await createSalarySlip(slipData);
      
      haptics.success();
      onClose();
      onSuccess?.();
    } catch (err: any) {
      console.error('Failed to create salary slip:', err);
      setError(err.message || t['error.create_slip'] || 'Failed to create salary slip. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBack = () => {
    setStep('form');
  };

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(langCode, { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };
  
  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Safe area bottom cover */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-card"
        style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
      />
      <div 
        className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col"
        style={{ maxHeight: '90vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}
      >
        {step === 'form' ? (
          <>
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
                {t['salary.create_slip'] || 'Create Salary Slip'}
              </h2>
              
              {/* ✓ Proceed Button (right) */}
              <button
                onClick={handleProceed}
                disabled={!selectedHelperId || !baseSalary || !paymentPeriodStart || !paymentPeriodEnd}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  selectedHelperId && baseSalary && paymentPeriodStart && paymentPeriodEnd
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground'
                }`}
                aria-label={t['common.proceed'] || 'Proceed'}
              >
                <Check size={20} strokeWidth={3} />
              </button>
            </div>
            
            {/* Header separator */}
            <div className="px-5"><div className="h-px bg-border w-full"></div></div>
            
            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Error display */}
              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-caption">
                  {error}
                </div>
              )}
              
              {/* Helper Selection */}
              <div>
                <label className="block text-caption text-muted-foreground mb-2">
                  {t['salary.helper_name'] || 'Helper Name'} *
                </label>
                <select
                  value={selectedHelperId}
                  onChange={(e) => setSelectedHelperId(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                >
                  <option value="">{t['salary.select_helper'] || 'Select helper'}</option>
                  {helpers.map(helper => (
                    <option key={helper.id} value={helper.id}>
                      {helper.firstName || helper.name?.split(' ')[0] || 'Helper'}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Payment Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-caption text-muted-foreground mb-2">
                    {t['salary.period_start'] || 'For Payment From'} *
                  </label>
                  <input
                    type="date"
                    value={paymentPeriodStart}
                    onChange={(e) => setPaymentPeriodStart(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                  />
                </div>
                <div>
                  <label className="block text-caption text-muted-foreground mb-2">
                    {t['salary.period_end'] || 'For Payment To'} *
                  </label>
                  <input
                    type="date"
                    value={paymentPeriodEnd}
                    onChange={(e) => setPaymentPeriodEnd(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                  />
                </div>
              </div>
              
              {/* Base Salary (from contract) */}
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
                    inputMode="decimal"
                    value={baseSalary}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d.]/g, '');
                      setBaseSalary(value);
                    }}
                    placeholder={contract ? contract.baseSalary.toString() : '0'}
                    className="w-full pl-16 pr-4 py-3 bg-muted rounded-xl text-lg font-semibold text-foreground outline-none border border-transparent focus:border-primary transition-colors text-right"
                  />
                  {loadingContract && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                {contract && (
                  <p className="text-caption text-muted-foreground mt-1">
                    {t['salary.from_contract'] || 'From employment details'}: HK${contract.baseSalary.toLocaleString()}
                  </p>
                )}
                {!contract && selectedHelperId && !loadingContract && (
                  <p className="text-caption text-destructive mt-1">
                    {t['salary.no_contract_warning'] || 'No employment details found. Please set up details first.'}
                  </p>
                )}
              </div>
              
              {/* Extra Payout */}
              <div>
                <label className="block text-caption text-muted-foreground mb-2">
                  {t['salary.extra_salary'] || 'Extra Payout'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                    HK$
                  </span>
                  <input
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="decimal"
                    value={extraSalary}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d.]/g, '');
                      setExtraSalary(value);
                    }}
                    placeholder="0"
                    className="w-full pl-16 pr-4 py-3 bg-muted rounded-xl text-lg font-semibold text-foreground outline-none border border-transparent focus:border-primary transition-colors text-right"
                  />
                </div>
              </div>
              
              {/* Payout Deduction */}
              <div>
                <label className="block text-caption text-muted-foreground mb-2">
                  {t['salary.deduction'] || 'Payout Deduction'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                    HK$
                  </span>
                  <input
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="decimal"
                    value={salaryDeduction}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d.]/g, '');
                      setSalaryDeduction(value);
                    }}
                    placeholder="0"
                    className="w-full pl-16 pr-4 py-3 bg-muted rounded-xl text-lg font-semibold text-foreground outline-none border border-transparent focus:border-primary transition-colors text-right"
                  />
                </div>
                <p className="text-caption text-muted-foreground mt-1">
                  {t['salary.deduction_hint'] || 'Enter as positive number, will be subtracted'}
                </p>
              </div>
              
              {/* Total Payout (calculated) */}
              <div className="p-4 bg-primary/10 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-body font-semibold text-foreground">
                    {t['salary.total_payout'] || 'Total Payout'}
                  </span>
                  <span className="text-title font-bold text-primary">
                    HK${totalPayout.toLocaleString()}
                  </span>
                </div>
              </div>
              
              {/* Note */}
              <div>
                <label className="block text-caption text-muted-foreground mb-2">
                  {t['salary.note'] || 'Note'}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t['salary.note_placeholder'] || 'Optional notes...'}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body resize-none"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Confirmation Step - Header with Back left, Title center, ✓ right */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              {/* Back Button (left) */}
              <button
                onClick={handleBack}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
                aria-label={t['common.back'] || 'Back'}
              >
                <ChevronLeft size={24} />
              </button>
              
              {/* Title (center) */}
              <h2 className="text-title font-semibold text-foreground text-center flex-1">
                {t['salary.confirm_slip'] || 'Confirm Salary Slip'}
              </h2>
              
              {/* ✓ Confirm Button (right) */}
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-sm disabled:opacity-50"
                aria-label={t['common.confirm'] || 'Confirm'}
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
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Error display */}
              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-caption">
                  {error}
                </div>
              )}
              
              {/* Summary */}
              <div className="p-4 bg-secondary/50 rounded-xl space-y-3">
                <p className="text-body text-muted-foreground">
                  {t['salary.confirm_message'] || 'A salary slip will be generated for:'}
                </p>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-body text-muted-foreground">{t['salary.helper'] || 'Helper'}</span>
                    <span className="text-body font-semibold">
                      {selectedHelper?.firstName || selectedHelper?.name?.split(' ')[0] || 'Helper'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body text-muted-foreground">{t['salary.total_payout'] || 'Total Payout'}</span>
                    <span className="text-body font-bold text-primary">HK${totalPayout.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body text-muted-foreground">{t['salary.payment_period'] || 'Payment Period'}</span>
                    <span className="text-body">
                      {formatDate(paymentPeriodStart)} - {formatDate(paymentPeriodEnd)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-caption text-muted-foreground">{t['salary.base_salary'] || 'Base Salary'}</span>
                  <span className="text-caption">HK${(parseInt(baseSalary) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-caption text-muted-foreground">{t['salary.extra_salary'] || 'Extra Salary'}</span>
                  <span className="text-caption">HK${(parseInt(extraSalary) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-caption text-muted-foreground">{t['salary.deduction'] || 'Deduction'}</span>
                  <span className="text-caption text-destructive">
                    -HK${Math.abs(parseInt(salaryDeduction) || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              
              {note && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-caption text-muted-foreground">{note}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CreateSalarySlipSheet;

