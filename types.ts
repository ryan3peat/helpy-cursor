import React from 'react';

export enum UserRole {
  MASTER = 'Admin',
  SPOUSE = 'Spouse',
  HELPER = 'Helper',
  CHILD = 'Child'
}

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

// Unified ToDo Item
export interface ToDoItem {
  id: string;
  type: ToDoType;
  name: string; // Item name or task title
  category: string; // ShoppingCategory or TaskCategory value
  completed: boolean;
  assigneeId?: string; // Single assignee user ID
  createdAt?: string;
  // Shopping-specific
  quantity?: string;
  unit?: string;
  // Task-specific
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  recurrence?: RecurrenceRule;
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
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  merchant: string;
  receiptUrl?: string;
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