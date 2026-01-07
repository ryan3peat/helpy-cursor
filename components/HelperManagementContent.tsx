// components/HelperManagementContent.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, FileText, Check, X, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import ErrorBanner from './ui/ErrorBanner';
import type { User, TranslationDictionary } from '@/types';
import { UserRole } from '@/types';
import type { HKStatutoryHoliday, HelperHolidayRecord, HelperPayslipConfirmation, CompensationType } from '@src/types/helperManagement';
import { useDemoMode } from '../contexts/DemoModeContext';
import {
  getUpcomingHolidays,
  getHelperHolidayRecord,
  upsertHelperHolidayRecord,
  getCurrentPayslip,
  createOrGetCurrentPayslip,
  signPayslip,
  isHelperSalaryConfigured,
  getPastHolidays,
  getPastPayslips,
  getOvertimeTotalForMonth,
  updatePayslipAmount,
} from '../services/helperManagementService';

interface Props {
  householdId: string;
  helperId: string;
  helper: User;
  currentUser: User;
  t: TranslationDictionary;
  onNavigateToProfile: () => void;
  onEditHelper?: (helperId: string) => void; // Direct edit modal callback
}

export const HelperManagementContent: React.FC<Props> = ({
  householdId,
  helperId,
  helper,
  currentUser,
  t,
  onNavigateToProfile,
  onEditHelper,
}) => {
  // State
  const [upcomingHolidays, setUpcomingHolidays] = useState<HKStatutoryHoliday[]>([]);
  const [holidayRecords, setHolidayRecords] = useState<Map<string, HelperHolidayRecord>>(new Map());
  const [currentPayslip, setCurrentPayslip] = useState<HelperPayslipConfirmation | null>(null);
  const [showCompensationModal, setShowCompensationModal] = useState<{ holiday: HKStatutoryHoliday } | null>(null);
  const [showOvertimeModal, setShowOvertimeModal] = useState<{ holiday: HKStatutoryHoliday } | null>(null);
  const [overtimeAmount, setOvertimeAmount] = useState('');
  const [addToPayslip, setAddToPayslip] = useState(true);
  const [showSignConfirmModal, setShowSignConfirmModal] = useState<'employer' | 'helper' | null>(null);
  const [showPastHolidays, setShowPastHolidays] = useState(false);
  const [showPastPayslips, setShowPastPayslips] = useState(false);
  const [pastHolidays, setPastHolidays] = useState<HelperHolidayRecord[]>([]);
  const [pastPayslips, setPastPayslips] = useState<HelperPayslipConfirmation[]>([]);
  const [overtimeTotal, setOvertimeTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showChangeAmountModal, setShowChangeAmountModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const { isDemoMode, demoPastPayslips, isViewingAsHelper } = useDemoMode();
  
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  // isHelper: true if actual Helper OR SuperAdmin viewing as Helper
  const isHelper = currentUser.role === UserRole.HELPER || (isSuperAdmin && isViewingAsHelper);
  const isAdmin = currentUser.role === UserRole.MASTER;
  const salaryConfigured = isHelperSalaryConfigured(helper);
  
  // Calculate total salary: Base + Other Allowances (incl. food) + Overtime
  const baseSalary = helper.helperBaseSalary || 0;
  const foodAllowance = helper.helperFoodAllowance || 0;
  const otherAllowancesFromProfile = (helper.helperOtherAllowances || []).reduce((sum, a) => sum + a.amount, 0);
  const otherAllowances = foodAllowance + otherAllowancesFromProfile;
  const calculatedTotal = baseSalary + otherAllowances + overtimeTotal;
  const totalSalary = calculatedTotal;
  
  // Check if admin has overridden the calculated amount
  const isAmountOverridden = currentPayslip && currentPayslip.salaryAmount !== calculatedTotal;

  // Load data
  useEffect(() => {
    loadHolidays();
    if (salaryConfigured) {
      loadPayslip();
      // Also load past payslips to show unsigned ones immediately
      loadPastPayslipsQuietly();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helperId, householdId, salaryConfigured]);

  // Load past payslips without showing the expanded section (to find unsigned ones)
  const loadPastPayslipsQuietly = async () => {
    try {
      if (isDemoMode) {
        setPastPayslips(demoPastPayslips);
        return;
      }
      const past = await getPastPayslips(helperId, householdId);
      setPastPayslips(past);
    } catch (error) {
      console.error('Failed to load past payslips:', error);
    }
  };

  const loadHolidays = async () => {
    try {
      const holidays = await getUpcomingHolidays(3);
      setUpcomingHolidays(holidays);
      
      // Load records for each holiday
      const records = new Map<string, HelperHolidayRecord>();
      for (const h of holidays) {
        const record = await getHelperHolidayRecord(helperId, householdId, h.holidayDate);
        if (record) {
          records.set(h.holidayDate, record);
        }
      }
      setHolidayRecords(records);
    } catch (error) {
      console.error('Failed to load holidays:', error);
    }
  };

  const loadPayslip = async () => {
    try {
      // In demo mode, create a mock current payslip (unsigned)
      if (isDemoMode) {
        const now = new Date();
        // Demo: Base 4870 + Other Allowance (food 1236 + transport 500) 1736 = 6606
        const mockCurrentPayslip: HelperPayslipConfirmation = {
          id: 'demo-payslip-current',
          householdId: 'demo-household',
          helperId: 'demo-helper-004',
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          salaryAmount: 6606,  // Total: base + other allowances
          baseSalary: 4870,
          otherAllowancesTotal: 1736,
          overtimeTotal: 0,
          employerSignedAt: null,
          employerUserId: null,
          helperSignedAt: null,
          createdAt: new Date().toISOString(),
        };
        setCurrentPayslip(mockCurrentPayslip);
        setOvertimeTotal(0);
        return;
      }
      
      // Get overtime total for current month
      const now = new Date();
      const overtime = await getOvertimeTotalForMonth(helperId, householdId, now.getMonth() + 1, now.getFullYear());
      setOvertimeTotal(overtime);
      
      const payslip = await getCurrentPayslip(helperId, householdId);
      if (!payslip) {
        // Create one with calculated salary
        const calculatedSalary = baseSalary + otherAllowances + overtime;
        const newPayslip = await createOrGetCurrentPayslip(helperId, householdId, calculatedSalary);
        setCurrentPayslip(newPayslip);
      } else {
        setCurrentPayslip(payslip);
      }
    } catch (error) {
      console.error('Failed to load payslip:', error);
    }
  };

  const handleToggleWorking = async (holiday: HKStatutoryHoliday) => {
    const existing = holidayRecords.get(holiday.holidayDate);
    const currentlyWorking = existing?.isWorking || false;
    
    if (!currentlyWorking) {
      // Turning ON - show compensation modal
      setShowCompensationModal({ holiday });
    } else {
      // Turning OFF - clear record
      try {
        await upsertHelperHolidayRecord(
          householdId,
          helperId,
          holiday.holidayDate,
          holiday.holidayName,
          false,
          null,
          0,
          false
        );
        loadHolidays();
        loadPayslip(); // Refresh overtime totals
      } catch (error) {
        console.error('Failed to update holiday record:', error);
      }
    }
  };

  const handleCompensationSelect = async (type: CompensationType) => {
    if (!showCompensationModal) return;
    
    if (type === 'lieu') {
      // Time in Lieu - save immediately
      const { holiday } = showCompensationModal;
      try {
        await upsertHelperHolidayRecord(
          householdId,
          helperId,
          holiday.holidayDate,
          holiday.holidayName,
          true,
          'lieu',
          0,
          false
        );
        setShowCompensationModal(null);
        loadHolidays();
      } catch (error) {
        console.error('Failed to save compensation:', error);
      }
    } else {
      // Overtime - show amount input modal
      setShowOvertimeModal(showCompensationModal);
      setShowCompensationModal(null);
      setOvertimeAmount('');
      setAddToPayslip(true);
    }
  };

  const handleOvertimeSave = async () => {
    if (!showOvertimeModal) return;
    const { holiday } = showOvertimeModal;
    const amount = parseInt(overtimeAmount) || 0;
    
    setIsLoading(true);
    try {
      await upsertHelperHolidayRecord(
        householdId,
        helperId,
        holiday.holidayDate,
        holiday.holidayName,
        true,
        'overtime',
        amount,
        addToPayslip
      );
      
      setShowOvertimeModal(null);
      loadHolidays();
      loadPayslip(); // Refresh to update overtime totals
    } catch (error) {
      console.error('Failed to save overtime:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignClick = (type: 'employer' | 'helper') => {
    // Validate role-based permissions
    if (type === 'employer' && !isAdmin) {
      setError(t['error.only_admin_sign'] || 'Only Admin users can sign the employer side');
      return;
    }
    if (type === 'helper' && !isHelper) {
      setError(t['error.only_helper_sign'] || 'Only the Helper can sign their side');
      return;
    }
    // Show confirmation modal
    setShowSignConfirmModal(type);
  };

  const handleChangeAmount = () => {
    if (!currentPayslip) return;
    setCustomAmount(currentPayslip.salaryAmount.toString());
    setShowChangeAmountModal(true);
  };

  const handleSaveCustomAmount = async () => {
    if (!currentPayslip) return;
    const newAmount = parseInt(customAmount) || 0;
    
    setIsLoading(true);
    try {
      await updatePayslipAmount(currentPayslip.id, newAmount);
      setShowChangeAmountModal(false);
      loadPayslip();
    } catch (err: any) {
      console.error('Failed to update amount:', err);
      setError(err.message || (t['error.update_amount'] || 'Failed to update amount'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignConfirm = async () => {
    if (!showSignConfirmModal || !currentPayslip) return;
    
    setIsLoading(true);
    try {
      await signPayslip(currentPayslip.id, showSignConfirmModal, currentUser.id);
      setShowSignConfirmModal(null);
      loadPayslip();
    } catch (err) {
      console.error('Failed to sign payslip:', err);
      setError(t['error.sign_payslip'] || 'Failed to sign payslip. It may have already been signed.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPastHolidays = async () => {
    try {
      const past = await getPastHolidays(helperId, householdId);
      setPastHolidays(past);
      setShowPastHolidays(true);
    } catch (error) {
      console.error('Failed to load past holidays:', error);
    }
  };

  const loadPastPayslips = async () => {
    try {
      // In demo mode, use demo payslips
      if (isDemoMode) {
        setPastPayslips(demoPastPayslips);
        setShowPastPayslips(true);
        return;
      }
      
      const past = await getPastPayslips(helperId, householdId);
      setPastPayslips(past);
      setShowPastPayslips(true);
    } catch (error) {
      console.error('Failed to load past payslips:', error);
    }
  };

  // Separate past payslips into unsigned (need attention) and signed (completed)
  const unsignedPastPayslips = pastPayslips.filter(
    p => !p.employerSignedAt || !p.helperSignedAt
  );
  const signedPastPayslips = pastPayslips.filter(
    p => p.employerSignedAt && p.helperSignedAt
  );

  const currentMonth = new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      <ErrorBanner 
        error={error} 
        onDismiss={() => setError(null)} 
        title={t['common.error'] || 'Error'}
      />
      
      {/* Helper Info Header */}
      <div className="pb-2">
        <p className="text-body font-bold text-foreground" style={{ fontSize: '20px' }}>
          {helper.firstName || helper.name?.split(' ')[0] || 'Helper'}
        </p>
        {helper.helperStartDate && (
          <p className="text-caption text-muted-foreground" style={{ fontSize: '14px' }}>
            {t['helper.started'] || 'Started'}: {new Date(helper.helperStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TILE 1: Statutory Holidays */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-primary" />
            <h3 className="text-title font-semibold">
              {t['helper.statutory_holidays'] || 'Statutory Holidays'}
            </h3>
          </div>
          <button
            onClick={loadPastHolidays}
            className="text-caption text-primary"
          >
            {t['common.past'] || 'Past'}
          </button>
        </div>
        
        <div className="space-y-3">
          {upcomingHolidays.map(holiday => {
            const record = holidayRecords.get(holiday.holidayDate);
            const isWorking = record?.isWorking || false;
            const compensationType = record?.compensationType;
            
            return (
              <div 
                key={holiday.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-body font-medium">{holiday.holidayName}</p>
                    {/* TIL Tag */}
                    {isWorking && compensationType === 'lieu' && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {t['helper.til_badge'] || 'TIL'}
                      </span>
                    )}
                    {/* OT Tag with amount */}
                    {isWorking && compensationType === 'overtime' && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                        OT {record?.overtimeAmount ? `$${record.overtimeAmount}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-caption text-muted-foreground">
                    {new Date(holiday.holidayDate).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-caption text-muted-foreground">
                    {t['helper.working'] || 'Working?'}
                  </span>
                  <button
                    onClick={() => handleToggleWorking(holiday)}
                    disabled={isHelper}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      isWorking ? 'bg-primary' : 'bg-muted'
                    } ${isHelper ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      isWorking ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            );
          })}
          
          {upcomingHolidays.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              {t['helper.no_upcoming_holidays'] || 'No upcoming holidays'}
            </p>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TILE 2: Payslip Section */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div>
        {/* Section Title */}
        <div className="flex items-center gap-2 mb-4">
          <FileText size={20} className="text-primary" />
          <h3 className="text-title font-semibold">
            {t['helper.payslip'] || 'Payslip'}
          </h3>
        </div>
        
        {!salaryConfigured ? (
          /* Salary not configured - show Input button */
          <div className="bg-card rounded-xl p-4 shadow-sm text-center py-6">
            <p className="text-body text-muted-foreground mb-3">
              {!helper.helperStartDate && !helper.helperBaseSalary
                ? (t['helper.missing_start_and_salary'] || 'Set the start date and salary to generate payslips')
                : !helper.helperStartDate
                ? (t['helper.missing_start_date'] || 'Set the start date to generate payslips')
                : (t['helper.missing_salary'] || 'Set the salary to generate payslips')
              }
            </p>
            {!isHelper && (
              <button
                onClick={() => {
                  if (onEditHelper) {
                    onEditHelper(helperId);
                  } else {
                    onNavigateToProfile();
                  }
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg transition-colors"
              >
                {t['helper.input_salary'] || 'Set Up'}
              </button>
            )}
          </div>
        ) : (
          /* Salary configured - show payslip cards */
          <div className="space-y-3">
            {/* Current Month Payslip Card */}
            <PayslipCard
              payslip={currentPayslip}
              isCurrentMonth={true}
              baseSalary={baseSalary}
              otherAllowances={otherAllowances}
              overtimeTotal={overtimeTotal}
              totalSalary={totalSalary}
              isAmountOverridden={isAmountOverridden || false}
              isAdmin={isAdmin}
              isHelper={isHelper}
              helper={helper}
              users={[]} // Will be passed from parent if needed
              onSignClick={handleSignClick}
              onChangeAmount={handleChangeAmount}
              t={t}
            />
            
            {/* Unsigned Past Payslips - Show in current area until signed */}
            {unsignedPastPayslips.map(payslip => (
              <PayslipCard
                key={payslip.id}
                payslip={payslip}
                isCurrentMonth={false}
                baseSalary={payslip.baseSalary || 0}
                otherAllowances={payslip.otherAllowancesTotal || 0}
                overtimeTotal={payslip.overtimeTotal || 0}
                totalSalary={payslip.salaryAmount}
                isAmountOverridden={false}
                isAdmin={isAdmin}
                isHelper={isHelper}
                helper={helper}
                users={[]}
                onSignClick={handleSignClick}
                onChangeAmount={() => {}}
                t={t}
              />
            ))}
            
            {/* Past & Signed Salary Toggle Button */}
            <button
              onClick={() => {
                if (showPastPayslips) {
                  setShowPastPayslips(false);
                } else {
                  loadPastPayslips();
                }
              }}
              className="w-full flex items-center justify-start gap-2 py-3 text-body font-medium text-foreground"
            >
              {showPastPayslips ? (
                <>
                  <ChevronDown size={18} />
                  {t['helper.hide_past_signed_salary'] || 'Hide Past & Signed Salary'}
                </>
              ) : (
                <>
                  <ChevronRight size={18} />
                  {t['helper.show_past_signed_salary'] || 'Past & Signed Salary'}
                </>
              )}
            </button>
            
            {/* Past & Signed Payslips (Expanded) - Only show fully signed */}
            {showPastPayslips && signedPastPayslips.length > 0 && (
              <PastPayslipsSection
                payslips={signedPastPayslips}
                helper={helper}
                t={t}
              />
            )}
            
            {/* Message if no signed payslips */}
            {showPastPayslips && signedPastPayslips.length === 0 && (
              <div className="text-center py-4 text-caption text-muted-foreground">
                {t['helper.no_signed_payslips'] || 'No signed payslips yet'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      
      {/* Compensation Type Modal - Bottom Sheet */}
      {showCompensationModal && createPortal(
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <h2 className="text-title text-foreground">
                {t['helper.select_compensation'] || 'Select Compensation Type'}
              </h2>
              <p className="text-body text-muted-foreground mt-1">
                {showCompensationModal.holiday.holidayName}
              </p>
            </div>

            {/* Content */}
            <div className="p-5 space-y-3">
              <button
                onClick={() => handleCompensationSelect('lieu')}
                className="w-full py-3 px-4 bg-secondary rounded-xl text-left transition-colors"
              >
                <span className="text-body font-medium">
                  {t['helper.time_in_lieu'] || 'Time-in-lieu (1 day off)'}
                </span>
              </button>
              <button
                onClick={() => handleCompensationSelect('overtime')}
                className="w-full py-3 px-4 bg-secondary rounded-xl text-left transition-colors"
              >
                <span className="text-body font-medium">
                  {t['helper.overtime_pay'] || 'Overtime Pay'}
                </span>
              </button>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border shrink-0">
              <button
                onClick={() => setShowCompensationModal(null)}
                className="w-full py-3.5 rounded-xl bg-secondary text-foreground text-body"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Overtime Amount Modal - Bottom Sheet */}
      {showOvertimeModal && createPortal(
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <h2 className="text-title text-foreground">
                {t['helper.overtime_amount'] || 'Overtime Pay Amount'}
              </h2>
              <p className="text-body text-muted-foreground mt-1">
                {showOvertimeModal.holiday.holidayName}
              </p>
            </div>

            {/* Content */}
            <div className="p-5">
              {/* Amount input */}
              <div className="mb-4">
                <label className="block text-caption text-muted-foreground mb-1.5">
                  {t['helper.amount'] || 'Amount (HK$)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    autoComplete="one-time-code"
                    value={overtimeAmount}
                    onChange={(e) => setOvertimeAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                  />
                </div>
              </div>
              
              {/* Add to payslip question */}
              <div className="p-3 bg-secondary rounded-lg">
                <p className="text-body mb-3">
                  {t['helper.add_to_payslip_question'] || "Add this amount to their monthly payslip?"}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAddToPayslip(true)}
                    className={`flex-1 py-2 rounded-xl transition-colors ${
                      addToPayslip 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {t['common.yes'] || 'Yes'}
                  </button>
                  <button
                    onClick={() => setAddToPayslip(false)}
                    className={`flex-1 py-2 rounded-xl transition-colors ${
                      !addToPayslip 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {t['common.no'] || 'No'}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border shrink-0 flex gap-3">
              <button
                onClick={() => setShowOvertimeModal(null)}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleOvertimeSave}
                disabled={isLoading}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body disabled:opacity-50"
              >
                {isLoading ? '...' : (t['common.save'] || 'Save')}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Change Amount Modal - Bottom Sheet */}
      {showChangeAmountModal && currentPayslip && createPortal(
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <h2 className="text-title text-foreground">
                {t['helper.change_amount'] || 'Change Amount'}
              </h2>
            </div>

            {/* Content */}
            <div className="p-5">
              {/* Current breakdown (read-only) */}
              <div className="bg-secondary/50 rounded-lg p-3 mb-4 space-y-1 text-caption">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t['helper.breakdown_base_salary'] || 'Base Salary'}</span>
                  <span>${baseSalary.toLocaleString()}</span>
                </div>
                {otherAllowances > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t['helper.breakdown_other_allowances'] || 'Other Allowances'}</span>
                    <span>${otherAllowances.toLocaleString()}</span>
                  </div>
                )}
                {overtimeTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t['helper.breakdown_overtime'] || 'Overtime'}</span>
                    <span>${overtimeTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border text-body">
                  <span className="text-muted-foreground">{t['helper.breakdown_calculated_total'] || 'Calculated Total'}</span>
                  <span className="font-medium">${totalSalary.toLocaleString()}</span>
                </div>
              </div>
              
              {/* New amount input */}
              <div className="mb-4">
                <label className="block text-caption text-muted-foreground mb-1.5">
                  {t['helper.new_amount'] || 'New Total Amount (HK$)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    autoComplete="one-time-code"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                  />
                </div>
              </div>
              
              {/* Revert button - show only if amount differs from calculated */}
              {parseInt(customAmount) !== calculatedTotal && (
                <button
                  onClick={() => setCustomAmount(calculatedTotal.toString())}
                  className="w-full py-2 text-caption text-primary"
                >
                  {t['helper.revert_to_calculated'] || 'Revert to Calculated Amount'} (${calculatedTotal.toLocaleString()})
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border shrink-0 flex gap-3">
              <button
                onClick={() => setShowChangeAmountModal(false)}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleSaveCustomAmount}
                disabled={isLoading}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body disabled:opacity-50"
              >
                {isLoading ? '...' : (t['common.save'] || 'Save')}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Sign Confirmation Modal - Bottom Sheet */}
      {showSignConfirmModal && createPortal(
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
          {/* Safe area bottom cover */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card"
            style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
          />
          <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
            {/* Header */}
            <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <h2 className="text-title text-foreground">
                  {t['helper.confirm_signature'] || 'Confirm Signature'}
                </h2>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-body text-muted-foreground mb-4">
                {t['helper.sign_warning'] || "Press to confirm this month's salary. This action CANNOT be reversed."}
              </p>
              
              <div className="p-3 bg-secondary rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-caption text-muted-foreground">{currentMonth}</span>
                  <span className="text-title font-bold text-primary">${totalSalary.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border shrink-0 flex gap-3">
              <button
                onClick={() => setShowSignConfirmModal(null)}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleSignConfirm}
                disabled={isLoading}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body disabled:opacity-50"
              >
                {isLoading ? '...' : (t['helper.confirm_sign'] || 'Confirm & Sign')}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Past Holidays Modal */}
      {showPastHolidays && (
        <PastHolidaysModal
          records={pastHolidays}
          onClose={() => setShowPastHolidays(false)}
          t={t}
        />
      )}

      {/* Past Payslips are now shown inline, not in modal */}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW PAYSLIP COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Helper function to format signed date
const formatSignedDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Current Month Payslip Card Component
const PayslipCard: React.FC<{
  payslip: HelperPayslipConfirmation | null;
  isCurrentMonth: boolean;
  baseSalary: number;
  otherAllowances: number;
  overtimeTotal: number;
  totalSalary: number;
  isAmountOverridden: boolean;
  isAdmin: boolean;
  isHelper: boolean;
  helper: User;
  users: User[];
  onSignClick: (role: 'employer' | 'helper') => void;
  onChangeAmount: () => void;
  t: TranslationDictionary;
}> = ({
  payslip,
  isCurrentMonth,
  baseSalary,
  otherAllowances,
  overtimeTotal,
  totalSalary,
  isAmountOverridden,
  isAdmin,
  isHelper,
  helper,
  onSignClick,
  onChangeAmount,
  t,
}) => {
  const isBothSigned = payslip?.employerSignedAt && payslip?.helperSignedAt;
  const now = new Date();
  const monthYear = payslip 
    ? new Date(payslip.year, payslip.month - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : now.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  return (
    <div className="bg-card rounded-xl p-4 shadow-sm">
      {/* Header: Month + Year with optional checkmark */}
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-foreground font-bold" style={{ fontSize: '20px' }}>{monthYear}</h4>
        {isBothSigned && (
          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
            <Check size={14} className="text-green-600" />
          </div>
        )}
      </div>
      <p className="text-caption text-muted-foreground mb-4">{t['helper.payslip'] || 'Payslip'}</p>
      
      {/* Salary Breakdown */}
      <div className="space-y-1 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-body text-muted-foreground">{t['helper.base_salary'] || 'Base Salary'}</span>
          <span className="text-body text-foreground">
            HK${baseSalary.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-body text-muted-foreground">{t['helper.other_allowance'] || 'Other Allowance'}</span>
          <span className="text-body text-foreground">
            HK${otherAllowances.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-body text-muted-foreground">{t['helper.overtime'] || 'Overtime'}</span>
          <span className="text-body text-foreground">
            HK${overtimeTotal.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-body text-foreground font-bold">{t['helper.total'] || 'Total'}</span>
          <span className="text-title font-bold text-foreground">
            HK${(payslip?.salaryAmount || totalSalary).toLocaleString()}
          </span>
        </div>
      </div>
      
      {/* Separator Line */}
      <div className="border-t border-border mb-4"></div>
      
      {/* Change Amount button - only for Admin and only if no signatures */}
      {isCurrentMonth && isAdmin && !payslip?.employerSignedAt && !payslip?.helperSignedAt && (
        <button
          onClick={onChangeAmount}
          className="w-full text-caption text-primary mb-4"
        >
          {t['helper.change_amount'] || 'Change Amount'}
        </button>
      )}
      
      {/* Signature Section */}
      <div className="grid grid-cols-2 gap-4">
        {/* Employer */}
        <div className="text-center">
          <div className="text-caption text-muted-foreground mb-2">
            {t['helper.employer'] || 'Employer'}
          </div>
          {payslip?.employerSignedAt ? (
            <div className={`rounded-xl p-3 ${isCurrentMonth ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
              <div className="flex items-center justify-center gap-1 text-green-600">
                <Check size={16} />
                <span className="text-caption font-medium">{t['helper.signed'] || 'Signed'}</span>
              </div>
              <p className="text-caption text-muted-foreground mt-1">David</p>
              <p className="text-micro text-muted-foreground">{formatSignedDate(payslip.employerSignedAt)}</p>
            </div>
          ) : (
            <button
              onClick={() => onSignClick('employer')}
              disabled={!isAdmin}
              className={`w-full px-4 py-3 rounded-xl transition-colors ${
                !isAdmin 
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-secondary text-foreground'
              }`}
            >
              {t['helper.sign'] || 'Sign'}
            </button>
          )}
        </div>
        
        {/* Helper */}
        <div className="text-center">
          <div className="text-caption text-muted-foreground mb-2">
            {t['helper.helper'] || 'Helper'}
          </div>
          {payslip?.helperSignedAt ? (
            <div className={`rounded-xl p-3 ${isCurrentMonth ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
              <div className="flex items-center justify-center gap-1 text-green-600">
                <Check size={16} />
                <span className="text-caption font-medium">{t['helper.signed'] || 'Signed'}</span>
              </div>
              <p className="text-caption text-muted-foreground mt-1">{helper.firstName || helper.name?.split(' ')[0] || 'Helper'}</p>
              <p className="text-micro text-muted-foreground">{formatSignedDate(payslip.helperSignedAt)}</p>
            </div>
          ) : (
            <button
              onClick={() => onSignClick('helper')}
              disabled={!isHelper}
              className={`w-full px-4 py-3 rounded-xl transition-colors ${
                !isHelper 
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-secondary text-foreground'
              }`}
            >
              {t['helper.sign'] || 'Sign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Past Payslips Section with Year Grouping
const PastPayslipsSection: React.FC<{
  payslips: HelperPayslipConfirmation[];
  helper: User;
  t: TranslationDictionary;
}> = ({ payslips, helper, t }) => {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedPayslips, setExpandedPayslips] = useState<Set<string>>(new Set());
  
  // Group payslips by year
  const currentYear = new Date().getFullYear();
  const groupedByYear = useMemo(() => {
    const groups: Record<number, HelperPayslipConfirmation[]> = {};
    payslips.forEach(slip => {
      if (!groups[slip.year]) groups[slip.year] = [];
      groups[slip.year].push(slip);
    });
    // Sort each group by month descending
    Object.keys(groups).forEach(year => {
      groups[parseInt(year)].sort((a, b) => b.month - a.month);
    });
    return groups;
  }, [payslips]);
  
  const years = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);
  const currentYearPayslips = groupedByYear[currentYear] || [];
  const previousYears = years.filter(y => y < currentYear);
  
  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };
  
  const togglePayslip = (id: string) => {
    setExpandedPayslips(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  if (payslips.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        {t['helper.no_past_payslips'] || 'No past payslips'}
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {/* Current Year Payslips (shown directly) */}
      {currentYearPayslips.map(slip => (
        <PastPayslipCard
          key={slip.id}
          payslip={slip}
          helper={helper}
          isExpanded={expandedPayslips.has(slip.id)}
          onToggle={() => togglePayslip(slip.id)}
          t={t}
        />
      ))}
      
      {/* Previous Years (collapsed by default) */}
      {previousYears.map(year => (
        <div key={year} className="w-full">
          <button
            onClick={() => toggleYear(year)}
            className="w-full flex items-center justify-start gap-2 py-3"
          >
            {expandedYears.has(year) ? (
              <ChevronDown size={18} className="text-primary" strokeWidth={2.5} />
            ) : (
              <ChevronRight size={18} className="text-primary" strokeWidth={2.5} />
            )}
            <span className="text-body font-bold text-primary">{year}</span>
          </button>
          
          {expandedYears.has(year) && (
            <div className="mt-2 space-y-2 pl-2">
              {groupedByYear[year].map(slip => (
                <PastPayslipCard
                  key={slip.id}
                  payslip={slip}
                  helper={helper}
                  isExpanded={expandedPayslips.has(slip.id)}
                  onToggle={() => togglePayslip(slip.id)}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Individual Past Payslip Card (Expandable)
const PastPayslipCard: React.FC<{
  payslip: HelperPayslipConfirmation;
  helper: User;
  isExpanded: boolean;
  onToggle: () => void;
  t: TranslationDictionary;
}> = ({ payslip, helper, isExpanded, onToggle, t }) => {
  const isBothSigned = payslip.employerSignedAt && payslip.helperSignedAt;
  const monthYear = new Date(payslip.year, payslip.month - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  
  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      {/* Collapsed View */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-body font-bold text-foreground">{monthYear}</span>
          {isBothSigned && (
            <Check size={16} className="text-green-600" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-body font-semibold text-foreground">HK${payslip.salaryAmount.toLocaleString()}</span>
          {isExpanded ? (
            <ChevronDown size={18} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={18} className="text-muted-foreground" />
          )}
        </div>
      </button>
      
      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          {/* Separator - inset from card edges */}
          <div className="border-t border-border mb-3"></div>
          <div className="space-y-2 text-caption">
            {/* Base Salary */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t['helper.base_salary'] || 'Base Salary'}</span>
              <span>HK${(payslip.baseSalary || ((payslip.salaryAmount || 0) - (payslip.overtimeTotal || 0) - (payslip.otherAllowancesTotal || 0))).toLocaleString()}</span>
            </div>
            {/* Other Allowance */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t['helper.other_allowance'] || 'Other Allowance'}</span>
              <span>HK${(payslip.otherAllowancesTotal || 0).toLocaleString()}</span>
            </div>
            {/* Overtime */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t['helper.overtime'] || 'Overtime'}</span>
              <span>HK${(payslip.overtimeTotal || 0).toLocaleString()}</span>
            </div>
            {/* Total */}
            <div className="flex justify-between pt-1">
              <span className="text-foreground font-bold">{t['helper.total'] || 'Total'}</span>
              <span className="font-bold">HK${payslip.salaryAmount.toLocaleString()}</span>
            </div>
            {/* Signature details */}
            <div className="flex justify-between pt-2 border-t border-border mt-2">
              <span className="text-muted-foreground">{t['helper.employer'] || 'Employer'}</span>
              <span className={payslip.employerSignedAt ? 'text-green-600' : 'text-muted-foreground'}>
                {payslip.employerSignedAt 
                  ? `Signed by David, ${formatSignedDate(payslip.employerSignedAt)}`
                  : 'Not signed'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t['helper.helper'] || 'Helper'}</span>
              <span className={payslip.helperSignedAt ? 'text-green-600' : 'text-muted-foreground'}>
                {payslip.helperSignedAt 
                  ? `Signed by ${helper.firstName || helper.name?.split(' ')[0] || 'Helper'}, ${formatSignedDate(payslip.helperSignedAt)}`
                  : 'Not signed'
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// OLD MODAL COMPONENTS (kept for holidays)
// ═══════════════════════════════════════════════════════════════════════════

// Sub-components for modals
const PastHolidaysModal: React.FC<{
  records: HelperHolidayRecord[];
  onClose: () => void;
  t: TranslationDictionary;
}> = ({ records, onClose, t }) => createPortal(
  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
    {/* Safe area bottom cover */}
    <div 
      className="fixed bottom-0 left-0 right-0 bg-card"
      style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
    />
    <div 
      className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)', maxHeight: '70vh' }}
    >
      {/* Header */}
      <div className="relative pt-6 pb-4 px-5 border-b border-border" style={{ marginLeft: '1.25rem', marginRight: '1.25rem', paddingLeft: 0, paddingRight: 0, borderColor: 'var(--border)' }}>
        <button 
          onClick={onClose}
          className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center right-0 -top-1 text-muted-foreground"
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <h2 className="text-title text-foreground">{t['helper.past_holidays'] || 'Past Holidays'}</h2>
      </div>
      {/* Body */}
      <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 100px)' }}>
        {records.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {t['helper.no_past_records'] || 'No past records'}
          </p>
        ) : (
          <div className="space-y-3">
            {records.map(record => (
              <div key={record.id} className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-body font-medium">{record.holidayName}</p>
                    {record.isWorking && record.compensationType === 'lieu' && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">{t['helper.til_badge'] || 'TIL'}</span>
                    )}
                    {record.isWorking && record.compensationType === 'overtime' && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                        OT {record.overtimeAmount ? `$${record.overtimeAmount}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-caption text-muted-foreground">
                    {new Date(record.holidayDate).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-body ${record.isWorking ? 'text-orange-500' : 'text-green-500'}`}>
                    {record.isWorking ? 'Worked' : 'Off'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
, document.body);

export default HelperManagementContent;
