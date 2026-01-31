// components/HouseholdSwitchModal.tsx
// Modal shown when user tries to join a new household but already belongs to another

import React from 'react';
import { createPortal } from 'react-dom';
import { Home, ArrowRight } from 'lucide-react';
import { TranslationDictionary } from '../types';

interface HouseholdSwitchModalProps {
  currentHouseholdName: string;
  newHouseholdName: string;
  adminName: string | null;
  onStay: () => void;
  onSwitch: () => void;
  t?: TranslationDictionary;
}

const HouseholdSwitchModal: React.FC<HouseholdSwitchModalProps> = ({
  currentHouseholdName,
  newHouseholdName,
  adminName,
  onStay,
  onSwitch,
  t = {}
}) => {
  return createPortal(
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] bottom-sheet-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onStay(); }}
    >
      <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content flex flex-col absolute bottom-0 left-0 right-0 mx-auto" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        {/* Header */}
        <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FFF3E0] rounded-full flex items-center justify-center">
              <Home className="w-6 h-6 text-[#FF9800]" />
            </div>
            <div>
              <h2 className="text-title text-foreground">
                {t['household.already_member'] || 'Already a Member'}
              </h2>
              <p className="text-caption text-muted-foreground">
                {t['household.already_member_of'] || 'You are already a member of'} <span className="font-semibold">{currentHouseholdName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="bg-secondary rounded-xl p-4 mb-4">
            <p className="text-caption text-muted-foreground mb-3">
              {t['household.invited_to_join'] || "You've been invited to join:"}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-body font-semibold text-foreground">{newHouseholdName}</p>
                {adminName && (
                  <p className="text-caption text-muted-foreground">{adminName}{t['household.possessive_household'] || "'s household"}</p>
                )}
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
          
          <p className="text-caption text-muted-foreground text-center">
            {t['household.only_one_at_time'] || 'You can only belong to one household at a time'}
          </p>
        </div>

        {/* Footer */}
        <div className="p-5 pb-8 border-t border-border shrink-0 space-y-3">
          <button
            onClick={onSwitch}
            className="w-full rounded-xl py-3.5 bg-primary text-primary-foreground text-body font-semibold flex items-center justify-center gap-2"
          >
            <ArrowRight size={18} />
            {t['household.switch_to_this'] || 'Switch to This Household'}
          </button>
          
          <button
            onClick={onStay}
            className="w-full rounded-xl py-3.5 bg-secondary text-foreground text-body font-medium flex items-center justify-center gap-2"
          >
            <Home size={18} />
            {t['household.stay_in_current'] || 'Stay in Current Household'}
          </button>
        </div>
      </div>
    </div>
  , document.body);
};

export default HouseholdSwitchModal;











