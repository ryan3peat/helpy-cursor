// components/HelperManagementContent.tsx

import React, { useState, useEffect } from 'react';
import { Calendar, FileText, Check, X } from 'lucide-react';
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
  calculateTotalSalary,
  isHelperSalaryConfigured,
  getPastHolidays,
  getPastPayslips,
} from '../services/helperManagementService';

interface Props {
  householdId: string;
  helperId: string;
  helper: User;
  currentUser: User;
  t: TranslationDictionary;
  onNavigateToProfile: () => void;
}

export const HelperManagementContent: React.FC<Props> = ({
  householdId,
  helperId,
  helper,
  currentUser,
  t,
  onNavigateToProfile,
}) => {
  // State
  const [upcomingHolidays, setUpcomingHolidays] = useState<HKStatutoryHoliday[]>([]);
  const [holidayRecords, setHolidayRecords] = useState<Map<string, HelperHolidayRecord>>(new Map());
  const [currentPayslip, setCurrentPayslip] = useState<HelperPayslipConfirmation | null>(null);
  const [showCompensationModal, setShowCompensationModal] = useState<{ holiday: HKStatutoryHoliday } | null>(null);
  const [showPastHolidays, setShowPastHolidays] = useState(false);
  const [showPastPayslips, setShowPastPayslips] = useState(false);
  const [pastHolidays, setPastHolidays] = useState<HelperHolidayRecord[]>([]);
  const [pastPayslips, setPastPayslips] = useState<HelperPayslipConfirmation[]>([]);
  
  const isHelper = currentUser.role === UserRole.HELPER;
  const salaryConfigured = isHelperSalaryConfigured(helper);
  const totalSalary = calculateTotalSalary(
    helper.helperBaseSalary || 5100,
    helper.helperFoodAllowance || 1236,
    helper.helperOtherAllowances || []
  );

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
      const payslip = await getCurrentPayslip(helperId, householdId);
      if (!payslip) {
        // Create one
        const newPayslip = await createOrGetCurrentPayslip(helperId, householdId, totalSalary);
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
          null
        );
        loadHolidays();
      } catch (error) {
        console.error('Failed to update holiday record:', error);
      }
    }
  };

  const handleCompensationSelect = async (type: CompensationType) => {
    if (!showCompensationModal) return;
    const { holiday } = showCompensationModal;
    
    try {
      await upsertHelperHolidayRecord(
        householdId,
        helperId,
        holiday.holidayDate,
        holiday.holidayName,
        true,
        type
      );
      
      setShowCompensationModal(null);
      loadHolidays();
    } catch (error) {
      console.error('Failed to save compensation:', error);
    }
  };

  const handleSign = async (type: 'employer' | 'helper') => {
    if (!currentPayslip) return;
    try {
      await signPayslip(currentPayslip.id, type, currentUser.id);
      loadPayslip();
    } catch (error) {
      console.error('Failed to sign payslip:', error);
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
            
            return (
              <div 
                key={holiday.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex-1">
                  <p className="text-body font-medium">{holiday.holidayName}</p>
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
                onClick={onNavigateToProfile}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t['helper.input_salary'] || 'Input Salary Details'}
              </button>
            )}
          </div>
        ) : (
          /* Salary configured - show payslip */
          <div>
            {/* Header row */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="text-caption text-muted-foreground">{currentMonth}</div>
              <div className="text-caption text-muted-foreground">
                {t['helper.employer'] || 'Employer'}
              </div>
              <div className="text-caption text-muted-foreground">
                {t['helper.helper'] || 'Helper'}
              </div>
            </div>
            
            {/* Content row */}
            <div className="grid grid-cols-3 gap-2 items-center text-center">
              {/* Salary amount */}
              <div className="text-title font-bold text-primary">
                ${totalSalary.toLocaleString()}
              </div>
              
              {/* Employer sign button */}
              <div>
                {currentPayslip?.employerSignedAt ? (
                  <div className="flex flex-col items-center">
                    <Check size={24} className="text-green-500" />
                    <span className="text-caption text-green-600">
                      {t['helper.signed'] || 'Signed'}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSign('employer')}
                    disabled={isHelper}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      isHelper 
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {t['helper.sign'] || 'Sign'}
                  </button>
                )}
              </div>
              
              {/* Helper sign button */}
              <div>
                {currentPayslip?.helperSignedAt ? (
                  <div className="flex flex-col items-center">
                    <Check size={24} className="text-green-500" />
                    <span className="text-caption text-green-600">
                      {t['helper.signed'] || 'Signed'}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSign('helper')}
                    disabled={!isHelper}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      !isHelper 
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {t['helper.sign'] || 'Sign'}
                  </button>
                )}
              </div>
            </div>
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
                  <p className="text-body font-medium">{record.holidayName}</p>
                  <p className="text-caption text-muted-foreground">
                    {new Date(record.holidayDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-body ${record.isWorking ? 'text-orange-500' : 'text-green-500'}`}>
                    {record.isWorking ? 'Worked' : 'Off'}
                  </p>
                  {record.compensationType && (
                    <p className="text-caption text-muted-foreground">
                      {record.compensationType === 'lieu' ? 'Time-in-lieu' : 'Overtime'}
                    </p>
                  )}
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
                  <span className="text-title font-bold">${slip.salaryAmount.toLocaleString()}</span>
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

