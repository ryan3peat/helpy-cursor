// components/HelperManagementContent.tsx

import React, { useState, useEffect } from 'react';
import { Calendar, FileText, Check, X, AlertTriangle } from 'lucide-react';
import ErrorBanner from './ui/ErrorBanner';
import type { User, TranslationDictionary } from '@/types';
import { UserRole } from '@/types';
import type { HKStatutoryHoliday, HelperHolidayRecord, HelperPayslipConfirmation, CompensationType } from '@src/types/helperManagement';
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
  
  const isHelper = currentUser.role === UserRole.HELPER;
  const isAdmin = currentUser.role === UserRole.MASTER;
  const salaryConfigured = isHelperSalaryConfigured(helper);
  
  // Calculate total salary: Base + Other Allowances + Overtime
  const baseSalary = helper.helperBaseSalary || 0;
  const otherAllowances = (helper.helperOtherAllowances || []).reduce((sum, a) => sum + a.amount, 0);
  const calculatedTotal = baseSalary + otherAllowances + overtimeTotal;
  const totalSalary = calculatedTotal;
  
  // Check if admin has overridden the calculated amount
  const isAmountOverridden = currentPayslip && currentPayslip.salaryAmount !== calculatedTotal;

  // Load data
  useEffect(() => {
    loadHolidays();
    if (salaryConfigured) {
      loadPayslip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helperId, householdId, salaryConfigured]);

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
      const past = await getPastPayslips(helperId, householdId);
      setPastPayslips(past);
      setShowPastPayslips(true);
    } catch (error) {
      console.error('Failed to load past payslips:', error);
    }
  };

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
            className="text-caption text-primary hover:underline"
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
                    {new Date(holiday.holidayDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
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
      {/* TILE 2: Payslip Confirmation */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-primary" />
            <h3 className="text-title font-semibold">
              {t['helper.payslip_confirmation'] || 'Payslip Confirmation'}
            </h3>
          </div>
          <button
            onClick={loadPastPayslips}
            className="text-caption text-primary hover:underline"
          >
            {t['common.past'] || 'Past'}
          </button>
        </div>
        
        {!salaryConfigured ? (
          /* Salary not configured - show Input button */
          <div className="text-center py-6">
            <p className="text-body text-muted-foreground mb-4">
              {t['helper.salary_not_configured'] || 'Salary details not configured'}
            </p>
            {!isHelper && (
              <button
                onClick={() => {
                  // Use direct edit callback if available, otherwise fall back to profile navigation
                  if (onEditHelper) {
                    onEditHelper(helperId);
                  } else {
                    onNavigateToProfile();
                  }
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t['helper.input_salary'] || 'Input Salary Details'}
              </button>
            )}
          </div>
        ) : (
          /* Salary configured - show payslip */
          <div>
            {/* Month header */}
            <div className="text-caption text-muted-foreground mb-3">{currentMonth}</div>
            
            {/* Calculated Amount Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-caption font-medium text-muted-foreground">
                  {t['helper.calculated_amount'] || 'Calculated Amount'}
                </span>
                {/* Change Amount button - only for Admin and only if no signatures */}
                {isAdmin && !currentPayslip?.employerSignedAt && !currentPayslip?.helperSignedAt && (
                  <button
                    onClick={handleChangeAmount}
                    className="text-caption text-primary hover:underline"
                  >
                    {t['helper.change_amount'] || 'Change Amount'}
                  </button>
                )}
              </div>
              
              {/* Salary Display */}
              <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                {/* Only show breakdown if amount hasn't been overridden */}
                {!isAmountOverridden && (
                  <>
                    <div className="flex justify-between text-caption">
                      <span className="text-muted-foreground">{t['helper.base_salary'] || 'Base Salary'}</span>
                      <span>${baseSalary.toLocaleString()}</span>
                    </div>
                    {otherAllowances > 0 && (
                      <div className="flex justify-between text-caption">
                        <span className="text-muted-foreground">{t['helper.other_allowances'] || 'Other Allowances'}</span>
                        <span>${otherAllowances.toLocaleString()}</span>
                      </div>
                    )}
                    {overtimeTotal > 0 && (
                      <div className="flex justify-between text-caption">
                        <span className="text-muted-foreground">{t['helper.overtime'] || 'Overtime'}</span>
                        <span>${overtimeTotal.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-body font-semibold">{t['helper.total'] || 'Total'}</span>
                      <span className="text-title font-bold text-primary">
                        ${(currentPayslip?.salaryAmount || totalSalary).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
                
                {/* Show override notice when amount has been manually changed */}
                {isAmountOverridden && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-body font-semibold">{t['helper.manual_amount'] || 'Manual Amount'}</span>
                      <span className="text-title font-bold text-primary">
                        ${currentPayslip?.salaryAmount.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-caption text-muted-foreground mt-1">
                      {t['helper.amount_overridden'] || 'Amount has been manually adjusted by Admin'}
                    </p>
                  </>
                )}
              </div>
            </div>
            
            {/* Sign Buttons Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Employer sign */}
              <div className="text-center">
                <div className="text-caption text-muted-foreground mb-2">
                  {t['helper.employer'] || 'Employer'}
                </div>
                {currentPayslip?.employerSignedAt ? (
                  <div className="flex flex-col items-center py-2">
                    <Check size={24} className="text-green-500" />
                    <span className="text-caption text-green-600">
                      {t['helper.signed'] || 'Signed'}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSignClick('employer')}
                    disabled={!isAdmin}
                    className={`w-full px-4 py-2 rounded-lg transition-colors ${
                      !isAdmin 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-400 text-white hover:bg-primary'
                    }`}
                  >
                    {t['helper.sign'] || 'Sign'}
                  </button>
                )}
              </div>
              
              {/* Helper sign */}
              <div className="text-center">
                <div className="text-caption text-muted-foreground mb-2">
                  {t['helper.helper'] || 'Helper'}
                </div>
                {currentPayslip?.helperSignedAt ? (
                  <div className="flex flex-col items-center py-2">
                    <Check size={24} className="text-green-500" />
                    <span className="text-caption text-green-600">
                      {t['helper.signed'] || 'Signed'}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSignClick('helper')}
                    disabled={!isHelper}
                    className={`w-full px-4 py-2 rounded-lg transition-colors ${
                      !isHelper 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-400 text-white hover:bg-primary'
                    }`}
                  >
                    {t['helper.sign'] || 'Sign'}
                  </button>
                )}
              </div>
            </div>
            
            {/* Locked indicator when both signed */}
            {currentPayslip?.employerSignedAt && currentPayslip?.helperSignedAt && (
              <div className="mt-3 text-center text-caption text-green-600 flex items-center justify-center gap-1">
                <Check size={14} />
                <span>{t['helper.payslip_confirmed'] || 'Payslip confirmed and locked'}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      
      {/* Compensation Type Modal */}
      {showCompensationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 m-4 max-w-sm w-full">
            <h3 className="text-title font-semibold mb-4">
              {t['helper.select_compensation'] || 'Select Compensation Type'}
            </h3>
            <p className="text-body text-muted-foreground mb-4">
              {showCompensationModal.holiday.holidayName}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleCompensationSelect('lieu')}
                className="w-full py-3 px-4 bg-secondary rounded-lg text-left hover:bg-secondary/80 transition-colors"
              >
                <span className="text-body font-medium">
                  {t['helper.time_in_lieu'] || 'Time-in-lieu (1 day off)'}
                </span>
              </button>
              <button
                onClick={() => handleCompensationSelect('overtime')}
                className="w-full py-3 px-4 bg-secondary rounded-lg text-left hover:bg-secondary/80 transition-colors"
              >
                <span className="text-body font-medium">
                  {t['helper.overtime_pay'] || 'Overtime Pay'}
                </span>
              </button>
            </div>
            <button
              onClick={() => setShowCompensationModal(null)}
              className="w-full mt-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {t['common.cancel'] || 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Overtime Amount Modal */}
      {showOvertimeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 m-4 max-w-sm w-full">
            <h3 className="text-title font-semibold mb-4">
              {t['helper.overtime_amount'] || 'Overtime Pay Amount'}
            </h3>
            <p className="text-body text-muted-foreground mb-4">
              {showOvertimeModal.holiday.holidayName}
            </p>
            
            {/* Amount input */}
            <div className="mb-4">
              <label className="block text-caption text-muted-foreground mb-2">
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
            <div className="mb-6 p-3 bg-secondary rounded-lg">
              <p className="text-body mb-3">
                {t['helper.add_to_payslip_question'] || "Add this amount to their monthly payslip?"}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setAddToPayslip(true)}
                  className={`flex-1 py-2 rounded-lg transition-colors ${
                    addToPayslip 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t['common.yes'] || 'Yes'}
                </button>
                <button
                  onClick={() => setAddToPayslip(false)}
                  className={`flex-1 py-2 rounded-lg transition-colors ${
                    !addToPayslip 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t['common.no'] || 'No'}
                </button>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowOvertimeModal(null)}
                className="flex-1 py-3 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleOvertimeSave}
                disabled={isLoading}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? '...' : (t['common.save'] || 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Amount Modal */}
      {showChangeAmountModal && currentPayslip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 m-4 max-w-sm w-full">
            <h3 className="text-title font-semibold mb-4">
              {t['helper.change_amount'] || 'Change Amount'}
            </h3>
            
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
              <label className="block text-caption text-muted-foreground mb-2">
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
                className="w-full mb-4 py-2 text-caption text-primary hover:underline"
              >
                {t['helper.revert_to_calculated'] || 'Revert to Calculated Amount'} (${calculatedTotal.toLocaleString()})
              </button>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowChangeAmountModal(false)}
                className="flex-1 py-3 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleSaveCustomAmount}
                disabled={isLoading}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? '...' : (t['common.save'] || 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Confirmation Modal */}
      {showSignConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 m-4 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <h3 className="text-title font-semibold">
                {t['helper.confirm_signature'] || 'Confirm Signature'}
              </h3>
            </div>
            
            <p className="text-body text-muted-foreground mb-6">
              {t['helper.sign_warning'] || "Press to confirm this month's salary. This action CANNOT be reversed."}
            </p>
            
            <div className="p-3 bg-secondary rounded-lg mb-6">
              <div className="flex justify-between items-center">
                <span className="text-caption text-muted-foreground">{currentMonth}</span>
                <span className="text-title font-bold text-primary">${totalSalary.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignConfirmModal(null)}
                className="flex-1 py-3 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleSignConfirm}
                disabled={isLoading}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? '...' : (t['helper.confirm_sign'] || 'Confirm & Sign')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Past Holidays Modal */}
      {showPastHolidays && (
        <PastHolidaysModal
          records={pastHolidays}
          onClose={() => setShowPastHolidays(false)}
          t={t}
        />
      )}

      {/* Past Payslips Modal */}
      {showPastPayslips && (
        <PastPayslipsModal
          payslips={pastPayslips}
          onClose={() => setShowPastPayslips(false)}
          t={t}
        />
      )}
    </div>
  );
};

// Sub-components for modals
const PastHolidaysModal: React.FC<{
  records: HelperHolidayRecord[];
  onClose: () => void;
  t: TranslationDictionary;
}> = ({ records, onClose, t }) => (
  <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
    <div className="bg-card rounded-t-2xl w-full max-w-lg max-h-[70vh] overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-title font-semibold">{t['helper.past_holidays'] || 'Past Holidays'}</h3>
        <button onClick={onClose}><X size={20} /></button>
      </div>
      <div className="p-4 overflow-y-auto max-h-[60vh]">
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
                    {new Date(record.holidayDate).toLocaleDateString()}
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
);

const PastPayslipsModal: React.FC<{
  payslips: HelperPayslipConfirmation[];
  onClose: () => void;
  t: TranslationDictionary;
}> = ({ payslips, onClose, t }) => (
  <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
    <div className="bg-card rounded-t-2xl w-full max-w-lg max-h-[70vh] overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-title font-semibold">{t['helper.past_payslips'] || 'Past Payslips'}</h3>
        <button onClick={onClose}><X size={20} /></button>
      </div>
      <div className="p-4 overflow-y-auto max-h-[60vh]">
        {payslips.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {t['helper.no_past_payslips'] || 'No past payslips'}
          </p>
        ) : (
          <div className="space-y-3">
            {payslips.map(slip => (
              <div key={slip.id} className="p-3 bg-secondary rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-body font-medium">
                    {new Date(slip.year, slip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <div className="text-right">
                    <span className="text-title font-bold">${slip.salaryAmount.toLocaleString()}</span>
                    {(slip.overtimeTotal || 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        (incl. OT ${slip.overtimeTotal})
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-caption">
                  <span className={slip.employerSignedAt ? 'text-green-600' : 'text-muted-foreground'}>
                    Employer: {slip.employerSignedAt ? '✓' : '—'}
                  </span>
                  <span className={slip.helperSignedAt ? 'text-green-600' : 'text-muted-foreground'}>
                    Helper: {slip.helperSignedAt ? '✓' : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default HelperManagementContent;
