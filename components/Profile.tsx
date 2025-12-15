import React, { useState, useRef, useEffect } from 'react';
import {
  AlertCircle, Heart, Settings, Plus, Trash2, X, Save, Camera,
  Image as ImageIcon, LogOut, Copy, Check, ChevronLeft, ChevronRight,
  CreditCard, Shield, Lock, Crown, Mail, Share2, Bell, BellOff, BellDot, Phone, CheckCircle, Loader2, Clock, Lightbulb
} from 'lucide-react';
import Avatar from './ui/Avatar';
import { useUser } from '@clerk/clerk-react';
import { User, UserRole, BaseViewProps, HouseholdPlan } from '../types';
import { createInvite } from '../services/inviteService';
import { createCheckoutSession, createPortalSession, downgradeToFree } from '../services/stripeService';
import { useSupabase } from '../contexts/SupabaseContext';
import { deleteItem, uploadAvatarImage } from '../services/supabaseService';
import { useScrollLock } from '@/hooks/useScrollLock';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  hasActiveSubscription
} from '../services/pushNotificationService';

interface ProfileProps extends BaseViewProps {
  users: User[];
  onAdd: (user: Omit<User, 'id'>) => Promise<User | undefined>;
  onUpdate: (id: string, data: Partial<User>) => void;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void;
  currentUser: User;
  onLogout: () => void;
  householdPlan?: HouseholdPlan | null;
  /** Trigger to open add member sheet from onboarding */
  openAddMemberFromOnboarding?: boolean;
  /** Callback when add member sheet is opened */
  onAddMemberSheetOpened?: () => void;
  /** Callback to restart onboarding tutorial */
  onRestartOnboarding?: () => void;
}

// Role priority for consistent sorting across all family members
// Uses plain strings for reliability across all data sources
const ROLE_PRIORITY: Record<string, number> = {
  'Admin': 1,
  'Spouse': 2,
  'Helper': 3,
  'Child': 4,
  'Other': 5,
};

type PlanKey = HouseholdPlan['plan'];

const DEFAULT_PLAN_LIMITS: Record<PlanKey, { maxFamily: number; maxHelpers: number }> = {
  free: { maxFamily: 3, maxHelpers: 1 },
  core: { maxFamily: 4, maxHelpers: 1 },
  pro: { maxFamily: 8, maxHelpers: 4 },
  test: { maxFamily: 4, maxHelpers: 1 },
};

type PlanLimitReason = 'family' | 'helper';

interface PlanLimitState {
  plan: PlanKey;
  reason: PlanLimitReason;
  allowed: number;
  current: number;
}

const isHelperRole = (role: string | UserRole | undefined | null) =>
  (role || '').toString().toLowerCase() === 'helper';

// localStorage key for caching household name
const HOUSEHOLD_NAME_CACHE_KEY = 'helpy_household_name';

const Profile: React.FC<ProfileProps> = ({
  users, onAdd, onUpdate, onDelete, onBack, currentUser, onLogout, t, currentLang, householdPlan,
  openAddMemberFromOnboarding, onAddMemberSheetOpened, onRestartOnboarding
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Authenticated Supabase client with JWT for RLS
  // ─────────────────────────────────────────────────────────────────
  const supabase = useSupabase();
  
  // ─────────────────────────────────────────────────────────────────
  // Role-based permissions
  // ─────────────────────────────────────────────────────────────────
  const isHelper = currentUser.role === UserRole.HELPER;

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
  const [planLimitModal, setPlanLimitModal] = useState<PlanLimitState | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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

  // Trial State
  const [isOnTrial, setIsOnTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<'free' | 'core' | 'pro' | 'test' | null>(null);
  const [isPlanConfirmOpen, setIsPlanConfirmOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{ plan: 'core' | 'pro' | 'test'; period: 'monthly' | 'yearly' } | null>(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralCodeError, setReferralCodeError] = useState<string | null>(null);
  const [referralCodeValid, setReferralCodeValid] = useState(false);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    plan: string;
    status: string;
    periodEnd?: string;
    period?: string;
  } | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isFinalDeleteConfirmOpen, setIsFinalDeleteConfirmOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [subscriptionCanceled, setSubscriptionCanceled] = useState(false);
  
  // Admin Deactivate/Delete Account State
  const [isAdminDeleteOptionsOpen, setIsAdminDeleteOptionsOpen] = useState(false);
  const [isTransferOwnershipOpen, setIsTransferOwnershipOpen] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState<string | null>(null);
  const [isDeactivatingAdmin, setIsDeactivatingAdmin] = useState(false);
  const [isDeleteHouseholdConfirmOpen, setIsDeleteHouseholdConfirmOpen] = useState(false);

  // Push Notification State
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const isTogglingRef = useRef(false); // Ref version to check in useEffect without triggering re-runs
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [pushSupported, setPushSupported] = useState(true);

  // Household Name State - initialize from localStorage cache for instant display
  const [householdName, setHouseholdName] = useState<string>(() => {
    const cached = localStorage.getItem(HOUSEHOLD_NAME_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.householdId === currentUser?.householdId) {
          return parsed.name;
        }
      } catch {
        // Invalid cache, ignore
      }
    }
    return '';
  });

  // Check push notification support and permission on mount
  // Also re-check when app becomes visible (e.g., returning from iOS/Android Settings)
  useEffect(() => {
    setPushSupported(isPushSupported());
    if (isPushSupported()) {
      setPushPermission(getNotificationPermission());
    }
    
    // Re-check permission when app becomes visible
    // Works on: iOS, Android, and Desktop (when returning from settings or switching tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPushSupported()) {
        const currentPermission = getNotificationPermission();
        setPushPermission(currentPermission);
        console.log('[Profile] Re-checked notification permission:', currentPermission);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Lock scroll when any modal is open
  useScrollLock(isAddModalOpen || isEditModalOpen || deleteConfirmOpen || showPhotoOptions || subscriptionCanceled || isPlanConfirmOpen || !!planLimitModal || isAdminDeleteOptionsOpen || isTransferOwnershipOpen || isDeleteHouseholdConfirmOpen);

  // Handle opening add member sheet from onboarding
  React.useEffect(() => {
    if (openAddMemberFromOnboarding) {
      setIsAddModalOpen(true);
      onAddMemberSheetOpened?.();
    }
  }, [openAddMemberFromOnboarding, onAddMemberSheetOpened]);

  // Pre-fetch subscription info on component mount (for admins)
  // This eliminates latency when navigating to the Plan page
  React.useEffect(() => {
    if (currentUser?.householdId && currentUser?.role === UserRole.MASTER) {
      fetchSubscriptionInfo();
    } else {
      // Non-admins don't need subscription info, stop loading
      setIsLoadingSubscription(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.householdId, currentUser?.role]);

  // Fetch subscription info and household name
  const fetchSubscriptionInfo = React.useCallback(async (retryCount = 0, showLoading = true) => {
    if (!currentUser?.householdId) return;
    
    try {
      // Only show loading spinner on initial fetch (when we have no data yet)
      if (showLoading && !subscriptionInfo) {
        setIsLoadingSubscription(true);
      }
      const { data, error } = await supabase
        .from('households')
        .select('name, subscription_plan, subscription_status, subscription_current_period_end, subscription_period, is_trial, trial_ends_at')
        .eq('id', currentUser.householdId)
        .single();

      if (error) throw error;

      if (data) {
        // Set household name
        if (data.name) {
          setHouseholdName(data.name);
          // Cache for instant display on next visit
          localStorage.setItem(HOUSEHOLD_NAME_CACHE_KEY, JSON.stringify({
            householdId: currentUser.householdId,
            name: data.name
          }));
        }
        
        setSubscriptionInfo({
          plan: data.subscription_plan || 'free',
          status: data.subscription_status || 'inactive',
          periodEnd: data.subscription_current_period_end,
          period: data.subscription_period || 'monthly'
        });
        setSelectedPlan((data.subscription_plan || 'free') as 'free' | 'core' | 'pro');
        setBillingPeriod((data.subscription_period || 'monthly') as 'monthly' | 'yearly');

        // Set trial state
        setIsOnTrial(data.is_trial || false);
        setTrialEndsAt(data.trial_ends_at || null);
        
        // If we were retrying and subscription is now active, we're done
        if (retryCount > 0 && data.subscription_status === 'active') {
          return true; // Success
        }
        return data.subscription_status === 'active';
      }
      return false;
    } catch (error) {
      console.error('Error fetching subscription info:', error);
      return false;
    } finally {
      setIsLoadingSubscription(false);
    }
  }, [currentUser?.householdId, subscriptionInfo]);

  // Check for Stripe checkout redirect and refetch subscription info
  React.useEffect(() => {
    if (!currentUser?.householdId) return;

    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
    const success = urlParams.get('success') || hashParams.get('success');
    const portalReturn = urlParams.get('portal_return') || hashParams.get('portal_return');

    // If we just returned from Stripe portal, check if subscription was canceled
    if (portalReturn === 'true') {
      // Navigate to subscription page
      setActiveSection('settings');
      setTimeout(() => setActiveSection('plan'), 100);

      // Clear URL parameters (both query and hash)
      const cleanPath = window.location.pathname;
      const cleanHash = window.location.hash.split('?')[0].replace('#portal_return=true', '') || '';
      window.history.replaceState({}, document.title, cleanPath + cleanHash);

      // Immediately refresh subscription info and check status
      // Use multiple retries as webhook might take a few seconds to process
      const checkSubscriptionStatus = async (attempt: number = 0) => {
        const maxAttempts = 5;
        
        const { data } = await supabase
          .from('households')
          .select('subscription_status, subscription_plan')
          .eq('id', currentUser.householdId)
          .single();
        
        if (data) {
          // Refresh the subscription info display
          fetchSubscriptionInfo(0, false);
          
          // If subscription was canceled or changed, show appropriate message
          if (data.subscription_status === 'canceling' || data.subscription_status === 'canceled' || data.subscription_plan === 'free') {
            setSubscriptionCanceled(true);
          } else if (attempt < maxAttempts) {
            // Keep checking in case webhook is still processing
            setTimeout(() => checkSubscriptionStatus(attempt + 1), 2000);
          }
        }
      };
      
      // Start checking after a brief delay for webhook processing
      setTimeout(() => checkSubscriptionStatus(0), 1500);
    }

    // If we just returned from Stripe checkout
    if (sessionId || success === 'true') {
      // Hide stale plan data to avoid flashing old plan while we sync
      setSubscriptionInfo(null);
      setIsLoadingSubscription(true);

      // Navigate to subscription page
      setActiveSection('settings');
      // Small delay to allow settings to render, then navigate to plan
      setTimeout(() => setActiveSection('plan'), 100);

      // Clear URL parameters
      const newUrl = window.location.pathname + (window.location.hash.split('?')[0] || '');
      window.history.replaceState({}, document.title, newUrl);

      // Show success message
      setSubscriptionSuccess(true);
      setTimeout(() => setSubscriptionSuccess(false), 10000);

      // Attempt immediate sync from Stripe session to avoid waiting on webhook
      const syncSubscription = async () => {
        try {
          await fetch('/api/sync-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ householdId: currentUser.householdId, sessionId }),
          });
        } catch (err) {
          console.warn('Sync subscription failed, will rely on webhook + retries', err);
        }
      };

      // Refetch with retry logic (webhook might take a few seconds)
      const retryFetch = async (attempt: number = 0) => {
        const maxRetries = 10;
        const retryDelay = 2000; // 2 seconds between retries

        if (attempt >= maxRetries) {
          console.warn('Subscription update not detected after max retries');
          setSubscriptionSuccess(false);
          return;
        }

        const isActive = await fetchSubscriptionInfo(attempt);
        
        if (isActive) {
          // Subscription is now active, we're done - keep success message a bit longer
          setTimeout(() => setSubscriptionSuccess(false), 3000);
          return;
        }
        
        if (attempt < maxRetries) {
          // Subscription not active yet, retry after delay
          setTimeout(() => retryFetch(attempt + 1), retryDelay);
        } else {
          setSubscriptionSuccess(false);
        }
      };

      // Initial fetch immediately, then retry if needed
      setTimeout(() => {
        syncSubscription().finally(() => {
          fetchSubscriptionInfo(0).then((isActive) => {
            if (!isActive) {
              // Wait 2 seconds before first retry (give webhook time to process)
              setTimeout(() => retryFetch(1), 2000);
            }
          });
        });
      }, 500);
    }
  }, [currentUser?.householdId, fetchSubscriptionInfo]);

  // Fetch subscription info when navigating to plan/security sections (only if missing)
  React.useEffect(() => {
    if ((activeSection === 'plan' || activeSection === 'security') && !subscriptionInfo) {
      fetchSubscriptionInfo();
    }
  }, [currentUser?.householdId, activeSection, subscriptionInfo, fetchSubscriptionInfo]);
  
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
  // But don't reset notificationsEnabled while user is actively toggling (prevents toggle flip)
  React.useEffect(() => {
    setAccountData(prev => ({
      email: currentUser.email || '',
      firstName: currentUser.firstName || currentUser.name?.split(' ')[0] || '',
      lastName: currentUser.lastName || currentUser.name?.split(' ').slice(1).join(' ') || '',
      phoneNumber: currentUser.phoneNumber || '',
      countryCode: currentUser.countryCode || '+1',
      currentPassword: '',
      newPassword: '',
      // Preserve notificationsEnabled if user is actively toggling (use ref to avoid re-triggering)
      notificationsEnabled: isTogglingRef.current ? prev.notificationsEnabled : (currentUser.notificationsEnabled ?? true)
    }));
  }, [currentUser]);
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiry: '',
    cvc: '',
    name: currentUser.name || '',
    cardType: 'DEBIT' as 'DEBIT' | 'CREDIT' | 'PREPAID'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Filter out invalid users and sort by role priority, then alphabetically
  const validUsers = React.useMemo(() => {
    return users
      .filter(u => u && u.id)
      .sort((a, b) => {
        // Use fallback of 99 for unknown roles to sort them last
        const priorityA = ROLE_PRIORITY[a.role] ?? 99;
        const priorityB = ROLE_PRIORITY[b.role] ?? 99;
        const roleDiff = priorityA - priorityB;
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

  // Scroll to top when changing sections
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeSection]);

  // Open target section when requested via global flag (e.g., from other views)
  useEffect(() => {
    const targetSection = localStorage.getItem('helpy_profile_target_section') as typeof activeSection | null;
    if (targetSection) {
      setActiveSection(targetSection);
      localStorage.removeItem('helpy_profile_target_section');
    }
  }, []);

  const resetForm = () => {
    setNewName('');
    setNewRole(UserRole.CHILD);
  };

  // Referral Code Validation
  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setReferralCodeValid(false);
      setReferralCodeError(null);
      return;
    }

    setIsValidatingReferral(true);
    try {
      const { data, error } = await supabase
        .from('referral_codes')
        .select('id, trial_days, is_active')
        .eq('code', code.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setReferralCodeError(t['subscription.invalid_referral_code'] || 'Invalid or expired referral code');
        setReferralCodeValid(false);
      } else {
        setReferralCodeError(null);
        setReferralCodeValid(true);
      }
    } catch (err) {
      setReferralCodeError(t['subscription.invalid_referral_code'] || 'Invalid or expired referral code');
      setReferralCodeValid(false);
    } finally {
      setIsValidatingReferral(false);
    }
  };

  // Stripe Checkout Handler
  const handleSelectPlan = async (plan: 'core' | 'pro' | 'test', period: 'monthly' | 'yearly', promoCode?: string, referralCode?: string) => {
    try {
      setPromoCodeError(null);
      setLoadingPlan(plan);
      const checkoutUrl = await createCheckoutSession(
        currentUser.householdId,
        plan,
        period,
        currentUser.email || '',
        promoCode,
        referralCode
      );
      
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      setPromoCodeError(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  const handleOpenPlanConfirm = (plan: 'core' | 'pro' | 'test', period: 'monthly' | 'yearly') => {
    setPendingPlan({ plan, period });
    setPromoCodeInput('');
    setPromoCodeError(null);
    setIsPlanConfirmOpen(true);
  };

  const handleConfirmPlan = async () => {
    if (!pendingPlan) return;
    await handleSelectPlan(pendingPlan.plan, pendingPlan.period, referralCodeValid ? undefined : promoCodeInput, referralCodeValid ? referralCodeInput : undefined);
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
      case UserRole.MASTER: return 'bg-primary/10 text-primary'; // Helpy blue #3EAFD2
      case UserRole.SPOUSE: return 'bg-[#F3E5F5] text-[#AB47BC]';
      case UserRole.HELPER: return 'bg-[#FFF3E0] text-[#FF9800]';
      case UserRole.CHILD: return 'bg-[#E8F5E9] text-[#4CAF50]';
      case UserRole.OTHER: return 'bg-[#FCE4EC] text-[#F06292]';
      default: return 'bg-[#F5F5F5] text-[#757575]';
    }
  };

  const resolvePlanLimits = React.useCallback(() => {
    const planKey = (householdPlan?.plan || (subscriptionInfo?.plan as PlanKey) || 'free') as PlanKey;
    const defaults = DEFAULT_PLAN_LIMITS[planKey] || DEFAULT_PLAN_LIMITS.free;

    return {
      plan: planKey,
      maxFamily: householdPlan?.maxFamilyMembers ?? defaults.maxFamily,
      maxHelpers: householdPlan?.maxHelpers ?? defaults.maxHelpers,
    };
  }, [householdPlan, subscriptionInfo?.plan]);

  const openPlanLimitModal = (reason: PlanLimitReason, planKey: PlanKey, allowed: number, current: number) => {
    setPlanLimitModal({ plan: planKey, reason, allowed, current });
    setIsAddModalOpen(false);
  };

  const formatPlanLabel = (plan: PlanKey) => {
    switch (plan) {
      case 'core':
        return 'Core';
      case 'pro':
        return 'Pro';
      case 'test':
        return 'Test';
      default:
        return 'Free';
    }
  };

  const handleUpgradeClick = () => {
    setPlanLimitModal(null);
    setActiveSection('settings');
    setTimeout(() => setActiveSection('plan'), 80);
  };

  const handleAddUser = async () => {
    if (!newName.trim() || isAddingUser) return;
    
    setIsAddingUser(true);

    const { plan, maxFamily, maxHelpers } = resolvePlanLimits();

    // Fetch latest counts from Supabase to avoid stale client state
    let helperCount = 0;
    let familyCount = 0;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, status')
        .eq('household_id', currentUser.householdId);

      if (error) throw error;

      const activeUsers = (data || []).filter(u => u?.status !== 'inactive');
      helperCount = activeUsers.filter(u => isHelperRole(u.role)).length;
      familyCount = activeUsers.filter(u => !isHelperRole(u.role)).length;
    } catch (err) {
      console.warn('[Profile] Failed to load latest user counts, falling back to state', err);
      const activeUsers = users.filter(u => u.status !== 'inactive');
      helperCount = activeUsers.filter(u => isHelperRole(u.role)).length;
      familyCount = activeUsers.filter(u => !isHelperRole(u.role)).length;
    }

    if (isHelperRole(newRole) && helperCount >= maxHelpers) {
      openPlanLimitModal('helper', plan, maxHelpers, helperCount);
      setIsAddingUser(false);
      return;
    }

    if (!isHelperRole(newRole) && familyCount >= maxFamily) {
      openPlanLimitModal('family', plan, maxFamily, familyCount);
      setIsAddingUser(false);
      return;
    }

    const nameToAdd = newName.trim();
    const roleToAdd = newRole;
    
    // Close modal immediately for better UX
    resetForm();
    setIsAddModalOpen(false);
    
    try {
      // Use invite API for ALL roles to ensure server-side limit enforcement
      // The API will create CHILD as 'active' and others as 'pending' with invite links
      const result = await createInvite({
        name: nameToAdd,
        role: roleToAdd,
        householdId: currentUser.householdId,
        inviterId: currentUser.id
      });
      
      // Only show invite link modal for non-children (children are added directly as active)
      if (roleToAdd !== UserRole.CHILD && result.inviteLink) {
        setInviteLink(result.inviteLink);
      }
      // For children, the user is already created as 'active' in the database
      // The subscription update will sync it to the UI automatically
      // No need to call onAdd since the API already created the user
    } catch (error) {
      console.error('Failed to add user:', error);
      // Extract error message from API response if available
      const errorMessage = error instanceof Error 
        ? error.message 
        : (t['error.add_user'] || 'Failed to add user. Please try again.');
      alert(errorMessage);
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = (id: string) => {
    setUserToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    // Update selectedUserId before deletion if needed
    if (selectedUserId === userToDelete) {
      setSelectedUserId(currentUser.id);
    }
    
    // Close dialog immediately for better UX
    setDeleteConfirmOpen(false);
    const deletingUserId = userToDelete;
    setUserToDelete(null);
    
    try {
      // Call onDelete which will update the parent's users array
      await onDelete(deletingUserId);
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      // Show error message to user
      alert(error?.message || t['error.delete_member'] || 'Failed to delete member. Please try again.');
    }
  };

  const handleReinvite = async (userId: string) => {
    try {
      const { resendInvite } = await import('../services/inviteService');
      const result = await resendInvite(userId, currentUser.householdId);
      setInviteLink(result.inviteLink);
      setIsCopied(false);
    } catch (error) {
      console.error('Failed to resend invite:', error);
      alert(t['error.generate_invite'] || 'Failed to generate new invite link');
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

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert(t['error.select_image'] || 'Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert(t['error.image_too_large'] || 'Image size must be less than 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      console.log('📷 Uploading avatar for user:', selectedUser.id);
      const avatarUrl = await uploadAvatarImage(
        currentUser.householdId,
        selectedUser.id,
        file
      );
      
      // Update user with new avatar URL
      onUpdate(selectedUser.id, { avatar: avatarUrl });
      console.log('✅ Avatar updated successfully');
    } catch (error) {
      console.error('❌ Failed to upload avatar:', error);
      alert(t['error.upload_image'] || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }

    // Reset the input so the same file can be selected again
    event.target.value = '';
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
    <header 
      className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end"
      style={{ height: '120px' }}
    >
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={onBackOverride || (() => setActiveSection('main'))}
          className="p-2 hover:bg-secondary rounded-full transition-colors"
        >
          <ChevronLeft size={24} className="text-foreground" />
        </button>
        <h1 className="text-display text-foreground">{title}</h1>
      </div>
    </header>
  );

  // =====================================================
  // MAIN PROFILE VIEW
  // =====================================================
  if (activeSection === 'main') {
    return (
      <div className="min-h-screen bg-background pb-40 animate-fade-in">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          {/* Header with Logout */}
          <header 
            className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end"
            style={{ height: '120px' }}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <button onClick={onBack} className="p-2 hover:bg-secondary rounded-full transition-colors">
                  <ChevronLeft size={24} className="text-foreground" />
                </button>
                <h1 className="text-display text-foreground">{t['nav.profile']}</h1>
              </div>
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
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
                {/* Safe area bottom cover - fills the gap below the sheet */}
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-card"
                  style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
                />
                <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                  {/* Close Button */}
                  <button 
                    onClick={() => setInviteLink(null)} 
                    className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors right-4 top-4 text-muted-foreground"
                    aria-label={t['common.close'] || 'Close'}
                  >
                    <X size={20} />
                  </button>

                  {/* Header */}
                  <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                    <h2 className="text-title text-foreground">{t['profile.invitation_link'] || 'Invitation Link'}</h2>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <p className="text-body text-muted-foreground mb-4">{t['profile.share_link_text'] || 'Share this link with the new member:'}</p>
                    <div className="bg-secondary p-3 rounded-lg break-all text-body font-mono text-foreground">
                      {inviteLink}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
                    <button
                      onClick={handleCopyInvite}
                      className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
                    >
                      {isCopied ? <Check size={18} /> : <Copy size={18} />}
                      {isCopied ? (t['profile.copied'] || 'Copied!') : (t['profile.copy_link'] || 'Copy')}
                    </button>
                    <button
                      onClick={handleShareInvite}
                      className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <Share2 size={18} />
                      {t['common.share'] || 'Share'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {planLimitModal && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
                <div className="bg-card rounded-2xl shadow-lg max-w-lg w-full p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-amber-100 text-amber-700">
                      <AlertCircle size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-title font-semibold text-foreground">
                        {planLimitModal.reason === 'helper'
                          ? (t['profile.limit_helper_title'] || 'Helper limit reached')
                          : (t['profile.limit_family_title'] || 'Member limit reached')}
                      </p>
                      <p className="text-body text-muted-foreground mt-1">
                        {(() => {
                          const planName = formatPlanLabel(planLimitModal.plan);
                          const limitLabel = planLimitModal.reason === 'helper'
                            ? `${planLimitModal.allowed} helper${planLimitModal.allowed === 1 ? '' : 's'}`
                            : `${planLimitModal.allowed} family member${planLimitModal.allowed === 1 ? '' : 's'}`;
                          return planLimitModal.reason === 'helper'
                            ? `Your ${planName} plan includes up to ${limitLabel}. Upgrade to add another helper.`
                            : `Your ${planName} plan includes up to ${limitLabel} (including the admin). Upgrade to add another member.`;
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="bg-secondary/40 border border-border rounded-xl p-3">
                    <p className="text-caption text-muted-foreground">{t['common.current'] || 'Current usage'}</p>
                    <p className="text-body font-semibold text-foreground">
                      {planLimitModal.reason === 'helper'
                        ? `${planLimitModal.current} / ${planLimitModal.allowed} helper${planLimitModal.allowed === 1 ? '' : 's'}`
                        : `${planLimitModal.current} / ${planLimitModal.allowed} family member${planLimitModal.allowed === 1 ? '' : 's'}`}
                    </p>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleUpgradeClick}
                      className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      Upgrade
                    </button>
                    <button
                      onClick={() => setPlanLimitModal(null)}
                      className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body font-semibold hover:bg-secondary/80 transition-colors"
                    >
                      Return
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* User Carousel */}
            <div className="bg-card rounded-3xl px-5 py-5 shadow-sm">
              {householdName && (
                <h2 className="text-title font-bold text-foreground mb-1">{householdName}</h2>
              )}
              <p className="text-title text-muted-foreground mb-3">{t['profile.familyMembers']}</p>
              <div className="flex gap-4 overflow-x-auto pt-2 pb-1 scrollbar-hide">
                {/* Add button first - Hidden for Helper */}
                {!isHelper && (
                <div
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex flex-col items-center gap-2 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                >
                  <div id="onboarding-add-member-btn" className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center border-2 border-border">
                    <Plus size={24} className="text-muted-foreground" />
                  </div>
                  <span className="text-body font-semibold text-foreground">{t['common.add']}</span>
                </div>
                )}
                {validUsers.map((user) => {
                  const isCurrent = user.id === currentUser.id;
                  const isSelected = user.id === selectedUserId;
                  return (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className="flex flex-col items-center gap-2 cursor-pointer"
                    >
                      <div className="relative">
                        <Avatar
                          user={user}
                          size="lg"
                          isSelected={isSelected}
                          showSelectionBorder={true}
                        />
                        {/* Notification indicator */}
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow-sm flex items-center justify-center">
                          {(() => {
                            if (user.role === 'Child') return <BellOff size={12} className="text-muted-foreground" />;
                            if (!user.notificationsEnabled) return <BellOff size={12} className="text-destructive" />;
                            if (!user.hasPushSubscription) return <BellDot size={12} className="text-orange-500" />;
                            return <Bell size={12} className="text-primary" />;
                          })()}
                        </div>
                      </div>
                      <span className="text-body font-semibold text-foreground">
                        {user.name.split(' ')[0]} {isCurrent ? '(You)' : ''}
                      </span>
                      {user.status === 'pending' && (
                        <span className="text-caption text-muted-foreground">{t['common.pending'] || 'Pending'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected User Profile Card */}
            {selectedUser && (
              <div className="bg-card rounded-3xl shadow-sm p-6 mb-6 relative">
                {/* Delete button - Hidden for Helper, positioned top right */}
                {selectedUser.id !== currentUser.id && !isHelper && (
                  <button
                    onClick={() => handleDeleteUser(selectedUser.id)}
                    className="absolute top-4 right-4 p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                    aria-label={t['profile.delete_member'] || 'Delete member'}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                {/* Header: Avatar + Name + Role */}
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div
                      className="relative cursor-pointer"
                      onClick={() => !isUploadingAvatar && setShowPhotoOptions(true)}
                    >
                      <Avatar
                        user={selectedUser}
                        size="xl"
                        className="shadow-sm"
                      />
                      {isUploadingAvatar && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    {!isUploadingAvatar && (
                      <button
                        onClick={() => setShowPhotoOptions(true)}
                        className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Camera size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-title font-bold text-foreground truncate">{selectedUser.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-block px-3 py-1 rounded-full text-caption font-semibold ${getRoleBadgeColor(selectedUser.role)}`}>
                        {selectedUser.role}
                      </span>
                      {selectedUser.status === 'pending' && (
                        <span className="text-caption text-muted-foreground">{t['common.pending'] || 'Pending'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notifications Status */}
                <div className="flex items-start gap-2 mt-3">
                  {(() => {
                    // Child
                    if (selectedUser.role === 'UserRole.CHILD' || selectedUser.role === 'Child') {
                      return (
                        <>
                          <BellOff size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                          <span className="text-body text-muted-foreground">
                            {t['notifications.child'] || "Children accounts don't receive notifications."}
                          </span>
                        </>
                      );
                    }
                    
                    // Off
                    if (!selectedUser.notificationsEnabled) {
                      return (
                        <>
                          <BellOff size={16} className="text-destructive shrink-0 mt-0.5" />
                          <div className="text-body text-muted-foreground">
                             <p className="font-bold text-foreground mb-1">Notifications off.</p>
                             <ol className="list-decimal pl-4 space-y-1">
                               <li>Enable in <strong>Settings &gt; Account</strong> below</li>
                               <li>Tap <strong>Allow</strong> if asked</li>
                             </ol>
                          </div>
                        </>
                      );
                    }
                    
                    // Incomplete (Enabled but no subscription)
                    if (!selectedUser.hasPushSubscription) {
                      return (
                        <>
                          <BellDot size={16} className="text-orange-500 shrink-0 mt-0.5" />
                          <div className="text-body text-muted-foreground">
                             <p className="font-bold text-foreground mb-1">Setup incomplete. <span className="font-normal">Ask {selectedUser.name.split(' ')[0]} to:</span></p>
                             <ol className="list-decimal pl-4 space-y-1">
                               <li>Add to Home Screen (iPhone/Android)</li>
                               <li>Enable Notification in <strong>Settings &gt; Account</strong></li>
                               <li>Tap <strong>Allow</strong> if asked</li>
                             </ol>
                          </div>
                        </>
                      );
                    }
                    
                    // Ready
                    return (
                      <>
                        <Bell size={16} className="text-primary shrink-0 mt-0.5" />
                        <span className="text-body text-foreground font-bold">
                          {t['notifications.ready'] || "Notifications active."}
                        </span>
                      </>
                    );
                  })()}
                </div>

                {/* Action Row */}
                <div className="mt-4 pt-4">
                  <div className="h-px bg-border -mt-4 mb-4" />
                  <div className="flex items-center gap-2">
                    {/* Edit button - Helper can only edit their own profile */}
                    {(!isHelper || selectedUser.id === currentUser.id) && (
                    <button
                      onClick={handleOpenEdit}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-foreground rounded-xl hover:bg-secondary/80 transition-colors whitespace-nowrap"
                    >
                      <Settings size={16} className="shrink-0" />
                      <span className="text-body font-medium">{t['common.edit'] || 'Edit'}</span>
                    </button>
                    )}
                    {/* Resend button - Hidden for Helper */}
                    {selectedUser.status === 'pending' && !isHelper && (
                      <button
                        onClick={() => handleReinvite(selectedUser.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors whitespace-nowrap"
                      >
                        <Share2 size={16} className="shrink-0" />
                        <span className="text-body font-medium">{t['profile.resend_invite'] || 'Resend Invite'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="mt-4 pt-4">
                  <div className="h-px bg-border -mt-4 mb-4" />
                  {/* Allergies */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={16} className="text-destructive" />
                      <h4 className="text-body font-bold text-foreground">{t['profile.allergies']}</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.allergies && selectedUser.allergies.length > 0 ? (
                        selectedUser.allergies.map((allergy) => (
                          <span key={allergy} className="px-3 py-1.5 bg-destructive/10 text-destructive rounded-full text-caption font-medium">
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
                      <Heart size={16} className="text-foreground" />
                      <h4 className="text-body font-bold text-foreground">{t['profile.preferences']}</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.preferences && selectedUser.preferences.length > 0 ? (
                        selectedUser.preferences.map((pref) => (
                          <span key={pref} className="px-3 py-1.5 bg-foreground/10 text-foreground rounded-full text-caption font-medium">
                            {pref}
                          </span>
                        ))
                      ) : (
                        <span className="text-caption text-muted-foreground">{t['profile.none']}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Settings & Tutorial Card */}
            <div className="bg-card rounded-3xl shadow-sm overflow-hidden">
              {/* Settings Row */}
              <button
                onClick={() => setActiveSection('settings')}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings size={18} className="text-primary" />
                  <div className="text-left">
                    <p className="font-bold text-foreground text-title">{t['common.settings']}</p>
                    <p className="text-caption text-muted-foreground">{t['profile.manage_account'] || 'Manage your account'}</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-muted-foreground" />
              </button>

              {/* Separator */}
              <div className="h-px bg-border mx-5" />

              {/* Tutorial Row */}
              <button
                onClick={onRestartOnboarding}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Lightbulb size={18} className="text-primary" />
                  <div className="text-left">
                    <p className="font-bold text-foreground text-title">{t['profile.tutorial'] || 'Tutorial'}</p>
                    <p className="text-caption text-muted-foreground">{t['profile.tutorial_desc'] || 'Learn how to use Helpy'}</p>
                  </div>
                </div>
                {/* No arrow for Tutorial */}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="helpy-footer">
            <span className="helpy-logo">helpy</span>
          </div>
        </div>

        {/* Add User Modal */}
          {isAddModalOpen && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
              {/* Safe area bottom cover */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-card"
                style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
              />
              <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                {/* Drag Handle */}
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-2" />
                
                {/* Close Button */}
                <button 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors right-4 top-4 text-muted-foreground"
                  aria-label={t['common.close'] || 'Close'}
                >
                  <X size={20} />
                </button>

                {/* Header */}
                <div className="pt-2 pb-4 px-5 shrink-0">
                  <h2 className="text-title font-bold text-foreground">{t['profile.addFamilyMember'] || 'Add Family Member'}</h2>
                </div>

                {/* Form */}
                <div className="p-5 pt-0 space-y-4 flex-1 overflow-y-auto">
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2">{t['common.name']}</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                      placeholder={t['common.enter_name'] || 'Enter name'}
                    />
                  </div>
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2">{t['profile.role']}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewRole(UserRole.SPOUSE)}
                        className={`px-4 py-3 rounded-lg text-body font-semibold transition-colors ${
                          newRole === UserRole.SPOUSE
                            ? 'bg-[#F3E5F5] text-[#AB47BC] border-2 border-[#AB47BC]'
                            : 'bg-secondary text-muted-foreground border-2 border-transparent hover:bg-secondary/80'
                        }`}
                      >
                        {t['profile.role.spouse'] || 'Spouse'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRole(UserRole.HELPER)}
                        className={`px-4 py-3 rounded-lg text-body font-semibold transition-colors ${
                          newRole === UserRole.HELPER
                            ? 'bg-[#FFF3E0] text-[#FF9800] border-2 border-[#FF9800]'
                            : 'bg-secondary text-muted-foreground border-2 border-transparent hover:bg-secondary/80'
                        }`}
                      >
                        {t['profile.role.helper'] || 'Helper'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRole(UserRole.CHILD)}
                        className={`px-4 py-3 rounded-lg text-body font-semibold transition-colors ${
                          newRole === UserRole.CHILD
                            ? 'bg-[#E8F5E9] text-[#4CAF50] border-2 border-[#4CAF50]'
                            : 'bg-secondary text-muted-foreground border-2 border-transparent hover:bg-secondary/80'
                        }`}
                      >
                        {t['profile.role.child'] || 'Child'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRole(UserRole.OTHER)}
                        className={`px-4 py-3 rounded-lg text-body font-semibold transition-colors ${
                          newRole === UserRole.OTHER
                            ? 'bg-[#FCE4EC] text-[#F06292] border-2 border-[#F06292]'
                            : 'bg-secondary text-muted-foreground border-2 border-transparent hover:bg-secondary/80'
                        }`}
                      >
                        {t['profile.role.other'] || 'Other'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-5 pb-8 border-t border-border shrink-0">
                  <button
                    onClick={handleAddUser}
                    disabled={isAddingUser || !newName.trim()}
                    className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAddingUser ? (t['common.adding'] || 'Adding...') : t['common.add']}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirmOpen && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
              {/* Safe area bottom cover */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-card"
                style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
              />
              <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                {/* Header */}
                <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                  <h2 className="text-title text-foreground">{t['profile.delete_family_member'] || 'Delete Family Member'}</h2>
                </div>

                {/* Content */}
                <div className="p-5">
                  <p className="text-body text-muted-foreground">
                    {t['profile.confirmDelete'] || 'Are you sure you want to delete this family member? This action cannot be undone.'}
                  </p>
                </div>

                {/* Footer */}
                <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setUserToDelete(null);
                    }}
                    className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteUser}
                    className="flex-1 py-3.5 rounded-xl bg-destructive/10 text-destructive text-body hover:bg-destructive/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit User Modal */}
          {isEditModalOpen && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
              {/* Safe area bottom cover - fills the gap below the sheet */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-card"
                style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
              />
              <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                {/* Close Button */}
                <button 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors right-4 top-4 text-muted-foreground"
                  aria-label={t['common.close'] || 'Close'}
                >
                  <X size={20} />
                </button>

                {/* Header */}
                <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                  <h2 className="text-title text-foreground">{t['profile.edit_profile'] || 'Edit Profile'}</h2>
                </div>

                {/* Form */}
                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                  {/* Name */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">{t['profile.name_label'] || 'Name'}</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                    />
                  </div>

                  {/* Role - Hidden when Admin/Helper edits their own profile (prevent self-demotion/escalation) */}
                  {!((isHelper || currentUser.role === UserRole.MASTER) && selectedUser.id === currentUser.id) && (
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">{t['profile.role'] || 'Role'}</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                    >
                      <option value={UserRole.MASTER}>{t['profile.role_admin'] || 'Admin'}</option>
                      <option value={UserRole.SPOUSE}>{t['profile.role_spouse'] || 'Spouse'}</option>
                      <option value={UserRole.HELPER}>{t['profile.role_helper'] || 'Helper'}</option>
                      <option value={UserRole.CHILD}>{t['profile.role_child'] || 'Child'}</option>
                      <option value={UserRole.OTHER}>{t['profile.role_other'] || 'Other'}</option>
                    </select>
                  </div>
                  )}

                  {/* Allergies */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">{t['profile.allergies']}</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newAllergyInput}
                        onChange={(e) => setNewAllergyInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
                        className="flex-1 px-4 py-2.5 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                        placeholder={t['common.add_allergy']}
                      />
                      <button onClick={addAllergy} className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors">
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
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">{t['profile.preferences']}</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newPreferenceInput}
                        onChange={(e) => setNewPreferenceInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addPreference()}
                        className="flex-1 px-4 py-2.5 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
                        placeholder={t['common.add_preference']}
                      />
                      <button onClick={addPreference} className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors">
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editPreferences.map((pref) => (
                        <span key={pref} className="px-3 py-1 bg-foreground/10 text-foreground rounded-full text-caption font-medium flex items-center gap-1">
                          {pref}
                          <button onClick={() => removePreference(pref)} className="hover:bg-foreground/20 rounded-full p-0.5 transition-colors">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body hover:bg-primary/90 transition-colors shadow-sm"
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
                <h2 className="text-title text-foreground">{t['profile.change_photo']}</h2>
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
                  <span className="font-semibold text-foreground">{t['profile.take_photo']}</span>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowPhotoOptions(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-secondary rounded-xl hover:bg-secondary/80 transition-colors"
                >
                  <ImageIcon size={20} className="text-muted-foreground" />
                  <span className="font-semibold text-foreground">{t['profile.choose_library']}</span>
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
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAvatarChange} />
      </div>
    );
  }

  // =====================================================
  // PLAN SELECTION VIEW
  // =====================================================
  const handleCancelSubscription = async () => {
    if (!window.confirm(t['subscription.confirm_cancel'] || 'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      // Redirect to Stripe portal for cancellation
      await handleManageSubscription();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert(t['error.cancel_subscription'] || 'Failed to cancel subscription. Please try again.');
      setIsLoading(false);
    }
  };

  const handleDowngradeToFree = async () => {
    if (!window.confirm(t['subscription.confirm_downgrade_free'] || 'Are you sure you want to downgrade to Free immediately? You will lose access to paid features right away.')) {
      return;
    }

    try {
      setLoadingPlan('free');
      setSubscriptionInfo(null);
      setIsLoadingSubscription(true);
      await downgradeToFree(currentUser.householdId);
      // Refresh subscription info
      await fetchSubscriptionInfo();
      // Show brief confirmation without trapping user in a modal
      setSubscriptionCanceled(true);
      setActiveSection('plan');
      setTimeout(() => setSubscriptionCanceled(false), 2500);
    } catch (error) {
      console.error('Downgrade error:', error);
      alert(t['error.downgrade_free'] || 'Failed to downgrade. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t['common.na'] || 'N/A';
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.toLocaleDateString(currentLang === 'en' ? 'en-GB' : currentLang, { month: 'short' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return t['common.na'] || 'N/A';
    }
  };

  // Handle Delete Account
  const handleDeleteAccountClick = () => {
    const isAdmin = currentUser.role === UserRole.MASTER;
    if (isAdmin) {
      // Admin gets options: Deactivate (transfer) or Delete (whole household)
      setIsAdminDeleteOptionsOpen(true);
    } else {
      // Non-admin gets simple delete confirmation
      setIsDeleteAccountModalOpen(true);
    }
  };

  const handleFirstDeleteConfirm = () => {
    setIsDeleteAccountModalOpen(false);
    setIsFinalDeleteConfirmOpen(true);
  };

  // Handle non-admin account deletion (self-delete)
  const handleDeleteSelfAccount = async () => {
    if (!currentUser?.householdId || !clerkUser) {
      alert(t['error.delete_account_unable'] || 'Unable to delete account. Please try again.');
      return;
    }

    setIsDeletingAccount(true);

    try {
      // Call the API to delete the user's own account
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          householdId: currentUser.householdId,
          action: 'delete_self'
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete account');
      }

      // Delete the Clerk account
      try {
        await clerkUser.delete();
      } catch (error) {
        console.error('Error deleting Clerk account:', error);
      }

      // Sign out the user
      setIsFinalDeleteConfirmOpen(false);
      onLogout();
    } catch (error) {
      console.error('Error deleting account:', error);
      alert(t['error.delete_account'] || 'Failed to delete account. Please try again or contact support.');
      setIsDeletingAccount(false);
      setIsFinalDeleteConfirmOpen(false);
    }
  };

  // Handle admin deactivation (transfer ownership)
  const handleAdminDeactivate = async () => {
    if (!currentUser?.householdId || !clerkUser || !selectedNewOwnerId) {
      alert(t['error.select_new_owner'] || 'Please select a new owner for the household.');
      return;
    }

    setIsDeactivatingAdmin(true);

    try {
      // Call the API to transfer ownership and delete admin
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          householdId: currentUser.householdId,
          action: 'deactivate_admin',
          newOwnerId: selectedNewOwnerId
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to transfer ownership');
      }

      // Delete the Clerk account
      try {
        await clerkUser.delete();
      } catch (error) {
        console.error('Error deleting Clerk account:', error);
      }

      // Sign out the user
      setIsTransferOwnershipOpen(false);
      setIsDeactivatingAdmin(false);
      onLogout();
    } catch (error) {
      console.error('Error deactivating admin:', error);
      alert(t['error.transfer_ownership'] || 'Failed to transfer ownership. Please try again.');
      setIsDeactivatingAdmin(false);
    }
  };

  // Handle admin delete entire household
  const handleDeleteHousehold = async () => {
    if (!currentUser?.householdId || !clerkUser) {
      alert(t['error.delete_account_unable'] || 'Unable to delete account. Please try again.');
      return;
    }

    setIsDeletingAccount(true);

    try {
      // Call the API to delete entire household
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          householdId: currentUser.householdId,
          action: 'delete_household'
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete household');
      }

      // Delete the Clerk account
      try {
        await clerkUser.delete();
      } catch (error) {
        console.error('Error deleting Clerk account:', error);
      }

      // Sign out the user
      setIsDeleteHouseholdConfirmOpen(false);
      setIsDeletingAccount(false);
      onLogout();
    } catch (error) {
      console.error('Error deleting household:', error);
      alert(t['error.delete_household'] || 'Failed to delete household. Please try again or contact support.');
      setIsDeletingAccount(false);
      setIsDeleteHouseholdConfirmOpen(false);
    }
  };

  // Get eligible users for ownership transfer (exclude current user and children)
  const eligibleNewOwners = users.filter(user => 
    user.id !== currentUser.id && 
    user.role !== UserRole.CHILD &&
    user.status !== 'pending'
  );

  // Legacy handler kept for backward compatibility
  const handleDeleteAccount = handleDeleteHousehold;

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

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getPlanDisplayName = (plan: 'core' | 'pro' | 'test' | 'free') => {
    if (plan === 'core') return t['common.core'] || 'Core';
    if (plan === 'pro') return t['common.pro'] || 'Pro';
    if (plan === 'test') return t['common.test'] || '🧪 Test';
    return t['common.free'] || 'Free';
  };

  if (activeSection === 'plan') {
    const plans = [
      {
        id: 'free',
        name: t['common.free'] || 'Free',
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: [
          t['plan.feature.free_family'] || 'Up to 3 family members (incl. admin)',
          t['plan.feature.free_helper'] || '1 Helper',
          t['plan.feature.free_expenses'] || 'Manual expense entry only',
        ],
        limitations: [
          t['plan.feature.free_no_scan'] || 'No receipt scanning or summary',
        ],
        highlight: false,
        isFree: true,
        isDowngrade: true
      },
      {
        id: 'core',
        name: t['common.core'] || 'Core',
        monthlyPrice: 88,
        yearlyPrice: 845,
        features: [
          t['plan.feature.core_family'] || 'Up to 4 family members (incl. admin)',
          t['plan.feature.core_helper'] || '1 Helper',
          t['plan.feature.core_expenses'] || 'All Expense Functions',
          t['plan.feature.core_helper_mgmt'] || 'Helper Management (Coming Soon)',
        ],
        limitations: [],
        highlight: false,
        isFree: false
      },
      {
        id: 'pro',
        name: t['common.pro'] || 'Pro',
        monthlyPrice: 118,
        yearlyPrice: 1133,
        features: [
          t['plan.feature.pro_family'] || 'Up to 8 family members (incl. admin)',
          t['plan.feature.pro_helpers'] || 'Up to 4 Helpers',
          t['plan.feature.pro_expenses'] || 'All Expense Functions',
          t['plan.feature.pro_helper_mgmt'] || 'Helper Management (Coming Soon)',
        ],
        limitations: [],
        highlight: true,
        isFree: false
      },
      {
        id: 'test',
        name: t['common.test'] || '🧪 Test',
        monthlyPrice: 5,
        yearlyPrice: 5,
        features: [
          t['plan.feature.test_desc'] || 'Test plan for Stripe payment testing',
        ],
        limitations: [],
        highlight: false,
        isFree: false,
        isTest: true
      }
    ];

    const isAdmin = currentUser.role === UserRole.MASTER;
    const isCanceling = subscriptionInfo?.status === 'canceling';
    const basePlanName = subscriptionInfo?.plan === 'core' 
      ? (t['common.core'] || 'Core') 
      : subscriptionInfo?.plan === 'pro' 
      ? (t['common.pro'] || 'Pro') 
      : subscriptionInfo?.plan === 'test'
      ? (t['common.test'] || '🧪 Test')
      : (t['common.free'] || 'Free');
    const currentPlanName = isCanceling ? `${basePlanName} (${t['subscription.canceling'] || 'Canceling'})` : basePlanName;
    const planPrice = subscriptionInfo?.plan === 'core' 
      ? (subscriptionInfo?.period === 'yearly' ? 845 : 88)
      : subscriptionInfo?.plan === 'pro'
      ? (subscriptionInfo?.period === 'yearly' ? 1133 : 118)
      : subscriptionInfo?.plan === 'test'
      ? 5
      : 0;

    return (
      <div className="min-h-screen bg-background pb-40 animate-fade-in">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          {renderSettingsHeader(t['common.plan'] || 'Subscription', () => setActiveSection('settings'))}
          <div className="pt-6 pb-24">

            {/* Success Message Banner */}
            {subscriptionSuccess && (
              <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-body font-semibold text-green-700 dark:text-green-400">
                    {t['subscription.payment_success'] || 'Payment successful! Your subscription is being updated...'}
                  </p>
                </div>
              </div>
            )}

            {/* Current Subscription Summary Tile */}
            {isLoadingSubscription ? (
              <div className="mt-6 bg-card rounded-3xl p-6 shadow-sm border border-border mb-6">
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            ) : (
              <div className="mt-6 bg-primary rounded-3xl p-6 shadow-md text-primary-foreground mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-title font-semibold text-primary-foreground/90 mb-1">{t['common.current_plan'] || 'Current Plan'}</h3>
                    <p className="text-display font-bold">{currentPlanName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-body text-primary-foreground/80 mb-1">{t['common.price'] || 'Price'}</p>
                    {planPrice > 0 ? (
                      <p className="text-title font-bold">
                        HK${planPrice}
                        <span className="text-body font-normal">/{subscriptionInfo?.period === 'yearly' ? t['common.yr'] : t['common.mo']}</span>
                      </p>
                    ) : (
                      <p className="text-title font-bold">{t['common.free']}</p>
                    )}
                  </div>
                </div>
                
                {subscriptionInfo?.status === 'canceling' && subscriptionInfo?.periodEnd ? (
                  <div className="mt-4 pt-4 border-t border-primary-foreground/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={16} className="text-primary-foreground/80" />
                      <p className="text-body font-semibold text-primary-foreground">{t['subscription.canceling'] || 'Subscription Canceling'}</p>
                    </div>
                    <p className="text-caption text-primary-foreground/70">
                      {t['subscription.access_until'] || 'Access until'}: {formatDate(subscriptionInfo.periodEnd)}
                    </p>
                    <p className="text-caption text-primary-foreground/60 mt-1">
                      {t['subscription.will_revert_free'] || 'Your plan will revert to Free after this date.'}
                    </p>
                  </div>
                ) : subscriptionInfo?.status === 'active' && subscriptionInfo?.periodEnd ? (
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-primary-foreground/20">
                    <div>
                      <p className="text-caption text-primary-foreground/70 mb-1">{t['common.expires_on'] || 'Expires On'}</p>
                      <p className="text-body font-semibold">{formatDate(subscriptionInfo.periodEnd)}</p>
                    </div>
                    <div>
                      <p className="text-caption text-primary-foreground/70 mb-1">{t['common.next_payment'] || 'Next Payment'}</p>
                      <p className="text-body font-semibold">{getNextPaymentDate(subscriptionInfo.periodEnd, subscriptionInfo.period) || (t['common.na'] || 'N/A')}</p>
                    </div>
                  </div>
                ) : subscriptionInfo?.status !== 'active' && subscriptionInfo?.status !== 'canceling' && (
                  <div className="mt-4 pt-4 border-t border-primary-foreground/20">
                    <p className="text-body text-primary-foreground/80">{t['common.no_active_subscription'] || 'No active subscription'}</p>
                  </div>
                )}

                {isOnTrial && trialEndsAt && (
                  <div className="mt-4 p-3 bg-amber-500/20 rounded-xl border border-amber-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={16} className="text-amber-200" />
                      <span className="text-caption font-semibold text-amber-100">
                        {t['subscription.trial_active'] || 'Trial Active'}
                      </span>
                    </div>
                    <p className="text-body text-amber-100">
                      {t['subscription.trial_ends'] || 'Your trial ends on'} {formatDate(trialEndsAt)}
                    </p>
                    <p className="text-caption text-amber-200/80 mt-1">
                      {getDaysRemaining(trialEndsAt)} {t['subscription.days_remaining'] || 'days remaining'}
                    </p>
                  </div>
                )}

                {subscriptionInfo?.status === 'active' && isAdmin && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isLoading}
                    className="w-full mt-4 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (t['common.processing'] || 'Processing...') : (t['common.cancel_subscription'] || 'Cancel Subscription')}
                  </button>
                )}
              </div>
            )}

            {/* Upgrade/Change Plan Section */}
            <div className="mb-6">
              <h3 className="text-title font-bold text-foreground mb-4">
                {subscriptionInfo && (subscriptionInfo.status === 'active' || subscriptionInfo.status === 'canceling') ? (t['subscription.change_plan'] || 'Change Plan') : (t['subscription.choose_plan'] || 'Choose Your Plan')}
              </h3>

              {!isAdmin && (
                <div className="mb-4 p-4 bg-muted rounded-xl border border-border">
                  <p className="text-body text-muted-foreground">
                    {t['subscription.admin_only'] || 'Only Admin can make changes to the subscription'}
                  </p>
                </div>
              )}

              {/* Billing Period Toggle */}
              <div className="mb-6 flex justify-center">
                <div className={`relative rounded-full overflow-hidden ${!isAdmin ? 'opacity-50' : ''}`} style={{ backgroundColor: 'hsl(var(--muted))' }}>
                  <div className="flex p-1">
                    <button
                      onClick={() => setBillingPeriod('monthly')}
                      disabled={!isAdmin}
                      className={`px-6 py-2 rounded-full font-semibold text-body transition-colors ${
                        billingPeriod === 'monthly'
                          ? 'bg-card text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      } ${!isAdmin ? 'cursor-not-allowed' : ''}`}
                    >
                      {t['common.monthly']}
                    </button>
                    <button
                      onClick={() => setBillingPeriod('yearly')}
                      disabled={!isAdmin}
                      className={`px-6 py-2 rounded-full font-semibold text-body transition-colors ${
                        billingPeriod === 'yearly'
                          ? 'bg-card text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      } ${!isAdmin ? 'cursor-not-allowed' : ''}`}
                    >
                      {t['common.yearly']}
                      <span className="ml-1 text-caption" style={{ color: 'hsl(var(--primary))' }}>{t['common.save_20_percent'] || 'Save 20%'}</span>
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
                  // For free plan, check if user has no active paid subscription
                  const isCurrentPlan = p.isFree 
                    ? (!subscriptionInfo?.plan || subscriptionInfo?.plan === 'free' || subscriptionInfo?.status !== 'active')
                    : (subscriptionInfo?.plan === p.id && (subscriptionInfo?.status === 'active' || subscriptionInfo?.status === 'canceling'));

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
                            {p.isFree ? (
                              <span className="text-display font-bold text-foreground">
                                {t['common.free'] || 'Free'}
                              </span>
                            ) : (
                              <>
                                <span className="text-display font-bold text-foreground">
                                  HK${price}
                                </span>
                                <span className="text-muted-foreground text-body">
                                  /{billingPeriod === 'monthly' ? t['common.mo'] : t['common.yr']}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isCurrentPlan && (
                            <span className="bg-primary text-primary-foreground text-caption font-bold px-3 py-1 rounded-full">
                              {t['common.current_plan'] || 'Current Plan'}
                            </span>
                          )}
                          {p.highlight && !isCurrentPlan && (
                            <span className="bg-primary text-primary-foreground text-caption font-bold px-3 py-1 rounded-full">
                              {t['common.popular'] || 'Popular'}
                            </span>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-2 mb-4">
                        {p.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-body text-muted-foreground">
                            <Check size={16} className="text-primary flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {/* Limitations for Free plan */}
                      {p.limitations && p.limitations.length > 0 && (
                        <ul className="space-y-2 mb-4">
                          {p.limitations.map((limitation, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-body text-muted-foreground/70">
                              <X size={16} className="text-muted-foreground/50 flex-shrink-0" />
                              {limitation}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Plan action buttons */}
                      {!p.isFree ? (
                        <button
                          onClick={() => handleOpenPlanConfirm(p.id as 'core' | 'pro' | 'test', billingPeriod)}
                          disabled={loadingPlan !== null || isCurrentPlan || !isAdmin}
                          className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                            isCurrentPlan
                              ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                              : !isAdmin
                              ? 'bg-muted text-muted-foreground cursor-not-allowed'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90'
                          }`}
                        >
                          {loadingPlan === p.id ? (t['common.processing'] || 'Processing...') : isCurrentPlan ? (t['common.current_plan'] || 'Current Plan') : !isAdmin ? (t['common.only_admin_can_change'] || 'Only Admin Can Change') : (t['common.change_plan'] || 'Select Plan')}
                        </button>
                      ) : (
                        <button
                          onClick={handleDowngradeToFree}
                          disabled={loadingPlan !== null || isCurrentPlan || !isAdmin}
                          className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                            isCurrentPlan
                              ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                              : !isAdmin
                              ? 'bg-muted text-muted-foreground cursor-not-allowed'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90'
                          }`}
                        >
                          {loadingPlan === 'free' ? (t['common.processing'] || 'Processing...') : isCurrentPlan ? (t['common.current_plan'] || 'Current Plan') : !isAdmin ? (t['common.only_admin_can_change'] || 'Only Admin Can Change') : (t['subscription.downgrade_to_free'] || 'Downgrade to Free')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Plan confirmation + promo code modal */}
          {isPlanConfirmOpen && pendingPlan && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end md:items-center justify-center bottom-sheet-backdrop">
              {/* Safe area bottom cover */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-card"
                style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
              />
              <div className="bg-card w-full max-w-md rounded-t-2xl md:rounded-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                {/* Header */}
                <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                  <h2 className="text-title text-foreground">{t['subscription.change_plan'] || 'Change Plan'}</h2>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                  <p className="text-body text-foreground">
                    {`You are about to upgrade to the ${getPlanDisplayName(pendingPlan.plan)} plan.`}
                  </p>

                  {/* Referral Code Section */}
                  <div className="space-y-2">
                    <label className="text-caption font-bold text-muted-foreground ml-1">
                      {t['subscription.referral_code'] || 'Referral Code (for free trial)'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={referralCodeInput}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setReferralCodeInput(value);
                          setReferralCodeError(null);
                          setReferralCodeValid(false);
                        }}
                        onBlur={() => validateReferralCode(referralCodeInput)}
                        className={`w-full bg-muted border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none transition-colors text-body uppercase ${
                          referralCodeError ? 'border-destructive' : referralCodeValid ? 'border-green-500' : 'border-border'
                        }`}
                      />
                      {isValidatingReferral && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {referralCodeValid && !isValidatingReferral && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Check size={20} className="text-green-500" />
                        </div>
                      )}
                    </div>
                    {referralCodeError && (
                      <p className="text-caption text-destructive">{referralCodeError}</p>
                    )}
                    {referralCodeValid && (
                      <p className="text-caption text-green-600">
                        {t['subscription.referral_valid'] || '✓ 30-day free trial will be applied!'}
                      </p>
                    )}
                  </div>

                  {/* Divider between referral and promo code */}
                  {referralCodeValid && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-caption">{t['common.or'] || 'or'}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  {/* Promo Code Section */}
                  <div className={`space-y-2 ${referralCodeValid ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="text-caption font-bold text-muted-foreground ml-1">
                      {t['subscription.promo_code'] || 'Promo code (optional)'}
                    </label>
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={(e) => {
                        setPromoCodeInput(e.target.value);
                        setPromoCodeError(null);
                      }}
                      placeholder={t['subscription.promo_code_placeholder'] || 'Enter promo code'}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none transition-colors text-body"
                    />
                    {promoCodeError && (
                      <p className="text-caption text-destructive">{promoCodeError}</p>
                    )}
                    <p className="text-caption text-muted-foreground">
                      {t['subscription.promo_code_hint'] || 'We will apply this code on the Stripe checkout page.'}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
                  <button
                    onClick={() => {
                      if (loadingPlan !== null) return;
                      setIsPlanConfirmOpen(false);
                      setPendingPlan(null);
                      setPromoCodeInput('');
                      setPromoCodeError(null);
                      setReferralCodeInput('');
                      setReferralCodeError(null);
                      setReferralCodeValid(false);
                    }}
                    disabled={loadingPlan !== null}
                    className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t['common.cancel'] || 'Cancel'}
                  </button>
                  <button
                    onClick={handleConfirmPlan}
                    disabled={loadingPlan !== null}
                    className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingPlan !== null ? (t['common.processing'] || 'Processing...') : (t['common.confirm'] || 'Confirm')}
                  </button>
                </div>
              </div>
            </div>
          )}

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
      <div className="min-h-screen bg-background pb-40 animate-fade-in">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          {renderSettingsHeader(t['common.security'] || 'Account', () => setActiveSection('settings'))}
          <div className="pt-6 pb-24">
            
            <div className="space-y-6">
              {/* Profile Information Section */}
              <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
                <h3 className="text-title font-bold text-foreground mb-4">{t['profile.profile_information'] || 'Profile Information'}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.first_name'] || 'First Name'}</label>
                      <input
                        type="text"
                        value={accountData.firstName}
                        onChange={e => setAccountData({ ...accountData, firstName: e.target.value })}
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none transition-colors text-body"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.last_name'] || 'Last Name'}</label>
                      <input
                        type="text"
                        value={accountData.lastName}
                        onChange={e => setAccountData({ ...accountData, lastName: e.target.value })}
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none transition-colors text-body"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.mobile_number'] || 'Mobile Number'}</label>
                    <div className="flex gap-2">
                      <div className="relative w-32 country-code-dropdown">
                        <input
                          type="text"
                          readOnly
                          value={accountData.countryCode}
                          onClick={() => setShowCountryCodeDropdown(true)}
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
                                placeholder={t['placeholder.search_country'] || 'Search country...'}
                                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-body focus:outline-none focus:border-primary transition-colors"
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
                                <div className="px-4 py-2 text-body text-muted-foreground">{t['info.no_countries_found'] || 'No countries found'}</div>
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
                          placeholder={t['placeholder.mobile_number'] || 'Mobile number'}
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
                <h3 className="text-title font-bold text-foreground mb-4">{t['profile.email_password'] || 'Email & Password'}</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.email_address'] || 'Email Address'}</label>
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
                      <p className="text-caption text-muted-foreground mt-1 ml-1">{t['profile.email_managed_by_google'] || 'Email managed by Google account'}</p>
                    )}
                  </div>
                  
                  {!isGoogleAuth && (
                    <>
                      <div className="space-y-1">
                        <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.current_password'] || 'Current Password'}</label>
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
                        <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.new_password'] || 'New Password'}</label>
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
                <h3 className="text-title font-bold text-foreground mb-4">{t['profile.notifications'] || 'Notifications'}</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                        <Bell size={20} className="text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-body">{t['profile.enable_notifications'] || 'Enable Notifications'}</p>
                        <p className="text-caption text-muted-foreground">
                          {!pushSupported 
                            ? (t['settings.push_not_supported'] || 'Not supported in this browser')
                            : pushPermission === 'denied'
                            ? (t['settings.push_blocked'] || 'Blocked - enable in browser settings')
                            : (t['settings.push_description'] || 'Get notified when family adds items')}
                        </p>
                      </div>
                    </div>
                    <button
                      disabled={!pushSupported || pushPermission === 'denied' || isTogglingNotifications}
                      onClick={async () => {
                        if (!pushSupported || pushPermission === 'denied') return;
                        
                        setIsTogglingNotifications(true);
                        isTogglingRef.current = true; // Set ref to prevent useEffect from resetting
                        const newValue = !accountData.notificationsEnabled;
                        
                        try {
                          if (newValue) {
                            // Enable notifications - subscribe to push
                            // Update local state first for immediate UI feedback
                            setAccountData({ ...accountData, notificationsEnabled: true });
                            
                            // IMPORTANT: Subscribe to push FIRST, before updating DB
                            // This prevents race condition where DB update triggers refetch 
                            // before subscription is saved
                            let subscriptionSuccess = false;
                            try {
                              const subscription = await subscribeToPush(
                                currentUser.id,
                                currentUser.householdId
                              );
                              
                              if (subscription) {
                                console.log('[Profile] Successfully subscribed to push notifications');
                                subscriptionSuccess = true;
                              } else {
                                console.warn('[Profile] Failed to subscribe to push notifications');
                              }
                              setPushPermission(getNotificationPermission());
                            } catch (subError) {
                              console.error('[Profile] Error subscribing to push:', subError);
                              setPushPermission(getNotificationPermission());
                            }
                            
                            // Now update database (this triggers refetch, but subscription is already saved)
                            await onUpdate(currentUser.id, { notificationsEnabled: true });
                            
                            if (!subscriptionSuccess) {
                              console.warn('[Profile] notifications_enabled is set to true but push subscription failed');
                            }
                          } else {
                            // Disable notifications - unsubscribe from push
                            // Update local state first
                            setAccountData({ ...accountData, notificationsEnabled: false });
                            
                            // Save to database immediately
                            await onUpdate(currentUser.id, { notificationsEnabled: false });
                            
                            // Then unsubscribe (non-blocking)
                            try {
                              await unsubscribeFromPush(currentUser.id, currentUser.householdId);
                              console.log('[Profile] Successfully unsubscribed from push notifications');
                            } catch (unsubError) {
                              console.error('[Profile] Error unsubscribing from push:', unsubError);
                              // DB is already updated, so continue
                            }
                          }
                        } catch (error) {
                          console.error('[Profile] Error toggling notifications:', error);
                          // Revert local state on error
                          setAccountData({ ...accountData, notificationsEnabled: !newValue });
                          // Show error to user (you could add a toast notification here)
                          setIsTogglingNotifications(false);
                          isTogglingRef.current = false;
                          return;
                        }
                        // Delay clearing toggling flag to let real-time update propagate
                        // This prevents the toggle from flipping back during the sync
                        setTimeout(() => {
                          isTogglingRef.current = false;
                          setIsTogglingNotifications(false);
                        }, 800);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        !pushSupported || pushPermission === 'denied'
                          ? 'bg-muted-foreground/20 cursor-not-allowed'
                          : accountData.notificationsEnabled 
                          ? 'bg-primary' 
                          : 'bg-muted-foreground/30'
                      }`}
                    >
                      {isTogglingNotifications ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Loader2 size={14} className="animate-spin text-muted-foreground" />
                        </span>
                      ) : (
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            accountData.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      )}
                    </button>
                  </div>
                  
                  {/* Permission blocked message */}
                  {pushSupported && pushPermission === 'denied' && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mt-2">
                      <p className="text-caption text-destructive">
                        Notifications are blocked. To enable them, go to your browser settings and allow notifications for this site.
                      </p>
                    </div>
                  )}
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
                    email: accountData.email,
                    notificationsEnabled: accountData.notificationsEnabled
                  };
                  
                  // Only include countryCode if it exists (database doesn't have this column)
                  // The service will filter it out anyway, but we can avoid sending it
                  // Note: countryCode is stored in phone_number format or can be omitted
                  
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

              {/* Delete Account Button - Available for all users */}
              <button
                onClick={handleDeleteAccountClick}
                className="w-full bg-destructive/10 text-destructive py-4 rounded-xl font-semibold shadow-sm hover:bg-destructive/20 transition-colors border border-destructive/20"
              >
                {t['profile.delete_account'] || 'Delete Account'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="helpy-footer">
            <span className="helpy-logo">helpy</span>
          </div>
        </div>

        {/* First Delete Confirmation Modal */}
        {isDeleteAccountModalOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
            {/* Safe area bottom cover */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-card"
              style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
            />
            <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
              {/* Header */}
              <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                <h2 className="text-title text-foreground">{t['profile.delete_account'] || 'Delete Account'}</h2>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-body text-muted-foreground">
                  {t['confirm.delete_account'] || 'Are you sure you want to delete your account? This change will be permanent.'}
                </p>
              </div>

              {/* Footer */}
              <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
                <button
                  onClick={() => setIsDeleteAccountModalOpen(false)}
                  className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFirstDeleteConfirm}
                  className="flex-1 py-3.5 rounded-xl bg-destructive/10 text-destructive text-body hover:bg-destructive/20 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Final Delete Confirmation Modal */}
        {isFinalDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
            {/* Safe area bottom cover */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-card"
              style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
            />
            <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
              {/* Header */}
              <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                <h2 className="text-title text-foreground">{t['profile.delete_account'] || 'Delete Account'}</h2>
              </div>

              {/* Content */}
              <div className="p-5">
                {subscriptionInfo?.status === 'active' && subscriptionInfo?.periodEnd && (
                  <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-body text-primary font-semibold mb-1">{t['profile.subscription_info'] || 'Subscription Information'}</p>
                    <p className="text-body text-primary">
                      {t['subscription.active_until'] || 'Your subscription is active until'} {formatDate(subscriptionInfo.periodEnd)}
                    </p>
                  </div>
                )}
                <p className="text-body text-muted-foreground">
                  {t['confirm.delete_account_final'] || 'Are you sure you want to delete? After deletion it will be immediate.'}
                </p>
              </div>

              {/* Footer */}
              <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
                <button
                  onClick={() => {
                    setIsFinalDeleteConfirmOpen(false);
                    setIsDeletingAccount(false);
                  }}
                  disabled={isDeletingAccount}
                  className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSelfAccount}
                  disabled={isDeletingAccount}
                  className="flex-1 py-3.5 rounded-xl bg-destructive text-destructive-foreground text-body hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingAccount ? (t['common.deleting'] || 'Deleting...') : (t['profile.delete_account'] || 'Delete Account')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Admin Delete Options Modal */}
        {isAdminDeleteOptionsOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
            {/* Safe area bottom cover */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-card"
              style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
            />
            <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
              {/* Header */}
              <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                <h2 className="text-title text-foreground">{t['profile.delete_account'] || 'Delete Account'}</h2>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                <p className="text-body text-muted-foreground mb-4">
                  {t['profile.admin_delete_options_desc'] || 'As the household admin, you have two options:'}
                </p>
                
                {/* Deactivate Option */}
                <button
                  onClick={() => {
                    setIsAdminDeleteOptionsOpen(false);
                    if (eligibleNewOwners.length === 0) {
                      alert(t['error.no_eligible_owners'] || 'No eligible family members to transfer ownership to. You can only delete the entire household.');
                      return;
                    }
                    setIsTransferOwnershipOpen(true);
                  }}
                  className="w-full p-4 rounded-xl border border-border bg-card hover:bg-secondary transition-colors text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Share2 size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-body">{t['profile.deactivate_account'] || 'Deactivate My Account'}</p>
                      <p className="text-caption text-muted-foreground mt-1">
                        {t['profile.deactivate_desc'] || 'Transfer ownership to another family member and remove your account. The household will continue with the new admin.'}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Delete Household Option */}
                <button
                  onClick={() => {
                    setIsAdminDeleteOptionsOpen(false);
                    setIsDeleteHouseholdConfirmOpen(true);
                  }}
                  className="w-full p-4 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Trash2 size={20} className="text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold text-destructive text-body">{t['profile.delete_household'] || 'Delete Entire Household'}</p>
                      <p className="text-caption text-muted-foreground mt-1">
                        {t['profile.delete_household_desc'] || 'Permanently delete your account and ALL family members. This action cannot be undone.'}
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Footer */}
              <div className="p-5 pb-8 border-t border-border shrink-0">
                <button
                  onClick={() => setIsAdminDeleteOptionsOpen(false)}
                  className="w-full py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors"
                >
                  {t['common.cancel'] || 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transfer Ownership Modal */}
        {isTransferOwnershipOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
            {/* Safe area bottom cover */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-card"
              style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
            />
            <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col max-h-[80vh]" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
              {/* Header */}
              <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                <h2 className="text-title text-foreground">{t['profile.transfer_ownership'] || 'Transfer Ownership'}</h2>
              </div>

              {/* Content */}
              <div className="p-5 flex-1 overflow-y-auto">
                <p className="text-body text-muted-foreground mb-4">
                  {t['profile.select_new_owner'] || 'Select a family member to become the new household admin:'}
                </p>
                
                <div className="space-y-2">
                  {eligibleNewOwners.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedNewOwnerId(user.id)}
                      className={`w-full p-4 rounded-xl border transition-colors text-left flex items-center gap-3 ${
                        selectedNewOwnerId === user.id 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border bg-card hover:bg-secondary'
                      }`}
                    >
                      {/* Avatar */}
                      <Avatar
                        user={user}
                        size="md"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-foreground text-body">{user.name}</p>
                        <p className="text-caption text-muted-foreground">{user.role}</p>
                      </div>
                      {selectedNewOwnerId === user.id && (
                        <CheckCircle size={20} className="text-primary" />
                      )}
                    </button>
                  ))}
                </div>

                {eligibleNewOwners.length === 0 && (
                  <div className="p-4 bg-muted rounded-xl">
                    <p className="text-body text-muted-foreground">
                      {t['profile.no_eligible_members'] || 'No eligible family members found. Only active members with Spouse, Helper, or Other roles can become the new admin.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
                <button
                  onClick={() => {
                    setIsTransferOwnershipOpen(false);
                    setSelectedNewOwnerId(null);
                    setIsDeactivatingAdmin(false);
                  }}
                  disabled={isDeactivatingAdmin}
                  className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  {t['common.cancel'] || 'Cancel'}
                </button>
                <button
                  onClick={handleAdminDeactivate}
                  disabled={!selectedNewOwnerId || isDeactivatingAdmin}
                  className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeactivatingAdmin ? (t['common.transferring'] || 'Transferring...') : (t['profile.transfer_and_leave'] || 'Transfer & Leave')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Household Confirmation Modal */}
        {isDeleteHouseholdConfirmOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
            {/* Safe area bottom cover */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-card"
              style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
            />
            <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
              {/* Header */}
              <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle size={20} className="text-destructive" />
                  <h2 className="text-title text-destructive">{t['profile.warning'] || 'Warning'}</h2>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <p className="text-body text-destructive font-semibold mb-2">
                    {t['profile.permanent_delete_warning'] || 'This action is permanent and cannot be undone!'}
                  </p>
                  <p className="text-body text-foreground">
                    {t['profile.delete_household_warning'] || 'You are about to delete:'}
                  </p>
                  <ul className="mt-2 space-y-1 text-body text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="text-destructive">•</span>
                      {t['profile.your_account'] || 'Your account'}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-destructive">•</span>
                      {users.length > 1 
                        ? `${users.length - 1} ${t['profile.other_family_members'] || 'other family member(s)'}`
                        : t['profile.all_household_data'] || 'All household data'}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-destructive">•</span>
                      {t['profile.all_data_items'] || 'All meals, expenses, tasks, and household info'}
                    </li>
                  </ul>
                </div>
                
                <p className="text-body text-muted-foreground">
                  {t['profile.all_members_logged_out'] || 'All family members will be logged out and will no longer be able to access the household.'}
                </p>
              </div>

              {/* Footer */}
              <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
                <button
                  onClick={() => {
                    setIsDeleteHouseholdConfirmOpen(false);
                    setIsDeletingAccount(false);
                  }}
                  disabled={isDeletingAccount}
                  className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  {t['common.cancel'] || 'Cancel'}
                </button>
                <button
                  onClick={handleDeleteHousehold}
                  disabled={isDeletingAccount}
                  className="flex-1 py-3.5 rounded-xl bg-destructive text-destructive-foreground text-body hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {isDeletingAccount ? (t['common.deleting'] || 'Deleting...') : (t['profile.delete_all'] || 'Delete All')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Cancellation Confirmation Modal */}
        {subscriptionCanceled && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
            {/* Safe area bottom cover */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-card"
              style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
            />
            <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
              {/* Header */}
              <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                <h2 className="text-title text-foreground">{t['profile.subscription_canceled'] || 'Subscription Canceled'}</h2>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="mb-4 flex justify-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <CheckCircle size={32} className="text-primary" />
                  </div>
                </div>
                <p className="text-body text-foreground mb-4">
                  {t['subscription.canceled_success'] || 'Your subscription has been successfully canceled.'}
                </p>
                <div className="p-4 bg-muted rounded-xl border border-border">
                  <p className="text-caption text-muted-foreground mb-2">{t['profile.what_happens_next'] || 'What happens next?'}</p>
                  <ul className="text-body text-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{t['profile.access_until_end'] || "You'll continue to have access to premium features until the end of your current billing period."}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{t['profile.revert_to_free'] || 'After that, your account will automatically revert to the free plan.'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{t['profile.resubscribe_anytime'] || 'You can resubscribe at any time from your profile settings.'}</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 pb-8 border-t border-border shrink-0">
                <button
                  onClick={() => {
                    setSubscriptionCanceled(false);
                    // Refresh subscription info
                    fetchSubscriptionInfo();
                  }}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body hover:bg-primary/90 transition-colors font-semibold"
                >
                  Got it
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
      <div className="min-h-screen bg-background pb-40 animate-fade-in">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          {renderSettingsHeader(t['common.payment'] || 'Payment', () => setActiveSection('settings'))}
          <div className="pt-6 pb-24">

            {/* Card Preview */}
            <div className="mt-6 mb-6">
              <div 
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{
                  aspectRatio: '1.586 / 1',
                  background: paymentData.cardType === 'DEBIT' 
                    ? 'linear-gradient(135deg, #F06292 0%, #C74B7A 50%, #9C3D62 100%)'
                    : paymentData.cardType === 'PREPAID'
                    ? 'linear-gradient(135deg, #FF9800 0%, #E68A00 50%, #CC7A00 100%)'
                    : 'linear-gradient(135deg, #3EAFD2 0%, #2D8BAA 50%, #1E6B85 100%)',
                  boxShadow: paymentData.cardType === 'DEBIT'
                    ? '0 16px 32px -12px rgba(240, 98, 146, 0.35), 0 6px 12px -6px rgba(240, 98, 146, 0.2)'
                    : paymentData.cardType === 'PREPAID'
                    ? '0 16px 32px -12px rgba(255, 152, 0, 0.35), 0 6px 12px -6px rgba(255, 152, 0, 0.2)'
                    : '0 16px 32px -12px rgba(62, 175, 210, 0.35), 0 6px 12px -6px rgba(62, 175, 210, 0.2)'
                }}
              >
                {/* Oversized branded "h" watermark */}
                <div 
                  className="absolute -top-8 -right-4 text-white/10 select-none pointer-events-none"
                  style={{ 
                    fontFamily: "'Peanut Butter', cursive",
                    fontSize: '270px',
                    lineHeight: 1
                  }}
                >
                  h
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 pointer-events-none"></div>
                
                {/* Card content */}
                <div className="relative h-full flex flex-col justify-between">
                  <div className="flex justify-end">
                    <span className="text-xs font-mono bg-white/20 backdrop-blur-sm px-2 py-1 rounded text-white/90">{paymentData.cardType}</span>
                  </div>
                  
                  <div className="mt-auto">
                    <div className="text-lg font-mono tracking-[0.2em] mb-3 text-white drop-shadow-sm">
                      {paymentData.cardNumber || '•••• •••• •••• ••••'}
                    </div>
                    <div className="flex justify-between text-sm">
                      <div>
                        <div className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">{t['profile.card_holder'] || 'Card Holder'}</div>
                        <div className="text-white font-medium drop-shadow-sm">{paymentData.name || 'YOUR NAME'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">{t['profile.card_expires'] || 'Expires'}</div>
                        <div className="text-white font-medium drop-shadow-sm">{paymentData.expiry || 'MM/YY'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-card p-6 rounded-2xl shadow-sm border border-border">
              <div className="space-y-1">
                <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.card_number'] || 'Card Number'}</label>
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
                  <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.expiry'] || 'Expiry'}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={t['placeholder.mm_yy'] || 'MM/YY'}
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
                <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.cardholder_name'] || 'Cardholder Name'}</label>
                <input
                  type="text"
                  placeholder={t['placeholder.name_on_card'] || 'Name on card'}
                  value={paymentData.name}
                  onChange={e => setPaymentData({ ...paymentData, name: e.target.value })}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium text-body focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.card_type'] || 'Card Type'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DEBIT', 'CREDIT', 'PREPAID'] as const).map(type => {
                    const isSelected = paymentData.cardType === type;
                    const colorMap = {
                      DEBIT: { bg: '#F06292', text: 'white' },
                      CREDIT: { bg: '#3EAFD2', text: 'white' },
                      PREPAID: { bg: '#FF9800', text: 'white' }
                    };
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPaymentData({ ...paymentData, cardType: type })}
                        className={`px-3 py-2.5 rounded-xl text-body font-medium transition-all ${
                          !isSelected ? 'bg-muted text-muted-foreground border border-border' : ''
                        }`}
                        style={isSelected ? { backgroundColor: colorMap[type].bg, color: colorMap[type].text } : {}}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4">
              <button onClick={() => setActiveSection('settings')} className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors">
                {t['profile.save_payment'] || 'Save Payment Method'}
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
      <div className="min-h-screen bg-background pb-40 animate-fade-in">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          {renderSettingsHeader(t['common.settings'] || 'Settings', () => setActiveSection('main'))}
          <div className="pt-6 pb-24">

            <div className="bg-card rounded-3xl shadow-sm overflow-hidden">
              {[
                { id: 'plan', label: t['common.plan'] || 'Subscription', icon: Crown, helperHidden: true },
                { id: 'security', label: t['common.security'] || 'Account', icon: Shield, helperHidden: false },
                { id: 'payment', label: t['common.payment'] || 'Payment', icon: CreditCard, helperHidden: true },
              ]
                .filter(item => !isHelper || !item.helperHidden)
                .map((item, index, filteredArray) => (
                <div key={item.id}>
                  <button
                    onClick={() => setActiveSection(item.id as any)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className="text-primary" />
                      <p className="font-bold text-foreground text-title">{item.label}</p>
                    </div>
                    <ChevronRight size={20} className="text-muted-foreground" />
                  </button>
                  {index < filteredArray.length - 1 && (
                    <div className="mx-5 border-t border-border" />
                  )}
                </div>
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