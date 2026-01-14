import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { User, UserRole, ToDoItem, Meal, Expense, MealType, MealAudience, ShoppingCategory, TaskCategory } from '../types';
import type { Place, PlaceCategory } from '@src/types/place';
import type { Practice, PracticeCategory } from '@src/types/practice';
import type { HelperPayslipConfirmation } from '@src/types/helperManagement';

// Get a date as YYYY-MM-DD string in LOCAL timezone (not UTC)
// Using toISOString() would convert to UTC which causes date to be wrong after midnight in timezones ahead of UTC
const getLocalDateString = (date: Date = new Date()): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// ============================================================================
// DEMO MODE CONTEXT
// Provides mock data for marketing screenshots
// Only visible to SuperAdmin users
// ============================================================================

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  // Simulate being a free (non-paid) user - locks paid features for testing
  isSimulatingFreeUser: boolean;
  toggleSimulateFreeUser: () => void;
  // View the app as if you were a Helper - for testing Helper experience
  isViewingAsHelper: boolean;
  toggleViewingAsHelper: () => void;
  demoUsers: User[];
  demoTodoItems: ToDoItem[];
  demoMeals: Meal[];
  demoExpenses: Expense[];
  demoFamilyNotes: string;
  demoFamilyNotesLang: string;
  demoFamilyNotesTranslations: Record<string, string>;
  demoPlaces: Place[];
  demoPractices: Practice[];
  demoPastPayslips: HelperPayslipConfirmation[];
}

const DemoModeContext = createContext<DemoModeContextType | null>(null);

// ============================================================================
// MOCK USER DATA - Asian Hong Kong Family
// ============================================================================

// Custom 3D Pixar-style avatars for demo family
const DEMO_AVATARS = {
  dad: '/demo/dad.jpg',
  mom: '/demo/wife.jpeg',
  child: '/demo/child.jpeg',
  helper: '/demo/helper.jpeg',
  grandma: '/demo/grandma.jpeg',
};

const createDemoUsers = (): User[] => [
  {
    id: 'demo-dad-001',
    householdId: 'demo-household',
    name: 'David Wong',
    firstName: 'David',
    lastName: 'Wong',
    role: UserRole.SUPERADMIN,
    avatar: DEMO_AVATARS.dad,
    allergies: ['Shellfish'],
    preferences: ['Dim Sum', 'Cantonese Cuisine', 'No Spicy Food'],
    status: 'active',
    notificationsEnabled: true,
    hasPushSubscription: true,
  },
  {
    id: 'demo-mom-002',
    householdId: 'demo-household',
    name: 'Michelle Chan',
    firstName: 'Michelle',
    lastName: 'Chan',
    role: UserRole.SPOUSE,
    avatar: DEMO_AVATARS.mom,
    allergies: ['Peanuts'],
    preferences: ['Japanese Food', 'Organic', 'Low Sugar'],
    status: 'active',
    notificationsEnabled: true,
    hasPushSubscription: true,
  },
  {
    id: 'demo-child-003',
    householdId: 'demo-household',
    name: 'Ethan Wong',
    firstName: 'Ethan',
    lastName: 'Wong',
    role: UserRole.CHILD,
    avatar: DEMO_AVATARS.child,
    allergies: ['Dairy'],
    preferences: ['Pasta', 'Chicken', 'No Vegetables'],
    status: 'active',
  },
  {
    id: 'demo-helper-004',
    householdId: 'demo-household',
    name: 'Anna',
    firstName: 'Anna',
    lastName: '',
    role: UserRole.HELPER,
    avatar: DEMO_AVATARS.helper,
    allergies: [],
    preferences: ['Home Cooking', 'Rice Dishes'],
    status: 'active',
    notificationsEnabled: true,
    hasPushSubscription: true,
  },
  {
    id: 'demo-grandma-005',
    householdId: 'demo-household',
    name: 'Lily Wong',
    firstName: 'Lily',
    lastName: 'Wong',
    role: UserRole.OTHER,
    avatar: DEMO_AVATARS.grandma,
    allergies: ['Gluten', 'MSG'],
    preferences: ['Congee', 'Steamed Fish', 'Soup'],
    status: 'active',
    notificationsEnabled: true,
    hasPushSubscription: true,
  },
];

// ============================================================================
// MOCK TODO ITEMS
// ============================================================================

const createDemoTodoItems = (): ToDoItem[] => {
  const today = new Date();
  const tasks: ToDoItem[] = [];
  
  // Helper to create a date string offset from today
  const dateOffset = (days: number): string => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return getLocalDateString(d);
  };
  
  // Shopping Items
  const shoppingItems: Partial<ToDoItem>[] = [
    { name: 'Fresh Salmon', category: ShoppingCategory.WET_MARKET, quantity: '500', unit: 'g' },
    { name: 'Bok Choy', category: ShoppingCategory.WET_MARKET, quantity: '2', unit: 'bunches' },
    { name: 'Vitasoy Soy Milk', category: ShoppingCategory.SUPERMARKET, quantity: '6', unit: 'boxes', brand: 'Vitasoy' },
    { name: 'Lee Kum Kee Oyster Sauce', category: ShoppingCategory.SUPERMARKET, quantity: '1', unit: 'bottle', brand: 'Lee Kum Kee', completed: true },
    { name: 'Jasmine Rice', category: ShoppingCategory.SUPERMARKET, quantity: '5', unit: 'kg' },
  ];
  
  shoppingItems.forEach((item, i) => {
    tasks.push({
      id: `demo-shop-${String(i + 1).padStart(3, '0')}`,
      type: 'shopping',
      name: item.name!,
      category: item.category!,
      completed: item.completed || false,
      quantity: item.quantity || '1',
      unit: item.unit,
      brand: item.brand,
      assigneeId: 'demo-helper-004',
      createdAt: new Date().toISOString(),
    });
  });
  
  // Tasks spread across a month for calendar view testing
  const taskList: { name: string; category: string; daysOffset: number; time?: string; assignee?: string; recurrence?: any }[] = [
    // Today
    { name: 'Pick up Ethan from school', category: TaskCategory.FAMILY_CARE, daysOffset: 0, time: '15:30', recurrence: { frequency: 'WEEKLY', dayOfWeek: today.getDay() } },
    { name: 'Prepare dinner', category: TaskCategory.HOME_CARE, daysOffset: 0, time: '17:00' },
    
    // Tomorrow
    { name: 'Take grandma to doctor', category: TaskCategory.FAMILY_CARE, daysOffset: 1, time: '10:00', assignee: 'demo-mom-002' },
    { name: 'Clean bathroom', category: TaskCategory.HOME_CARE, daysOffset: 1, time: '14:00', recurrence: { frequency: 'WEEKLY', dayOfWeek: (today.getDay() + 1) % 7 } },
    
    // Day 2
    { name: 'Grocery shopping at Wellcome', category: TaskCategory.HOME_CARE, daysOffset: 2, time: '09:00' },
    { name: 'Pay electricity bill', category: TaskCategory.OTHERS, daysOffset: 2 },
    
    // Day 3
    { name: 'Ethan swimming class', category: TaskCategory.FAMILY_CARE, daysOffset: 3, time: '16:00', assignee: 'demo-mom-002' },
    { name: 'Vacuum living room', category: TaskCategory.HOME_CARE, daysOffset: 3 },
    
    // Day 4
    { name: 'Pick up dry cleaning', category: TaskCategory.OTHERS, daysOffset: 4, time: '11:00' },
    
    // Day 5
    { name: 'Water plants', category: TaskCategory.HOME_CARE, daysOffset: 5, recurrence: { frequency: 'WEEKLY', dayOfWeek: (today.getDay() + 5) % 7 } },
    { name: 'Call insurance company', category: TaskCategory.OTHERS, daysOffset: 5, time: '14:00', assignee: 'demo-dad-001' },
    
    // Day 6
    { name: 'Deep clean kitchen', category: TaskCategory.HOME_CARE, daysOffset: 6, time: '09:00' },
    { name: 'Ethan piano lesson', category: TaskCategory.FAMILY_CARE, daysOffset: 6, time: '15:00' },
    
    // Day 7 (1 week)
    { name: 'Organize pantry', category: TaskCategory.HOME_CARE, daysOffset: 7 },
    { name: 'Family dim sum brunch', category: TaskCategory.FAMILY_CARE, daysOffset: 7, time: '10:30', assignee: 'demo-dad-001' },
    
    // Day 8
    { name: 'Iron school uniforms', category: TaskCategory.HOME_CARE, daysOffset: 8, time: '08:00' },
    
    // Day 9
    { name: 'Renew library books', category: TaskCategory.OTHERS, daysOffset: 9 },
    { name: 'Prepare lunch boxes', category: TaskCategory.HOME_CARE, daysOffset: 9, time: '07:00' },
    
    // Day 10
    { name: 'Parent-teacher meeting', category: TaskCategory.FAMILY_CARE, daysOffset: 10, time: '14:00', assignee: 'demo-mom-002' },
    { name: 'Change bed sheets', category: TaskCategory.HOME_CARE, daysOffset: 10 },
    
    // Day 12
    { name: 'Take car for service', category: TaskCategory.OTHERS, daysOffset: 12, time: '09:00', assignee: 'demo-dad-001' },
    { name: 'Ethan dentist appointment', category: TaskCategory.FAMILY_CARE, daysOffset: 12, time: '16:00', assignee: 'demo-mom-002' },
    
    // Day 14 (2 weeks)
    { name: 'Grocery run - wet market', category: TaskCategory.HOME_CARE, daysOffset: 14, time: '07:30' },
    { name: 'Clean windows', category: TaskCategory.HOME_CARE, daysOffset: 14, time: '10:00' },
    
    // Day 15
    { name: 'Pay credit card bill', category: TaskCategory.OTHERS, daysOffset: 15, assignee: 'demo-dad-001' },
    
    // Day 16
    { name: 'Grandma birthday preparation', category: TaskCategory.FAMILY_CARE, daysOffset: 16 },
    { name: 'Order birthday cake', category: TaskCategory.OTHERS, daysOffset: 16, time: '11:00', assignee: 'demo-mom-002' },
    
    // Day 17
    { name: 'Birthday party', category: TaskCategory.FAMILY_CARE, daysOffset: 17, time: '12:00' },
    
    // Day 18
    { name: 'Return borrowed items', category: TaskCategory.OTHERS, daysOffset: 18 },
    
    // Day 20
    { name: 'Schedule helper medical checkup', category: TaskCategory.OTHERS, daysOffset: 20, assignee: 'demo-mom-002' },
    { name: 'Restock medicine cabinet', category: TaskCategory.HOME_CARE, daysOffset: 20 },
    
    // Day 21 (3 weeks)
    { name: 'Deep clean refrigerator', category: TaskCategory.HOME_CARE, daysOffset: 21, time: '09:00' },
    { name: 'Weekend family outing', category: TaskCategory.FAMILY_CARE, daysOffset: 21, time: '14:00', assignee: 'demo-dad-001' },
    
    // Day 23
    { name: 'Prepare school project materials', category: TaskCategory.FAMILY_CARE, daysOffset: 23, assignee: 'demo-mom-002' },
    
    // Day 25
    { name: 'Pay rent', category: TaskCategory.OTHERS, daysOffset: 25, assignee: 'demo-dad-001' },
    { name: 'Monthly deep clean', category: TaskCategory.HOME_CARE, daysOffset: 25, time: '08:00', recurrence: { frequency: 'MONTHLY', dayOfMonth: 25 } },
    
    // Day 27
    { name: 'Sort donation items', category: TaskCategory.HOME_CARE, daysOffset: 27 },
    
    // Day 28 (4 weeks)
    { name: 'Ethan report card day', category: TaskCategory.FAMILY_CARE, daysOffset: 28, time: '15:00', assignee: 'demo-mom-002' },
    { name: 'Plan next month meals', category: TaskCategory.HOME_CARE, daysOffset: 28 },
    
    // Day 30
    { name: 'End of month grocery inventory', category: TaskCategory.HOME_CARE, daysOffset: 30 },
    { name: 'Review household expenses', category: TaskCategory.OTHERS, daysOffset: 30, time: '20:00', assignee: 'demo-dad-001' },
  ];
  
  taskList.forEach((task, i) => {
    tasks.push({
      id: `demo-task-${String(i + 1).padStart(3, '0')}`,
      type: 'task',
      name: task.name,
      category: task.category,
      completed: false,
      assigneeId: task.assignee || 'demo-helper-004',
      dueDate: dateOffset(task.daysOffset),
      dueTime: task.time,
      recurrence: task.recurrence,
      createdAt: new Date().toISOString(),
    });
  });
  
  return tasks;
};

// ============================================================================
// MOCK MEALS - Week of meals for the family
// ============================================================================

const createDemoMeals = (): Meal[] => {
  const today = new Date();
  const meals: Meal[] = [];
  
  const mealPlan = [
    // Today
    { type: MealType.BREAKFAST, desc: 'Congee with Century Egg', audience: 'ALL' as MealAudience },
    { type: MealType.LUNCH, desc: 'Char Siu Rice with Vegetables', audience: 'ALL' as MealAudience },
    { type: MealType.DINNER, desc: 'Steamed Fish with Ginger and Spring Onion', audience: 'ADULTS' as MealAudience },
    { type: MealType.DINNER, desc: 'Chicken Nuggets with Pasta', audience: 'KIDS' as MealAudience },
    { type: MealType.SNACKS, desc: 'Egg Tarts and Milk Tea', audience: 'ALL' as MealAudience },
  ];
  
  const allUserIds = ['demo-dad-001', 'demo-mom-002', 'demo-child-003', 'demo-helper-004', 'demo-grandma-005'];
  const adultUserIds = ['demo-dad-001', 'demo-mom-002', 'demo-helper-004', 'demo-grandma-005'];
  const kidUserIds = ['demo-child-003'];
  
  mealPlan.forEach((meal, index) => {
    let forUserIds: string[];
    switch (meal.audience) {
      case 'ADULTS': forUserIds = adultUserIds; break;
      case 'KIDS': forUserIds = kidUserIds; break;
      default: forUserIds = allUserIds;
    }
    
    meals.push({
      id: `demo-meal-${index + 1}`,
      date: getLocalDateString(today),
      type: meal.type,
      description: meal.desc,
      forUserIds,
      audience: meal.audience,
      createdBy: 'demo-mom-002',
    });
  });
  
  // Tomorrow's meals
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const tomorrowMeals = [
    { type: MealType.BREAKFAST, desc: 'Dim Sum Variety', audience: 'ALL' as MealAudience },
    { type: MealType.LUNCH, desc: 'Wonton Noodle Soup', audience: 'ALL' as MealAudience },
    { type: MealType.DINNER, desc: 'Braised Pork Belly with Rice', audience: 'ALL' as MealAudience },
  ];
  
  tomorrowMeals.forEach((meal, index) => {
    meals.push({
      id: `demo-meal-tomorrow-${index + 1}`,
      date: getLocalDateString(tomorrow),
      type: meal.type,
      description: meal.desc,
      forUserIds: allUserIds,
      audience: meal.audience,
      createdBy: 'demo-helper-004',
    });
  });
  
  return meals;
};

// ============================================================================
// MOCK EXPENSES - January 2026 Hong Kong expenses
// ============================================================================

const createDemoExpenses = (): Expense[] => {
  // Common Hong Kong merchants
  const expenses: Expense[] = [
    // Housing & Utilities
    { id: 'demo-exp-002', amount: 850, currency: 'HKD', category: 'Housing & Utilities', date: '2026-01-05', merchant: 'CLP Power', createdBy: 'demo-dad-001' },
    { id: 'demo-exp-003', amount: 380, currency: 'HKD', category: 'Housing & Utilities', date: '2026-01-05', merchant: 'Towngas', createdBy: 'demo-dad-001' },
    { id: 'demo-exp-004', amount: 298, currency: 'HKD', category: 'Housing & Utilities', date: '2026-01-10', merchant: 'PCCW Broadband', createdBy: 'demo-dad-001' },
    
    // Food & Daily Needs
    { id: 'demo-exp-005', amount: 1580, currency: 'HKD', category: 'Food & Daily Needs', date: '2026-01-03', merchant: 'Wellcome Supermarket', createdBy: 'demo-helper-004' },
    { id: 'demo-exp-006', amount: 890, currency: 'HKD', category: 'Food & Daily Needs', date: '2026-01-07', merchant: 'ParknShop', createdBy: 'demo-helper-004' },
    { id: 'demo-exp-007', amount: 320, currency: 'HKD', category: 'Food & Daily Needs', date: '2026-01-08', merchant: 'Tai Po Wet Market', createdBy: 'demo-helper-004' },
    { id: 'demo-exp-008', amount: 156, currency: 'HKD', category: 'Food & Daily Needs', date: '2026-01-10', merchant: '7-Eleven', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-009', amount: 420, currency: 'HKD', category: 'Food & Daily Needs', date: '2026-01-12', merchant: 'AEON Supermarket', createdBy: 'demo-helper-004' },
    { id: 'demo-exp-010', amount: 680, currency: 'HKD', category: 'Food & Daily Needs', date: '2026-01-15', merchant: 'City Super', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-011', amount: 450, currency: 'HKD', category: 'Food & Daily Needs', date: '2026-01-18', merchant: 'Wellcome Supermarket', createdBy: 'demo-helper-004' },
    { id: 'demo-exp-012', amount: 285, currency: 'HKD', category: 'Food & Daily Needs', date: '2026-01-20', merchant: 'Tai Po Wet Market', createdBy: 'demo-helper-004' },
    { id: 'demo-exp-013', amount: 780, currency: 'HKD', category: 'Food & Daily Needs', date: '2026-01-25', merchant: 'ParknShop', createdBy: 'demo-helper-004' },
    
    // Transport & Travel
    { id: 'demo-exp-014', amount: 500, currency: 'HKD', category: 'Transport & Travel', date: '2026-01-02', merchant: 'Octopus Top-up', createdBy: 'demo-dad-001' },
    { id: 'demo-exp-015', amount: 300, currency: 'HKD', category: 'Transport & Travel', date: '2026-01-06', merchant: 'Uber Hong Kong', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-016', amount: 500, currency: 'HKD', category: 'Transport & Travel', date: '2026-01-15', merchant: 'Octopus Top-up', createdBy: 'demo-dad-001' },
    { id: 'demo-exp-017', amount: 180, currency: 'HKD', category: 'Transport & Travel', date: '2026-01-20', merchant: 'Shell Petrol Station', createdBy: 'demo-dad-001' },
    
    // Health & Personal Care
    { id: 'demo-exp-018', amount: 650, currency: 'HKD', category: 'Health & Personal Care', date: '2026-01-04', merchant: 'Mannings', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-019', amount: 380, currency: 'HKD', category: 'Health & Personal Care', date: '2026-01-11', merchant: 'Watsons', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-020', amount: 1200, currency: 'HKD', category: 'Health & Personal Care', date: '2026-01-16', merchant: 'Union Hospital - Dr. Lee', createdBy: 'demo-mom-002' },
    
    // Lifestyle
    { id: 'demo-exp-021', amount: 580, currency: 'HKD', category: 'Lifestyle', date: '2026-01-09', merchant: 'Tim Ho Wan', createdBy: 'demo-dad-001' },
    { id: 'demo-exp-022', amount: 450, currency: 'HKD', category: 'Lifestyle', date: '2026-01-14', merchant: 'Ocean Park', createdBy: 'demo-dad-001' },
    { id: 'demo-exp-023', amount: 320, currency: 'HKD', category: 'Lifestyle', date: '2026-01-19', merchant: 'Broadway Cinema', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-024', amount: 880, currency: 'HKD', category: 'Lifestyle', date: '2026-01-22', merchant: 'Yum Cha Restaurant', createdBy: 'demo-dad-001' },
    
    // Misc
    { id: 'demo-exp-025', amount: 180, currency: 'HKD', category: 'Misc', date: '2026-01-13', merchant: 'MUJI', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-026', amount: 250, currency: 'HKD', category: 'Misc', date: '2026-01-21', merchant: 'IKEA', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-027', amount: 150, currency: 'HKD', category: 'Misc', date: '2026-01-24', merchant: 'Japan Home Centre', createdBy: 'demo-helper-004' },
  ];
  
  return expenses;
};

// ============================================================================
// FAMILY BOARD MESSAGE
// ============================================================================

const DEMO_FAMILY_NOTES = "Hey everyone! Just discovered this awesome app called Helpy. Let's use it to keep our family organized. Anna, please add the grocery list here. Kids, check your tasks! Love you all.";

const DEMO_FAMILY_NOTES_TRANSLATIONS: Record<string, string> = {
  'en': DEMO_FAMILY_NOTES,
  'zh-HK': '大家好！我發現咗呢個好用嘅應用程式叫 Helpy。等我哋用佢嚟令我哋一家人更有條理。Anna，請喺度加購物清單。小朋友，記得睇吓你哋嘅任務！愛你哋。',
  'zh-CN': '大家好！我发现了这个很棒的应用叫 Helpy。让我们用它来让家庭更有条理。Anna，请在这里添加购物清单。孩子们，记得看看你们的任务！爱你们。',
  'zh-TW': '大家好！我發現了這個很棒的應用程式叫 Helpy。讓我們用它來讓家庭更有條理。Anna，請在這裡添加購物清單。孩子們，記得看看你們的任務！愛你們。',
  'tl': 'Hey lahat! Nadiskubre ko itong magandang app na Helpy. Gamitin natin ito para maayos ang ating pamilya. Anna, idagdag mo ang grocery list dito. Mga bata, tingnan ang mga tasks ninyo! Mahal ko kayo.',
  'id': 'Hai semuanya! Baru menemukan aplikasi keren bernama Helpy. Mari kita gunakan untuk mengatur keluarga kita. Anna, tolong tambahkan daftar belanja di sini. Anak-anak, cek tugas kalian! Sayang kalian.',
  'ko': '여러분 안녕! 방금 Helpy라는 멋진 앱을 발견했어요. 우리 가족을 정리하는 데 사용해요. Anna, 여기에 장보기 목록을 추가해 주세요. 아이들, 할 일을 확인해! 사랑해요.',
  'ja': 'みんなへ！Helpyという素晴らしいアプリを見つけました。家族の整理に使いましょう。Annaさん、買い物リストをここに追加してください。子供たち、タスクを確認して！愛しています。',
};

// ============================================================================
// MOCK PLACES - Hong Kong locations
// ============================================================================

const createDemoPlaces = (): Place[] => [
  // Home
  {
    id: 'demo-place-001',
    householdId: 'demo-household',
    category: 'Home' as PlaceCategory,
    name: 'Wong Family Residence',
    address: '88 Tai Po Road, Sha Tin, NT',
    countryCode: '+852',
    phone: '26001234',
    note: 'Passcode: 8899. Building management: Mr. Chan at lobby.',
  },
  // School
  {
    id: 'demo-place-002',
    householdId: 'demo-household',
    category: 'School' as PlaceCategory,
    name: "ESF Discovery College - Ethan's School",
    address: '38 Siena Avenue, Discovery Bay, Lantau Island',
    countryCode: '+852',
    phone: '39696088',
    note: 'Drop-off: 7:45am. Pick-up: 3:30pm (Gate B). Teacher: Ms. Johnson.',
  },
  {
    id: 'demo-place-003',
    householdId: 'demo-household',
    category: 'School' as PlaceCategory,
    name: 'ESF Kennedy School (Backup)',
    address: '19 Sha Wan Drive, Pokfulam',
    countryCode: '+852',
    phone: '25791902',
    note: 'For swimming lessons on Saturdays 10am.',
  },
  // Doctor
  {
    id: 'demo-place-004',
    householdId: 'demo-household',
    category: 'Doctor' as PlaceCategory,
    name: 'Dr. Lee Family Clinic',
    address: 'Room 1205, Prince Building, Central',
    countryCode: '+852',
    phone: '25231234',
    note: 'Ethan\'s pediatrician. Appointments needed. Best time: morning.',
  },
  {
    id: 'demo-place-005',
    householdId: 'demo-household',
    category: 'Doctor' as PlaceCategory,
    name: 'Dr. Chen Dental',
    address: 'Level 8, Tower 1, Grand Century Place, Mongkok',
    countryCode: '+852',
    phone: '27891234',
    note: 'Whole family dentist. 6-month checkup reminder.',
  },
  // Hospital
  {
    id: 'demo-place-006',
    householdId: 'demo-household',
    category: 'Hospital' as PlaceCategory,
    name: 'Prince of Wales Hospital - Emergency',
    address: '30-32 Ngan Shing Street, Sha Tin',
    countryCode: '+852',
    phone: '26322211',
    note: 'Nearest A&E. Keep medical cards in wallet.',
  },
  // Shops
  {
    id: 'demo-place-007',
    householdId: 'demo-household',
    category: 'Shops' as PlaceCategory,
    name: 'Tai Po Hui Wet Market',
    address: 'Fu Shin Street, Tai Po',
    countryCode: '+852',
    phone: '',
    note: 'Ask for Mrs. Lam for fresh fish (Stall 23). Best before 9am.',
  },
  {
    id: 'demo-place-008',
    householdId: 'demo-household',
    category: 'Shops' as PlaceCategory,
    name: 'ParknShop - Sha Tin',
    address: 'B2, New Town Plaza, Sha Tin',
    countryCode: '+852',
    phone: '',
    note: 'Tuesday is senior discount day. Parking: L2.',
  },
];

// ============================================================================
// DEMO PAST PAYSLIPS
// ============================================================================

const createDemoPastPayslips = (): HelperPayslipConfirmation[] => [
  // September 2025 - with overtime
  // Base: 4870, Other (food 1236 + transport 500): 1736, Overtime: 500 = Total: 7106
  {
    id: 'demo-payslip-001',
    householdId: 'demo-household',
    helperId: 'demo-helper-004',
    month: 9,
    year: 2025,
    salaryAmount: 7106,
    baseSalary: 4870,
    otherAllowancesTotal: 1736,
    overtimeTotal: 500,  // Worked on Mid-Autumn Festival
    employerSignedAt: '2025-09-30T10:00:00Z',
    employerUserId: 'demo-dad-001',
    helperSignedAt: '2025-09-30T11:30:00Z',
    createdAt: '2025-09-30T10:00:00Z',
  },
  // October 2025 - regular (no overtime)
  // Base: 4870, Other: 1736, Overtime: 0 = Total: 6606
  {
    id: 'demo-payslip-002',
    householdId: 'demo-household',
    helperId: 'demo-helper-004',
    month: 10,
    year: 2025,
    salaryAmount: 6606,
    baseSalary: 4870,
    otherAllowancesTotal: 1736,
    overtimeTotal: 0,
    employerSignedAt: '2025-10-31T09:00:00Z',
    employerUserId: 'demo-dad-001',
    helperSignedAt: '2025-10-31T14:00:00Z',
    createdAt: '2025-10-31T09:00:00Z',
  },
  // November 2025 - with overtime
  // Base: 4870, Other: 1736, Overtime: 300 = Total: 6906
  {
    id: 'demo-payslip-003',
    householdId: 'demo-household',
    helperId: 'demo-helper-004',
    month: 11,
    year: 2025,
    salaryAmount: 6906,
    baseSalary: 4870,
    otherAllowancesTotal: 1736,
    overtimeTotal: 300,  // Worked on a Sunday
    employerSignedAt: '2025-11-30T11:00:00Z',
    employerUserId: 'demo-dad-001',
    helperSignedAt: '2025-11-30T15:00:00Z',
    createdAt: '2025-11-30T11:00:00Z',
  },
  // December 2025 - UNSIGNED (to demo the pending signature feature)
  // Base: 4870, Other: 1736, Overtime: 0 = Total: 6606
  {
    id: 'demo-payslip-004',
    householdId: 'demo-household',
    helperId: 'demo-helper-004',
    month: 12,
    year: 2025,
    salaryAmount: 6606,
    baseSalary: 4870,
    otherAllowancesTotal: 1736,
    overtimeTotal: 0,
    employerSignedAt: null,  // Not signed yet!
    employerUserId: null,
    helperSignedAt: null,    // Not signed yet!
    createdAt: '2025-12-01T10:00:00Z',
  },
];

// ============================================================================
// DEMO PRACTICES
// ============================================================================

const createDemoPractices = (): Practice[] => [
  // Home Rules
  {
    id: 'demo-practice-001',
    householdId: 'demo-household',
    category: 'Home Rules' as PracticeCategory,
    name: 'No shoes inside the house',
    note: 'All family members and guests remove shoes at entrance. Slippers provided in shoe cabinet.',
  },
  {
    id: 'demo-practice-002',
    householdId: 'demo-household',
    category: 'Home Rules' as PracticeCategory,
    name: 'Screen time limits for Ethan',
    note: 'Weekdays: 30 mins after homework. Weekends: 1 hour max. No iPad after 7pm.',
  },
  // Routine
  {
    id: 'demo-practice-003',
    householdId: 'demo-household',
    category: 'Routine' as PracticeCategory,
    name: "Ethan's Morning Routine",
    note: 'Wake 6:30am, breakfast 7am, leave for school 7:30am. Pack snack box night before.',
  },
  {
    id: 'demo-practice-004',
    householdId: 'demo-household',
    category: 'Routine' as PracticeCategory,
    name: 'Grandma medicine schedule',
    note: 'Morning: Blood pressure pill with breakfast. Evening: Vitamin D after dinner.',
  },
  // Cooking
  {
    id: 'demo-practice-005',
    householdId: 'demo-household',
    category: 'Cooking' as PracticeCategory,
    name: 'Ethan prefers no vegetables mixed in',
    note: 'Serve veggies on the side. He will eat carrots and corn but not leafy greens.',
  },
  {
    id: 'demo-practice-006',
    householdId: 'demo-household',
    category: 'Cooking' as PracticeCategory,
    name: 'Grandma diet restrictions',
    note: 'Low sodium, no MSG. Congee must be soft. Avoid cold foods.',
  },
  {
    id: 'demo-practice-007',
    householdId: 'demo-household',
    category: 'Cooking' as PracticeCategory,
    name: 'Michelle is allergic to peanuts',
    note: 'Check all sauces and snacks for peanut ingredients. EpiPen in medicine cabinet.',
  },
  // Child Care
  {
    id: 'demo-practice-008',
    householdId: 'demo-household',
    category: 'Child Care' as PracticeCategory,
    name: 'Ethan bedtime routine',
    note: 'Bath 7:30pm, story time 8pm, lights out 8:30pm. Nightlight on, door slightly open.',
  },
  {
    id: 'demo-practice-009',
    householdId: 'demo-household',
    category: 'Child Care' as PracticeCategory,
    name: 'Ethan dairy allergy',
    note: 'Use oat milk for cereal. No cheese or ice cream. Lactose-free yogurt OK.',
  },
  // Cleaning
  {
    id: 'demo-practice-010',
    householdId: 'demo-household',
    category: 'Cleaning' as PracticeCategory,
    name: 'Weekly deep clean schedule',
    note: 'Mon: Bathrooms. Wed: Kitchen deep clean. Fri: All floors. Sat: Windows.',
  },
  // Laundry
  {
    id: 'demo-practice-011',
    householdId: 'demo-household',
    category: 'Laundry' as PracticeCategory,
    name: 'Delicate items handling',
    note: "Michelle's silk blouses: hand wash only. David's suits: dry clean (Mr. Clean, Sha Tin Centre).",
  },
  // Safety
  {
    id: 'demo-practice-012',
    householdId: 'demo-household',
    category: 'Safety' as PracticeCategory,
    name: 'Emergency contacts',
    note: 'David mobile: 9123 4567. Michelle mobile: 9234 5678. Emergency: 999.',
  },
  // Helper Care
  {
    id: 'demo-practice-013',
    householdId: 'demo-household',
    category: 'Helper Care' as PracticeCategory,
    name: 'Anna day off',
    note: 'Every Sunday. Usually returns by 9pm. Contact if running late.',
  },
];

// ============================================================================
// DEMO MODE PROVIDER
// ============================================================================

export const DemoModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isSimulatingFreeUser, setIsSimulatingFreeUser] = useState(false);
  const [isViewingAsHelper, setIsViewingAsHelper] = useState(false);
  
  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => !prev);
  }, []);
  
  const toggleSimulateFreeUser = useCallback(() => {
    setIsSimulatingFreeUser(prev => !prev);
  }, []);
  
  const toggleViewingAsHelper = useCallback(() => {
    setIsViewingAsHelper(prev => !prev);
  }, []);
  
  // Memoize demo data so it doesn't recreate on every render
  const demoUsers = useMemo(() => createDemoUsers(), []);
  const demoTodoItems = useMemo(() => createDemoTodoItems(), []);
  const demoMeals = useMemo(() => createDemoMeals(), []);
  const demoExpenses = useMemo(() => createDemoExpenses(), []);
  const demoPlaces = useMemo(() => createDemoPlaces(), []);
  const demoPractices = useMemo(() => createDemoPractices(), []);
  const demoPastPayslips = useMemo(() => createDemoPastPayslips(), []);
  
  const value = useMemo(() => ({
    isDemoMode,
    toggleDemoMode,
    isSimulatingFreeUser,
    toggleSimulateFreeUser,
    isViewingAsHelper,
    toggleViewingAsHelper,
    demoUsers,
    demoTodoItems,
    demoMeals,
    demoExpenses,
    demoFamilyNotes: DEMO_FAMILY_NOTES,
    demoFamilyNotesLang: 'en',
    demoFamilyNotesTranslations: DEMO_FAMILY_NOTES_TRANSLATIONS,
    demoPlaces,
    demoPractices,
    demoPastPayslips,
  }), [isDemoMode, toggleDemoMode, isSimulatingFreeUser, toggleSimulateFreeUser, isViewingAsHelper, toggleViewingAsHelper, demoUsers, demoTodoItems, demoMeals, demoExpenses, demoPlaces, demoPractices, demoPastPayslips]);
  
  return (
    <DemoModeContext.Provider value={value}>
      {children}
    </DemoModeContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useDemoMode = (): DemoModeContextType => {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error('useDemoMode must be used within a DemoModeProvider');
  }
  return context;
};

export default DemoModeContext;

