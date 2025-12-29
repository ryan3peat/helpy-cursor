// config/navConfig.ts
// Shared navigation and feature configuration for consistent icons across the app

import { 
  Home, 
  ClipboardList, 
  Utensils, 
  DollarSign, 
  Info,
  ShoppingCart,
  Users,
  Camera,
  MapPin,
  ListChecks,
  LucideIcon,
} from 'lucide-react';

// Main navigation items - used by Layout.tsx and UserGuide.tsx
export const NAV_ITEMS = {
  dashboard: {
    id: 'dashboard',
    labelKey: 'nav.home',
    icon: Home,
  },
  todo: {
    id: 'todo',
    labelKey: 'nav.todo',
    icon: ClipboardList,
  },
  meals: {
    id: 'meals',
    labelKey: 'nav.meals',
    icon: Utensils,
  },
  expenses: {
    id: 'expenses',
    labelKey: 'nav.cost',
    icon: DollarSign,
  },
  info: {
    id: 'info',
    labelKey: 'nav.info',
    icon: Info,
  },
} as const;

// Feature icons - used in UserGuide and feature cards
// These match the icons used in the actual feature pages (Dashboard.tsx, ToDo.tsx, etc.)
export const FEATURE_ICONS = {
  // To-Do sub-features (matching Dashboard stat cards and ToDo.tsx section tabs)
  shopping: ShoppingCart,    // Dashboard line 552, ToDo line 952
  tasks: ClipboardList,      // Dashboard line 560, ToDo line 934
  
  // Meals sub-features
  mealPlanning: Utensils,
  rsvp: Users,
  
  // Expenses sub-features
  manualEntry: DollarSign,
  receiptScan: Camera,
  
  // Household Info sub-features (matching HouseholdInfo.tsx)
  places: MapPin,           // MapPin used for Places section tab
  routines: ListChecks,     // ListChecks used for Practice/Routines section tab
  helperManagement: Users,
} as const;

// Helper type for accessing nav items
export type NavItemKey = keyof typeof NAV_ITEMS;

// Get icon component for a nav item
export const getNavIcon = (key: NavItemKey): LucideIcon => {
  return NAV_ITEMS[key].icon;
};

// Get icon component for a feature
export const getFeatureIcon = (key: keyof typeof FEATURE_ICONS): LucideIcon => {
  return FEATURE_ICONS[key];
};

