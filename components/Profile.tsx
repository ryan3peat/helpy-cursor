import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle, AlertTriangle, Heart, Settings, Plus, Trash2, X, Save, Camera,
  Image as ImageIcon, LogOut, Copy, Check, ChevronLeft, ChevronRight, ArrowLeft,
  Shield, Lock, Crown, Mail, Share2, Bell, BellOff, Phone, CheckCircle, Loader2, GraduationCap,
  MessageCircleQuestionMark, Palette, Monitor, BookOpen, Pencil, CircleStar,
  MoreVertical, Globe
} from 'lucide-react';
import FeedbackSection from './FeedbackSection';
import UserGuide from './UserGuide';
import { useUser } from '@clerk/clerk-react';
import { User, UserRole, BaseViewProps } from '../types';
import { createInvite } from '../services/inviteService';
import { createCheckoutSession, createPortalSession, syncSubscription, changeSubscription, downgradeToFree } from '../services/stripeService';
import { useSupabase } from '../contexts/SupabaseContext';
import { deleteItem, uploadAvatarImage } from '../services/supabaseService';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useSheetTheme } from '@/hooks/useSheetTheme';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  hasActiveSubscription,
  checkNotificationCapability
} from '../services/pushNotificationService';
import { compressImageForAvatar } from '../utils/imageCompression';
import { getRoleConfig } from '../config/rolePermissions';
import { isRunningAsPwa, isIosDevice, isAndroidDevice } from '../utils/pwaUtils';
import { useDemoMode } from '../contexts/DemoModeContext';

interface ProfileProps extends BaseViewProps {
  users: User[];
  onAdd: (user: Omit<User, 'id'>) => Promise<User | undefined>;
  onUpdate: (id: string, data: Partial<User>) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  currentUser: User;
  onLogout: () => void;
  initialEditUserId?: string; // If set, opens edit modal for this user on mount
  onRestartTutorial?: () => void; // Restart the onboarding tutorial
}

// Role priority for consistent sorting across all family members
// Uses lowercase keys for case-insensitive matching
const ROLE_PRIORITY: Record<string, number> = {
  'superadmin': 0,
  'admin': 1,
  'spouse': 2,
  'helper': 3,
  'child': 4,
  'other': 5,
};

// Helper function to get role priority (case-insensitive)
const getRolePriority = (role: string): number => {
  return ROLE_PRIORITY[role.toLowerCase()] ?? 99;
};

// localStorage key for caching household name
const HOUSEHOLD_NAME_CACHE_KEY = 'helpy_household_name';

const Profile: React.FC<ProfileProps> = ({
  users, onAdd, onUpdate, onDelete, onBack, currentUser, onLogout, t, currentLang, initialEditUserId, onRestartTutorial
}) => {
  // ─────────────────────────────────────────────────────────────────
  // Role-based permissions
  // ─────────────────────────────────────────────────────────────────
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  const { isViewingAsHelper } = useDemoMode();
  // isHelper: true if actual Helper OR SuperAdmin viewing as Helper
  const isHelper = currentUser.role === UserRole.HELPER || (isSuperAdmin && isViewingAsHelper);
  
  // Get authenticated Supabase client (with JWT for RLS)
  const supabase = useSupabase();

  // Navigation State
  const [activeSection, setActiveSection] = useState<'main' | 'settings' | 'plan' | 'security' | 'payment' | 'appearance' | 'feedback' | 'guide'>('main');

  // Check if we should navigate to a specific section (e.g., from Expenses upgrade button or Home user guide)
  useEffect(() => {
    const targetSection = localStorage.getItem('helpy_profile_target_section');
    if (targetSection === 'plan') {
      // Navigate through settings first, then to plan
      setActiveSection('settings');
      setTimeout(() => setActiveSection('plan'), 100);
      // Clear the flag
      localStorage.removeItem('helpy_profile_target_section');
    } else if (targetSection === 'guide') {
      // Navigate through settings first, then to guide
      setActiveSection('settings');
      setTimeout(() => setActiveSection('guide'), 100);
      // Clear the flag
      localStorage.removeItem('helpy_profile_target_section');
    } else if (targetSection === 'add_family') {
      // Open the Add Family Member sheet directly
      setIsAddModalOpen(true);
      // Clear the flag
      localStorage.removeItem('helpy_profile_target_section');
    }
    
    // Check if we should select a specific user (e.g., from Family Info pencil icon)
    const editUserId = localStorage.getItem('helpy_profile_edit_user_id');
    if (editUserId) {
      // Verify the user exists in the users list before selecting
      const userExists = users.some(u => u.id === editUserId);
      if (userExists) {
        setSelectedUserId(editUserId);
      }
      // Clear the flag
      localStorage.removeItem('helpy_profile_edit_user_id');
    }
  }, []);

  // Main Profile State
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
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
  const [newRole, setNewRole] = useState<UserRole>(UserRole.SPOUSE);
  const [addUserStep, setAddUserStep] = useState<'form' | 'loading' | 'success' | 'invite' | 'limit_error'>('form');
  const [addedUserName, setAddedUserName] = useState('');
  const [limitErrorMessage, setLimitErrorMessage] = useState('');

  // Settings State
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'core' | 'pro'>('free');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<'free' | 'core' | 'pro' | 'test' | null>(null);
  
  // Plan confirmation modal state (for promo/referral codes)
  const [isPlanConfirmOpen, setIsPlanConfirmOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{ plan: 'core' | 'pro' | 'test'; period: 'monthly' | 'yearly' } | null>(null);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralCodeError, setReferralCodeError] = useState<string | null>(null);
  const [referralCodeValid, setReferralCodeValid] = useState(false);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    plan: string;
    status: string;
    periodEnd?: string;
    period?: string;
    isTrial?: boolean;
    trialEndsAt?: string;
    cancelAtPeriodEnd?: boolean;
  } | null>(null);
  
  // Household limits for family member quota
  const [householdLimits, setHouseholdLimits] = useState<{
    maxFamily: number;
    maxHelpers: number;
  }>({ maxFamily: 3, maxHelpers: 1 }); // Default to free plan limits
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const hasLoadedSubscriptionRef = useRef(false); // Track if we've loaded subscription info at least once
  const isHandlingStripeReturnRef = useRef(false); // Prevent double-fetch when returning from Stripe
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isFinalDeleteConfirmOpen, setIsFinalDeleteConfirmOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [subscriptionCanceled, setSubscriptionCanceled] = useState(false);

  // Downgrade confirmation modal state
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [pendingDowngrade, setPendingDowngrade] = useState<{
    type: 'paid_to_paid' | 'paid_to_free';
    targetPlan?: 'core' | 'pro';
    targetPeriod?: 'monthly' | 'yearly';
  } | null>(null);

  // Cancel subscription confirmation modal state
  const [showCancelSubConfirm, setShowCancelSubConfirm] = useState(false);

  // Generic alert modal state (replaces native alert())
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'success' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'info' });
  
  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };
  
  const closeAlert = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
  };

  // Push Notification State
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const isTogglingRef = useRef(false); // Ref version to check in useEffect without triggering re-runs
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [pushSupported, setPushSupported] = useState(true);

  // Carousel scroll state
  const carouselScrollRef = useRef<HTMLDivElement>(null);
  const [activeCarouselDot, setActiveCarouselDot] = useState(0);

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
  useScrollLock(isAddModalOpen || isEditModalOpen || deleteConfirmOpen || showPhotoOptions || subscriptionCanceled || isPlanConfirmOpen || showDowngradeModal || showCancelSubConfirm || alertModal.isOpen);
  
  // Dim status bar when sheet is open (iOS)
  useSheetTheme(isAddModalOpen || isEditModalOpen || deleteConfirmOpen || showPhotoOptions || subscriptionCanceled || isPlanConfirmOpen || isDeleteAccountModalOpen || isFinalDeleteConfirmOpen || showDowngradeModal || showCancelSubConfirm || alertModal.isOpen);

  // Track if we've handled the initial edit (to prevent re-opening on data refresh)
  const [initialEditHandled, setInitialEditHandled] = useState(false);
  
  // Handle initial edit user ID (from external navigation like Helper Management)
  useEffect(() => {
    // Only process once, and only if not already handled
    if (initialEditUserId && !initialEditHandled) {
      const userToEdit = users.find(u => u.id === initialEditUserId);
      if (userToEdit) {
        // Set selected user and open edit modal
        setSelectedUserId(initialEditUserId);
        setEditName(userToEdit.name);
        setEditRole(userToEdit.role);
        setEditAllergies([...(userToEdit.allergies || [])]);
        setEditPreferences([...(userToEdit.preferences || [])]);
        
        setIsEditModalOpen(true);
        setInitialEditHandled(true); // Mark as handled to prevent re-opening
      }
    }
  }, [initialEditUserId, users, initialEditHandled]);

  // Pre-fetch subscription info on component mount (for admins)
  // This eliminates latency when navigating to the Plan page
  React.useEffect(() => {
    // Skip if we're handling Stripe return (that handler will fetch after sync)
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const portalReturn = urlParams.get('portal_return') || hashParams.get('portal_return');
    const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
    const success = urlParams.get('success') || hashParams.get('success');
    
    if (portalReturn === 'true' || sessionId || success === 'true') {
      // Let the Stripe return handler manage the fetch after sync
      return;
    }
    
    if (currentUser?.householdId && (currentUser?.role === UserRole.MASTER || currentUser?.role === UserRole.SUPERADMIN)) {
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
    
    // Ensure we have an authenticated client
    if (!supabase) {
      console.warn('[Profile] No Supabase client available for fetching subscription info');
      setIsLoadingSubscription(false);
      return false;
    }
    
    try {
      // Only show loading spinner on initial fetch (when we have no data yet)
      if (showLoading && !hasLoadedSubscriptionRef.current) {
        setIsLoadingSubscription(true);
      }
      const { data, error } = await supabase
        .from('households')
        .select('name, subscription_plan, subscription_status, subscription_current_period_end, subscription_period, max_family_members, max_helpers, is_trial, trial_ends_at, cancel_at_period_end')
        .eq('id', currentUser.householdId)
        .maybeSingle();

      // maybeSingle() returns null if no rows found (instead of throwing error)
      if (error) throw error;
      
      // If no household found, silently return (user may not have access or household doesn't exist)
      if (!data) {
        return false;
      }

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
        
        const newSubscriptionInfo = {
          plan: data.subscription_plan || 'free',
          status: data.subscription_status || 'inactive',
          periodEnd: data.subscription_current_period_end,
          period: data.subscription_period || 'monthly',
          isTrial: data.is_trial || false,
          trialEndsAt: data.trial_ends_at || undefined,
          cancelAtPeriodEnd: data.cancel_at_period_end || false
        };
        
        console.log('[Profile] Updating subscriptionInfo state:', newSubscriptionInfo);
        
        // Mark as loaded
        hasLoadedSubscriptionRef.current = true;
        
        // Update all subscription-related state
        setSubscriptionInfo(newSubscriptionInfo);
        setSelectedPlan((data.subscription_plan || 'free') as 'free' | 'core' | 'pro');
        setBillingPeriod((data.subscription_period || 'monthly') as 'monthly' | 'yearly');
        
        // Update household limits
        setHouseholdLimits({
          maxFamily: data.max_family_members ?? 3,
          maxHelpers: data.max_helpers ?? 1
        });
        
        console.log('[Profile] State updated - subscriptionInfo should now be:', newSubscriptionInfo);
        
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
  }, [currentUser?.householdId, supabase]); // Include supabase in dependencies

  // Check for Stripe checkout redirect and refetch subscription info
  React.useEffect(() => {
    if (!currentUser?.householdId) return;

    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
    const success = urlParams.get('success') || hashParams.get('success');
    const portalReturn = urlParams.get('portal_return') || hashParams.get('portal_return');

    // If we just returned from Stripe portal, sync and check subscription status
    if (portalReturn === 'true') {
      // Mark that we're handling Stripe return to prevent double-fetch
      isHandlingStripeReturnRef.current = true;
      
      // Show loading state while syncing from Stripe
      setIsLoadingSubscription(true);
      
      // Clear URL parameters first to prevent re-triggering
      const newUrl = window.location.pathname + (window.location.hash.split('?')[0] || '');
      window.history.replaceState({}, document.title, newUrl);
      
      // Navigate to subscription page
      setActiveSection('plan');

      // Sync subscription from Stripe to get latest status (including cancel_at_period_end)
      // IMPORTANT: Sync FIRST, then fetch - to ensure we get the latest cancel_at_period_end value
      const syncAfterPortal = async () => {
        try {
          console.log('[Profile] ====== PORTAL RETURN SYNC START ======');
          console.log('[Profile] Syncing subscription after portal return for household:', currentUser.householdId);
          
          // Call sync-subscription to get latest from Stripe FIRST
          const syncResult = await syncSubscription(currentUser.householdId);
          console.log('[Profile] Sync API result:', JSON.stringify(syncResult));
          
          // Small delay to ensure database update is committed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // NOW fetch updated subscription info from database (with loading = false to not show spinner)
          console.log('[Profile] Fetching updated subscription info from database...');
          await fetchSubscriptionInfo(0, false);
          
          // Check if subscription was fully canceled (status changed)
          if (!supabase) {
            console.log('[Profile] No supabase client available');
            return;
          }
          
          const { data, error } = await supabase
            .from('households')
            .select('subscription_status, subscription_plan, cancel_at_period_end, is_trial')
            .eq('id', currentUser.householdId)
            .maybeSingle();
          
          console.log('[Profile] Direct database query result:', JSON.stringify(data));
          if (error) {
            console.error('[Profile] Database query error:', error);
          }
          
          console.log('[Profile] cancel_at_period_end value:', data?.cancel_at_period_end);
          console.log('[Profile] subscription_status value:', data?.subscription_status);
          
          if (data) {
            // Show canceled modal if subscription is fully canceled (not just cancel_at_period_end)
            if (data.subscription_status === 'canceled' || data.subscription_status === 'inactive') {
              console.log('[Profile] Showing subscription canceled modal');
              setSubscriptionCanceled(true);
            }
          }
          
          console.log('[Profile] ====== PORTAL RETURN SYNC END ======');
        } catch (error) {
          console.error('[Profile] Error syncing after portal return:', error);
          // Still try to fetch local data
          await fetchSubscriptionInfo(0, false);
        }
      };
      
      // Sync from Stripe FIRST, then fetch - ensures we have the latest cancel_at_period_end value
      // Don't fetch stale data first, as it shows the wrong button state
      syncAfterPortal().finally(() => {
        // Reset the flag after sync is complete
        isHandlingStripeReturnRef.current = false;
      });
      
      return; // Don't process other URL params
    }

    // If we just returned from Stripe checkout
    if (sessionId || success === 'true') {
      // Mark that we're handling Stripe return to prevent double-fetch
      isHandlingStripeReturnRef.current = true;
      
      // Navigate to subscription page
      setActiveSection('settings');
      // Small delay to allow settings to render, then navigate to plan
      setTimeout(() => setActiveSection('plan'), 100);

      // Clear URL parameters
      const newUrl = window.location.pathname + (window.location.hash.split('?')[0] || '');
      window.history.replaceState({}, document.title, newUrl);

      // Show success message
      setSubscriptionSuccess(true);

      // Actively sync subscription from Stripe (don't rely solely on webhook)
      const syncAndFetch = async () => {
        console.log('[Profile] Syncing subscription after checkout...');
        
        // First, try to sync from Stripe API (this bypasses webhook)
        const syncResult = await syncSubscription(currentUser.householdId, sessionId || undefined);
        
        if (syncResult.success) {
          console.log('[Profile] Sync successful:', syncResult);
          // Small delay to ensure database update is committed
          await new Promise(resolve => setTimeout(resolve, 500));
          // Force refresh subscription info from database
          console.log('[Profile] Fetching subscription info after sync...');
          const refreshed = await fetchSubscriptionInfo(0, false);
          console.log('[Profile] Subscription info refreshed, active:', refreshed);
          // Give React time to process the state update
          await new Promise(resolve => setTimeout(resolve, 100));
          // Verify the state was updated by fetching once more
          console.log('[Profile] Verifying subscription info state...');
          await fetchSubscriptionInfo(0, false);
          setTimeout(() => setSubscriptionSuccess(false), 3000);
          isHandlingStripeReturnRef.current = false;
          return;
        }
        
        console.warn('[Profile] Sync failed, falling back to polling:', syncResult.error);
        isHandlingStripeReturnRef.current = false;
        
        // Fallback: poll for webhook to update (legacy behavior)
        const retryFetch = async (attempt: number = 0) => {
          const maxRetries = 5;
          const retryDelay = 2000;

          if (attempt >= maxRetries) {
            console.warn('Subscription update not detected after max retries');
            setSubscriptionSuccess(false);
            return;
          }

          const isActive = await fetchSubscriptionInfo(attempt);
          
          if (isActive) {
            setTimeout(() => setSubscriptionSuccess(false), 3000);
            return;
          }
          
          if (attempt < maxRetries) {
            setTimeout(() => retryFetch(attempt + 1), retryDelay);
          } else {
            setSubscriptionSuccess(false);
          }
        };

        // Start polling as fallback
        setTimeout(() => retryFetch(0), 1000);
      };

      // Run sync after a short delay (give checkout redirect time to complete)
      setTimeout(syncAndFetch, 500);
    }
  }, [currentUser?.householdId, fetchSubscriptionInfo]);

  // Fetch subscription info when navigating to plan/security sections (only if missing)
  React.useEffect(() => {
    // Skip if we're handling Stripe return (that handler will fetch)
    if (isHandlingStripeReturnRef.current) {
      return;
    }
    if ((activeSection === 'plan' || activeSection === 'security') && !subscriptionInfo) {
      fetchSubscriptionInfo();
    }
  }, [currentUser?.householdId, activeSection, subscriptionInfo, fetchSubscriptionInfo]);

  // Debug: Log subscriptionInfo changes to verify state updates
  React.useEffect(() => {
    console.log('[Profile] subscriptionInfo state changed:', subscriptionInfo);
  }, [subscriptionInfo]);
  
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Filter out invalid users and sort by role priority, then alphabetically
  const validUsers = React.useMemo(() => {
    return users
      .filter(u => u && u.id)
      .sort((a, b) => {
        // Use case-insensitive role priority lookup
        const priorityA = getRolePriority(a.role);
        const priorityB = getRolePriority(b.role);
        const roleDiff = priorityA - priorityB;
        if (roleDiff !== 0) return roleDiff;
        return a.name.localeCompare(b.name);
      });
  }, [users]);

  // Handle carousel scroll to update pagination dots
  useEffect(() => {
    const scrollContainer = carouselScrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
      // Calculate total items (Add button + users)
      const totalItems = (!isHelper ? 1 : 0) + validUsers.length;
      if (totalItems <= 1) return;
      
      // Each item is roughly 80px (64px avatar + 16px gap)
      const itemWidth = 80;
      const visibleItems = Math.floor(clientWidth / itemWidth);
      const totalDots = Math.max(1, totalItems - visibleItems + 1);
      
      // Calculate which dot should be active based on scroll position
      const maxScroll = scrollWidth - clientWidth;
      const scrollProgress = maxScroll > 0 ? scrollLeft / maxScroll : 0;
      const activeDot = Math.min(Math.round(scrollProgress * (totalDots - 1)), totalDots - 1);
      
      setActiveCarouselDot(activeDot);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    // Initial calculation
    handleScroll();
    
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [validUsers.length, isHelper]);

  // Calculate total member count for quota display (family + helpers combined)
  // Count ALL users (active + pending) since pending invites also consume quota slots
  const totalMemberCount = React.useMemo(() => {
    return users.filter(u => u && u.id).length;
  }, [users]);
  
  // Total slots = family slots + helper slots
  const totalMaxSlots = householdLimits.maxFamily + householdLimits.maxHelpers;
  
  // Check if at total member limit
  const isAtMemberLimit = totalMemberCount >= totalMaxSlots;

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
    // Use requestAnimationFrame to ensure DOM is ready, especially important for iOS Safari
    requestAnimationFrame(() => {
      // Scroll both window and document elements for better cross-browser compatibility
      // Direct assignment works better on iOS Safari than scrollTo with behavior
      if (window.scrollTo) {
        window.scrollTo(0, 0);
      }
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body) {
        document.body.scrollTop = 0;
      }
      
      // Additional scroll for iOS Safari - sometimes needs a small delay after render
      setTimeout(() => {
        if (window.scrollTo) {
          window.scrollTo(0, 0);
        }
        if (document.documentElement) {
          document.documentElement.scrollTop = 0;
        }
        if (document.body) {
          document.body.scrollTop = 0;
        }
      }, 10);
    });
  }, [activeSection]);

  const resetForm = () => {
    setNewName('');
    setNewRole(UserRole.SPOUSE);
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

  // Open plan confirmation modal (for new subscriptions with referral codes)
  const handleOpenPlanConfirm = (plan: 'core' | 'pro' | 'test', period: 'monthly' | 'yearly') => {
    setPendingPlan({ plan, period });
    setReferralCodeInput('');
    setReferralCodeError(null);
    setReferralCodeValid(false);
    setIsPlanConfirmOpen(true);
  };

  // Confirm plan selection from modal
  const handleConfirmPlan = async () => {
    if (!pendingPlan) return;
    await handleSelectPlan(
      pendingPlan.plan,
      pendingPlan.period,
      undefined,
      referralCodeValid ? referralCodeInput : undefined
    );
  };

  // Stripe Checkout Handler - handles both new subscriptions and plan changes
  const handleSelectPlan = async (plan: 'core' | 'pro' | 'test', period: 'monthly' | 'yearly', referralCode?: string, skipConfirmation?: boolean) => {
    try {
      setLoadingPlan(plan);
      
      // Check if user has an active paid subscription (includes 'trialing' status)
      const isSubscriptionActive = subscriptionInfo?.status === 'active' || subscriptionInfo?.status === 'trialing';
      const hasActivePaidSubscription = isSubscriptionActive && 
        subscriptionInfo?.plan && 
        subscriptionInfo.plan !== 'free';
      
      if (hasActivePaidSubscription && plan !== 'test') {
        // Determine if this is a downgrade
        const planRank = { free: 0, core: 1, pro: 2 };
        const currentPlanRank = planRank[subscriptionInfo?.plan as keyof typeof planRank] ?? 0;
        const targetPlanRank = planRank[plan as keyof typeof planRank] ?? 0;
        const isDowngrade = targetPlanRank < currentPlanRank;

        // Show confirmation modal for downgrades (unless skipConfirmation is true - meaning user already confirmed)
        if (isDowngrade && !skipConfirmation) {
          setPendingDowngrade({
            type: 'paid_to_paid',
            targetPlan: plan as 'core' | 'pro',
            targetPeriod: period,
          });
          setShowDowngradeModal(true);
          setLoadingPlan(null);
          return;
        }

        // Change existing subscription instead of creating new checkout
        const result = await changeSubscription(currentUser.householdId, plan as 'core' | 'pro', period, currentUser.id);
        
        if (result.success) {
          // Refresh subscription info
          await fetchSubscriptionInfo(0, false);
          showAlert(
            t['subscription.plan_changed_title'] || 'Plan Changed',
            result.message || `Successfully changed to ${plan.toUpperCase()} plan!`,
            'success'
          );
        } else {
          throw new Error(result.error || 'Failed to change subscription');
        }
        setLoadingPlan(null);
        setIsPlanConfirmOpen(false);
        setPendingPlan(null);
      } else {
        // New subscription - redirect to Stripe Checkout
        const checkoutUrl = await createCheckoutSession(
          currentUser.householdId,
          plan,
          period,
          currentUser.email || '',
          undefined,
          referralCode,
          currentUser.id
        );
        
        // Redirect to Stripe Checkout
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      showAlert(
        t['error.plan_change_failed'] || 'Could not change your plan. Please try again or contact support.',
        '',
        'error'
      );
      setLoadingPlan(null);
    }
  };

  // Handle downgrade to Free plan - shows confirmation modal
  const handleDowngradeToFree = () => {
    setPendingDowngrade({ type: 'paid_to_free' });
    setShowDowngradeModal(true);
  };

  // Execute the actual downgrade to Free (called after modal confirmation)
  const executeDowngradeToFree = async () => {
    console.log('[Profile] executeDowngradeToFree started');
    try {
      setLoadingPlan('core'); // Use 'core' as a loading indicator for downgrade
      console.log('[Profile] Calling downgradeToFree API...');
      const result = await downgradeToFree(currentUser.householdId, currentUser.id);
      console.log('[Profile] downgradeToFree API result:', result);
      console.log('[Profile] downgradeToFree API completed, refreshing subscription info...');
      // Refresh subscription info
      await fetchSubscriptionInfo(0, false);
      console.log('[Profile] Subscription info refreshed, showing success alert');
      showAlert(
        t['subscription.downgrade_success_title'] || 'Subscription Canceled',
        t['subscription.downgrade_success'] || 'Your subscription has been canceled. You are now on the Free plan.',
        'success'
      );
    } catch (error) {
      console.error('[Profile] Downgrade error:', error);
      showAlert(
        t['error.downgrade_title'] || 'Downgrade Failed',
        t['error.plan_change_failed'] || 'Could not change your plan. Please try again or contact support.',
        'error'
      );
    } finally {
      console.log('[Profile] executeDowngradeToFree finished, resetting loadingPlan');
      setLoadingPlan(null);
    }
  };

  // Handle confirmation from downgrade modal
  const handleConfirmDowngrade = async () => {
    if (!pendingDowngrade) return;
    
    setShowDowngradeModal(false);
    const downgradeType = pendingDowngrade.type;
    const targetPlan = pendingDowngrade.targetPlan;
    const targetPeriod = pendingDowngrade.targetPeriod;
    setPendingDowngrade(null); // Clear immediately to prevent double-clicks
    
    try {
      if (downgradeType === 'paid_to_free') {
        await executeDowngradeToFree();
      } else if (downgradeType === 'paid_to_paid' && targetPlan && targetPeriod) {
        // Call handleSelectPlan with skipConfirmation=true to bypass the modal
        await handleSelectPlan(targetPlan, targetPeriod, undefined, true);
      }
    } catch (error) {
      console.error('Downgrade confirmation error:', error);
      setLoadingPlan(null); // Ensure loading is reset on error
    }
  };

  // Handle cancel from downgrade modal
  const handleCancelDowngrade = () => {
    setShowDowngradeModal(false);
    setPendingDowngrade(null);
    setLoadingPlan(null);
  };

  // Stripe Portal Handler (for managing existing subscription)
  const handleManageSubscription = async () => {
    try {
      setIsLoading(true);
      const portalUrl = await createPortalSession(currentUser.householdId);
      
      if (!portalUrl) {
        throw new Error('No portal URL returned');
      }
      
      // Redirect to Stripe portal
      window.location.href = portalUrl;
      
      // Safety: reset loading after a delay in case redirect doesn't happen
      setTimeout(() => {
        setIsLoading(false);
      }, 5000);
    } catch (error) {
      console.error('Portal error:', error);
      showAlert(
        t['error.portal_title'] || 'Portal Error',
        t['error.subscription_settings'] || 'Could not open subscription settings. Please try again.',
        'error'
      );
      setIsLoading(false);
    }
  };

  // --- Helper Functions ---
  // Colors based on brand palette: #3EAFD2, #FF9800, #7E57C2, #4CAF50, #F06292, #757575
  // Role badge colors: White background with colored text, except SuperAdmin (solid blue)
  // All badges have subtle shadow for depth
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPERADMIN: return 'bg-primary text-white shadow-sm'; // Solid blue with white text
      case UserRole.MASTER: return 'bg-white text-primary shadow-sm'; // White bg, cyan text
      case UserRole.SPOUSE: return 'bg-white text-[#7E57C2] shadow-sm'; // White bg, purple text
      case UserRole.HELPER: return 'bg-white text-[#FF9800] shadow-sm'; // White bg, orange text
      case UserRole.CHILD: return 'bg-white text-[#4CAF50] shadow-sm'; // White bg, green text
      case UserRole.OTHER: return 'bg-white text-[#F06292] shadow-sm'; // White bg, pink text
      default: return 'bg-white text-muted-foreground shadow-sm';
    }
  };

  // Get avatar URL with appropriate background color based on status
  const getAvatarUrl = (user: User) => {
    // Check if using dicebear avatar (no custom photo uploaded)
    const isDicebearAvatar = user.avatar?.includes('dicebear');
    
    if (isDicebearAvatar) {
      const seed = encodeURIComponent(user.name);
      // Grey (#9CA3AF) for pending, Helpy blue (#3EAFD2) for accepted
      const bgColor = user.status === 'pending' ? '9CA3AF' : '3EAFD2';
      // Reduce font size by 20% (from default 50 to 40)
      return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=${bgColor}&fontSize=40`;
    }
    
    return user.avatar;
  };

  const handleAddUser = async () => {
    if (!newName.trim() || isAddingUser) return;
    
    setIsAddingUser(true);
    const nameToAdd = newName.trim();
    const roleToAdd = newRole;
    
    // Store name for success/invite display
    setAddedUserName(nameToAdd);
    
    // Show loading step (keep modal open)
    setAddUserStep('loading');
    
    try {
      // Children don't need invite links - they're added directly to the household
      if (roleToAdd === UserRole.CHILD) {
        const newUser: Omit<User, 'id'> = {
          householdId: currentUser.householdId,
          name: nameToAdd,
          role: roleToAdd,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameToAdd)}`,
          allergies: [],
          preferences: [],
          status: 'active' // Children are added as active family members, not pending
        };
        
        // Create child user directly without invite link
        await onAdd(newUser);
        
        // Show brief success, then close (children don't need invite link)
        setAddUserStep('success');
        setTimeout(() => {
          closeAddUserModal();
        }, 1200);
      } else {
        // For Spouse, Helper, and Other, create user with invite link
        const result = await createInvite({
          name: nameToAdd,
          role: roleToAdd,
          householdId: currentUser.householdId,
          inviterId: currentUser.id
        });
        
        // Show success flash, then invite link
        setAddUserStep('success');
        setInviteLink(result.inviteLink);
        setTimeout(() => {
          setAddUserStep('invite');
        }, 800);
      }
    } catch (error: any) {
      console.error('Failed to add user:', error);
      
      // Check if it's a plan limit error
      const errorMessage = error?.message || '';
      if (errorMessage.includes('limit reached')) {
        setLimitErrorMessage(errorMessage);
        setAddUserStep('limit_error');
      } else {
        showAlert(
          t['error.add_user_title'] || 'Add User Failed',
          t['error.add_user'] || 'Failed to add user. Please try again.',
          'error'
        );
        setAddUserStep('form');
      }
    } finally {
      setIsAddingUser(false);
    }
  };
  
  // Close add user modal and reset state
  const closeAddUserModal = () => {
    setIsAddModalOpen(false);
    setAddUserStep('form');
    setAddedUserName('');
    setInviteLink(null);
    setIsCopied(false);
    setLimitErrorMessage('');
    resetForm();
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
    // Find the user's name for the invite modal
    const userToReinvite = users.find(u => u.id === userId);
    const userName = userToReinvite?.name || '';
    
    // Open modal in loading state
    setAddedUserName(userName);
    setIsAddModalOpen(true);
    setAddUserStep('loading');
    
    try {
      const { resendInvite } = await import('../services/inviteService');
      const result = await resendInvite(userId, currentUser.householdId);
      setInviteLink(result.inviteLink);
      setIsCopied(false);
      // Go directly to invite step (skip success for resend)
      setAddUserStep('invite');
    } catch (error) {
      console.error('Failed to resend invite:', error);
      showAlert(
        t['error.invite_title'] || 'Invite Failed',
        t['error.generate_invite'] || 'Failed to generate new invite link',
        'error'
      );
      closeAddUserModal();
    }
  };

  const handleCopyInvite = () => {
    if (!inviteLink) return;
    
    // Create a personalized message with the link
    const inviterName = currentUser.name || currentUser.firstName || 'Someone';
    const inviteeName = addedUserName || '';
    const greeting = inviteeName ? `${t['profile.invite_hi'] || 'Hi'} ${inviteeName}, ` : '';
    const signupGuidance = t['profile.invite_signup_guidance'] || 'Signing up is quick:\n- Fastest: Use "Sign Up with Google" (1 click, no verification needed)\n- Or use email: Make sure you have access to the email you use - we\'ll send a 6-digit code to verify. Check your spam/junk folder if you don\'t see it!';
    const accessApp = t['profile.invite_access_app'] || 'Once you sign up, you can always access the app at: app.helpyfam.com';
    const message = `${greeting}${inviterName} ${t['profile.invite_join_family'] || 'would like you to join the family in the Helpy app!'}\n\n${t['profile.invite_app_description'] || 'Helpy is the home management app connecting families and helpers, organizing meals, tasks, and expenses in one place.'}\n\n${signupGuidance}\n\n${t['profile.invite_click_below'] || 'Click below to join:'}\n${inviteLink}\n\n----------\n\n${accessApp}`;
    
    navigator.clipboard.writeText(message);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShareInvite = async () => {
    if (!inviteLink) return;
    
    const inviterName = currentUser.name || currentUser.firstName || 'Someone';
    const inviteeName = addedUserName || '';
    const greeting = inviteeName ? `${t['profile.invite_hi'] || 'Hi'} ${inviteeName}, ` : '';
    const signupGuidance = t['profile.invite_signup_guidance'] || 'Signing up is quick:\n- Fastest: Use "Sign Up with Google" (1 click, no verification needed)\n- Or use email: Make sure you have access to the email you use - we\'ll send a 6-digit code to verify. Check your spam/junk folder if you don\'t see it!';
    const accessApp = t['profile.invite_access_app'] || 'Once you sign up, you can always access the app at: app.helpyfam.com';
    // Note: Web Share API appends URL separately, so we include accessApp in text before the link context
    const shareText = `${greeting}${inviterName} ${t['profile.invite_join_family'] || 'would like you to join the family in the Helpy app!'}\n\n${t['profile.invite_app_description'] || 'Helpy is the home management app connecting families and helpers, organizing meals, tasks, and expenses in one place.'}\n\n${signupGuidance}\n\n${t['profile.invite_click_below'] || 'Click below to join:'}\n\n----------\n\n${accessApp}`;
    
    // Use Web Share API if available (mobile devices)
    if (navigator.share) {
      try {
        await navigator.share({
          title: t['profile.invite_title'] || 'Join Helpy',
          text: shareText,
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

  const handleWhatsAppShare = () => {
    if (!inviteLink) return;
    
    const inviterName = currentUser.name || currentUser.firstName || 'Someone';
    const inviteeName = addedUserName || '';
    const greeting = inviteeName ? `${t['profile.invite_hi'] || 'Hi'} ${inviteeName}, ` : '';
    const signupGuidance = t['profile.invite_signup_guidance'] || 'Signing up is quick:\n- Fastest: Use "Sign Up with Google" (1 click, no verification needed)\n- Or use email: Make sure you have access to the email you use - we\'ll send a 6-digit code to verify. Check your spam/junk folder if you don\'t see it!';
    const accessApp = t['profile.invite_access_app'] || 'Once you sign up, you can always access the app at: app.helpyfam.com';
    const message = `${greeting}${inviterName} ${t['profile.invite_join_family'] || 'would like you to join the family in the Helpy app!'}\n\n${t['profile.invite_app_description'] || 'Helpy is the home management app connecting families and helpers, organizing meals, tasks, and expenses in one place.'}\n\n${signupGuidance}\n\n${t['profile.invite_click_below'] || 'Click below to join:'}\n${inviteLink}\n\n----------\n\n${accessApp}`;
    
    // Use Universal Link - works reliably on all platforms (iOS, Android, Desktop)
    // iOS/Android will open WhatsApp if installed, or show the app store if not
    // No unreliable timeout detection needed
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleOpenEdit = () => {
    setEditName(selectedUser.name);
    setEditRole(selectedUser.role);
    setEditAllergies([...(selectedUser.allergies || [])]);
    setEditPreferences([...(selectedUser.preferences || [])]);
    
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    const updates: Partial<User> = {
      name: editName,
      role: editRole,
      allergies: editAllergies,
      preferences: editPreferences,
    };
    
    onUpdate(selectedUser.id, updates);
    setIsEditModalOpen(false);
  };


  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showAlert(
        t['error.invalid_file_title'] || 'Invalid File',
        t['error.select_image'] || 'Please select an image file',
        'error'
      );
      return;
    }

    // Validate file size (max 10MB before compression - we'll compress it down)
    if (file.size > 10 * 1024 * 1024) {
      showAlert(
        t['error.file_too_large_title'] || 'File Too Large',
        t['error.image_too_large'] || 'Image size must be less than 10MB',
        'error'
      );
      return;
    }

    setIsUploadingAvatar(true);
    try {
      console.log('📷 Compressing avatar for user:', selectedUser.id);
      
      // Compress image before upload (resizes to 400x400 max, ~80% quality)
      // This typically reduces 3-5MB phone photos to ~20-50KB
      const compressed = await compressImageForAvatar(file, 400, 0.85);
      
      console.log('📷 Uploading compressed avatar...');
      const avatarUrl = await uploadAvatarImage(
        currentUser.householdId,
        selectedUser.id,
        compressed.file
      );
      
      // Update user with new avatar URL
      onUpdate(selectedUser.id, { avatar: avatarUrl });
      console.log('✅ Avatar updated successfully');
    } catch (error) {
      console.error('❌ Failed to upload avatar:', error);
      showAlert(
        t['error.upload_failed_title'] || 'Upload Failed',
        t['error.upload_image'] || 'Failed to upload image. Please try again.',
        'error'
      );
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
      <div className="flex items-center gap-2">
        <button
          onClick={onBackOverride || (() => setActiveSection('main'))}
          className="p-2 rounded-full"
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
                <button onClick={onBack} className="p-2 rounded-full">
                  <ChevronLeft size={24} className="text-foreground" />
                </button>
                <h1 className="text-display text-foreground">{t['nav.profile']}</h1>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-xl "
              >
                <LogOut size={18} />
                <span className="text-body font-semibold">{t['profile.logout']}</span>
              </button>
            </div>
          </header>

          <div className="pt-6 space-y-6">
            {/* User Carousel */}
            <div className="bg-card rounded-2xl px-5 py-5 shadow-sm">
              {householdName && (
                <h2 className="text-title font-bold text-foreground mb-1">{householdName}</h2>
              )}
              <p className="text-title text-muted-foreground mb-3">{t['profile.familyMembers']}</p>
              <div ref={carouselScrollRef} className="flex gap-4 overflow-x-auto pt-2 pb-1 scrollbar-hide">
                {/* Add button first - Hidden for Helper */}
                {!isHelper && (
                <div
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex flex-col items-center gap-2 cursor-pointer opacity-60"
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
                  const hasNotifications = user.notificationsEnabled === true;
                  return (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className="flex flex-col items-center gap-2 cursor-pointer"
                    >
                      <div className="relative">
                        <div className={`w-16 h-16 rounded-full overflow-hidden border-4 ${isSelected ? 'border-primary shadow-md' : 'border-transparent'
                          }`}>
                          <img src={getAvatarUrl(user)} alt={user.name} className="w-full h-full object-cover" />
                        </div>
                        {/* Notification indicator */}
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow-sm flex items-center justify-center">
                          {(() => {
                            if (user.role === 'Child') return <BellOff size={12} className="text-muted-foreground" />;
                            // For current user, check if OS blocked notifications
                            if (user.id === currentUser.id && typeof Notification !== 'undefined' && Notification.permission === 'denied') return <BellOff size={12} className="text-destructive" />;
                            if (!user.notificationsEnabled) return <BellOff size={12} className="text-destructive" />;
                            if (!user.hasPushSubscription) return <BellOff size={12} className="text-orange-500" />;
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
              
              {/* Carousel pagination dots */}
              {(() => {
                const totalItems = (!isHelper ? 1 : 0) + validUsers.length;
                const scrollContainer = carouselScrollRef.current;
                const clientWidth = scrollContainer?.clientWidth || 300;
                const itemWidth = 80;
                const visibleItems = Math.floor(clientWidth / itemWidth);
                const totalDots = Math.max(1, totalItems - visibleItems + 1);
                
                // Only show dots if there are more items than can fit
                if (totalDots <= 1) return null;
                
                return (
                  <div className="flex justify-center gap-1.5 mt-3">
                    {Array.from({ length: totalDots }).map((_, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          index === activeCarouselDot 
                            ? 'bg-primary w-4' 
                            : 'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Selected User Profile Card */}
            {selectedUser && (
              <div className="bg-card rounded-2xl shadow-sm p-6 mb-6 relative">
                {/* Edit button (pencil) - positioned top right */}
                {(!isHelper || selectedUser.id === currentUser.id) && (
                  <button
                    onClick={handleOpenEdit}
                    className="absolute top-4 right-4 p-2.5 text-muted-foreground rounded-xl transition-colors"
                    aria-label={t['common.edit'] || 'Edit'}
                  >
                    <Pencil size={18} />
                  </button>
                )}
                {/* Header: Avatar + Name + Role */}
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div
                      className="w-20 h-20 rounded-full overflow-hidden shadow-sm bg-secondary cursor-pointer relative"
                      onClick={() => !isUploadingAvatar && setShowPhotoOptions(true)}
                    >
                      <img src={getAvatarUrl(selectedUser)} alt={selectedUser.name} className="w-full h-full object-cover" />
                      {isUploadingAvatar && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    {!isUploadingAvatar && (
                      <button
                        onClick={() => setShowPhotoOptions(true)}
                        className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-1.5 rounded-full shadow-sm opacity-0"
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
                             <p className="font-bold text-foreground mb-1">{t['notifications.off'] || 'Notifications off.'}</p>
                             <ol className="list-decimal pl-4 space-y-1">
                               <li>{t['notifications.off_step1'] || 'Enable in'} <strong>{t['notifications.off_step1_settings'] || 'Settings'}</strong> {t['notifications.off_step1_below'] || 'below'}</li>
                               <li>{t['notifications.tap'] || 'Tap'} <strong>{t['notifications.allow'] || 'Allow'}</strong> {t['notifications.if_asked'] || 'if asked'}</li>
                             </ol>
                          </div>
                        </>
                      );
                    }
                    
                    // Incomplete (Enabled but no subscription)
                    if (!selectedUser.hasPushSubscription) {
                      return (
                        <>
                          <BellOff size={16} className="text-orange-500 shrink-0 mt-0.5" />
                          <div className="text-body text-muted-foreground">
                             <p className="font-bold text-foreground mb-1">{t['notifications.incomplete'] || 'Notification setup is incomplete.'} <span className="font-normal">{(t['notifications.ask_to'] || 'Ask {name} to:').replace('{name}', selectedUser.name.split(' ')[0])}</span></p>
                             <ol className="list-decimal pl-4 space-y-1">
                               <li>{t['notifications.step_add_home'] || 'Add to Home Screen (iPhone/Android)'}</li>
                               <li>{t['notifications.step_enable'] || 'Enable Notification in'} <strong>{t['notifications.off_step1_settings'] || 'Settings'}</strong></li>
                               <li>{t['notifications.tap'] || 'Tap'} <strong>{t['notifications.allow'] || 'Allow'}</strong> {t['notifications.if_asked'] || 'if asked'}</li>
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

                {/* Action Row - Only Resend Invite when pending */}
                {selectedUser.status === 'pending' && !isHelper && (
                  <div className="mt-4 pt-4">
                    <div className="h-px bg-border -mt-4 mb-4" />
                    <button
                      onClick={() => handleReinvite(selectedUser.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl"
                    >
                      <Share2 size={16} className="shrink-0" />
                      <span className="text-body font-medium">{t['profile.resend_invite'] || 'Resend Invite'}</span>
                    </button>
                  </div>
                )}

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

            {/* Quick Settings Button */}
            <button
              onClick={() => setActiveSection('settings')}
              className="w-full bg-card px-5 py-4 rounded-2xl shadow-sm flex items-center justify-between "
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

            {/* User Guide & Tutorial Card */}
            <div className="w-full bg-card rounded-2xl shadow-sm overflow-hidden">
              {/* User Guide */}
              <button
                onClick={() => setActiveSection('guide')}
                className="w-full px-5 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <BookOpen size={18} className="text-primary" />
                  <div className="text-left">
                    <p className="font-bold text-foreground text-title">{t['guide.title'] || 'User Guide'}</p>
                    <p className="text-caption text-muted-foreground">{t['profile.learn_features'] || 'Learn how to use Helpy'}</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-muted-foreground" />
              </button>

              {/* Line Separator */}
              <div className="px-5"><div className="h-px bg-border w-full"></div></div>

              {/* Tutorial */}
              {onRestartTutorial && (
                <button
                  onClick={onRestartTutorial}
                  className="w-full px-5 py-4 flex items-center"
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap size={18} className="text-primary" />
                    <div className="text-left">
                      <p className="font-bold text-foreground text-title">{t['common.tutorial'] || 'Tutorial'}</p>
                      <p className="text-caption text-muted-foreground">{t['profile.restart_tutorial'] || 'Restart the onboarding guide'}</p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="helpy-footer">
            <span className="helpy-logo">helpy</span>
          </div>
        </div>

        {/* Add User Modal - Multi-step Flow */}
          {isAddModalOpen && createPortal(
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
              onClick={(e) => { if (e.target === e.currentTarget) setIsAddModalOpen(false); }}
            >
              {/* Safe area bottom cover */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-card"
                style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
              />
              <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ minHeight: '400px', maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                {/* Header with X left, Title center (no ✓ for Add Family Member) */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
                  {/* X Close Button or Back Button (left) */}
                  {addUserStep === 'invite' ? (
                    <button
                      onClick={() => setAddUserStep('form')}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
                      aria-label={t['common.back'] || 'Back'}
                    >
                      <ArrowLeft size={20} />
                    </button>
                  ) : (
                    <button 
                      onClick={closeAddUserModal} 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
                      aria-label={t['common.close'] || 'Close'}
                    >
                      <X size={20} />
                    </button>
                  )}
                  
                  {/* Title (center) */}
                  <h2 className="text-title font-semibold text-foreground text-center flex-1">
                    {addUserStep === 'invite' 
                      ? (t['profile.invite_link'] || 'Invite Link')
                      : (t['profile.addMember'] || 'Add Family Member')
                    }
                  </h2>
                  
                  {/* Invisible spacer (right) - no check button for Add Family Member */}
                  <div className="w-10 h-10" />
                </div>
                
                {/* Header separator */}
                <div className="px-5"><div className="h-px bg-border w-full"></div></div>

                {/* STEP: Form */}
                {addUserStep === 'form' && (
                  <>
                    {/* Form */}
                    <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                      {/* Main Input: Name (big font) */}
                      <div>
                        <label className="block text-caption text-muted-foreground mb-2 tracking-wide">{t['common.name'] || 'Name'}</label>
                        <input
                          type="text"
                          autoComplete="one-time-code"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="w-full px-4 py-3 bg-muted rounded-xl text-xl font-semibold text-foreground placeholder-light outline-none border border-transparent focus:border-primary transition-colors"
                          placeholder={t['common.enter_name'] || 'Enter Name'}
                        />
                      </div>
                      <div>
                        <label className="block text-caption text-muted-foreground mb-2 tracking-wide">{t['profile.role'] || 'Role'}</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setNewRole(UserRole.SPOUSE)}
                            className={`flex-1 px-3 py-2 rounded-xl text-body transition-all flex items-center justify-start ${
                              newRole === UserRole.SPOUSE
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card text-foreground ring-1 ring-border'
                            }`}
                          >
                            Spouse
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewRole(UserRole.HELPER)}
                            className={`flex-1 px-3 py-2 rounded-xl text-body transition-all flex items-center justify-start ${
                              newRole === UserRole.HELPER
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card text-foreground ring-1 ring-border'
                            }`}
                          >
                            Helper
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewRole(UserRole.CHILD)}
                            className={`flex-1 px-3 py-2 rounded-xl text-body transition-all flex items-center justify-start ${
                              newRole === UserRole.CHILD
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card text-foreground ring-1 ring-border'
                            }`}
                          >
                            Child
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewRole(UserRole.OTHER)}
                            className={`flex-1 px-3 py-2 rounded-xl text-body transition-all flex items-center justify-start ${
                              newRole === UserRole.OTHER
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card text-foreground ring-1 ring-border'
                            }`}
                          >
                            Other
                          </button>
                        </div>
                      </div>
                      
                      {/* Role Info Box - fixed height to match Helper (tallest) */}
                      {(() => {
                        const roleConfig = getRoleConfig(newRole);
                        if (!roleConfig) return null;
                        
                        // Profile-only roles (like Child) have a different display format
                        if (roleConfig.isProfileOnly) {
                          return (
                            <div className="bg-muted rounded-xl p-4 mt-2" style={{ minHeight: '280px' }}>
                              <p className="text-body font-semibold text-foreground mb-1">
                                {roleConfig.displayName}
                              </p>
                              <p className="text-body text-muted-foreground mb-3">
                                {roleConfig.description}
                              </p>
                              
                              {/* This profile is for: */}
                              {roleConfig.profileFor && roleConfig.profileFor.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-body text-muted-foreground mb-1.5 font-semibold">
                                    {t['guide.this_profile_is_for'] || 'This profile is for:'}
                                  </p>
                                  <div className="space-y-1">
                                    {roleConfig.profileFor.map((item) => (
                                      <div key={item.key} className="flex items-start gap-2">
                                        <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                                        <span className="text-body text-foreground">{item.label}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Note */}
                              {roleConfig.note && (
                                <p className="text-caption text-muted-foreground">
                                  {t['guide.child_note'] || roleConfig.note}
                                </p>
                              )}
                            </div>
                          );
                        }
                        
                        // Regular roles (Admin, Spouse, Helper, Other)
                        return (
                          <div className="bg-muted rounded-xl p-4 mt-2" style={{ minHeight: '280px' }}>
                            <p className="text-body font-semibold text-foreground mb-1">
                              {roleConfig.displayName}
                            </p>
                            <p className="text-body text-muted-foreground mb-3">
                              {roleConfig.description}
                            </p>
                            
                            {/* What they can do */}
                            {roleConfig.abilities.length > 0 && (
                              <div className="mb-3">
                                <p className="text-body text-muted-foreground mb-1.5 font-semibold">
                                  {t['guide.what_you_can_do'] || 'What they can do:'}
                                </p>
                                <div className="space-y-1">
                                  {roleConfig.abilities.map((ability) => (
                                    <div key={ability.key} className="flex items-start gap-2">
                                      <Check size={14} className="text-primary mt-0.5 flex-shrink-0" />
                                      <span className="text-body text-foreground">{ability.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* What they can't do */}
                            {roleConfig.restrictions.length > 0 && (
                              <div>
                                <p className="text-body text-muted-foreground mb-1.5 font-semibold">
                                  {t['guide.what_you_cant_do'] || "What they can't do:"}
                                </p>
                                <div className="space-y-1">
                                  {roleConfig.restrictions.map((restriction) => (
                                    <div key={restriction.key} className="flex items-start gap-2">
                                      <X size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                                      <span className="text-body text-foreground">{restriction.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Full access note for roles with no restrictions */}
                            {roleConfig.restrictions.length === 0 && (
                              <p className="text-caption text-muted-foreground">
                                {t['guide.full_access'] || 'Full access - no restrictions'}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      
                      {/* Slot usage */}
                      <p className="text-caption text-muted-foreground text-center">
                        {totalMemberCount} {t['common.of'] || 'of'} {totalMaxSlots} {t['profile.member_slots_used'] || 'member slots used'}
                      </p>
                    </div>

                    {/* Footer with Add button */}
                    <div className="px-5"><div className="h-px bg-border w-full"></div></div>
                    <div className="p-5 pb-8 shrink-0">
                      {isAtMemberLimit ? (
                        <button
                          onClick={() => {
                            closeAddUserModal();
                            // Navigate to plan section
                            setTimeout(() => {
                              setActiveSection('settings');
                              setTimeout(() => setActiveSection('plan'), 100);
                            }, 300);
                          }}
                          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm flex items-center justify-center gap-2"
                        >
                          <Crown size={18} />
                          {t['common.upgrade_to_add_more'] || 'Upgrade to Add More'}
                        </button>
                      ) : (
                        <button
                          onClick={handleAddUser}
                          disabled={isAddingUser || !newName.trim()}
                          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isAddingUser && <Loader2 size={18} className="animate-spin" />}
                          {newRole === UserRole.CHILD 
                            ? (t['common.add'] || 'Add')
                            : (t['common.add_and_invite'] || 'Add and Send Invite Link')}
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* STEP: Loading */}
                {addUserStep === 'loading' && (
                  <>
                    <div className="flex-1 flex flex-col items-center justify-center px-5">
                      <Loader2 size={40} className="text-primary animate-spin mb-4" />
                      <p className="text-body text-muted-foreground">
                        {t['profile.creating_invite'] || 'Creating invite...'}
                      </p>
                    </div>
                    {/* Empty footer to maintain height */}
                    <div className="p-5 pb-8 shrink-0">
                      <div className="h-[52px]" />
                    </div>
                  </>
                )}

                {/* STEP: Success */}
                {addUserStep === 'success' && (
                  <>
                    <div className="flex-1 flex flex-col items-center justify-center px-5">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <CheckCircle size={32} className="text-primary" />
                      </div>
                      <p className="text-title font-semibold text-foreground">
                        {addedUserName} {t['profile.added'] || 'added'}!
                      </p>
                    </div>
                    {/* Empty footer to maintain height */}
                    <div className="p-5 pb-8 shrink-0">
                      <div className="h-[52px]" />
                    </div>
                  </>
                )}

                {/* STEP: Invite Link */}
                {addUserStep === 'invite' && (
                  <>
                    {/* Content */}
                    <div className="p-5 flex-1 space-y-4">
                      {/* Success icon */}
                      <div className="flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <CheckCircle size={32} className="text-primary" />
                        </div>
                      </div>
                      
                      <p className="text-body text-muted-foreground text-center">
                        {addedUserName} {t['profile.added'] || 'added'}! {t['profile.share_link_text'] || 'Share this link with them to join:'}
                      </p>
                      
                      {/* Invite link box */}
                      <div className="bg-muted p-3 rounded-xl break-all text-caption font-mono text-muted-foreground">
                        {inviteLink}
                      </div>
                    </div>

                    {/* Footer with share buttons - standard styling */}
                    <div className="px-5"><div className="h-px bg-border w-full"></div></div>
                    <div className="p-5 pb-8 flex gap-2 shrink-0">
                      <button
                        onClick={handleWhatsAppShare}
                        className="flex-1 py-3.5 rounded-xl bg-card text-foreground text-body font-semibold flex items-center justify-center gap-2 ring-1 ring-border"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#4CAF50]">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </button>
                      <button
                        onClick={handleShareInvite}
                        className="flex-1 py-3.5 rounded-xl bg-card text-foreground text-body font-semibold flex items-center justify-center gap-2 ring-1 ring-border"
                      >
                        <Share2 size={18} />
                        {t['common.share'] || 'Share'}
                      </button>
                      <button
                        onClick={handleCopyInvite}
                        className="flex-1 py-3.5 rounded-xl bg-card text-foreground text-body font-semibold flex items-center justify-center gap-2 ring-1 ring-border"
                      >
                        {isCopied ? <Check size={18} className="text-primary" /> : <Copy size={18} />}
                        {isCopied ? (t['profile.copied'] || 'Copied!') : (t['profile.copy_link'] || 'Copy')}
                      </button>
                    </div>
                  </>
                )}

                {/* STEP: Plan Limit Error */}
                {addUserStep === 'limit_error' && (
                  <>
                    <div className="flex-1 flex flex-col items-center justify-center px-5">
                      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                        <AlertCircle size={32} className="text-destructive" />
                      </div>
                      <p className="text-title font-semibold text-foreground mb-2 text-center">
                        {limitErrorMessage.includes('Helper') 
                          ? (t['error.helper_limit_title'] || 'Helper Limit Reached')
                          : (t['error.family_limit_title'] || 'Family Member Limit Reached')
                        }
                      </p>
                      <p className="text-body text-muted-foreground text-center">
                        {t['error.upgrade_to_add_more'] || 'Upgrade your plan to add more members to your household.'}
                      </p>
                    </div>
                    
                    {/* Footer with Upgrade button */}
                    <div className="p-5 pb-8 border-t border-border flex flex-col gap-3 shrink-0">
                      <button
                        onClick={() => {
                          closeAddUserModal();
                          // Scroll to plan section after modal closes
                          setTimeout(() => {
                            const planSection = document.getElementById('plan-section');
                            if (planSection) {
                              planSection.scrollIntoView({ behavior: 'smooth' });
                            }
                          }, 300);
                        }}
                        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm"
                      >
                        {t['common.upgrade_plan'] || 'Upgrade Plan'}
                      </button>
                      <button
                        onClick={() => setAddUserStep('form')}
                        className="w-full py-3.5 rounded-xl bg-secondary text-foreground text-body font-semibold"
                      >
                        {t['common.go_back'] || 'Go Back'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          , document.body)}

          {/* Delete Confirmation Modal */}
          {deleteConfirmOpen && createPortal(
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
              onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmOpen(false); }}
            >
              {/* Safe area bottom cover */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-card"
                style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
              />
              <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                {/* Header with X left, Title center */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
                  {/* X Close Button (left) */}
                  <button
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setUserToDelete(null);
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
                    aria-label={t['common.close'] || 'Close'}
                  >
                    <X size={20} />
                  </button>
                  
                  {/* Title (center) */}
                  <h2 className="text-title font-semibold text-foreground text-center flex-1">
                    {t['profile.delete_family_member'] || 'Delete Family Member'}
                  </h2>
                  
                  {/* Invisible spacer (right) */}
                  <div className="w-10 h-10" />
                </div>
                
                {/* Header separator */}
                <div className="px-5"><div className="h-px bg-border w-full"></div></div>

                {/* Content */}
                <div className="p-5">
                  <p className="text-body text-muted-foreground text-center">
                    {t['profile.confirmDelete'] || 'Are you sure you want to delete this family member? This action cannot be undone.'}
                  </p>
                </div>

                {/* Footer */}
                <div className="px-5"><div className="h-px bg-border w-full"></div></div>
                <div className="p-5 pb-8 flex gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setUserToDelete(null);
                    }}
                    className="flex-1 py-3.5 rounded-xl bg-card text-foreground text-body font-semibold ring-1 ring-border"
                  >
                    {t['common.cancel'] || 'Cancel'}
                  </button>
                  <button
                    onClick={confirmDeleteUser}
                    className="flex-1 py-3.5 rounded-xl bg-destructive text-primary-foreground text-body font-semibold"
                  >
                    {t['common.delete'] || 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          , document.body)}

          {/* Edit User Modal */}
          {isEditModalOpen && createPortal(
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
              onClick={(e) => { if (e.target === e.currentTarget) setIsEditModalOpen(false); }}
            >
              {/* Safe area bottom cover - fills the gap below the sheet */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-card"
                style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
              />
              <div className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ maxHeight: '80vh', marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                {/* Header with X left, Title center, ✓ right */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
                  {/* X Close Button (left) */}
                  <button 
                    onClick={() => setIsEditModalOpen(false)} 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
                    aria-label={t['common.close'] || 'Close'}
                  >
                    <X size={20} />
                  </button>
                  
                  {/* Title (center) */}
                  <h2 className="text-title font-semibold text-foreground text-center flex-1">
                    {t['profile.edit_profile'] || 'Edit Profile'}
                  </h2>
                  
                  {/* ✓ Confirm Button (right) */}
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingProfile}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      !isSavingProfile
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    aria-label={t['common.save'] || 'Save'}
                  >
                    {isSavingProfile ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Check size={20} strokeWidth={3} />
                    )}
                  </button>
                </div>
                
                {/* Header separator */}
                <div className="px-5"><div className="h-px bg-border w-full"></div></div>

                {/* Form */}
                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                  {/* Main Input: Name (big font) */}
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">{t['profile.name_label'] || 'Name'}</label>
                    <input
                      type="text"
                      autoComplete="one-time-code"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-3 bg-muted rounded-xl text-xl font-semibold text-foreground placeholder-light outline-none border border-transparent focus:border-primary transition-colors"
                    />
                  </div>

                  {/* Role - Hidden when Admin/Helper edits their own profile (prevent self-demotion/escalation) */}
                  {!((isHelper || currentUser.role === UserRole.MASTER) && selectedUser.id === currentUser.id) && (
                  <div>
                    <label className="block text-caption text-muted-foreground mb-2 tracking-wide">{t['profile.role'] || 'Role'}</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body"
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
                        autoComplete="one-time-code"
                        value={newAllergyInput}
                        onChange={(e) => setNewAllergyInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
                        className="flex-1 px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body"
                        placeholder={t['common.add_allergy']}
                      />
                      <button onClick={addAllergy} className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editAllergies.map((allergy) => (
                        <span key={allergy} className="px-3 py-1 bg-destructive/10 text-destructive rounded-full text-caption font-medium flex items-center gap-1">
                          {allergy}
                          <button onClick={() => removeAllergy(allergy)} className="rounded-full p-0.5">
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
                        autoComplete="one-time-code"
                        value={newPreferenceInput}
                        onChange={(e) => setNewPreferenceInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addPreference()}
                        className="flex-1 px-4 py-3 rounded-xl bg-muted border border-transparent focus:border-primary outline-none transition-all text-body"
                        placeholder={t['common.add_preference']}
                      />
                      <button onClick={addPreference} className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editPreferences.map((pref) => (
                        <span key={pref} className="px-3 py-1 bg-foreground/10 text-foreground rounded-full text-caption font-medium flex items-center gap-1">
                          {pref}
                          <button onClick={() => removePreference(pref)} className="rounded-full p-0.5">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Footer - Delete button only (when editing other member), or spacer */}
                {selectedUser && selectedUser.id !== currentUser.id && !isHelper ? (
                  <>
                    {/* Footer separator */}
                    <div className="px-5"><div className="h-px bg-border w-full"></div></div>
                    {/* Footer with Remove button */}
                    <div className="shrink-0 p-5 pb-8">
                      <button
                        onClick={() => {
                          setIsEditModalOpen(false);
                          handleDeleteUser(selectedUser.id);
                        }}
                        className="w-full py-3.5 rounded-xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"
                      >
                        <Trash2 size={20} />
                        {t['profile.remove_member'] || 'Remove Family Member'}
                      </button>
                    </div>
                  </>
                ) : (
                  /* Invisible spacer for consistent height */
                  <div className="shrink-0 p-5 pb-8">
                    <div className="h-[52px]"></div>
                  </div>
                )}
              </div>
            </div>
          , document.body)}

        {/* Photo Options Modal */}
        {showPhotoOptions && createPortal(
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) setShowPhotoOptions(false); }}
          >
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
                  className="w-full flex items-center gap-3 p-4 bg-secondary rounded-xl "
                >
                  <Camera size={20} className="text-muted-foreground" />
                  <span className="font-semibold text-foreground">{t['profile.take_photo']}</span>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowPhotoOptions(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-secondary rounded-xl "
                >
                  <ImageIcon size={20} className="text-muted-foreground" />
                  <span className="font-semibold text-foreground">{t['profile.choose_library']}</span>
                </button>
              </div>
              
              {/* Cancel Footer */}
              <div className="p-5 pb-8 border-t border-border">
                <button
                  onClick={() => setShowPhotoOptions(false)}
                  className="w-full py-3.5 bg-muted rounded-xl font-semibold text-foreground"
                >
                  {t['common.cancel'] || 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        , document.body)}

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAvatarChange} />
      </div>
    );
  }

  // =====================================================
  // PLAN SELECTION VIEW
  // =====================================================
  const handleCancelSubscription = () => {
    setShowCancelSubConfirm(true);
  };
  
  const confirmCancelSubscription = async () => {
    setShowCancelSubConfirm(false);
    // handleManageSubscription already handles loading state and errors internally
    await handleManageSubscription();
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
    setIsDeleteAccountModalOpen(true);
  };

  const handleFirstDeleteConfirm = () => {
    setIsDeleteAccountModalOpen(false);
    setIsFinalDeleteConfirmOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (!currentUser?.householdId || !clerkUser) {
      showAlert(
        t['error.delete_account_title'] || 'Delete Failed',
        t['error.delete_account_unable'] || 'Unable to delete account. Please try again.',
        'error'
      );
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
      if (!supabase) {
        throw new Error('Supabase client not available');
      }
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
      showAlert(
        t['error.delete_account_title'] || 'Delete Failed',
        t['error.delete_account'] || 'Failed to delete account. Please try again or contact support.',
        'error'
      );
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
    // Helpy brand colors
    const HELPY_BLUE = '#3EAFD2';
    const HELPY_PINK = '#F06292';
    
    // Feature sections for organized display
    const featureSections = [
      {
        id: 'users',
        title: t['plan.section.users'] || 'Users',
        features: [
          { 
            id: 'family', 
            name: t['plan.feature.family_members'] || 'Family members',
            isLimit: true 
          },
          { 
            id: 'helpers', 
            name: t['plan.feature.helpers'] || 'Helpers',
            isLimit: true 
          },
        ]
      },
      {
        id: 'basic_features',
        title: t['plan.section.basic_features'] || 'Basic Features',
        features: [
          { 
            id: 'home', 
            name: t['plan.feature.home'] || 'Home (Family Board & Widgets)',
            isLimit: false 
          },
          { 
            id: 'todo', 
            name: t['plan.feature.todo'] || 'To Do (Tasks & Shopping)',
            isLimit: false 
          },
          { 
            id: 'meal_planning', 
            name: t['plan.feature.meal_planning'] || 'Meal Planning',
            isLimit: false 
          },
          { 
            id: 'family_info', 
            name: t['plan.feature.family_info'] || 'Family Info',
            isLimit: false 
          },
          { 
            id: 'ai_translations', 
            name: t['plan.feature.ai_translations'] || 'AI Translations',
            isLimit: false 
          },
        ]
      },
      {
        id: 'expenses',
        title: t['plan.section.expenses'] || 'Expenses',
        features: [
          { 
            id: 'manual_expenses', 
            name: t['plan.feature.manual_expenses'] || 'Add expenses manually',
            description: t['plan.feature.manual_expenses_desc'] || 'Enter amount, category, shop, and date quickly.',
            isLimit: false 
          },
          { 
            id: 'ai_scan', 
            name: t['plan.feature.ai_scan'] || 'AI receipt scanning',
            description: t['plan.feature.ai_scan_desc'] || 'Take or upload receipt photo and automatically capture the details.',
            isLimit: false 
          },
          { 
            id: 'spending_summary', 
            name: t['plan.feature.spending_summary'] || 'Monthly Spending Summary',
            description: t['plan.feature.spending_summary_desc'] || 'Pie charts show category totals and percentages.',
            isLimit: false 
          },
        ]
      },
      {
        id: 'helper_management',
        title: t['plan.section.helper_management'] || 'Helper',
        features: [
          { 
            id: 'helper_records', 
            name: t['plan.feature.helper_records'] || 'Helper details & salary slip',
            description: t['plan.feature.helper_records_desc'] || 'Manage the helper\'s salary details and generate digital payslips.',
            isLimit: false 
          },
        ]
      }
    ];

    const plans = [
      {
        id: 'free',
        name: t['common.free'] || 'Free',
        monthlyPrice: 0,
        yearlyPrice: 0,
        accentColor: null, // White/neutral
        featureValues: {
          family: { included: true, value: '3' },
          helpers: { included: true, value: '1' },
          home: { included: true },
          todo: { included: true },
          meal_planning: { included: true },
          family_info: { included: true },
          ai_translations: { included: true },
          manual_expenses: { included: true },
          ai_scan: { included: false },
          spending_summary: { included: false },
          helper_records: { included: false },
        },
        badge: null,
        isFree: true
      },
      {
        id: 'core',
        name: t['common.core'] || 'Core',
        monthlyPrice: 88,
        yearlyPrice: 845,
        accentColor: HELPY_BLUE,
        featureValues: {
          family: { included: true, value: '4' },
          helpers: { included: true, value: '1' },
          home: { included: true },
          todo: { included: true },
          meal_planning: { included: true },
          family_info: { included: true },
          ai_translations: { included: true },
          manual_expenses: { included: true },
          ai_scan: { included: true },
          spending_summary: { included: true },
          helper_records: { included: true },
        },
        badge: null,
        isFree: false
      },
      {
        id: 'pro',
        name: t['common.pro'] || 'Pro',
        monthlyPrice: 118,
        yearlyPrice: 1133,
        accentColor: HELPY_PINK,
        featureValues: {
          family: { included: true, value: '8' },
          helpers: { included: true, value: '4' },
          home: { included: true },
          todo: { included: true },
          meal_planning: { included: true },
          family_info: { included: true },
          ai_translations: { included: true },
          manual_expenses: { included: true },
          ai_scan: { included: true },
          spending_summary: { included: true },
          helper_records: { included: true },
        },
        badge: true,
        isFree: false
      }
    ];

    const isAdmin = currentUser.role === UserRole.MASTER || currentUser.role === UserRole.SUPERADMIN;
    // Check if subscription is active (includes 'trialing' status for free trial subscriptions)
    const isSubscriptionActive = subscriptionInfo?.status === 'active' || subscriptionInfo?.status === 'trialing';
    // Determine the current plan - if subscription is active/trialing, use the plan, otherwise it's free
    const effectivePlan = isSubscriptionActive && subscriptionInfo?.plan && subscriptionInfo.plan !== 'free' 
      ? subscriptionInfo.plan 
      : 'free';
    const currentPlanName = effectivePlan === 'core' 
      ? (t['common.core'] || 'Core') 
      : effectivePlan === 'pro' 
      ? (t['common.pro'] || 'Pro') 
      : (t['common.free'] || 'Free');
    const planPrice = effectivePlan === 'core' 
      ? (subscriptionInfo?.period === 'yearly' ? 845 : 88)
      : effectivePlan === 'pro'
      ? (subscriptionInfo?.period === 'yearly' ? 1133 : 118)
      : 0;
    
    // Current plan card colors based on plan
    const currentPlanColors = effectivePlan === 'core'
      ? { bg: HELPY_BLUE, text: 'white', textMuted: 'rgba(255,255,255,0.8)', border: 'rgba(255,255,255,0.2)', badgeBg: 'white', badgeBorder: 'white', badgeText: HELPY_BLUE }
      : effectivePlan === 'pro'
      ? { bg: HELPY_PINK, text: 'white', textMuted: 'rgba(255,255,255,0.8)', border: 'rgba(255,255,255,0.2)', badgeBg: 'white', badgeBorder: 'white', badgeText: HELPY_PINK }
      : { bg: 'hsl(var(--card))', text: 'hsl(var(--foreground))', textMuted: 'hsl(var(--muted-foreground))', border: 'hsl(var(--border))', badgeBg: 'white', badgeBorder: HELPY_BLUE, badgeText: HELPY_BLUE };

    return (
      <div className="min-h-screen bg-background pb-40 animate-fade-in">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          {renderSettingsHeader(t['common.plan'] || 'Subscription', () => setActiveSection('settings'))}
          <div className="pt-6">

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
              <div className="mt-6 bg-card rounded-2xl p-6 shadow-sm border border-border mb-6">
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            ) : (
              <div 
                className="mt-6 rounded-2xl p-6 shadow-md mb-6"
                style={{ 
                  backgroundColor: currentPlanColors.bg, 
                  color: currentPlanColors.text
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span 
                      className="text-caption font-bold px-3 py-1 rounded-full border inline-block mb-2"
                      style={{ 
                        backgroundColor: currentPlanColors.badgeBg,
                        borderColor: currentPlanColors.badgeBorder,
                        color: currentPlanColors.badgeText
                      }}
                    >
                      {t['common.current_plan'] || 'Current Plan'}
                    </span>
                    <p className="text-display font-bold">{currentPlanName}</p>
                  </div>
                  <div className="text-right">
                    <p 
                      className="text-body mb-1"
                      style={{ color: currentPlanColors.textMuted }}
                    >
                      {t['common.price'] || 'Price'}
                    </p>
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
                
                {subscriptionInfo?.periodEnd ? (
                  <div
                    className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t"
                    style={{ borderColor: currentPlanColors.border }}
                  >
                    <div>
                      <p
                        className="text-caption mb-1"
                        style={{ color: currentPlanColors.textMuted }}
                      >
                        {subscriptionInfo?.cancelAtPeriodEnd ? (t['subscription.access_until'] || 'Access Until') : (t['common.expires_on'] || 'Expires On')}
                      </p>
                      <p className="text-body font-semibold">{formatDate(subscriptionInfo.periodEnd)}</p>
                    </div>
                    <div>
                      <p
                        className="text-caption mb-1"
                        style={{ color: currentPlanColors.textMuted }}
                      >
                        {subscriptionInfo?.cancelAtPeriodEnd ? (t['common.status'] || 'Status') : (t['common.next_payment'] || 'Next Payment')}
                      </p>
                      <p className="text-body font-semibold">
                        {subscriptionInfo?.cancelAtPeriodEnd
                          ? (t['subscription.cancelled'] || 'Cancelled')
                          : (getNextPaymentDate(subscriptionInfo.periodEnd, subscriptionInfo.period) || (t['common.na'] || 'N/A'))}
                      </p>
                    </div>
                  </div>
                ) : !isSubscriptionActive && (
                  <div 
                    className="mt-4 pt-4 border-t"
                    style={{ borderColor: currentPlanColors.border }}
                  >
                    <p 
                      className="text-body"
                      style={{ color: currentPlanColors.textMuted }}
                    >
                      {t['common.no_active_subscription'] || 'No active subscription'}
                    </p>
                  </div>
                )}

                {/* Trial End Date Display */}
                {subscriptionInfo?.isTrial && subscriptionInfo?.trialEndsAt && (
                  <div 
                    className="mt-4 pt-4 border-t"
                    style={{ borderColor: currentPlanColors.border }}
                  >
                    <p 
                      className="text-body"
                      style={{ color: currentPlanColors.textMuted }}
                    >
                      {t['subscription.trial_ends'] || 'Free trial ends'}: <span className="font-semibold" style={{ color: currentPlanColors.text }}>{formatDate(subscriptionInfo.trialEndsAt)}</span>
                    </p>
                  </div>
                )}

                {/* Show cancel button for active paid subscriptions OR subscriptions set to cancel at period end */}
                {((isSubscriptionActive && subscriptionInfo?.plan && subscriptionInfo.plan !== 'free') || subscriptionInfo?.cancelAtPeriodEnd) && isAdmin && (
                  <>
                    <div className="space-y-2">
                      <button
                        onClick={handleCancelSubscription}
                        disabled={isLoading || subscriptionInfo?.cancelAtPeriodEnd}
                        className="w-full py-3 rounded-xl font-semibold disabled:opacity-50"
                        style={{
                          backgroundColor: subscriptionInfo?.cancelAtPeriodEnd
                            ? 'rgba(128,128,128,0.3)'
                            : subscriptionInfo?.plan ? 'rgba(255,255,255,0.2)' : 'hsl(var(--secondary))',
                          color: subscriptionInfo?.cancelAtPeriodEnd ? 'rgba(255,255,255,0.6)' : currentPlanColors.text
                        }}
                      >
                        {isLoading
                          ? (t['common.processing'] || 'Processing...')
                          : subscriptionInfo?.cancelAtPeriodEnd
                            ? (t['subscription.cancelled'] || 'Cancelled')
                            : (t['common.cancel_subscription'] || 'Cancel Subscription')}
                      </button>
                      {/* Temporary debug button to manually sync */}
                      <button
                        onClick={async () => {
                          console.log('[DEBUG] Manual sync triggered');
                          try {
                            const syncResult = await syncSubscription(currentUser.householdId);
                            console.log('[DEBUG] Manual sync result:', syncResult);
                            await fetchSubscriptionInfo(0, false);
                            console.log('[DEBUG] Manual fetch completed');
                          } catch (error) {
                            console.error('[DEBUG] Manual sync error:', error);
                          }
                        }}
                        className="w-full py-2 rounded-xl font-semibold text-xs"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.8)'
                        }}
                      >
                        Debug: Manual Sync
                      </button>
                    </div>
                    {subscriptionInfo?.cancelAtPeriodEnd && subscriptionInfo?.periodEnd && (
                      <p
                        className="text-caption text-center mt-2"
                        style={{ color: currentPlanColors.textMuted }}
                      >
                        {t['subscription.access_until'] || 'You have access until'} {formatDate(subscriptionInfo.periodEnd)}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Upgrade/Change Plan Section */}
            <div id="plan-section" className="mb-6">
              <h3 className="text-title font-bold text-foreground mb-4">
                {isSubscriptionActive && effectivePlan !== 'free' ? (t['subscription.change_plan'] || 'Change Plan') : (t['subscription.choose_plan'] || 'Choose Your Plan')}
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
                          : 'text-muted-foreground'
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
                          : 'text-muted-foreground'
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
                  // Check if subscription is active (includes 'trialing' status for free trial subscriptions)
                  const isSubscriptionActive = subscriptionInfo?.status === 'active' || subscriptionInfo?.status === 'trialing';
                  // For free plan, check if user has no active paid subscription
                  const isCurrentPlan = p.isFree 
                    ? (!subscriptionInfo?.plan || subscriptionInfo?.plan === 'free' || !isSubscriptionActive)
                    : (subscriptionInfo?.plan === p.id && isSubscriptionActive);

                  // Determine if this is an upgrade or downgrade
                  // Plan hierarchy: free (0) < core (1) < pro (2)
                  // IMPORTANT: Use effectivePlan (which considers subscription status), not subscriptionInfo.plan
                  // This ensures that inactive/canceled subscriptions are treated as Free
                  const planRank = { free: 0, core: 1, pro: 2 };
                  const currentEffectivePlan = isSubscriptionActive && subscriptionInfo?.plan && subscriptionInfo.plan !== 'free'
                    ? subscriptionInfo.plan
                    : 'free';
                  const currentPlanRank = planRank[currentEffectivePlan as keyof typeof planRank] ?? 0;
                  const targetPlanRank = planRank[p.id as keyof typeof planRank] ?? 0;
                  const isUpgrade = targetPlanRank > currentPlanRank;
                  const isDowngrade = targetPlanRank < currentPlanRank;
                  
                  // Check if user has an active paid subscription (for showing downgrade to Free)
                  const hasActivePaidSubscription = isSubscriptionActive && 
                    subscriptionInfo?.plan && 
                    subscriptionInfo.plan !== 'free';

                  // Get button label
                  const getButtonLabel = () => {
                    if (loadingPlan === p.id || (p.isFree && loadingPlan !== null)) {
                      return t['common.processing'] || 'Processing...';
                    }
                    if (isCurrentPlan) {
                      return t['common.current_plan'] || 'Current Plan';
                    }
                    if (!isAdmin) {
                      return t['common.only_admin_can_change'] || 'Only Admin Can Change';
                    }
                    if (isUpgrade) {
                      return t['common.upgrade'] || 'Upgrade';
                    }
                    if (isDowngrade) {
                      return t['common.downgrade'] || 'Downgrade';
                    }
                    return t['common.select_plan'] || 'Select Plan';
                  };

                  // Determine if this is a colored card (blue/pink) vs white
                  const hasColoredBg = !!p.accentColor;

                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl overflow-hidden transition-colors relative shadow-md ${
                        hasColoredBg ? '' : 'bg-card border border-border'
                      }`}
                      style={{ 
                        backgroundColor: p.accentColor || undefined,
                      }}
                    >
                      {/* Corner badge - CircleStar icon */}
                      {p.badge && !isCurrentPlan && (
                        <div className="absolute top-6 right-6">
                          <CircleStar size={36} strokeWidth={2} color="white" />
                        </div>
                      )}

                      <div className="p-6">
                        {/* Header */}
                        <div className="mb-5">
                          {/* Plan name with Current Plan badge */}
                          <div className="flex items-center gap-3 mb-1">
                            <h3 
                              className="text-title font-bold"
                              style={{ color: hasColoredBg ? 'white' : 'hsl(var(--foreground))' }}
                            >
                              {p.name}
                            </h3>
                            {isCurrentPlan && (
                              <span 
                                className="text-caption font-bold px-3 py-1 rounded-full border"
                                style={{ 
                                  backgroundColor: 'white',
                                  borderColor: hasColoredBg ? 'white' : HELPY_BLUE,
                                  color: p.accentColor || HELPY_BLUE
                                }}
                              >
                                {t['common.current_plan'] || 'Current Plan'}
                              </span>
                            )}
                          </div>
                          {/* Price */}
                          <div className="flex items-baseline gap-1">
                            {p.isFree ? (
                              <span 
                                className="text-display font-bold"
                                style={{ color: hasColoredBg ? 'white' : 'hsl(var(--foreground))' }}
                              >
                                {t['common.free'] || 'Free'}
                              </span>
                            ) : (
                              <>
                                <span 
                                  className="text-display font-bold"
                                  style={{ color: hasColoredBg ? 'white' : 'hsl(var(--foreground))' }}
                                >
                                  HK${price}
                                </span>
                                <span 
                                  className="text-body"
                                  style={{ color: hasColoredBg ? 'rgba(255,255,255,0.8)' : 'hsl(var(--muted-foreground))' }}
                                >
                                  /{billingPeriod === 'monthly' ? t['common.mo'] : t['common.yr']}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Feature Matrix with Sections */}
                        <div className="space-y-4 mb-6">
                          {featureSections.map((section, sectionIndex) => (
                            <div key={section.id}>
                              {/* Section divider (except for first section) */}
                              {sectionIndex > 0 && (
                                <div 
                                  className="border-t my-4"
                                  style={{ borderColor: hasColoredBg ? 'rgba(255,255,255,0.2)' : 'hsl(var(--border))' }}
                                />
                              )}
                              
                              {/* Section title */}
                              <p 
                                className="text-body font-semibold mb-3"
                                style={{ color: hasColoredBg ? 'rgba(255,255,255,0.6)' : 'hsl(var(--muted-foreground))' }}
                              >
                                {section.title}
                              </p>
                              
                              {/* Section features */}
                              <div className="space-y-3">
                                {section.features.map((feature) => {
                                  const featureValue = p.featureValues[feature.id as keyof typeof p.featureValues];
                                  const isIncluded = featureValue?.included ?? false;
                                  const limitValue = featureValue && 'value' in featureValue ? featureValue.value : null;

                                  // For limit features (family/helpers), show number as the leading element
                                  if (feature.isLimit && limitValue) {
                                    return (
                                      <div key={feature.id} className="flex items-start gap-3">
                                        <span 
                                          className="text-title font-bold flex-shrink-0 w-5 text-center"
                                          style={{ 
                                            color: hasColoredBg ? 'white' : 'hsl(var(--primary))'
                                          }}
                                        >
                                          {limitValue}
                            </span>
                                        <div className="min-w-0">
                                          <p 
                                            className="text-body font-semibold"
                                            style={{ color: hasColoredBg ? 'white' : 'hsl(var(--foreground))' }}
                                          >
                                            {feature.name}
                                          </p>
                                          {feature.description && (
                                            <p 
                                              className="text-body font-normal"
                                              style={{ color: hasColoredBg ? 'rgba(255,255,255,0.7)' : 'hsl(var(--muted-foreground))' }}
                                            >
                                              {feature.description}
                                            </p>
                          )}
                        </div>
                      </div>
                                    );
                                  }

                                  // For regular features, show check/X icon
                                  return (
                                    <div key={feature.id} className="flex items-start gap-3">
                                      <div className="w-5 flex justify-center flex-shrink-0">
                                        {isIncluded ? (
                                          <Check 
                                            size={18} 
                                            className="mt-0.5" 
                                            style={{ color: hasColoredBg ? 'white' : 'hsl(var(--primary))' }} 
                                          />
                                        ) : (
                                          <X 
                                            size={18} 
                                            className="mt-0.5" 
                                            style={{ color: hasColoredBg ? 'rgba(255,255,255,0.4)' : 'hsl(var(--muted-foreground) / 0.4)' }}
                                          />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p 
                                          className="text-body font-semibold"
                                          style={{ 
                                            color: hasColoredBg 
                                              ? (isIncluded ? 'white' : 'rgba(255,255,255,0.5)')
                                              : (isIncluded ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground) / 0.5)')
                                          }}
                                        >
                                          {feature.name}
                                        </p>
                                        {feature.description && (
                                          <p 
                                            className="text-body font-normal"
                                            style={{ 
                                              color: hasColoredBg 
                                                ? (isIncluded ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)')
                                                : (isIncluded ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground) / 0.4)')
                                            }}
                                          >
                                            {feature.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                      {/* Button for paid plans */}
                      {!p.isFree && (
                        <button
                          onClick={() => {
                            // For new subscriptions, open the modal to allow promo/referral codes
                            // For existing paid subscriptions, directly change plan
                            if (hasActivePaidSubscription && p.id !== 'test') {
                              handleSelectPlan(p.id as 'core' | 'pro' | 'test', billingPeriod);
                            } else {
                              handleOpenPlanConfirm(p.id as 'core' | 'pro' | 'test', billingPeriod);
                            }
                          }}
                          disabled={loadingPlan !== null || isCurrentPlan || !isAdmin}
                          className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                              isCurrentPlan || !isAdmin
                                ? 'cursor-not-allowed'
                                : ''
                            }`}
                            style={{ 
                              backgroundColor: hasColoredBg 
                                ? (isCurrentPlan || !isAdmin ? 'rgba(255,255,255,0.2)' : 'white')
                                : (isCurrentPlan || !isAdmin ? 'hsl(var(--secondary))' : 'hsl(var(--primary))'),
                              color: hasColoredBg 
                                ? (isCurrentPlan || !isAdmin ? 'rgba(255,255,255,0.6)' : p.accentColor)
                                : (isCurrentPlan || !isAdmin ? 'hsl(var(--muted-foreground))' : 'white'),
                            }}
                        >
                          {getButtonLabel()}
                        </button>
                      )}

                      {/* Free plan - show current plan indicator OR downgrade button */}
                      {p.isFree && isCurrentPlan && (
                          <div 
                            className="w-full py-3 rounded-xl font-semibold text-center"
                            style={{
                              backgroundColor: 'hsl(var(--secondary))',
                              color: 'hsl(var(--muted-foreground))'
                            }}
                          >
                          {t['common.current_plan'] || 'Current Plan'}
                        </div>
                      )}
                      
                      {/* Downgrade to Free button - only show when user has active paid subscription */}
                      {p.isFree && !isCurrentPlan && hasActivePaidSubscription && (
                        <button
                          onClick={handleDowngradeToFree}
                          disabled={loadingPlan !== null || !isAdmin}
                            className={`w-full py-3 rounded-xl font-semibold transition-colors border ${
                              !isAdmin ? 'cursor-not-allowed' : ''
                            }`}
                            style={{
                              backgroundColor: 'hsl(var(--muted-foreground) / 0.1)',
                              borderColor: 'hsl(var(--border))',
                              color: !isAdmin ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))'
                            }}
                        >
                          {loadingPlan !== null ? (t['common.processing'] || 'Processing...') : !isAdmin ? (t['common.only_admin_can_change'] || 'Only Admin Can Change') : (t['common.downgrade'] || 'Downgrade')}
                        </button>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Plan confirmation + promo code modal */}
          {isPlanConfirmOpen && pendingPlan && createPortal(
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end md:items-center justify-center bottom-sheet-backdrop"
              onClick={(e) => { if (e.target === e.currentTarget) setIsPlanConfirmOpen(false); }}
            >
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

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto max-h-[60vh]">
                <div className="p-5 space-y-3">
                  <p className="text-body text-foreground">
                    {(t['subscription.upgrade_to'] || 'You are about to upgrade to the {plan} plan.').replace('{plan}', pendingPlan.plan === 'core' ? 'Core' : pendingPlan.plan === 'pro' ? 'Pro' : 'Test')}
                  </p>

                  {/* Referral Code Section */}
                  <div className="space-y-2">
                    <label className="text-caption font-bold text-muted-foreground ml-1">
                      {t['subscription.referral_code'] || 'Referral Code (for free trial)'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        autoComplete="one-time-code"
                        value={referralCodeInput}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setReferralCodeInput(value);
                          setReferralCodeError(null);
                          setReferralCodeValid(false);
                        }}
                        onBlur={() => validateReferralCode(referralCodeInput)}
                        placeholder={t['subscription.referral_code_placeholder'] || 'e.g., PROMOCODE'}
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

                </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
                  <button
                    onClick={() => {
                      if (loadingPlan !== null) return;
                      setIsPlanConfirmOpen(false);
                      setPendingPlan(null);
                      setReferralCodeInput('');
                      setReferralCodeError(null);
                      setReferralCodeValid(false);
                    }}
                    disabled={loadingPlan !== null}
                    className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body  disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t['common.cancel'] || 'Cancel'}
                  </button>
                  <button
                    onClick={handleConfirmPlan}
                    disabled={loadingPlan !== null || isValidatingReferral}
                    className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold  disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingPlan !== null ? (t['common.processing'] || 'Processing...') : (t['common.continue'] || 'Continue')}
                  </button>
                </div>
              </div>
            </div>
          , document.body)}

          {/* Downgrade Confirmation Modal - Bottom Sheet */}
          {showDowngradeModal && pendingDowngrade && createPortal(
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
              onClick={(e) => { if (e.target === e.currentTarget) setShowDowngradeModal(false); }}
            >
              {/* Safe area bottom cover */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-card"
                style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
              />
              <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                {/* Close Button */}
                <button 
                  onClick={handleCancelDowngrade} 
                  className="absolute z-10 w-10 h-10 rounded-full flex items-center justify-center right-4 top-4 text-muted-foreground"
                  aria-label={t['common.close'] || 'Close'}
                >
                  <X size={20} />
                </button>

                {/* Header */}
                <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle size={20} className="text-destructive" />
                    </div>
                    <h2 className="text-title text-destructive">
                      {pendingDowngrade.type === 'paid_to_free' 
                        ? (t['subscription.downgrade_to_free_title'] || 'Cancel Subscription')
                        : (t['subscription.downgrade_plan_title'] || 'Downgrade Plan')
                      }
                    </h2>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <p className="text-body text-muted-foreground">
                    {pendingDowngrade.type === 'paid_to_free' 
                      ? (t['subscription.downgrade_to_free_desc'] || 'This is immediate and you will NOT receive a refund for your remaining paid period. You will lose access to premium features.')
                      : (t['subscription.downgrade_plan_desc'] || 'Your unused time will be credited toward your next invoice. This change takes effect immediately.')
                    }
                  </p>
                </div>

                {/* Footer */}
                <div className="p-5 pb-8 border-t border-border shrink-0 flex gap-3">
                  <button
                    onClick={handleCancelDowngrade}
                    className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
                  >
                    {t['common.cancel'] || 'Cancel'}
                  </button>
                  <button
                    onClick={handleConfirmDowngrade}
                    className="flex-1 py-3.5 rounded-xl bg-destructive/10 text-destructive text-body font-semibold"
                  >
                    {t['common.confirm'] || 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          , document.body)}

          {/* Cancel Subscription Confirmation Modal */}
          {showCancelSubConfirm && createPortal(
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
              onClick={(e) => { if (e.target === e.currentTarget) setShowCancelSubConfirm(false); }}
            >
              {/* Safe area bottom cover */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-card"
                style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
              />
              <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
                {/* Header */}
                <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                  <h2 className="text-title text-foreground">{t['subscription.cancel_title'] || 'Cancel Subscription'}</h2>
                </div>

                {/* Content */}
                <div className="p-5">
                  <p className="text-body text-muted-foreground">
                    {t['subscription.confirm_cancel'] || 'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.'}
                  </p>
                </div>

                {/* Footer */}
                <div className="p-5 pb-8 border-t border-border flex gap-3 shrink-0">
                  <button
                    onClick={() => setShowCancelSubConfirm(false)}
                    className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body"
                  >
                    {t['common.keep_subscription'] || 'Keep Subscription'}
                  </button>
                  <button
                    onClick={confirmCancelSubscription}
                    className="flex-1 py-3.5 rounded-xl bg-destructive/10 text-destructive text-body"
                  >
                    {t['common.cancel_subscription'] || 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          , document.body)}

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
          <div className="pt-6">
            
            <div className="space-y-6">
              {/* Profile Information Section */}
              <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
                <h3 className="text-title font-bold text-foreground mb-4">{t['profile.profile_information'] || 'Profile Information'}</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.first_name'] || 'First Name'}</label>
                      <input
                        type="text"
                        autoComplete="given-name"
                        value={accountData.firstName}
                        onChange={e => setAccountData({ ...accountData, firstName: e.target.value })}
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none transition-colors text-body"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.last_name'] || 'Last Name'}</label>
                      <input
                        type="text"
                        autoComplete="family-name"
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
                          autoComplete="one-time-code"
                          readOnly
                          value={accountData.countryCode}
                          onClick={() => setShowCountryCodeDropdown(true)}
                          placeholder="+852"
                          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground font-medium focus:border-primary outline-none cursor-pointer transition-colors text-body"
                        />
                        <Globe size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        {showCountryCodeDropdown && (
                          <div className="absolute z-50 mt-1 w-64 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto country-code-dropdown">
                            <div className="p-2 sticky top-0 bg-card border-b border-border">
                              <input
                                type="text"
                                autoComplete="one-time-code"
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
                                    className="w-full text-left px-4 py-2  flex items-center justify-between"
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
                          autoComplete="tel"
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
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-caption font-bold text-muted-foreground ml-1">{t['profile.email_address'] || 'Email Address'}</label>
                    <div className="relative">
                      <input
                        type="email"
                        autoComplete="email"
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
                            autoComplete="current-password"
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
                            autoComplete="new-password"
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
                        {t['profile.google_managed'] || 'Your account is managed through Google. Password changes must be made through your Google account settings.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 space-y-3">
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
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold shadow-sm "
              >
                {t['common.save_changes'] || 'Save Changes'}
              </button>

              {/* Delete Account Button - Only for Master Users */}
              {currentUser.role === UserRole.MASTER && (
                <button
                  onClick={handleDeleteAccountClick}
                  className="w-full bg-destructive/10 text-destructive py-4 rounded-xl font-semibold shadow-sm  border border-destructive/20"
                >
                  {t['profile.delete_account'] || 'Delete Account'}
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
        {isDeleteAccountModalOpen && createPortal(
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) setIsDeleteAccountModalOpen(false); }}
          >
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
                  className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body "
                >
                  {t['common.cancel'] || 'Cancel'}
                </button>
                <button
                  onClick={handleFirstDeleteConfirm}
                  className="flex-1 py-3.5 rounded-xl bg-destructive/10 text-destructive text-body "
                >
                  {t['common.continue'] || 'Continue'}
                </button>
              </div>
            </div>
          </div>
        , document.body)}

        {/* Final Delete Confirmation Modal */}
        {isFinalDeleteConfirmOpen && createPortal(
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) setIsFinalDeleteConfirmOpen(false); }}
          >
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
                  className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground text-body  disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t['common.cancel'] || 'Cancel'}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="flex-1 py-3.5 rounded-xl bg-destructive text-destructive-foreground text-body disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingAccount ? (t['common.deleting'] || 'Deleting...') : (t['profile.delete_account'] || 'Delete Account')}
                </button>
              </div>
            </div>
          </div>
        , document.body)}

        {/* Subscription Cancellation Confirmation Modal */}
        {subscriptionCanceled && createPortal(
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) setSubscriptionCanceled(false); }}
          >
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
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body  font-semibold"
                >
                  {t['common.got_it'] || 'Got it'}
                </button>
              </div>
            </div>
          </div>
        , document.body)}
      </div>
    );
  }

  // =====================================================
  // APPEARANCE VIEW
  // =====================================================
  if (activeSection === 'appearance') {
    return (
      <div className="min-h-screen bg-background pb-40 animate-fade-in">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          {renderSettingsHeader(t['settings.appearance'] || 'Appearance', () => setActiveSection('settings'))}
          <div className="pt-6">
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3">
                <Monitor size={18} className="text-primary" />
                <div className="text-left">
                  <p className="font-bold text-foreground text-title">{t['settings.theme'] || 'Theme'}</p>
                  <p className="text-caption text-muted-foreground">{t['settings.follows_device'] || 'Follows your device setting'}</p>
                </div>
              </div>
            </div>
            
            <p className="text-caption text-muted-foreground mt-4 px-1">
              {t['settings.theme_info'] || 'Helpy automatically matches your device appearance. Change your device settings to switch between light and dark mode.'}
            </p>
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
  // USER GUIDE VIEW
  // =====================================================
  if (activeSection === 'guide') {
    return (
      <div className="min-h-screen bg-background pb-40 animate-fade-in">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
          {renderSettingsHeader(t['guide.title'] || 'User Guide', () => setActiveSection('settings'))}
          <div className="pt-6">
            <UserGuide
              currentUser={currentUser}
              t={t}
              onNavigateToPlan={() => setActiveSection('plan')}
              onNavigateToFeedback={() => setActiveSection('feedback')}
            />
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
  // FEEDBACK VIEW
  // =====================================================
  if (activeSection === 'feedback') {
    return (
      <FeedbackSection
        currentUser={currentUser}
        householdId={currentUser.householdId}
        t={t}
        onBack={() => setActiveSection('settings')}
      />
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
          <div className="pt-6">

            <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
              {[
                { id: 'plan', label: t['common.plan'] || 'Subscription', icon: Crown, helperHidden: true },
                { id: 'security', label: t['common.security'] || 'Account', icon: Shield, helperHidden: false },
                { id: 'appearance', label: t['settings.appearance'] || 'Appearance', icon: Palette, helperHidden: false },
                { id: 'timezone', label: t['settings.timezone'] || 'Time Zone', icon: Globe, helperHidden: false, isStatic: true },
                { id: 'feedback', label: t['feedback.title'] || 'Feedback', icon: MessageCircleQuestionMark, helperHidden: false },
              ]
                .filter(item => !isHelper || !item.helperHidden)
                .map((item, index, filteredArray) => (
                <div key={item.id}>
                  {item.isStatic ? (
                    // Static timezone display (no navigation)
                    <div className="w-full px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <item.icon size={18} className="text-primary" />
                        <div>
                          <p className="font-bold text-foreground text-title">{item.label}</p>
                          <p className="text-caption text-muted-foreground">UTC +8 | Hong Kong, Singapore, Philippines</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveSection(item.id as any)}
                      className="w-full px-5 py-4 flex items-center justify-between "
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={18} className="text-primary" />
                        <p className="font-bold text-foreground text-title">{item.label}</p>
                      </div>
                      <ChevronRight size={20} className="text-muted-foreground" />
                    </button>
                  )}
                  {index < filteredArray.length - 1 && (
                    <div className="px-5"><div className="h-px bg-border w-full"></div></div>
                  )}
                </div>
              ))}
            </div>

            {/* Notifications Section - State-based UI */}
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden mt-6">
              {(() => {
                const isPwa = isRunningAsPwa();
                const isWorking = pushSupported && pushPermission === 'granted' && accountData.notificationsEnabled && currentUser.hasPushSubscription;
                const isBlocked = pushPermission === 'denied';
                const isOff = !accountData.notificationsEnabled;
                
                // STATE 1: Not running as PWA (browser mode)
                if (!isPwa) {
                  return (
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-3 mb-3">
                        <BellOff size={18} className="text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-bold text-foreground text-title">{t['profile.notifications'] || 'Notifications'}</p>
                          <p className="text-caption text-muted-foreground">
                            {t['pwa.add_to_home'] || 'Add Helpy to Home Screen'}
                          </p>
                        </div>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-4">
                        {isIosDevice() ? (
                          <>
                            <p className="text-body text-muted-foreground mb-3">
                              {t['pwa.notification_requires_install'] || 'To receive notifications, add Helpy to your home screen:'}
                            </p>
                            <ol className="text-body text-muted-foreground space-y-2 list-decimal pl-4">
                              <li>
                                {t['pwa.ios_step1_tap_share'] || 'Tap the'} <strong>{t['pwa.share'] || 'Share'}</strong> {t['pwa.ios_step1_button'] || 'button'} <Share2 size={14} className="inline text-primary" />
                                <p className="text-caption text-muted-foreground mt-0.5">{t['pwa.ios_share_location'] || '(at the bottom of the screen)'}</p>
                              </li>
                              <li>
                                {t['pwa.ios_step2_scroll'] || 'Scroll down and tap'} <strong>"{t['pwa.add_to_home_screen'] || 'Add to Home Screen'}"</strong>
                              </li>
                              <li>
                                {t['pwa.ios_step3_tap'] || 'Tap'} <strong>"{t['pwa.add'] || 'Add'}"</strong> {t['pwa.ios_step3_location'] || 'in the top right corner'}
                              </li>
                            </ol>
                          </>
                        ) : isAndroidDevice() ? (
                          <>
                            <p className="text-body text-muted-foreground mb-3">
                              {t['pwa.notification_requires_install'] || 'To receive notifications, add Helpy to your home screen:'}
                            </p>
                            <ol className="text-body text-muted-foreground space-y-2 list-decimal pl-4">
                              <li>
                                {t['pwa.android_step1_tap'] || 'Tap the'} <strong>{t['pwa.menu'] || 'menu'}</strong> <MoreVertical size={14} className="inline text-primary" />
                                <p className="text-caption text-muted-foreground mt-0.5">{t['pwa.android_menu_location'] || '(three dots in the top right corner)'}</p>
                              </li>
                              <li>
                                {t['pwa.android_step2_tap'] || 'Tap'} <strong>"{t['pwa.add_to_home_screen'] || 'Add to Home Screen'}"</strong> {t['pwa.or'] || 'or'} <strong>"{t['pwa.install_app'] || 'Install app'}"</strong>
                              </li>
                              <li>
                                {t['pwa.android_step3_tap'] || 'Tap'} <strong>"{t['pwa.add'] || 'Add'}"</strong> {t['pwa.or'] || 'or'} <strong>"{t['pwa.install'] || 'Install'}"</strong> {t['pwa.to_confirm'] || 'to confirm'}
                              </li>
                            </ol>
                          </>
                        ) : (
                          <>
                            <p className="text-body text-muted-foreground mb-2">
                              <strong>{t['pwa.desktop_mobile_best'] || 'Notifications work best on mobile.'}</strong>
                            </p>
                            <p className="text-body text-muted-foreground">
                              {t['pwa.desktop_install_mobile'] || 'Install Helpy on your iPhone or Android to receive notifications on the go.'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                }

                // STATE 2: Permission blocked
                if (isBlocked) {
                  return (
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-3 mb-3">
                        <BellOff size={18} className="text-destructive shrink-0" />
                        <div>
                          <p className="font-bold text-foreground text-title">{t['profile.notifications'] || 'Notifications'}</p>
                          <p className="text-caption text-destructive">
                            {t['notifications.blocked_status'] || 'Blocked'}
                          </p>
                        </div>
                      </div>
                      <div className="bg-destructive/10 rounded-xl p-4">
                        <p className="text-body text-destructive mb-3">
                          {t['notifications.blocked_explanation'] || 'Notifications are blocked. To enable them:'}
                        </p>
                        {isIosDevice() ? (
                          <ol className="text-body text-destructive space-y-2 list-decimal pl-4">
                            <li>{t['notifications.ios_unblock_1'] || 'Open Settings on your iPhone'}</li>
                            <li>{t['notifications.ios_unblock_2'] || 'Scroll down and tap "Helpy"'}</li>
                            <li>{t['notifications.ios_unblock_3'] || 'Tap "Notifications" and enable "Allow Notifications"'}</li>
                          </ol>
                        ) : isAndroidDevice() ? (
                          <ol className="text-body text-destructive space-y-2 list-decimal pl-4">
                            <li>{t['notifications.android_unblock_1'] || 'Open Settings on your phone'}</li>
                            <li>{t['notifications.android_unblock_2'] || 'Tap "Apps" then find "Helpy"'}</li>
                            <li>{t['notifications.android_unblock_3'] || 'Tap "Notifications" and enable them'}</li>
                          </ol>
                        ) : (
                          <ol className="text-body text-destructive space-y-2 list-decimal pl-4">
                            <li>{t['notifications.desktop_unblock_1'] || 'Click the lock icon in the address bar'}</li>
                            <li>{t['notifications.desktop_unblock_2'] || 'Find "Notifications" and change to "Allow"'}</li>
                          </ol>
                        )}
                      </div>
                    </div>
                  );
                }

                // STATE 3: Working (permission granted + subscription active)
                if (isWorking) {
                  return (
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Bell size={18} className="text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-foreground text-title">{t['profile.notifications'] || 'Notifications'}</p>
                            <p className="text-caption text-primary font-medium">
                              {t['settings.enabled'] || 'Enabled'}
                            </p>
                          </div>
                        </div>
                        {/* Mute toggle - allows user to mute without going to OS settings.
                            We just disable in database, keeping the browser subscription intact.
                            This makes re-enabling fast and reliable. */}
                        <button
                          disabled={isTogglingNotifications}
                          onClick={async () => {
                            setIsTogglingNotifications(true);
                            isTogglingRef.current = true;
                            try {
                              setAccountData({ ...accountData, notificationsEnabled: false });
                              await onUpdate(currentUser.id, { 
                                notificationsEnabled: false
                                // Keep hasPushSubscription: true - subscription still exists
                              });
                              console.log('[Profile] Notifications muted (subscription preserved)');
                            } catch (error) {
                              console.error('[Profile] Error muting notifications:', error);
                              setAccountData({ ...accountData, notificationsEnabled: true });
                            } finally {
                              setTimeout(() => {
                                isTogglingRef.current = false;
                                setIsTogglingNotifications(false);
                              }, 300);
                            }
                          }}
                          className="shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-primary"
                        >
                          {isTogglingNotifications ? (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Loader2 size={14} className="animate-spin text-white" />
                            </span>
                          ) : (
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                          )}
                        </button>
                      </div>
                      <p className="text-caption text-muted-foreground mt-2 ml-8">
                        {t['settings.manage_in_phone'] || 'Manage notification settings in your phone Settings.'}
                      </p>
                    </div>
                  );
                }

                // STATE 4: Off (user disabled) or needs setup
                return (
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <BellOff size={18} className={isOff ? "text-muted-foreground shrink-0" : "text-orange-500 shrink-0"} />
                        <div className="min-w-0">
                          <p className="font-bold text-foreground text-title">{t['profile.notifications'] || 'Notifications'}</p>
                          <p className="text-caption text-muted-foreground">
                            {isOff 
                              ? (t['settings.off'] || 'Off')
                              : (t['settings.setup_incomplete'] || 'Setup incomplete')
                            }
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={isTogglingNotifications}
                        onClick={async () => {
                          setIsTogglingNotifications(true);
                          isTogglingRef.current = true;
                          
                          try {
                            // Optimistically update UI
                            setAccountData({ ...accountData, notificationsEnabled: true });
                            
                            // Check if we already have a valid subscription
                            const capability = await checkNotificationCapability(
                              currentUser.id,
                              currentUser.householdId
                            );
                            
                            if (capability.capable) {
                              // Subscription already exists, just enable in database
                              console.log('[Profile] Re-enabling existing subscription');
                              await onUpdate(currentUser.id, { 
                                notificationsEnabled: true,
                                hasPushSubscription: true
                              });
                            } else {
                              // Need to set up subscription (first time or was fully unsubscribed)
                              console.log('[Profile] Setting up new subscription, reason:', capability.reason);
                              
                              const subscription = await subscribeToPush(
                                currentUser.id,
                                currentUser.householdId
                              );
                              
                              setPushPermission(getNotificationPermission());
                              
                              if (subscription) {
                                console.log('[Profile] Notifications enabled successfully');
                                await onUpdate(currentUser.id, { 
                                  notificationsEnabled: true,
                                  hasPushSubscription: true
                                });
                              } else {
                                // Revert on failure
                                const newPermission = getNotificationPermission();
                                console.warn('[Profile] Subscription failed');
                                setAccountData({ ...accountData, notificationsEnabled: false });
                                
                                if (newPermission === 'denied') {
                                  setPushPermission('denied');
                                } else {
                                  showAlert(
                                    t['notifications.setup_failed_title'] || 'Setup Failed',
                                    t['notifications.setup_failed'] || 'Failed to enable notifications. Please try again.',
                                    'error'
                                  );
                                }
                              }
                            }
                          } catch (error) {
                            console.error('[Profile] Error enabling notifications:', error);
                            setAccountData({ ...accountData, notificationsEnabled: false });
                            showAlert(
                              t['notifications.setup_failed_title'] || 'Setup Failed',
                              t['notifications.setup_failed'] || 'Failed to enable notifications. Please try again.',
                              'error'
                            );
                          } finally {
                            setTimeout(() => {
                              isTogglingRef.current = false;
                              setIsTogglingNotifications(false);
                            }, 300);
                          }
                        }}
                        className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          accountData.notificationsEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
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
                    <p className="text-caption text-muted-foreground mt-2 ml-8">
                      {t['settings.push_description_short'] || 'Get notified about family activity.'}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Footer */}
          <div className="helpy-footer">
            <span className="helpy-logo">helpy</span>
          </div>
        </div>

        {/* Generic Alert Modal (replaces native alert()) */}
        {alertModal.isOpen && createPortal(
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) setAlertModal(prev => ({ ...prev, isOpen: false })); }}
          >
            {/* Safe area bottom cover */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-card"
              style={{ height: 'env(safe-area-inset-bottom, 34px)' }}
            />
            <div className="bg-card w-full max-w-md rounded-t-2xl overflow-hidden bottom-sheet-content relative flex flex-col" style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}>
              {/* Header */}
              <div className="pt-6 pb-4 px-5 border-b border-border shrink-0">
                <h2 className={`text-title ${alertModal.type === 'error' ? 'text-destructive' : alertModal.type === 'success' ? 'text-primary' : 'text-foreground'}`}>
                  {alertModal.title}
                </h2>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-body text-muted-foreground">
                  {alertModal.message}
                </p>
              </div>

              {/* Footer */}
              <div className="p-5 pb-8 border-t border-border shrink-0">
                <button
                  onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                  className={`w-full py-3.5 rounded-xl text-body ${
                    alertModal.type === 'error' 
                      ? 'bg-destructive/10 text-destructive' 
                      : alertModal.type === 'success'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  {t['common.ok'] || 'OK'}
                </button>
              </div>
            </div>
          </div>
        , document.body)}
      </div>
    );
  }

  return null;
};

export default Profile;