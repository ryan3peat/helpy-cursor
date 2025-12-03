// components/HouseholdSwitchModal.tsx
// Modal shown when user tries to join a new household but already belongs to another

import React from 'react';
import { X, Home, ArrowRight } from 'lucide-react';

interface HouseholdSwitchModalProps {
  currentHouseholdName: string;
  newHouseholdName: string;
  adminName: string | null;
  onStay: () => void;
  onSwitch: () => void;
}

const HouseholdSwitchModal: React.FC<HouseholdSwitchModalProps> = ({
  currentHouseholdName,
  newHouseholdName,
  adminName,
  onStay,
  onSwitch
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Home className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Already a Member
          </h2>
          <p className="text-gray-600 text-sm">
            You are already a member of <span className="font-semibold">{currentHouseholdName}</span>
            {adminName && ` (${adminName}'s household)`}.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-700 mb-3">
            You've been invited to join:
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{newHouseholdName}</p>
              {adminName && (
                <p className="text-xs text-gray-500">{adminName}'s household</p>
              )}
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onSwitch}
            style={{ backgroundColor: '#3EAFD2' }}
            className="w-full hover:opacity-90 rounded-xl font-semibold py-3 transition-all text-white flex items-center justify-center gap-2"
          >
            <ArrowRight size={18} />
            Switch to This Household
          </button>
          
          <button
            onClick={onStay}
            className="w-full border-2 border-gray-200 hover:border-gray-300 rounded-xl font-semibold py-3 transition-all text-gray-700 flex items-center justify-center gap-2"
          >
            <Home size={18} />
            Stay in Current Household
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          You can only belong to one household at a time
        </p>
      </div>
    </div>
  );
};

export default HouseholdSwitchModal;

