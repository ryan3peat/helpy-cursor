// components/RemovedFromHousehold.tsx
import React from 'react';
import { useUser } from '@clerk/clerk-react';
import { UserX, Home, LogOut, AlertTriangle } from 'lucide-react';
import { TranslationDictionary } from '@/types';

interface RemovedFromHouseholdProps {
  t: TranslationDictionary;
  onLogout: () => void;
  onCreateNewHousehold?: () => void;
}

const RemovedFromHousehold: React.FC<RemovedFromHouseholdProps> = ({
  t,
  onLogout,
  onCreateNewHousehold
}) => {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-orange-100 flex items-center justify-center">
            <UserX size={32} className="text-orange-600" />
          </div>
          <h1 className="text-display text-foreground mb-2">
            {t['removed.title'] || 'Removed from Household'}
          </h1>
          <p className="text-body text-muted-foreground">
            {t['removed.subtitle'] || 'You have been removed from your household'}
          </p>
        </div>

        {/* Main content */}
        <div className="bg-card rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={20} className="text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-title text-foreground mb-2">
                {t['removed.explanation_title'] || 'What happened?'}
              </h3>
              <p className="text-body text-muted-foreground">
                {t['removed.explanation'] ||
                  'The household administrator has removed you from the household. Your Helpy account is still active, but you are no longer part of any household.'}
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-body font-semibold text-foreground mb-3">
              {t['removed.options_title'] || 'What would you like to do?'}
            </h4>

            <div className="space-y-3">
              {/* Option 1: Create new household */}
              {onCreateNewHousehold && (
                <button
                  onClick={onCreateNewHousehold}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 hover:border-primary/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Home size={20} className="text-primary" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-body font-medium text-foreground">
                      {t['removed.create_new'] || 'Create a new household'}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {t['removed.create_new_desc'] || 'Start fresh with your own household'}
                    </p>
                  </div>
                </button>
              )}

              {/* Option 2: Logout */}
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-muted-foreground/10 flex items-center justify-center group-hover:bg-muted-foreground/20 transition-colors">
                  <LogOut size={20} className="text-muted-foreground" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-body font-medium text-foreground">
                    {t['removed.sign_out'] || 'Sign out'}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {t['removed.sign_out_desc'] || 'Sign out and sign back in later'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-caption text-muted-foreground">
            {t['removed.contact_admin'] ||
              'If you believe this was done in error, please contact your household administrator.'}
          </p>
        </div>

        {/* Helpy logo */}
        <div className="helpy-footer">
          <span className="helpy-logo">helpy</span>
        </div>
      </div>
    </div>
  );
};

export default RemovedFromHousehold;