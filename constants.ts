
import { UserRole, User, ShoppingCategory, Section, Task, Meal, MealType, Expense } from './types';

export const EXPENSE_CATEGORIES = [
  'Housing & Utilities',
  'Food & Daily Needs',
  'Transport & Travel',
  'Health & Personal Care',
  'Fun & Lifestyle',
  'Miscellaneous'
];

export const MOCK_USERS: User[] = [
  { 
    id: '1', 
    householdId: 'demo',
    name: 'Sarah (Mom)', 
    role: UserRole.MASTER, 
    avatar: 'https://picsum.photos/200/200?random=1',
    allergies: [],
    preferences: ['Low Sodium', 'No Spicy'],
    email: 'sarah@helpy.com',
    password: 'password'
  },
  { 
    id: '2', 
    householdId: 'demo',
    name: 'David (Dad)', 
    role: UserRole.SPOUSE, 
    avatar: 'https://picsum.photos/200/200?random=2',
    allergies: ['Shellfish'],
    preferences: ['High Protein'],
    email: 'david@helpy.com',
    password: 'password'
  },
  { 
    id: '3', 
    householdId: 'demo',
    name: 'Maria (Helper)', 
    role: UserRole.HELPER, 
    avatar: 'https://picsum.photos/200/200?random=3',
    allergies: [],
    preferences: []
  },
  { 
    id: '4', 
    householdId: 'demo',
    name: 'Tom (Kid)', 
    role: UserRole.CHILD, 
    avatar: 'https://picsum.photos/200/200?random=4',
    allergies: ['Peanuts', 'Dairy'],
    preferences: ['Likes Pasta']
  },
];

export const DEFAULT_FAMILY_RULES: Section[] = [
  { 
    id: '101', 
    category: 'House Rules', 
    title: 'No Shoes Indoors', 
    content: 'Please change to indoor slippers at door.\nShoe rack provided.\nThank you!\n\nDue: Dec 18, 2025\nIndah' 
  },
  { 
    id: '102', 
    category: 'House Rules', 
    title: 'Phone Use Policy', 
    content: 'Phone OK during break & after child sleeps.\nNo TikTok live from flat.\nKeep volume low.\n\nDue: Dec 18, 2025\nIndah' 
  },
  { 
    id: '103', 
    category: 'House Rules', 
    title: 'Guest & Visitor Rules', 
    content: 'Visitors OK with prior notice.\nMax 2 hours.\nCommon area only.\n\nDue: Dec 18, 2025\nIndah' 
  },
];

export const DEFAULT_SHOPPING_ITEMS = [
  { id: '101', name: 'Organic Eggs', category: ShoppingCategory.SUPERMARKET, quantity: '12 pcs', completed: false, addedBy: '1' },
  { id: '102', name: 'Fresh Salmon', category: ShoppingCategory.WET_MARKET, quantity: '500g', completed: false, addedBy: '1' },
  { id: '103', name: 'AA Batteries', category: ShoppingCategory.OTHERS, quantity: '1 pack', completed: true, addedBy: '2' },
];

export const DEFAULT_TASKS: Task[] = [
  { 
    id: '1', 
    title: 'Pay Piano Tutor', 
    assignees: ['1'], 
    dueDate: new Date().toISOString().split('T')[0], 
    completed: false 
  },
  { 
    id: '2', 
    title: 'Water Plants', 
    assignees: ['3'], 
    dueDate: new Date().toISOString().split('T')[0], 
    completed: true, 
    recurrence: {
        frequency: 'WEEKLY',
        interval: 1,
        weekDays: [0, 3], // Sun, Wed
        endCondition: 'NEVER'
    }
  },
];

export const DEFAULT_MEALS: Meal[] = [
  { id: '1', date: new Date().toISOString().split('T')[0], type: MealType.DINNER, description: 'Steamed Fish & Veggies', forUserIds: ['1','2','3','4'] }
];

export const DEFAULT_EXPENSES: Expense[] = [
  { id: '1', amount: 120.50, category: 'Food & Daily Needs', merchant: 'FairPrice', date: '2023-10-25' },
  { id: '2', amount: 45.00, category: 'Transport & Travel', merchant: 'Grab', date: '2023-10-24' },
  { id: '3', amount: 850.00, category: 'Housing & Utilities', merchant: 'Management Fee', date: '2023-10-01' },
];

export const SHOPPING_CATEGORY_COLORS: Record<ShoppingCategory, string> = {
  [ShoppingCategory.SUPERMARKET]: 'border-l-blue-500',
  [ShoppingCategory.WET_MARKET]: 'border-l-green-500',
  [ShoppingCategory.OTHERS]: 'border-l-gray-400',
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh-CN', name: 'Chinese Simplified' },
  { code: 'zh-TW', name: 'Chinese Traditional' },
  { code: 'zh-HK', name: 'Cantonese' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
];

// The source of truth for UI strings.
export const BASE_TRANSLATIONS: Record<string, string> = {
  // Dashboard
  'dashboard.greeting.morning': 'Good morning',
  'dashboard.greeting.afternoon': 'Good afternoon',
  'dashboard.greeting.evening': 'Good evening',
  'dashboard.family_board': 'Family Board',
  'dashboard.tap_to_pin': 'Tap to pin a note...',
  'dashboard.type_note': 'Type a note for the family...',
  'dashboard.shopping': 'Shopping',
  'dashboard.items_needed': 'Items needed',
  'dashboard.tasks': 'Tasks',
  'dashboard.todo': 'To-Do',
  'dashboard.meals': 'Meals',
  'dashboard.planned': 'Planned',
  'dashboard.expenses': 'Expenses',
  'dashboard.this_month': 'This Month',
  'dashboard.up_next': 'Up Next',
  'dashboard.view_schedule': 'View Schedule',
  'dashboard.everyone': 'Everyone',
  'dashboard.eating': 'eating',
  'dashboard.language': 'Language',

  // Filters & Common Tabs
  'filter.all': 'All',
  'filter.today': 'Today',
  'filter.overdue': 'Overdue',
  'filter.later': 'Later',
  'filter.general': 'General',

  // Shopping
  'shopping.title': 'Shopping List',
  'shopping.new_item': 'New Item',
  'shopping.item_name': 'Item Name',
  'shopping.unit_placeholder': 'Unit (pkt, kg)',
  'shopping.quick_add': 'Quick Add',
  'shopping.completed': 'Completed',
  'shopping.clear_all': 'Clear All',
  'shopping.no_items': 'No items in list',
  'category.supermarket': 'Supermarket',
  'category.wet_market': 'Wet Market',
  'category.others': 'Others',

  // Tasks
  'tasks.title': 'Tasks',
  'tasks.new_task': 'New Task',
  'tasks.task_name': 'Task Name',
  'tasks.assignees': 'Assignees',
  'tasks.recurrence': 'Does not repeat',
  'tasks.custom_recurrence': 'Custom Recurrence',
  'tasks.repeat_every': 'Repeat every',
  'tasks.repeat_on': 'Repeat on',
  'tasks.ends': 'Ends',
  'tasks.never': 'Never',
  'tasks.on': 'On',
  'tasks.after': 'After',
  'tasks.occurrences': 'occurrences',
  'tasks.once': 'Once',
  'tasks.daily': 'Daily',
  'tasks.weekly': 'Weekly',
  'tasks.monthly': 'Monthly',
  'tasks.yearly': 'Yearly',
  
  // Tasks Empty States
  'tasks.no_tasks_all': 'No tasks created',
  'tasks.no_tasks_today': 'No tasks due today',
  'tasks.no_tasks_overdue': 'No overdue tasks',
  'tasks.no_tasks_later': 'No upcoming tasks',

  // Day Bubbles (Single Letter)
  'day.letter.sun': 'S',
  'day.letter.mon': 'M',
  'day.letter.tue': 'T',
  'day.letter.wed': 'W',
  'day.letter.thu': 'T',
  'day.letter.fri': 'F',
  'day.letter.sat': 'S',
  
  // Day Short (For Recurrence)
  'day.short.sun': 'Sun',
  'day.short.mon': 'Mon',
  'day.short.tue': 'Tue',
  'day.short.wed': 'Wed',
  'day.short.thu': 'Thu',
  'day.short.fri': 'Fri',
  'day.short.sat': 'Sat',

  // Meals
  'meals.title': 'Meals',
  'meals.day_view': 'Day View',
  'meals.week_view': 'Week View',
  'meals.today': 'Today',
  'meals.back_to_week': 'Back to Current Week',
  'meals.plan_meal': 'Plan meal...',
  'meals.add_dish': 'Add dish',
  'meals.the_dish': 'The Dish',
  'meals.whats_for': 'What\'s for',
  'meals.who_eating': 'Who is eating?',
  'meals.add_meal': 'Add Meal',
  'meals.save_changes': 'Save Changes',
  'meals.suggest_ai': 'Suggest with AI',
  'meals.group_all': 'All',
  'meals.group_adults': 'Adults',
  'meals.group_kids': 'Kids',
  'meals.view_day': 'Day',
  'meals.view_week': 'Week',

  // Meal Types
  'meal.type.breakfast': 'Breakfast',
  'meal.type.lunch': 'Lunch',
  'meal.type.dinner': 'Dinner',

  // Expenses
  'expenses.title': 'Expenses',
  'expenses.total_month': 'Total this month',
  'expenses.scan_receipt': 'Scan Receipt',
  'expenses.analyzing': 'Analyzing Receipt with AI...',
  'expenses.breakdown': 'Spending Breakdown',

  // Household Info
  'info.title': 'Household Info',
  'info.add_section': 'Add Custom Section',
  'info.edit_info': 'Edit Info',
  'info.new_info': 'New Info',
  'info.category': 'Category',
  'info.title_label': 'Title',
  'info.content_label': 'Content',
  'info.cat.house_rules': 'House Rules',
  'info.placeholder.category': 'General',
  'info.placeholder.title': 'e.g. WiFi Password',
  'info.placeholder.content': 'Enter details...',

  // Profile
  'profile.title': 'Family Profiles',
  'profile.back': 'Back',
  'profile.add_member': 'Add Family Member',
  'profile.edit_profile': 'Edit Profile',
  'profile.logout': 'Log Out',
  'profile.allergies': 'Allergies & Medical',
  'profile.preferences': 'Preferences',
  'profile.none_added': 'None added',
  'profile.change_photo': 'Change Photo',
  'profile.take_photo': 'Take Photo',
  'profile.choose_library': 'Choose from Library',
  'profile.invite_link': 'Invite Link',
  'profile.copy_link': 'Copy Link',
  'profile.copied': 'Copied!',
  'profile.restart_tutorial': 'Restart Tutorial',

  // Onboarding
  'onboarding.welcome': 'Welcome, {name}!',
  'onboarding.step1.desc': 'Let\'s get your home set up. Click \'Got it\' to go to your profile and add your family members.',
  'onboarding.step2.title': 'Grow your Family',
  'onboarding.step2.desc': 'Tap the + button to add your family members.',
  'onboarding.skip': 'Skip',
  'onboarding.got_it': 'Got it',
  'onboarding.add_member': 'Add Family Member',

  // Nav
  'nav.home': 'Home',
  'nav.shop': 'Shop',
  'nav.tasks': 'Tasks',
  'nav.meals': 'Meals',
  'nav.cost': 'Cost',
  'nav.info': 'Info',
  
  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.add': 'Add',
  'common.remove': 'Remove',
  'common.confirm_clear': 'Are you sure you want to clear these items?',
};