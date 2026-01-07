import React from 'react';

export enum UserRole {
  MASTER = 'Admin',
  SUPERADMIN = 'SuperAdmin',
  SPOUSE = 'Spouse',
  HELPER = 'Helper',
  CHILD = 'Child',
  OTHER = 'Other'
}

export type OnboardingStatus = 'not_started' | 'skipped' | 'completed';

export interface User {
  id: string;
  householdId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  countryCode?: string;
  role: UserRole;
  avatar?: string;
  allergies?: string[];
  preferences?: string[];
  status?: 'active' | 'pending'; // Made optional - defaults to 'active'
  expiresAt?: string | null; 
  email?: string;
  password?: string;
  pin?: string;
  notificationsEnabled?: boolean;
  hasPushSubscription?: boolean;
  onboardingStatus?: OnboardingStatus;
  // Helper-specific salary fields (only populated for Helper role)
  helperStartDate?: string | null;
  helperBaseSalary?: number;
  helperFoodAllowance?: number;
  helperOtherAllowances?: Array<{ name: string; amount: number }>;
}

export interface Section {
  id: string;
  category: string;
  title: string;
  content: string;
}

// --- ToDo Types (Unified Shopping + Tasks) ---
export type ToDoType = 'shopping' | 'task';

export enum ShoppingCategory {
  SUPERMARKET = 'Supermarket',
  WET_MARKET = 'Wet Market',
  OTHERS = 'Others'
}

export enum TaskCategory {
  HOME_CARE = 'Home Care',
  FAMILY_CARE = 'Family Care',
  OTHERS = 'Others'
}

export type ToDoCategory = ShoppingCategory | TaskCategory;

// Recurrence types for tasks
export type RecurrenceFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  dayOfWeek?: number; // 0=Sun, 1=Mon... (for WEEKLY)
  dayOfMonth?: number; // 1-31 (for MONTHLY)
}

// Recurring Series - Template for recurring tasks (Google Calendar style)
export interface RecurringSeries {
  id: string;
  householdId: string;
  // Task template (copied to each instance)
  name: string;
  category: string;
  assigneeId?: string;
  dueTime?: string;
  // Recurrence rules
  frequency: RecurrenceFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  // Series bounds
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (null = forever)
  // Metadata
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

// Edit/Delete action scope for recurring tasks
export type RecurringActionScope = 'this' | 'all';

// Unified ToDo Item
export interface ToDoItem {
  id: string;
  type: ToDoType;
  name: string; // Item name or task title
  category: string; // ShoppingCategory or TaskCategory value
  completed: boolean;
  completedAt?: string; // When item was marked complete (for sorting suggestions)
  assigneeId?: string; // Single assignee user ID
  createdBy?: string; // User ID who created this item (for notifications)
  createdAt?: string;
  // Shopping-specific
  quantity?: string;
  unit?: string;
  brand?: string; // Brand name (optional, not translated)
  // Task-specific
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  recurrence?: RecurrenceRule; // Legacy field (still used for display)
  // Recurring series (new instance-based model)
  seriesId?: string; // Links to recurring_series table (null = one-off task)
  isException?: boolean; // True if this instance was modified from series template
  originalDueDate?: string; // Original date if instance was moved
  // Translation fields
  nameLang?: string | null; // Language code of the name field (null if undetectable)
  nameTranslations?: Record<string, string>; // Translations: { "en": "original", "zh-CN": "translated", ... }
  // Soft delete
  deletedAt?: string; // Timestamp when item was soft-deleted (null = active)
}

// Legacy types for backwards compatibility
export interface ShoppingItem {
  id: string;
  name: string;
  category: ShoppingCategory;
  quantity: string;
  completed: boolean;
  addedBy?: string;
}

export interface Task {
  id: string;
  title: string;
  assignees: string[];
  dueDate: string;
  dueTime?: string;
  completed: boolean;
  recurrence?: RecurrenceRule;
}

export enum MealType {
  BREAKFAST = 'Breakfast',
  LUNCH = 'Lunch',
  DINNER = 'Dinner',
  SNACKS = 'Snacks'
}

export type MealAudience = 'ALL' | 'ADULTS' | 'KIDS';

export interface Meal {
  id: string;
  date: string;
  type: MealType;
  description: string;
  forUserIds: string[];
  audience: MealAudience;
  createdBy?: string; // User ID who created this meal (for notifications)
  // Translation fields
  descriptionLang?: string | null; // Language code of the description field (null if undetectable)
  descriptionTranslations?: Record<string, string>; // Translations: { "en": "original", "zh-CN": "translated", ... }
}

export interface ExpenseLineItem {
  name: string;
  price: number;
}

export interface Expense {
  id: string;
  amount: number;
  currency: string; // ISO 4217 currency code (e.g., 'HKD', 'USD') - defaults to 'HKD'
  category: string;
  date: string;
  merchant: string;
  receiptUrl?: string;
  createdBy?: string; // User ID who created this expense
  lineItems?: ExpenseLineItem[]; // Individual items extracted from receipt OCR
  // Translation fields
  merchantLang?: string | null; // Language code of the merchant field (null if undetectable)
  merchantTranslations?: Record<string, string>; // Translations: { "en": "original", "zh-CN": "translated", ... }
}

export interface HouseholdPlan {
  plan: 'free' | 'core' | 'pro' | 'test';
  status: string;
  periodEnd?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

export type TranslationDictionary = Record<string, string>;

export interface BaseViewProps {
  t: TranslationDictionary;
  currentLang: string;
}