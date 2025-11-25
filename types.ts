
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
  role: UserRole;
  avatar?: string;
  allergies?: string[];
  preferences?: string[];
  email?: string;
  password?: string;
  pin?: string;
}

export interface Section {
  id: string;
  category: string;
  title: string;
  content: string;
}

export enum ShoppingCategory {
  SUPERMARKET = 'Supermarket',
  WET_MARKET = 'Wet Market',
  OTHERS = 'Others'
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: ShoppingCategory;
  quantity: string;
  completed: boolean;
  addedBy?: string;
}

// --- Recurrence Types ---
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number; // e.g. 1 = every week, 2 = every 2 weeks
  weekDays?: number[]; // 0=Sun, 1=Mon...
  endCondition: 'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES';
  endDate?: string;
  endCount?: number;
}

export interface Task {
  id: string;
  title: string;
  assignees: string[]; // List of User IDs
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  completed: boolean;
  recurrence?: RecurrenceRule;
}

export enum MealType {
  BREAKFAST = 'Breakfast',
  LUNCH = 'Lunch',
  DINNER = 'Dinner'
}

export interface Meal {
  id: string;
  date: string;
  type: MealType;
  description: string;
  forUserIds: string[];
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
  icon: React.ReactNode;
}

export type TranslationDictionary = Record<string, string>;

export interface BaseViewProps {
  t: TranslationDictionary;
  currentLang: string;
}