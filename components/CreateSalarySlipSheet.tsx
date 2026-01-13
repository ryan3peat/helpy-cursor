// components/CreateSalarySlipSheet.tsx
// ============================================================================
// Bottom sheet for creating a new salary slip
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
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
  
  // Reset form when sheet opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setError(null);
      
      // Pre-select helper if provided
      if (preSelectedHelperId) {
        setSelectedHelperId(preSelectedHelperId);
      } else if (helpers.length === 1) {
        // Auto-select if only one helper
        setSelectedHelperId(helpers[0].id);
      } else {
        setSelectedHelperId('');
      }
      
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
      setContract(null);
    }
  }, [isOpen, preSelectedHelperId, helpers]);
  
  // Load contract when helper is selected
  useEffect(() => {
    if (selectedHelperId && householdId) {
      loadContract();
    }
  }, [selectedHelperId, householdId]);
  
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
  
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="90vh">
      {step === 'form' ? (
        <>
          <BottomSheet.Header>
            <h2 className="text-title text-foreground">
              {t['salary.create_slip'] || 'Create Salary Slip'}
            </h2>
          </BottomSheet.Header>
          <BottomSheet.Body>
            <div className="space-y-4">
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
              
              {/* Base Salary (from contract) */}
              <div>
                <label className="block text-caption text-muted-foreground mb-2">
                  {t['salary.base_salary'] || 'Base Salary'} (HK$) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder={contract ? contract.baseSalary.toString() : '0'}
                    className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                  />
                  {loadingContract && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                {contract && (
                  <p className="text-caption text-muted-foreground mt-1">
                    {t['salary.from_contract'] || 'From contract'}: HK${contract.baseSalary.toLocaleString()}
                  </p>
                )}
                {!contract && selectedHelperId && !loadingContract && (
                  <p className="text-caption text-amber-600 mt-1">
                    {t['salary.no_contract_warning'] || 'No contract found. Please set up contract first.'}
                  </p>
                )}
              </div>
              
              {/* Extra Salary */}
              <div>
                <label className="block text-caption text-muted-foreground mb-2">
                  {t['salary.extra_salary'] || 'Extra Salary'} (HK$)
                </label>
                <input
                  type="number"
                  value={extraSalary}
                  onChange={(e) => setExtraSalary(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                />
              </div>
              
              {/* Salary Deduction */}
              <div>
                <label className="block text-caption text-muted-foreground mb-2">
                  {t['salary.deduction'] || 'Salary Deduction'} (HK$)
                </label>
                <input
                  type="number"
                  value={salaryDeduction}
                  onChange={(e) => setSalaryDeduction(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                />
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
              
              {/* Payment Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-caption text-muted-foreground mb-2">
                    {t['salary.period_start'] || 'Period Start'} *
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
                    {t['salary.period_end'] || 'Period End'} *
                  </label>
                  <input
                    type="date"
                    value={paymentPeriodEnd}
                    onChange={(e) => setPaymentPeriodEnd(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                  />
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
          </BottomSheet.Body>
          <BottomSheet.Footer>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleProceed}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold flex items-center justify-center gap-2"
              >
                <Check size={18} />
                {t['common.proceed'] || 'Proceed'}
              </button>
            </div>
          </BottomSheet.Footer>
        </>
      ) : (
        <>
          {/* Confirmation Step */}
          <BottomSheet.Header>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Check size={20} className="text-primary" />
              </div>
              <h2 className="text-title text-foreground">
                {t['salary.confirm_slip'] || 'Confirm Salary Slip'}
              </h2>
            </div>
          </BottomSheet.Header>
          <BottomSheet.Body>
            <div className="space-y-4">
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
          </BottomSheet.Body>
          <BottomSheet.Footer>
            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
              >
                {t['common.back'] || 'Back'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin mx-auto" />
                ) : (
                  t['common.confirm'] || 'Confirm'
                )}
              </button>
            </div>
          </BottomSheet.Footer>
        </>
      )}
    </BottomSheet>
  );
};

export default CreateSalarySlipSheet;

