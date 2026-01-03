import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { User, UserRole, ToDoItem, Meal, Expense, MealType, MealAudience, ShoppingCategory, TaskCategory } from '../types';
import type { EssentialInfo, EssentialInfoCategory } from '@src/types/essentialInfo';
import type { HouseRoutine, HouseRoutineCategory } from '@src/types/houseRoutine';
import type { HelperPayslipConfirmation } from '@src/types/helperManagement';

// ============================================================================
// DEMO MODE CONTEXT
// Provides mock data for marketing screenshots
// Only visible to SuperAdmin users
// ============================================================================

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  demoUsers: User[];
  demoTodoItems: ToDoItem[];
  demoMeals: Meal[];
  demoExpenses: Expense[];
  demoFamilyNotes: string;
  demoFamilyNotesLang: string;
  demoFamilyNotesTranslations: Record<string, string>;
  demoEssentialItems: EssentialInfo[];
  demoHouseRoutineItems: HouseRoutine[];
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
    helperStartDate: '2024-06-01',
    helperBaseSalary: 4870,
    helperFoodAllowance: 1236,
    helperOtherAllowances: [{ name: 'Transport', amount: 500 }],
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
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return [
    // Shopping Items
    {
      id: 'demo-shop-001',
      type: 'shopping',
      name: 'Fresh Salmon',
      category: ShoppingCategory.WET_MARKET,
      completed: false,
      quantity: '500',
      unit: 'g',
      assigneeId: 'demo-helper-004',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-shop-002',
      type: 'shopping',
      name: 'Bok Choy',
      category: ShoppingCategory.WET_MARKET,
      completed: false,
      quantity: '2',
      unit: 'bunches',
      assigneeId: 'demo-helper-004',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-shop-003',
      type: 'shopping',
      name: 'Vitasoy Soy Milk',
      category: ShoppingCategory.SUPERMARKET,
      completed: false,
      quantity: '6',
      unit: 'boxes',
      brand: 'Vitasoy',
      assigneeId: 'demo-helper-004',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-shop-004',
      type: 'shopping',
      name: 'Lee Kum Kee Oyster Sauce',
      category: ShoppingCategory.SUPERMARKET,
      completed: true,
      quantity: '1',
      unit: 'bottle',
      brand: 'Lee Kum Kee',
      assigneeId: 'demo-helper-004',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-shop-005',
      type: 'shopping',
      name: 'Jasmine Rice',
      category: ShoppingCategory.SUPERMARKET,
      completed: false,
      quantity: '5',
      unit: 'kg',
      assigneeId: 'demo-helper-004',
      createdAt: new Date().toISOString(),
    },
    // Tasks
    {
      id: 'demo-task-001',
      type: 'task',
      name: 'Pick up Ethan from school',
      category: TaskCategory.FAMILY_CARE,
      completed: false,
      assigneeId: 'demo-helper-004',
      dueDate: today.toISOString().split('T')[0],
      dueTime: '15:30',
      createdAt: new Date().toISOString(),
      recurrence: { frequency: 'WEEKLY', dayOfWeek: 1 },
    },
    {
      id: 'demo-task-002',
      type: 'task',
      name: 'Clean bathroom',
      category: TaskCategory.HOME_CARE,
      completed: false,
      assigneeId: 'demo-helper-004',
      dueDate: tomorrow.toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      recurrence: { frequency: 'WEEKLY', dayOfWeek: 3 },
    },
    {
      id: 'demo-task-003',
      type: 'task',
      name: 'Take grandma to doctor',
      category: TaskCategory.FAMILY_CARE,
      completed: false,
      assigneeId: 'demo-mom-002',
      dueDate: tomorrow.toISOString().split('T')[0],
      dueTime: '10:00',
      createdAt: new Date().toISOString(),
    },
  ];
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
      date: today.toISOString().split('T')[0],
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
      date: tomorrow.toISOString().split('T')[0],
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
    
    // Fun & Lifestyle
    { id: 'demo-exp-021', amount: 580, currency: 'HKD', category: 'Fun & Lifestyle', date: '2026-01-09', merchant: 'Tim Ho Wan', createdBy: 'demo-dad-001' },
    { id: 'demo-exp-022', amount: 450, currency: 'HKD', category: 'Fun & Lifestyle', date: '2026-01-14', merchant: 'Ocean Park', createdBy: 'demo-dad-001' },
    { id: 'demo-exp-023', amount: 320, currency: 'HKD', category: 'Fun & Lifestyle', date: '2026-01-19', merchant: 'Broadway Cinema', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-024', amount: 880, currency: 'HKD', category: 'Fun & Lifestyle', date: '2026-01-22', merchant: 'Yum Cha Restaurant', createdBy: 'demo-dad-001' },
    
    // Miscellaneous
    { id: 'demo-exp-025', amount: 180, currency: 'HKD', category: 'Miscellaneous', date: '2026-01-13', merchant: 'MUJI', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-026', amount: 250, currency: 'HKD', category: 'Miscellaneous', date: '2026-01-21', merchant: 'IKEA', createdBy: 'demo-mom-002' },
    { id: 'demo-exp-027', amount: 150, currency: 'HKD', category: 'Miscellaneous', date: '2026-01-24', merchant: 'Japan Home Centre', createdBy: 'demo-helper-004' },
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
// MOCK ESSENTIAL INFO (PLACES) - Hong Kong locations
// ============================================================================

const createDemoEssentialItems = (): EssentialInfo[] => [
  // Home
  {
    id: 'demo-place-001',
    householdId: 'demo-household',
    category: 'Home' as EssentialInfoCategory,
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
    category: 'School' as EssentialInfoCategory,
    name: "ESF Discovery College - Ethan's School",
    address: '38 Siena Avenue, Discovery Bay, Lantau Island',
    countryCode: '+852',
    phone: '39696088',
    note: 'Drop-off: 7:45am. Pick-up: 3:30pm (Gate B). Teacher: Ms. Johnson.',
  },
  {
    id: 'demo-place-003',
    householdId: 'demo-household',
    category: 'School' as EssentialInfoCategory,
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
    category: 'Doctor' as EssentialInfoCategory,
    name: 'Dr. Lee Family Clinic',
    address: 'Room 1205, Prince Building, Central',
    countryCode: '+852',
    phone: '25231234',
    note: 'Ethan\'s pediatrician. Appointments needed. Best time: morning.',
  },
  {
    id: 'demo-place-005',
    householdId: 'demo-household',
    category: 'Doctor' as EssentialInfoCategory,
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
    category: 'Hospital' as EssentialInfoCategory,
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
    category: 'Shops' as EssentialInfoCategory,
    name: 'Tai Po Hui Wet Market',
    address: 'Fu Shin Street, Tai Po',
    countryCode: '+852',
    phone: '',
    note: 'Ask for Mrs. Lam for fresh fish (Stall 23). Best before 9am.',
  },
  {
    id: 'demo-place-008',
    householdId: 'demo-household',
    category: 'Shops' as EssentialInfoCategory,
    name: 'ParknShop - Sha Tin',
    address: 'B2, New Town Plaza, Sha Tin',
    countryCode: '+852',
    phone: '',
    note: 'Tuesday is senior discount day. Parking: L2.',
  },
];

// ============================================================================
// MOCK HOUSE ROUTINE (PRACTICE) - Family rules and routines
// ============================================================================

// ============================================================================
// DEMO PAST PAYSLIPS
// ============================================================================

const createDemoPastPayslips = (): HelperPayslipConfirmation[] => [
  // September 2025 - with overtime
  {
    id: 'demo-payslip-001',
    householdId: 'demo-household',
    helperId: 'demo-helper-004',
    month: 9,
    year: 2025,
    salaryAmount: 6606,  // 6106 base + 500 overtime
    overtimeTotal: 500,  // Worked on Mid-Autumn Festival
    employerSignedAt: '2025-09-30T10:00:00Z',
    employerUserId: 'demo-dad-001',
    helperSignedAt: '2025-09-30T11:30:00Z',
    createdAt: '2025-09-30T10:00:00Z',
  },
  // October 2025 - regular
  {
    id: 'demo-payslip-002',
    householdId: 'demo-household',
    helperId: 'demo-helper-004',
    month: 10,
    year: 2025,
    salaryAmount: 6106,  // Base only
    overtimeTotal: 0,
    employerSignedAt: '2025-10-31T09:00:00Z',
    employerUserId: 'demo-dad-001',
    helperSignedAt: '2025-10-31T14:00:00Z',
    createdAt: '2025-10-31T09:00:00Z',
  },
  // November 2025 - with overtime
  {
    id: 'demo-payslip-003',
    householdId: 'demo-household',
    helperId: 'demo-helper-004',
    month: 11,
    year: 2025,
    salaryAmount: 6406,  // 6106 base + 300 overtime
    overtimeTotal: 300,  // Worked on a Sunday
    employerSignedAt: '2025-11-30T11:00:00Z',
    employerUserId: 'demo-dad-001',
    helperSignedAt: '2025-11-30T15:00:00Z',
    createdAt: '2025-11-30T11:00:00Z',
  },
  // December 2025 - regular
  {
    id: 'demo-payslip-004',
    householdId: 'demo-household',
    helperId: 'demo-helper-004',
    month: 12,
    year: 2025,
    salaryAmount: 6106,  // Base only
    overtimeTotal: 0,
    employerSignedAt: '2025-12-31T10:00:00Z',
    employerUserId: 'demo-dad-001',
    helperSignedAt: '2025-12-31T12:00:00Z',
    createdAt: '2025-12-31T10:00:00Z',
  },
];

// ============================================================================
// DEMO HOUSE ROUTINES (PRACTICE)
// ============================================================================

const createDemoHouseRoutineItems = (): HouseRoutine[] => [
  // Home Rules
  {
    id: 'demo-routine-001',
    householdId: 'demo-household',
    category: 'Home Rules' as HouseRoutineCategory,
    name: 'No shoes inside the house',
    note: 'All family members and guests remove shoes at entrance. Slippers provided in shoe cabinet.',
  },
  {
    id: 'demo-routine-002',
    householdId: 'demo-household',
    category: 'Home Rules' as HouseRoutineCategory,
    name: 'Screen time limits for Ethan',
    note: 'Weekdays: 30 mins after homework. Weekends: 1 hour max. No iPad after 7pm.',
  },
  // Routine
  {
    id: 'demo-routine-003',
    householdId: 'demo-household',
    category: 'Routine' as HouseRoutineCategory,
    name: "Ethan's Morning Routine",
    note: 'Wake 6:30am, breakfast 7am, leave for school 7:30am. Pack snack box night before.',
  },
  {
    id: 'demo-routine-004',
    householdId: 'demo-household',
    category: 'Routine' as HouseRoutineCategory,
    name: 'Grandma medicine schedule',
    note: 'Morning: Blood pressure pill with breakfast. Evening: Vitamin D after dinner.',
  },
  // Cooking
  {
    id: 'demo-routine-005',
    householdId: 'demo-household',
    category: 'Cooking' as HouseRoutineCategory,
    name: 'Ethan prefers no vegetables mixed in',
    note: 'Serve veggies on the side. He will eat carrots and corn but not leafy greens.',
  },
  {
    id: 'demo-routine-006',
    householdId: 'demo-household',
    category: 'Cooking' as HouseRoutineCategory,
    name: 'Grandma diet restrictions',
    note: 'Low sodium, no MSG. Congee must be soft. Avoid cold foods.',
  },
  {
    id: 'demo-routine-007',
    householdId: 'demo-household',
    category: 'Cooking' as HouseRoutineCategory,
    name: 'Michelle is allergic to peanuts',
    note: 'Check all sauces and snacks for peanut ingredients. EpiPen in medicine cabinet.',
  },
  // Child Care
  {
    id: 'demo-routine-008',
    householdId: 'demo-household',
    category: 'Child Care' as HouseRoutineCategory,
    name: 'Ethan bedtime routine',
    note: 'Bath 7:30pm, story time 8pm, lights out 8:30pm. Nightlight on, door slightly open.',
  },
  {
    id: 'demo-routine-009',
    householdId: 'demo-household',
    category: 'Child Care' as HouseRoutineCategory,
    name: 'Ethan dairy allergy',
    note: 'Use oat milk for cereal. No cheese or ice cream. Lactose-free yogurt OK.',
  },
  // Cleaning
  {
    id: 'demo-routine-010',
    householdId: 'demo-household',
    category: 'Cleaning' as HouseRoutineCategory,
    name: 'Weekly deep clean schedule',
    note: 'Mon: Bathrooms. Wed: Kitchen deep clean. Fri: All floors. Sat: Windows.',
  },
  // Laundry
  {
    id: 'demo-routine-011',
    householdId: 'demo-household',
    category: 'Laundry' as HouseRoutineCategory,
    name: 'Delicate items handling',
    note: "Michelle's silk blouses: hand wash only. David's suits: dry clean (Mr. Clean, Sha Tin Centre).",
  },
  // Safety
  {
    id: 'demo-routine-012',
    householdId: 'demo-household',
    category: 'Safety' as HouseRoutineCategory,
    name: 'Emergency contacts',
    note: 'David mobile: 9123 4567. Michelle mobile: 9234 5678. Emergency: 999.',
  },
  // Helper Care
  {
    id: 'demo-routine-013',
    householdId: 'demo-household',
    category: 'Helper Care' as HouseRoutineCategory,
    name: 'Anna day off',
    note: 'Every Sunday. Usually returns by 9pm. Contact if running late.',
  },
];

// ============================================================================
// DEMO MODE PROVIDER
// ============================================================================

export const DemoModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => !prev);
  }, []);
  
  // Memoize demo data so it doesn't recreate on every render
  const demoUsers = useMemo(() => createDemoUsers(), []);
  const demoTodoItems = useMemo(() => createDemoTodoItems(), []);
  const demoMeals = useMemo(() => createDemoMeals(), []);
  const demoExpenses = useMemo(() => createDemoExpenses(), []);
  const demoEssentialItems = useMemo(() => createDemoEssentialItems(), []);
  const demoHouseRoutineItems = useMemo(() => createDemoHouseRoutineItems(), []);
  const demoPastPayslips = useMemo(() => createDemoPastPayslips(), []);
  
  const value = useMemo(() => ({
    isDemoMode,
    toggleDemoMode,
    demoUsers,
    demoTodoItems,
    demoMeals,
    demoExpenses,
    demoFamilyNotes: DEMO_FAMILY_NOTES,
    demoFamilyNotesLang: 'en',
    demoFamilyNotesTranslations: DEMO_FAMILY_NOTES_TRANSLATIONS,
    demoEssentialItems,
    demoHouseRoutineItems,
    demoPastPayslips,
  }), [isDemoMode, toggleDemoMode, demoUsers, demoTodoItems, demoMeals, demoExpenses, demoEssentialItems, demoHouseRoutineItems, demoPastPayslips]);
  
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

