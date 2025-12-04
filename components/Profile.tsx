import React, { useState, useRef } from 'react';
import {
  AlertCircle, Heart, Settings, Plus, Trash2, X, Save, Camera,
  Image as ImageIcon, LogOut, Copy, Check, ChevronLeft, ChevronRight,
  CreditCard, Shield, Lock, Crown, Mail, Share2, Bell, Phone
} from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { User, UserRole, BaseViewProps } from '../types';
import { createInvite } from '../services/inviteService';
import { createCheckoutSession, createPortalSession } from '../services/stripeService';
import { supabase } from '../services/supabase';
import { deleteItem } from '../services/supabaseService';
import { useScrollLock } from '@/hooks/useScrollLock';

interface ProfileProps extends BaseViewProps {
  users: User[];
  onAdd: (user: Omit<User, 'id'>) => Promise<User | undefined>;
  onUpdate: (id: string, data: Partial<User>) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  currentUser: User;
  onLogout: () => void;
}

// Role priority for consistent sorting across all family members
const ROLE_PRIORITY: Record<UserRole, number> = {
  [UserRole.MASTER]: 1,
  [UserRole.SPOUSE]: 2,
  [UserRole.HELPER]: 3,
  [UserRole.CHILD]: 4,
  [UserRole.OTHER]: 5,
};

const Profile: React.FC<ProfileProps> = ({
  users, onAdd, onUpdate, onDelete, onBack, currentUser, onLogout, t
}) => {
  // Navigation State
  const [activeSection, setActiveSection] = useState<'main' | 'settings' | 'plan' | 'security' | 'payment'>('main');

  // Main Profile State
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Edit Profile Form State
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>(UserRole.CHILD);
  const [editAllergies, setEditAllergies] = useState<string[]>([]);
  const [editPreferences, setEditPreferences] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [newPreferenceInput, setNewPreferenceInput] = useState('');

  // Add User Form State
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.CHILD);

  // Settings State
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'core' | 'pro'>('free');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    plan: string;
    status: string;
    periodEnd?: string;
    period?: string;
  } | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isFinalDeleteConfirmOpen, setIsFinalDeleteConfirmOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Lock scroll when any modal is open
  useScrollLock(isAddModalOpen || isEditModalOpen || deleteConfirmOpen || showPhotoOptions);

  // Fetch subscription info
  React.useEffect(() => {
    const fetchSubscriptionInfo = async () => {
      if (!currentUser?.householdId) return;
      
      try {
        setIsLoadingSubscription(true);
        const { data, error } = await supabase
          .from('households')
          .select('subscription_plan, subscription_status, subscription_current_period_end, subscription_period')
          .eq('id', currentUser.householdId)
          .single();

        if (error) throw error;

        if (data) {
          setSubscriptionInfo({
            plan: data.subscription_plan || 'free',
            status: data.subscription_status || 'inactive',
            periodEnd: data.subscription_current_period_end,
            period: data.subscription_period || 'monthly'
          });
          setSelectedPlan((data.subscription_plan || 'free') as 'free' | 'core' | 'pro');
          setBillingPeriod((data.subscription_period || 'monthly') as 'monthly' | 'yearly');
        }
      } catch (error) {
        console.error('Error fetching subscription info:', error);
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    if (activeSection === 'plan' || activeSection === 'security') {
      fetchSubscriptionInfo();
    }
  }, [currentUser?.householdId, activeSection]);
  
  // Get Clerk user to detect authentication method
  const { user: clerkUser } = useUser();
  const isGoogleAuth = clerkUser?.externalAccounts?.some(account => 
    account.provider === 'google'
  ) || false;

  const [accountData, setAccountData] = useState({
    email: currentUser.email || '',
    firstName: currentUser.firstName || currentUser.name?.split(' ')[0] || '',
    lastName: currentUser.lastName || currentUser.name?.split(' ').slice(1).join(' ') || '',
    phoneNumber: currentUser.phoneNumber || '',
    countryCode: currentUser.countryCode || '+852',
    currentPassword: '',
    newPassword: '',
    notificationsEnabled: currentUser.notificationsEnabled ?? true
  });

  // Country codes list
  const countryCodes = [
    { code: '+852', country: 'Hong Kong' },
    { code: '+1', country: 'United States/Canada' },
    { code: '+44', country: 'United Kingdom' },
    { code: '+86', country: 'China' },
    { code: '+65', country: 'Singapore' },
    { code: '+60', country: 'Malaysia' },
    { code: '+66', country: 'Thailand' },
    { code: '+84', country: 'Vietnam' },
    { code: '+62', country: 'Indonesia' },
    { code: '+63', country: 'Philippines' },
    { code: '+81', country: 'Japan' },
    { code: '+82', country: 'South Korea' },
    { code: '+61', country: 'Australia' },
    { code: '+64', country: 'New Zealand' },
    { code: '+91', country: 'India' },
    { code: '+33', country: 'France' },
    { code: '+49', country: 'Germany' },
    { code: '+39', country: 'Italy' },
    { code: '+34', country: 'Spain' },
    { code: '+31', country: 'Netherlands' },
    { code: '+971', country: 'United Arab Emirates' },
  ];

  const [countryCodeSearch, setCountryCodeSearch] = useState('');
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
  
  const filteredCountryCodes = countryCodes.filter(item =>
    item.country.toLowerCase().includes(countryCodeSearch.toLowerCase()) ||
    item.code.includes(countryCodeSearch)
  );

  // Update accountData when currentUser changes
  React.useEffect(() => {
    setAccountData({
      email: currentUser.email || '',
      firstName: currentUser.firstName || currentUser.name?.split(' ')[0] || '',
      lastName: currentUser.lastName || currentUser.name?.split(' ').slice(1).join(' ') || '',
      phoneNumber: currentUser.phoneNumber || '',
      countryCode: currentUser.countryCode || '+1',
      currentPassword: '',
      newPassword: '',
      notificationsEnabled: currentUser.notificationsEnabled ?? true
    });
  }, [currentUser]);
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiry: '',
    cvc: '',
    name: currentUser.name || ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Filter out invalid users and sort by role priority, then alphabetically
  const validUsers = React.useMemo(() => {
    return users
      .filter(u => u && u.id)
      .sort((a, b) => {
        const roleDiff = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
        if (roleDiff !== 0) return roleDiff;
        return a.name.localeCompare(b.name);
      });
  }, [users]);

  // Find selected user, fallback to current user if not found
  const selectedUser = validUsers.find(u => u.id === selectedUserId) || validUsers.find(u => u.id === currentUser.id) || validUsers[0];

  // Update selectedUserId if the currently selected user is deleted
  React.useEffect(() => {
    const userExists = validUsers.some(u => u.id === selectedUserId);
    if (!userExists && validUsers.length > 0) {
      // If selected user was deleted, switch to current user or first available user
      setSelectedUserId(currentUser.id);
    } else if (validUsers.length === 0) {
      // If no users, ensure we're on current user
      setSelectedUserId(currentUser.id);
    }
  }, [validUsers, selectedUserId, currentUser.id]);

  const resetForm = () => {
    setNewName('');
    setNewRole(UserRole.CHILD);
  };

  // Stripe Checkout Handler
  const handleSelectPlan = async (plan: 'core' | 'pro', period: 'monthly' | 'yearly') => {
    try {
      setIsLoading(true);
      const checkoutUrl = await createCheckoutSession(
        currentUser.householdId,
        plan,
        period,
        currentUser.email || ''
      );
      
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      alert(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  // Stripe Portal Handler (for managing existing subscription)
  const handleManageSubscription = async () => {
    try {
      setIsLoading(true);
      const portalUrl = await createPortalSession(currentUser.householdId);
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Portal error:', error);
      alert(error instanceof Error ? error.message : 'Failed to open subscription management.');
      setIsLoading(false);
    }
  };

  // --- Helper Functions ---
  // Colors based on brand palette: #3EAFD2, #FF9800, #7E57C2, #4CAF50, #F06292, #AB47BC, #757575
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.MASTER: return 'bg-[#E6F7FB] text-[#3EAFD2]';
      case UserRole.SPOUSE: return 'bg-[#F3E5F5] text-[#AB47BC]';
      case UserRole.HELPER: return 'bg-[#FFF3E0] text-[#FF9800]';
      case UserRole.CHILD: return 'bg-[#E8F5E9] text-[#4CAF50]';
      case UserRole.OTHER: return 'bg-[#FCE4EC] text-[#F06292]';
      default: return 'bg-[#F5F5F5] text-[#757575]';
    }
  };

  const handleAddUser = async () => {
    if (!newName.trim() || isAddingUser) return;
    
    setIsAddingUser(true);
    const nameToAdd = newName.trim();
    const roleToAdd = newRole;
    
    // Close modal immediately for better UX
    resetForm();
    setIsAddModalOpen(false);
    
    try {
      // Children don't need invite links - they're added directly to the household
      if (roleToAdd === UserRole.CHILD) {
        const newUser: Omit<User, 'id'> = {
          householdId: currentUser.householdId,
          email: '',
          name: nameToAdd,
          role: roleToAdd,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameToAdd)}`,
          allergies: [],
          preferences: [],
          status: 'active' // Children are added as active family members, not pending
        };
        
        // Create child user directly without invite link
        await onAdd(newUser);
        // User will appear via subscription update
      } else {
        // For Spouse, Helper, and Other, create user with invite link
        const result = await createInvite({
          name: nameToAdd,
          role: roleToAdd,
          householdId: currentUser.householdId,
          inviterId: currentUser.id
        });
        
        // Show invite link modal for non-children
        setInviteLink(result.inviteLink);
      }
    } catch (error) {
      console.error('Failed to add user:', error);
      alert('Failed to add user. Please try again.');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = (id: string) => {
    setUserToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteUser = () => {
    if (!userToDelete) return;
    
    // Update selectedUserId before deletion if needed
    if (selectedUserId === userToDelete) {
      setSelectedUserId(currentUser.id);
    }
    // Call onDelete which will update the parent's users array
    onDelete(userToDelete);
    setDeleteConfirmOpen(false);
    setUserToDelete(null);
  };

  const handleReinvite = async (userId: string) => {
    try {
      const { resendInvite } = await import('../services/inviteService');
      const result = await resendInvite(userId, currentUser.householdId);
      setInviteLink(result.inviteLink);
      setIsCopied(false);
    } catch (error) {
      console.error('Failed to resend invite:', error);
      alert('Failed to generate new invite link');
    }
  };

  const handleCopyInvite = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShareInvite = async () => {
    if (!inviteLink) return;
    
    // Use Web Share API if available (mobile devices)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Helpy household',
          text: 'Join my Helpy household',
          url: inviteLink,
        });
      } catch (error) {
        // User cancelled or error occurred, fall back to copy
        if ((error as Error).name !== 'AbortError') {
          handleCopyInvite();
        }
      }
    } else {
      // Fall back to copy on desktop
      handleCopyInvite();
    }
  };

  const handleOpenEdit = () => {
    setEditName(selectedUser.name);
    setEditRole(selectedUser.role);
    setEditAllergies([...(selectedUser.allergies || [])]);
    setEditPreferences([...(selectedUser.preferences || [])]);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    onUpdate(selectedUser.id, {
      name: editName,
      role: editRole,
      allergies: editAllergies,
      preferences: editPreferences
    });
    setIsEditModalOpen(false);
  };

  const addAllergy = () => {
    if (newAllergyInput.trim() && !editAllergies.includes(newAllergyInput.trim())) {
      setEditAllergies([...editAllergies, newAllergyInput.trim()]);
      setNewAllergyInput('');
    }
  };

  const removeAllergy = (item: string) => {
    setEditAllergies(editAllergies.filter(a => a !== item));
  };

  const addPreference = () => {
    if (newPreferenceInput.trim() && !editPreferences.includes(newPreferenceInput.trim())) {
      setEditPreferences([...editPreferences, newPreferenceInput.trim()]);
      setNewPreferenceInput('');
    }
  };

  const removePreference = (item: string) => {
    setEditPreferences(editPreferences.filter(p => p !== item));
  };

  const renderSettingsHeader = (title: string, onBackOverride?: () => void) => (
    <div className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-4 flex items-center gap-3 z-10">
      <button
        onClick={onBackOverride || (() => setActiveSection('main'))}
        className="p-2 hover:bg-secondary rounded-full transition-colors"
      >
        <ChevronLeft size={24} className="text-foreground" />
      </button>
      <h2 className="text-title font-bold text-foreground">{title}</h2>
    </div>
  );

  // =====================================================
  // MAIN PROFILE VIEW
  // =====================================================
  if (activeSection === 'main') {
    return (
      <div className="min-h-screen bg-background pb-40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          {/* Header with Logout */}
          <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 pt-12 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <button onClick={onBack} className="p-2 hover:bg-secondary rounded-full transition-colors">
                <ChevronLeft size={24} className="text-foreground" />
              </button>
              <h1 className="text-display text-foreground">{t['nav.profile']}</h1>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors"
              >
                <LogOut size={18} />
                <span className="text-body font-semibold">{t['profile.logout']}</span>
              </button>
            </div>
          </header>

          <div className="pt-6 space-y-6">
            {/* Invite Link Modal */}
            {inviteLink && (
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end justify-center p-4 z-50 bottom-sheet-backdrop">
                <div className="bg-card rounded-t-3xl p-6 max-w-lg w-full shadow-2xl bottom-sheet-content relative" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-title font-bold text-foreground">Invitation Link</h3>
                    <button onClick={() => setInviteLink(null)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                      <X size={20} className="text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-body text-muted-foreground mb-4">Share this link with the new member:</p>
                  <div className="bg-muted p-3 rounded-xl mb-4 break-all text-body font-mono text-foreground">
                    {inviteLink}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCopyInvite}
                      className="flex-1 bg-secondary text-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
                    >
                      {isCopied ? <Check size={18} /> : <Copy size={18} />}
                      {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleShareInvite}
                      className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                    >
                      <Share2 size={18} />
                      Share
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* User Carousel */}
            <div className="bg-primary rounded-3xl p-6 shadow-md">
              <h2 className="text-primary-foreground text-title font-bold mb-4">{t['profile.familyMembers']}</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide pl-4 pt-4">
                {validUsers.map((user) => {
                  const isCurrent = user.id === currentUser.id;
                  const isSelected = user.id === selectedUserId;
                  return (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className={`flex flex-col items-center gap-2 cursor-pointer transition-opacity mt-2 ${isSelected ? 'opacity-100' : 'opacity-60'
                        }`}
                    >
                      <div className={`w-16 h-16 rounded-full overflow-hidden border-4 ${isSelected ? 'border-primary-foreground shadow-md' : 'border-primary-foreground/50'
                        }`}>
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      </div>
                      <span className={`text-caption font-medium ${isSelected ? 'text-primary-foreground' : 'text-primary-foreground/70'}`}>
                        {user.name.split(' ')[0]} {isCurrent ? '(You)' : ''}
                      </span>
                      {user.status === 'pending' && (
                        <span className="text-micro text-primary-foreground/80">Pending</span>
                      )}
                    </div>
                  );
                })}
                <div
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex flex-col items-center gap-2 cursor-pointer opacity-60 hover:opacity-100 transition-opacity mt-2"
                >
                  <div id="onboarding-add-member-btn" className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center border-2 border-primary-foreground/50">
                    <Plus size={24} className="text-primary-foreground" />
                  </div>
                  <span className="text-caption font-medium text-primary-foreground/70">{t['common.add']}</span>
                </div>
              </div>
            </div>

            {/* Selected User Profile Card */}
            {selectedUser && (
              <div className="bg-card rounded-3xl shadow-sm p-6 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 flex gap-2">
                  {selectedUser.id !== currentUser.id && (
                    <button
                      onClick={() => handleDeleteUser(selectedUser.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 size={18} />
                      <span className="text-body font-semibold">{t['profile.delete'] || 'Delete'}</span>
                    </button>
                  )}
                  <button
                    onClick={handleOpenEdit}
                    className="p-2 text-muted-foreground hover:text-primary bg-secondary rounded-full transition-colors"
                  >
                    <Settings size={18} />
                  </button>
                  {selectedUser.status === 'pending' && (
                    <button
                      onClick={() => handleReinvite(selectedUser.id)}
                      className="p-2 text-primary hover:text-primary/80 bg-primary/10 rounded-full transition-colors"
                    >
                      <Share2 size={18} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="relative group">
                    <div
                      className="w-20 h-20 rounded-full overflow-hidden shadow-sm bg-secondary cursor-pointer"
                      onClick={() => setShowPhotoOptions(true)}
                    >
                      <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
                    </div>
                    <button
                      onClick={() => setShowPhotoOptions(true)}
                      className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Camera size={14} />
                    </button>
                  </div>
                  <div>
                    <h3 className="text-title font-bold text-foreground">{selectedUser.name}</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-caption font-semibold mt-1 ${getRoleBadgeColor(selectedUser.role)}`}>
                      {selectedUser.role}
                    </span>
                  </div>
                </div>

                {/* Allergies */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-destructive" />
                    <h4 className="text-body font-bold text-foreground">{t['profile.allergies']}</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.allergies && selectedUser.allergies.length > 0 ? (
                      selectedUser.allergies.map((allergy) => (
                        <span key={allergy} className="px-3 py-1 bg-destructive/10 text-destructive rounded-full text-caption font-medium">
                          {allergy}
                        </span>
                      ))
                    ) : (
                      <span className="text-caption text-muted-foreground">{t['profile.none']}</span>
                    )}
                  </div>
                </div>

                {/* Preferences */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Heart size={16} className="text-destructive" />
                    <h4 className="text-body font-bold text-foreground">{t['profile.preferences']}</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.preferences && selectedUser.preferences.length > 0 ? (
                      selectedUser.preferences.map((pref) => (
                        <span key={pref} className="px-3 py-1 bg-destructive/10 text-destructive rounded-full text-caption font-medium">
                          {pref}
                        </span>
                      ))
                    ) : (
                      <span className="text-caption text-muted-foreground">{t['profile.none']}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Settings Button */}
            <button
              onClick={() => setActiveSection('settings')}
              className="w-full bg-card p-4 rounded-2xl shadow-sm border border-border flex items-center justify-between hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <Settings size={20} className="text-primary-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-foreground text-title">Settings</p>
                  <p className="text-caption text-muted-foreground">Manage your account</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </button>
          </div>

          {/* Footer */}
          <div className="helpy-footer">
            <span className="helpy-logo">helpy</span>
          </div>
        </div>

        {/* Add User Modal */}
          {isAddModalOpen && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center sm:items-end justify-center p-4 z-50 bottom-sheet-backdrop">
              <div className="bg-card rounded-t-3xl w-full max-w-lg p-6 bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <h3 className="text-title font-bold text-foreground">{t['profile.addMember']}</h3>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                    <X size={24} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="space-y-4 flex-1 overflow-y-auto">
                  <div>
                    <label className="block text-body font-semibold text-foreground mb-2">{t['common.name']}</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary transition-colors text-body"
                      placeholder="Enter name"
                    />
                  </div>
                  <div>
                    <label className="block text-body font-semibold text-foreground mb-2">{t['profile.role']}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewRole(UserRole.SPOUSE)}
                        className={`px-4 py-3 rounded-xl font-semibold transition-colors ${
                          newRole === UserRole.SPOUSE
                            ? 'bg-[#F3E5F5] text-[#AB47BC] border-2 border-[#AB47BC]'
                            : 'bg-secondary text-muted-foreground border-2 border-transparent hover:bg-secondary/80'
                        }`}
                      >
                        Spouse
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRole(UserRole.HELPER)}
                        className={`px-4 py-3 rounded-xl font-semibold transition-colors ${
                          newRole === UserRole.HELPER
                            ? 'bg-[#FFF3E0] text-[#FF9800] border-2 border-[#FF9800]'
                            : 'bg-secondary text-muted-foreground border-2 border-transparent hover:bg-secondary/80'
                        }`}
                      >
                        Helper
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRole(UserRole.CHILD)}
                        className={`px-4 py-3 rounded-xl font-semibold transition-colors ${
                          newRole === UserRole.CHILD
                            ? 'bg-[#E8F5E9] text-[#4CAF50] border-2 border-[#4CAF50]'
                            : 'bg-secondary text-muted-foreground border-2 border-transparent hover:bg-secondary/80'
                        }`}
                      >
                        Child
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRole(UserRole.OTHER)}
                        className={`px-4 py-3 rounded-xl font-semibold transition-colors ${
                          newRole === UserRole.OTHER
                            ? 'bg-[#FCE4EC] text-[#F06292] border-2 border-[#F06292]'
                            : 'bg-secondary text-muted-foreground border-2 border-transparent hover:bg-secondary/80'
                        }`}
                      >
                        Other
                      </button>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-border shrink-0">
                  <button
                    onClick={handleAddUser}
                    disabled={isAddingUser || !newName.trim()}
                    className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAddingUser ? 'Adding...' : t['common.add']}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirmOpen && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end justify-center p-4 z-50 bottom-sheet-backdrop">
              <div className="bg-card rounded-t-3xl w-full max-w-md p-6 bottom-sheet-content relative" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                <div className="mb-6">
                  <h3 className="text-title font-bold text-foreground mb-2">Delete Family Member</h3>
                  <p className="text-body text-muted-foreground">
                    {t['profile.confirmDelete'] || 'Are you sure you want to delete this family member? This action cannot be undone.'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setUserToDelete(null);
                    }}
                    className="flex-1 bg-secondary text-foreground py-3 rounded-xl font-semibold hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteUser}
                    className="flex-1 bg-destructive/10 text-destructive py-3 rounded-xl font-semibold hover:bg-destructive/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit User Modal */}
          {isEditModalOpen && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center sm:items-end justify-center p-4 z-50 bottom-sheet-backdrop">
              <div className="bg-card rounded-t-3xl w-full max-w-lg bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                <div className="flex items-center justify-between mb-6 p-6 pb-4 border-b border-border shrink-0">
                  <h3 className="text-title font-bold text-foreground">Edit Profile</h3>
                  <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                    <X size={24} className="text-muted-foreground" />
                  </button>
                </div>

                <div className="space-y-6 p-6 flex-1 overflow-y-auto">
                  {/* Name */}
                  <div>
                    <label className="block text-body font-semibold text-foreground mb-2">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary transition-colors text-body"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-body font-semibold text-foreground mb-2">Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary transition-colors text-body"
                    >
                      <option value={UserRole.MASTER}>Master</option>
                      <option value={UserRole.SPOUSE}>Spouse</option>
                      <option value={UserRole.HELPER}>Helper</option>
                      <option value={UserRole.CHILD}>Child</option>
                      <option value={UserRole.OTHER}>Other</option>
                    </select>
                  </div>

                  {/* Allergies */}
                  <div>
                    <label className="block text-body font-semibold text-foreground mb-2">Allergies</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newAllergyInput}
                        onChange={(e) => setNewAllergyInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
                        className="flex-1 px-4 py-2 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary transition-colors text-body"
                        placeholder="Add allergy"
                      />
                      <button onClick={addAllergy} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold transition-colors">
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editAllergies.map((allergy) => (
                        <span key={allergy} className="px-3 py-1 bg-destructive/10 text-destructive rounded-full text-caption font-medium flex items-center gap-1">
                          {allergy}
                          <button onClick={() => removeAllergy(allergy)} className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Preferences */}
                  <div>
                    <label className="block text-body font-semibold text-foreground mb-2">Preferences</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newPreferenceInput}
                        onChange={(e) => setNewPreferenceInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addPreference()}
                        className="flex-1 px-4 py-2 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary transition-colors text-body"
                        placeholder="Add preference"
                      />
                      <button onClick={addPreference} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold transition-colors">
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editPreferences.map((pref) => (
                        <span key={pref} className="px-3 py-1 bg-destructive/10 text-destructive rounded-full text-caption font-medium flex items-center gap-1">
                          {pref}
                          <button onClick={() => removePreference(pref)} className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 bg-secondary text-foreground py-3 rounded-xl font-semibold hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Photo Options Modal */}
        {showPhotoOptions && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
            {/* Safe area bottom cover */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-card"
              style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
            />
            <div 
              className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col"
              style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}
            >
              {/* Header */}
              <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
                <h2 className="text-title text-foreground text-center">Change Photo</h2>
              </div>
              
              {/* Options */}
              <div className="p-5 space-y-2">
                <button
                  onClick={() => {
                    cameraInputRef.current?.click();
                    setShowPhotoOptions(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-secondary rounded-xl hover:bg-secondary/80 transition-colors"
                >
                  <Camera size={20} className="text-muted-foreground" />
                  <span className="font-semibold text-foreground">Take Photo</span>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowPhotoOptions(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-secondary rounded-xl hover:bg-secondary/80 transition-colors"
                >
                  <ImageIcon size={20} className="text-muted-foreground" />
                  <span className="font-semibold text-foreground">Choose from Library</span>
                </button>
              </div>
              
              {/* Cancel Footer */}
              <div className="p-5 pb-8 border-t border-border">
                <button
                  onClick={() => setShowPhotoOptions(false)}
                  className="w-full py-3.5 bg-muted rounded-xl font-semibold text-foreground hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" />
      </div>
    );
  }

  // =====================================================
  // PLAN SELECTION VIEW
  // =====================================================
  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      // Redirect to Stripe portal for cancellation
      await handleManageSubscription();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
      setIsLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.toLocaleDateString('en-GB', { month: 'short' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return 'N/A';
    }
  };

  // Handle Delete Account
  const handleDeleteAccountClick = () => {
    setIsDeleteAccountModalOpen(true);
  };

  const handleFirstDeleteConfirm = () => {
    setIsDeleteAccountModalOpen(false);
    setIsFinalDeleteConfirmOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (!currentUser?.householdId || !clerkUser) {
      alert('Unable to delete account. Please try again.');
      return;
    }

    setIsDeletingAccount(true);

    try {
      // Get all users in the household except the master user
      const familyMembers = users.filter(user => user.id !== currentUser.id);

      // Delete each family member
      for (const member of familyMembers) {
        try {
          await deleteItem(currentUser.householdId, 'users', member.id);
        } catch (error) {
          console.error(`Error deleting family member ${member.id}:`, error);
          // Continue with deletion even if one fails
        }
      }

      // Delete the master user from Supabase
      try {
        await deleteItem(currentUser.householdId, 'users', currentUser.id);
      } catch (error) {
        console.error('Error deleting master user:', error);
        throw error;
      }

      // Delete the household record
      const { error: householdError } = await supabase
        .from('households')
        .delete()
        .eq('id', currentUser.householdId);

      if (householdError) {
        console.error('Error deleting household:', householdError);
        throw householdError;
      }

      // Delete the Clerk account
      try {
        await clerkUser.delete();
      } catch (error) {
        console.error('Error deleting Clerk account:', error);
        // Even if Clerk deletion fails, we've deleted everything else
        // So we should still sign out
      }

      // Sign out the user
      setIsFinalDeleteConfirmOpen(false);
      onLogout();
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again or contact support.');
      setIsDeletingAccount(false);
      setIsFinalDeleteConfirmOpen(false);
    }
  };

  const getNextPaymentDate = (periodEnd?: string, period?: string) => {
    if (!periodEnd) return null;
    try {
      const endDate = new Date(periodEnd);
      const day = endDate.getDate();
      const month = endDate.toLocaleDateString('en-GB', { month: 'short' });
      const year = endDate.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return null;
    }
  };

  if (activeSection === 'plan') {
    const plans = [
      {
        id: 'core',
        name: 'Core',
        monthlyPrice: 88,
        yearlyPrice: 850,
        features: ['Up to 6 family members', '2 helpers', 'Receipt scanning', 'Priority support'],
        highlight: false
      },
      {
        id: 'pro',
        name: 'Pro',
        monthlyPrice: 118,
        yearlyPrice: 1080,
        features: ['Up to 10 family members', 'Unlimited helpers', 'Advanced AI', 'Data export', 'Premium support'],
        highlight: true
      }
    ];

    const currentPlanName = subscriptionInfo?.plan === 'core' ? 'Core' : subscriptionInfo?.plan === 'pro' ? 'Pro' : 'Free';
    const planPrice = subscriptionInfo?.plan === 'core' 
      ? (subscriptionInfo?.period === 'yearly' ? 850 : 88)
      : subscriptionInfo?.plan === 'pro'
      ? (subscriptionInfo?.period === 'yearly' ? 1080 : 118)
      : 0;

    return (
      <div className="min-h-screen bg-background pb-40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          <div className="pt-16 pb-24">
            {renderSettingsHeader('Subscription')}

            {/* Current Subscription Details */}
            {isLoadingSubscription ? (
              <div className="mt-6 bg-card rounded-3xl p-6 shadow-sm border border-border mb-6">
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            ) : subscriptionInfo ? (
              <div className="mt-6 bg-primary rounded-3xl p-6 shadow-md text-primary-foreground mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-title font-semibold text-primary-foreground/90 mb-1">Current Plan</h3>
                    <p className="text-display font-bold">{currentPlanName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-body text-primary-foreground/80 mb-1">Price</p>
                    {planPrice > 0 ? (
                      <p className="text-title font-bold">
                        ${planPrice}
                        <span className="text-body font-normal">/{subscriptionInfo?.period === 'yearly' ? 'yr' : 'mo'}</span>
                      </p>
                    ) : (
                      <p className="text-title font-bold">Free</p>
                    )}
                  </div>
                </div>
                
                {subscriptionInfo.status === 'active' && subscriptionInfo.periodEnd && (
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-primary-foreground/20">
                    <div>
                      <p className="text-caption text-primary-foreground/70 mb-1">Subscription Until</p>
                      <p className="text-body font-semibold">{formatDate(subscriptionInfo.periodEnd)}</p>
                    </div>
                    <div>
                      <p className="text-caption text-primary-foreground/70 mb-1">Next Payment</p>
                      <p className="text-body font-semibold">{getNextPaymentDate(subscriptionInfo.periodEnd, subscriptionInfo.period) || 'N/A'}</p>
                    </div>
                  </div>
                )}

                {subscriptionInfo.status === 'active' && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isLoading}
                    className="w-full mt-4 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Processing...' : 'Cancel Subscription'}
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-6 bg-card rounded-3xl p-6 shadow-sm border border-border mb-6">
                <div className="text-center py-4">
                  <h3 className="text-title font-bold text-foreground mb-2">No Active Subscription</h3>
                  <p className="text-body text-muted-foreground">Choose a plan below to get started</p>
                </div>
              </div>
            )}

            {/* Upgrade/Change Plan Section */}
            <div className="mb-6">
              <h3 className="text-title font-bold text-foreground mb-4">
                {subscriptionInfo && subscriptionInfo.status === 'active' ? 'Change Plan' : 'Choose Your Plan'}
              </h3>

              {/* Billing Period Toggle */}
              <div className="mb-6 flex justify-center">
                <div className="relative rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                  <div className="flex p-1">
                    <button
                      onClick={() => setBillingPeriod('monthly')}
                      className={`px-6 py-2 rounded-full font-semibold text-body transition-colors ${
                        billingPeriod === 'monthly'
                          ? 'bg-card text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingPeriod('yearly')}
                      className={`px-6 py-2 rounded-full font-semibold text-body transition-colors ${
                        billingPeriod === 'yearly'
                          ? 'bg-card text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Yearly
                      <span className="ml-1 text-caption" style={{ color: 'hsl(var(--primary))' }}>Save 20%</span>
                    </button>
                  </div>
                  <div 
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
                  />
                </div>
              </div>

              {/* Plan Cards */}
              <div className="space-y-4">
                {plans.map((p) => {
                  const price = billingPeriod === 'monthly' ? p.monthlyPrice : p.yearlyPrice;
                  const isCurrentPlan = selectedPlan === p.id;

                  return (
                    <div
                      key={p.id}
                      className={`bg-card rounded-2xl p-6 border-2 transition-colors ${
                        p.highlight
                          ? 'border-primary shadow-md'
                          : isCurrentPlan
                          ? 'border-primary'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-title font-bold text-foreground">{p.name}</h3>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-display font-bold text-foreground">
                              ${price}
                            </span>
                            <span className="text-muted-foreground text-body">
                              /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                            </span>
                          </div>
                        </div>
                        {p.highlight && (
                          <span className="bg-primary text-primary-foreground text-caption font-bold px-3 py-1 rounded-full">
                            Popular
                          </span>
                        )}
                      </div>

                      <ul className="space-y-2 mb-6">
                        {p.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-body text-muted-foreground">
                            <Check size={16} className="text-primary flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handleSelectPlan(p.id as 'core' | 'pro', billingPeriod)}
                        disabled={isLoading || isCurrentPlan}
                        className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                          isCurrentPlan
                            ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                      >
                        {isLoading ? 'Processing...' : isCurrentPlan ? 'Current Plan' : 'Select Plan'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="helpy-footer">
            <span className="helpy-logo">helpy</span>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // SECURITY VIEW
  // =====================================================
  if (activeSection === 'security') {
    return (
      <div className="min-h-screen bg-background pb-40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          <div className="pt-16 pb-24">
            {renderSettingsHeader('Account')}
            
            <div className="space-y-6">
              {/* Profile Information Section */}
              <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
                <h3 className="text-title font-bold text-foreground mb-4">Profile Information</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-caption font-bold text-muted-foreground ml-1">First Name</label>
                      <input
                        type="text"
                        value={accountData.firstName}
                        onChange={e => setAccountData({ ...accountData, firstName: e.target.value })}
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none transition-colors text-body"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-caption font-bold text-muted-foreground ml-1">Last Name</label>
                      <input
                        type="text"
                        value={accountData.lastName}
                        onChange={e => setAccountData({ ...accountData, lastName: e.target.value })}
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none transition-colors text-body"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-caption font-bold text-muted-foreground ml-1">Mobile Number</label>
                    <div className="flex gap-2">
                      <div className="relative w-32 country-code-dropdown">
                        <input
                          type="text"
                          value={accountData.countryCode}
                          onClick={() => setShowCountryCodeDropdown(true)}
                          onFocus={() => setShowCountryCodeDropdown(true)}
                          onChange={e => {
                            setAccountData({ ...accountData, countryCode: e.target.value });
                            setCountryCodeSearch(e.target.value);
                            setShowCountryCodeDropdown(true);
                          }}
                          placeholder="+852"
                          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none cursor-pointer transition-colors text-body"
                        />
                        <Phone size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        {showCountryCodeDropdown && (
                          <div className="absolute z-50 mt-1 w-64 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto country-code-dropdown">
                            <div className="p-2 sticky top-0 bg-card border-b border-border">
                              <input
                                type="text"
                                value={countryCodeSearch}
                                onChange={e => setCountryCodeSearch(e.target.value)}
                                placeholder="Search country..."
                                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-body focus:outline-none focus:border-primary transition-colors"
                                autoFocus
                              />
                            </div>
                            <div className="py-1">
                              {filteredCountryCodes.length > 0 ? (
                                filteredCountryCodes.map((item) => (
                                  <button
                                    key={`${item.code}-${item.country}`}
                                    type="button"
                                    onClick={() => {
                                      setAccountData({ ...accountData, countryCode: item.code });
                                      setShowCountryCodeDropdown(false);
                                      setCountryCodeSearch('');
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-secondary transition-colors flex items-center justify-between"
                                  >
                                    <span className="text-body text-foreground">{item.country}</span>
                                    <span className="text-body font-medium text-muted-foreground">{item.code}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-2 text-body text-muted-foreground">No countries found</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="tel"
                          value={accountData.phoneNumber}
                          onChange={e => setAccountData({ ...accountData, phoneNumber: e.target.value })}
                          placeholder="Mobile number"
                          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none pl-10 transition-colors text-body"
                        />
                        <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email & Password Section */}
              <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
                <h3 className="text-title font-bold text-foreground mb-4">Email & Password</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-caption font-bold text-muted-foreground ml-1">Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={accountData.email}
                        onChange={e => setAccountData({ ...accountData, email: e.target.value })}
                        disabled={isGoogleAuth}
                        className={`w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none pl-10 transition-colors text-body ${isGoogleAuth ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                      <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    {isGoogleAuth && (
                      <p className="text-caption text-muted-foreground mt-1 ml-1">Email managed by Google account</p>
                    )}
                  </div>
                  
                  {!isGoogleAuth && (
                    <>
                      <div className="space-y-1">
                        <label className="text-caption font-bold text-muted-foreground ml-1">Current Password</label>
                        <div className="relative">
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={accountData.currentPassword}
                            onChange={e => setAccountData({ ...accountData, currentPassword: e.target.value })}
                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none pl-10 transition-colors text-body"
                          />
                          <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-caption font-bold text-muted-foreground ml-1">New Password</label>
                        <div className="relative">
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={accountData.newPassword}
                            onChange={e => setAccountData({ ...accountData, newPassword: e.target.value })}
                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none pl-10 transition-colors text-body"
                          />
                          <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                    </>
                  )}
                  {isGoogleAuth && (
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                      <p className="text-body text-primary">
                        Your account is managed through Google. Password changes must be made through your Google account settings.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notifications Section */}
              <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
                <h3 className="text-title font-bold text-foreground mb-4">Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                        <Bell size={20} className="text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-body">Enable Notifications</p>
                        <p className="text-caption text-muted-foreground">Receive updates and reminders</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAccountData({ ...accountData, notificationsEnabled: !accountData.notificationsEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        accountData.notificationsEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          accountData.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 space-y-4">
              <button 
                onClick={() => {
                  // Save account data
                  const updates: Partial<User> = {
                    firstName: accountData.firstName,
                    lastName: accountData.lastName,
                    phoneNumber: accountData.phoneNumber,
                    countryCode: accountData.countryCode,
                    email: accountData.email,
                    notificationsEnabled: accountData.notificationsEnabled
                  };
                  
                  // Update name if firstName or lastName changed
                  if (accountData.firstName || accountData.lastName) {
                    updates.name = `${accountData.firstName} ${accountData.lastName}`.trim();
                  }
                  
                  onUpdate(currentUser.id, updates);
                  setActiveSection('settings');
                }} 
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors"
              >
                Save Changes
              </button>

              {/* Delete Account Button - Only for Master Users */}
              {currentUser.role === UserRole.MASTER && (
                <button
                  onClick={handleDeleteAccountClick}
                  className="w-full bg-destructive/10 text-destructive py-4 rounded-xl font-semibold shadow-sm hover:bg-destructive/20 transition-colors border border-destructive/20"
                >
                  Delete Account
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="helpy-footer">
            <span className="helpy-logo">helpy</span>
          </div>
        </div>

        {/* First Delete Confirmation Modal */}
        {isDeleteAccountModalOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end justify-center p-4 z-50 bottom-sheet-backdrop">
            <div className="bg-card rounded-t-3xl w-full max-w-md p-6 bottom-sheet-content relative" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
              <div className="mb-6">
                <h3 className="text-title font-bold text-foreground mb-2">Delete Account</h3>
                <p className="text-body text-muted-foreground">
                  Are you sure you want to delete your account? This change will be permanent.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteAccountModalOpen(false)}
                  className="flex-1 bg-secondary text-foreground py-3 rounded-xl font-semibold hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFirstDeleteConfirm}
                  className="flex-1 bg-destructive/10 text-destructive py-3 rounded-xl font-semibold hover:bg-destructive/20 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Final Delete Confirmation Modal */}
        {isFinalDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end justify-center p-4 z-50 bottom-sheet-backdrop">
            <div className="bg-card rounded-t-3xl w-full max-w-md p-6 bottom-sheet-content relative" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
              <div className="mb-6">
                <h3 className="text-title font-bold text-foreground mb-2">Delete Account</h3>
                {subscriptionInfo?.status === 'active' && subscriptionInfo?.periodEnd && (
                  <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                    <p className="text-body text-primary font-semibold mb-1">Subscription Information</p>
                    <p className="text-body text-primary">
                      Your subscription is active until {formatDate(subscriptionInfo.periodEnd)}
                    </p>
                  </div>
                )}
                <p className="text-body text-muted-foreground">
                  Are you sure you want to delete? After deletion it will be immediate.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsFinalDeleteConfirmOpen(false);
                    setIsDeletingAccount(false);
                  }}
                  disabled={isDeletingAccount}
                  className="flex-1 bg-secondary text-foreground py-3 rounded-xl font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="flex-1 bg-destructive text-destructive-foreground py-3 rounded-xl font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =====================================================
  // PAYMENT VIEW
  // =====================================================
  if (activeSection === 'payment') {
    return (
      <div className="min-h-screen bg-background pb-40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          <div className="pt-16 pb-24">
            {renderSettingsHeader('Payment Method')}

            {/* Card Preview */}
            <div className="bg-muted rounded-2xl p-6 shadow-md mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-foreground opacity-5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="flex justify-between items-start mb-8">
                <CreditCard size={24} className="text-muted-foreground opacity-80" />
                <span className="text-caption font-mono bg-secondary px-2 py-1 rounded text-muted-foreground">DEBIT</span>
              </div>
              <div className="text-title font-mono tracking-widest mb-4 text-foreground">
                {paymentData.cardNumber || '•••• •••• •••• ••••'}
              </div>
              <div className="flex justify-between text-body">
                <span className="text-muted-foreground">{paymentData.name || 'CARDHOLDER'}</span>
                <span className="text-muted-foreground">{paymentData.expiry || 'MM/YY'}</span>
              </div>
            </div>

            <div className="space-y-4 bg-card p-6 rounded-2xl shadow-sm border border-border">
              <div className="space-y-1">
                <label className="text-caption font-bold text-muted-foreground ml-1">Card Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  value={paymentData.cardNumber}
                  onChange={e => {
                    // Only allow digits and format with spaces every 4 digits
                    const digitsOnly = e.target.value.replace(/\D/g, '');
                    const formatted = digitsOnly.replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19);
                    setPaymentData({ ...paymentData, cardNumber: formatted });
                  }}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-mono text-body focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-caption font-bold text-muted-foreground ml-1">Expiry</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/YY"
                    maxLength={5}
                    value={paymentData.expiry}
                    onChange={e => {
                      // Only allow digits and auto-format as MM/YY
                      const digitsOnly = e.target.value.replace(/\D/g, '');
                      let formatted = digitsOnly;
                      if (digitsOnly.length >= 2) {
                        formatted = digitsOnly.slice(0, 2) + '/' + digitsOnly.slice(2, 4);
                      }
                      setPaymentData({ ...paymentData, expiry: formatted });
                    }}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-mono text-body focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-caption font-bold text-muted-foreground ml-1">CVC</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="123"
                    maxLength={4}
                    value={paymentData.cvc}
                    onChange={e => {
                      // Only allow digits for CVC
                      const value = e.target.value.replace(/\D/g, '');
                      setPaymentData({ ...paymentData, cvc: value });
                    }}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-mono text-body focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-caption font-bold text-muted-foreground ml-1">Cardholder Name</label>
                <input
                  type="text"
                  placeholder="Name on card"
                  value={paymentData.name}
                  onChange={e => setPaymentData({ ...paymentData, name: e.target.value })}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium text-body focus:border-primary outline-none transition-colors"
                />
              </div>
            </div>

            <div className="mt-6 pt-4">
              <button onClick={() => setActiveSection('settings')} className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors">
                Save Payment Method
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="helpy-footer">
            <span className="helpy-logo">helpy</span>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // SETTINGS MENU VIEW
  // =====================================================
  if (activeSection === 'settings') {
    return (
      <div className="min-h-screen bg-background pb-40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          <div className="pt-16 pb-24">
            {renderSettingsHeader('Settings', () => setActiveSection('main'))}

            <div className="space-y-3">
              {[
                { id: 'plan', label: 'Subscription', icon: Crown },
                { id: 'security', label: 'Account', icon: Shield },
                { id: 'payment', label: 'Manage Payment', icon: CreditCard },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as any)}
                  className="w-full bg-card p-4 rounded-2xl shadow-sm border border-border flex items-center justify-between hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                      <item.icon size={20} className="text-primary-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground text-title">{item.label}</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="helpy-footer">
            <span className="helpy-logo">helpy</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Profile;