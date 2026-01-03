// components/RemovedFromHousehold.tsx
import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { UserX, Home, Trash2, AlertTriangle } from 'lucide-react';
import { TranslationDictionary } from '@/types';

interface RemovedFromHouseholdProps {
  t: TranslationDictionary;
  onDeleteAccount: () => Promise<void>;
  onCreateNewHousehold: () => Promise<void>;
  isLoading?: boolean;
}

const RemovedFromHousehold: React.FC<RemovedFromHouseholdProps> = ({
  t,
  onDeleteAccount,
  onCreateNewHousehold,
  isLoading = false
}) => {
  const { user } = useUser();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNewHousehold = async () => {
    setIsCreating(true);
    try {
      await onCreateNewHousehold();
    } catch (error) {
      console.error('Failed to create new household:', error);
      setIsCreating(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
    } catch (error) {
      console.error('Failed to delete account:', error);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

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
              <button
                onClick={handleCreateNewHousehold}
                disabled={isLoading || isCreating || isDeleting}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {isCreating ? (
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Home size={20} className="text-primary" />
                  )}
                </div>
                <div className="text-left flex-1">
                  <p className="text-body font-medium text-foreground">
                    {isCreating 
                      ? (t['removed.creating'] || 'Creating household...')
                      : (t['removed.create_new'] || 'Create a new household')
                    }
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {t['removed.create_new_desc'] || 'Start fresh with your own household'}
                  </p>
                </div>
              </button>

              {/* Option 2: Delete account permanently */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading || isCreating || isDeleting}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Trash2 size={20} className="text-destructive" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-body font-medium text-foreground">
                    {t['removed.delete_account'] || 'Delete my account permanently'}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {t['removed.delete_account_desc'] || 'Remove all your data from Helpy'}
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

      {/* Delete Confirmation Modal - Bottom Sheet */}
      {showDeleteConfirm && (
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
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-destructive" />
                </div>
                <h2 className="text-title text-destructive">
                  {t['removed.delete_confirm_title'] || 'Delete Account?'}
                </h2>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-body text-muted-foreground">
                {t['removed.delete_confirm_message'] || 
                  'This action cannot be undone. Your account and all associated data will be permanently deleted.'}
              </p>
            </div>

            {/* Footer */}
            <div className="p-5 pb-8 border-t border-border shrink-0 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body disabled:opacity-50"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-3.5 rounded-xl bg-destructive/10 text-destructive text-body disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                    {t['common.deleting'] || 'Deleting...'}
                  </>
                ) : (
                  t['removed.delete_permanently'] || 'Delete Permanently'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemovedFromHousehold;

