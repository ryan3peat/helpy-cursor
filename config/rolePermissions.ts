// config/rolePermissions.ts
// Centralized role permissions configuration
// This is the SINGLE SOURCE OF TRUTH for all role-based permissions
// Used by: UserGuide.tsx, Profile.tsx (Add Member), and permission checks

import { UserRole } from '../types';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface RoleAbility {
  key: string;
  label: string;
}

export interface RoleRestriction {
  key: string;
  label: string;
}

export interface RoleConfig {
  role: UserRole;
  displayName: string;
  description: string;
  abilities: RoleAbility[];
  restrictions: RoleRestriction[];
  // Technical permissions for code checks
  permissions: {
    // Essential Info (Places)
    places: { add: boolean; edit: boolean; delete: boolean; view: boolean };
    // House Routines (Practice)
    practice: { add: boolean; edit: boolean; delete: boolean; view: boolean };
    // Shopping
    shopping: { add: boolean; edit: boolean; delete: boolean; complete: boolean };
    // Tasks
    tasks: { add: boolean; edit: boolean; delete: boolean; complete: boolean };
    // Meals
    meals: { 
      add: boolean; 
      edit: boolean; 
      delete: boolean; 
      joinAll: boolean;
      joinAdults: boolean;
      joinKids: boolean;
    };
    // Expenses
    expenses: { 
      add: boolean; 
      editOwn: boolean; 
      editOthers: boolean;
      deleteOwn: boolean;
      deleteOthers: boolean;
      viewOwn: boolean;
      viewOthers: boolean;
      viewSummary: boolean;
    };
    // Family Notes
    familyNotes: { edit: boolean; view: boolean };
    // User Management
    userManagement: { 
      addInvite: boolean; 
      editOwnProfile: boolean;
      editOwnRole: boolean;
      editOthersProfile: boolean; 
      deleteOthers: boolean;
    };
    // Subscription
    subscription: { 
      viewPlans: boolean; 
      changePlan: boolean; 
      cancel: boolean; 
      managePayment: boolean;
    };
    // Account
    account: { deleteHousehold: boolean; logout: boolean };
  };
  // Whether to show in User Guide (SuperAdmin is hidden)
  showInGuide: boolean;
  // Whether to show in Add Member role selector (SuperAdmin is hidden)
  showInAddMember: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Role Configurations
// ─────────────────────────────────────────────────────────────────

export const ROLE_CONFIGS: Record<string, RoleConfig> = {
  // ─────────────────────────────────────────────────────────────────
  // ADMIN (Master)
  // ─────────────────────────────────────────────────────────────────
  [UserRole.MASTER]: {
    role: UserRole.MASTER,
    displayName: 'Admin',
    description: 'The household owner with full control',
    abilities: [
      { key: 'manage_family', label: 'Add and manage family members' },
      { key: 'invite_helpers', label: 'Invite helpers with secure links' },
      { key: 'manage_billing', label: 'Manage subscription and billing' },
      { key: 'edit_family_board', label: 'Edit the Family Board' },
      { key: 'manage_items', label: 'Add, edit, and delete all items' },
      { key: 'view_expenses', label: 'View all expenses and spending summaries' },
      { key: 'setup_places', label: 'Set up places and practice' },
      { key: 'delete_household', label: 'Delete the household account' },
    ],
    restrictions: [],
    permissions: {
      places: { add: true, edit: true, delete: true, view: true },
      practice: { add: true, edit: true, delete: true, view: true },
      shopping: { add: true, edit: true, delete: true, complete: true },
      tasks: { add: true, edit: true, delete: true, complete: true },
      meals: { add: true, edit: true, delete: true, joinAll: true, joinAdults: true, joinKids: false },
      expenses: { add: true, editOwn: true, editOthers: true, deleteOwn: true, deleteOthers: true, viewOwn: true, viewOthers: true, viewSummary: true },
      familyNotes: { edit: true, view: true },
      userManagement: { addInvite: true, editOwnProfile: true, editOwnRole: false, editOthersProfile: true, deleteOthers: true },
      subscription: { viewPlans: true, changePlan: true, cancel: true, managePayment: true },
      account: { deleteHousehold: true, logout: true },
    },
    showInGuide: true,
    showInAddMember: false, // Admin is the creator, can't add another Admin
  },

  // ─────────────────────────────────────────────────────────────────
  // SUPERADMIN (Internal)
  // ─────────────────────────────────────────────────────────────────
  [UserRole.SUPERADMIN]: {
    role: UserRole.SUPERADMIN,
    displayName: 'SuperAdmin',
    description: 'Internal administrator with debug access',
    abilities: [
      { key: 'all_admin', label: 'All Admin capabilities' },
      { key: 'debug_access', label: 'Internal debugging tools' },
    ],
    restrictions: [],
    permissions: {
      places: { add: true, edit: true, delete: true, view: true },
      practice: { add: true, edit: true, delete: true, view: true },
      shopping: { add: true, edit: true, delete: true, complete: true },
      tasks: { add: true, edit: true, delete: true, complete: true },
      meals: { add: true, edit: true, delete: true, joinAll: true, joinAdults: true, joinKids: false },
      expenses: { add: true, editOwn: true, editOthers: true, deleteOwn: true, deleteOthers: true, viewOwn: true, viewOthers: true, viewSummary: true },
      familyNotes: { edit: true, view: true },
      userManagement: { addInvite: true, editOwnProfile: true, editOwnRole: false, editOthersProfile: true, deleteOthers: true },
      subscription: { viewPlans: true, changePlan: true, cancel: true, managePayment: true },
      account: { deleteHousehold: true, logout: true },
    },
    showInGuide: false, // Hidden from users
    showInAddMember: false, // Cannot add SuperAdmin
  },

  // ─────────────────────────────────────────────────────────────────
  // SPOUSE
  // ─────────────────────────────────────────────────────────────────
  [UserRole.SPOUSE]: {
    role: UserRole.SPOUSE,
    displayName: 'Spouse',
    description: 'Partner with nearly full access',
    abilities: [
      { key: 'manage_family', label: 'Add and manage family members' },
      { key: 'invite_helpers', label: 'Invite helpers with secure links' },
      { key: 'edit_family_board', label: 'Edit the Family Board' },
      { key: 'manage_items', label: 'Add, edit, and delete all items' },
      { key: 'view_expenses', label: 'View all expenses and spending summaries' },
      { key: 'setup_places', label: 'Set up places and practice' },
    ],
    restrictions: [
      { key: 'no_billing', label: 'Manage subscription or billing' },
      { key: 'no_delete_household', label: 'Delete the household account' },
    ],
    permissions: {
      places: { add: true, edit: true, delete: true, view: true },
      practice: { add: true, edit: true, delete: true, view: true },
      shopping: { add: true, edit: true, delete: true, complete: true },
      tasks: { add: true, edit: true, delete: true, complete: true },
      meals: { add: true, edit: true, delete: true, joinAll: true, joinAdults: true, joinKids: false },
      expenses: { add: true, editOwn: true, editOthers: true, deleteOwn: true, deleteOthers: true, viewOwn: true, viewOthers: true, viewSummary: true },
      familyNotes: { edit: true, view: true },
      userManagement: { addInvite: true, editOwnProfile: true, editOwnRole: true, editOthersProfile: true, deleteOthers: true },
      subscription: { viewPlans: true, changePlan: false, cancel: false, managePayment: false },
      account: { deleteHousehold: false, logout: true },
    },
    showInGuide: true,
    showInAddMember: true,
  },

  // ─────────────────────────────────────────────────────────────────
  // HELPER
  // ─────────────────────────────────────────────────────────────────
  [UserRole.HELPER]: {
    role: UserRole.HELPER,
    displayName: 'Helper',
    description: 'Household staff with task-focused access',
    abilities: [
      { key: 'shopping_tasks', label: 'Add and complete shopping items and tasks' },
      { key: 'meals_rsvp', label: 'View meal plans and RSVP for meals' },
      { key: 'own_expenses', label: 'Enter and view your own expenses' },
      { key: 'view_places', label: 'View places and practice' },
      { key: 'sign_payslips', label: 'Sign payslips digitally' },
    ],
    restrictions: [
      { key: 'no_delete', label: 'Delete items (shopping, tasks, meals)' },
      { key: 'no_edit_places', label: 'Add or edit places and practice' },
      { key: 'no_others_expenses', label: "View other people's expenses" },
      { key: 'no_summary', label: 'View spending summaries' },
      { key: 'no_family_board', label: 'Edit the Family Board' },
      { key: 'no_manage_family', label: 'Manage family members' },
      { key: 'no_subscription', label: 'Access subscription settings' },
    ],
    permissions: {
      places: { add: false, edit: false, delete: false, view: true },
      practice: { add: false, edit: false, delete: false, view: true },
      shopping: { add: true, edit: true, delete: false, complete: true },
      tasks: { add: true, edit: true, delete: false, complete: true },
      meals: { add: true, edit: true, delete: false, joinAll: true, joinAdults: true, joinKids: false },
      expenses: { add: true, editOwn: true, editOthers: false, deleteOwn: false, deleteOthers: false, viewOwn: true, viewOthers: false, viewSummary: false },
      familyNotes: { edit: false, view: true },
      userManagement: { addInvite: false, editOwnProfile: true, editOwnRole: false, editOthersProfile: false, deleteOthers: false },
      subscription: { viewPlans: false, changePlan: false, cancel: false, managePayment: false },
      account: { deleteHousehold: false, logout: true },
    },
    showInGuide: true,
    showInAddMember: true,
  },

  // ─────────────────────────────────────────────────────────────────
  // CHILD
  // ─────────────────────────────────────────────────────────────────
  [UserRole.CHILD]: {
    role: UserRole.CHILD,
    displayName: 'Child',
    description: 'Family member with full access',
    abilities: [
      { key: 'manage_family', label: 'Add and manage family members' },
      { key: 'edit_family_board', label: 'Edit the Family Board' },
      { key: 'manage_items', label: 'Add, edit, and delete all items' },
      { key: 'view_expenses', label: 'View all expenses and spending summaries' },
      { key: 'setup_places', label: 'Set up places and practice' },
      { key: 'meals_kids', label: 'RSVP for "Everyone" and "Kids" meals' },
    ],
    restrictions: [
      { key: 'no_adults_meals', label: 'Join "Adults only" meals' },
      { key: 'no_billing', label: 'Manage subscription or billing' },
      { key: 'no_delete_household', label: 'Delete the household account' },
      { key: 'no_notifications', label: 'Receive push notifications' },
    ],
    permissions: {
      places: { add: true, edit: true, delete: true, view: true },
      practice: { add: true, edit: true, delete: true, view: true },
      shopping: { add: true, edit: true, delete: true, complete: true },
      tasks: { add: true, edit: true, delete: true, complete: true },
      meals: { add: true, edit: true, delete: true, joinAll: true, joinAdults: false, joinKids: true },
      expenses: { add: true, editOwn: true, editOthers: true, deleteOwn: true, deleteOthers: true, viewOwn: true, viewOthers: true, viewSummary: true },
      familyNotes: { edit: true, view: true },
      userManagement: { addInvite: true, editOwnProfile: true, editOwnRole: true, editOthersProfile: true, deleteOthers: true },
      subscription: { viewPlans: true, changePlan: false, cancel: false, managePayment: false },
      account: { deleteHousehold: false, logout: true },
    },
    showInGuide: true,
    showInAddMember: true,
  },

  // ─────────────────────────────────────────────────────────────────
  // OTHER
  // ─────────────────────────────────────────────────────────────────
  [UserRole.OTHER]: {
    role: UserRole.OTHER,
    displayName: 'Other',
    description: 'Extended family or guest with full access',
    abilities: [
      { key: 'manage_family', label: 'Add and manage family members' },
      { key: 'edit_family_board', label: 'Edit the Family Board' },
      { key: 'manage_items', label: 'Add, edit, and delete all items' },
      { key: 'view_expenses', label: 'View all expenses and spending summaries' },
      { key: 'setup_places', label: 'Set up places and practice' },
    ],
    restrictions: [
      { key: 'no_billing', label: 'Manage subscription or billing' },
      { key: 'no_delete_household', label: 'Delete the household account' },
    ],
    permissions: {
      places: { add: true, edit: true, delete: true, view: true },
      practice: { add: true, edit: true, delete: true, view: true },
      shopping: { add: true, edit: true, delete: true, complete: true },
      tasks: { add: true, edit: true, delete: true, complete: true },
      meals: { add: true, edit: true, delete: true, joinAll: true, joinAdults: true, joinKids: false },
      expenses: { add: true, editOwn: true, editOthers: true, deleteOwn: true, deleteOthers: true, viewOwn: true, viewOthers: true, viewSummary: true },
      familyNotes: { edit: true, view: true },
      userManagement: { addInvite: true, editOwnProfile: true, editOwnRole: true, editOthersProfile: true, deleteOthers: true },
      subscription: { viewPlans: true, changePlan: false, cancel: false, managePayment: false },
      account: { deleteHousehold: false, logout: true },
    },
    showInGuide: true,
    showInAddMember: true,
  },
};

// ─────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Get role config by UserRole enum value or string
 */
export function getRoleConfig(role: UserRole | string): RoleConfig | undefined {
  // Handle both enum and string values
  const roleKey = typeof role === 'string' ? role : role;
  return ROLE_CONFIGS[roleKey];
}

/**
 * Get all roles that should be shown in the User Guide
 */
export function getGuideRoles(): RoleConfig[] {
  return Object.values(ROLE_CONFIGS).filter(config => config.showInGuide);
}

/**
 * Get all roles that can be assigned when adding a family member
 */
export function getAddMemberRoles(): RoleConfig[] {
  return Object.values(ROLE_CONFIGS).filter(config => config.showInAddMember);
}

/**
 * Check if a user can perform a specific action
 * This can be used to replace scattered isHelper checks in the future
 */
export function canPerform(
  userRole: UserRole | string,
  feature: keyof RoleConfig['permissions'],
  action: string
): boolean {
  const config = getRoleConfig(userRole);
  if (!config) return false;
  
  const featurePermissions = config.permissions[feature];
  if (!featurePermissions) return false;
  
  return (featurePermissions as Record<string, boolean>)[action] ?? false;
}

/**
 * Check if user is a Helper (convenience function for common check)
 */
export function isHelperRole(role: UserRole | string): boolean {
  return role === UserRole.HELPER || role === 'Helper';
}

/**
 * Check if user is an Admin (Master or SuperAdmin)
 */
export function isAdminRole(role: UserRole | string): boolean {
  return role === UserRole.MASTER || role === 'Admin' || 
         role === UserRole.SUPERADMIN || role === 'SuperAdmin';
}

