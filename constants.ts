
import { ShoppingCategory } from './types';

export const EXPENSE_CATEGORIES = [
  'Housing & Utilities',
  'Food & Daily Needs',
  'Transport & Travel',
  'Health & Personal Care',
  'Fun & Lifestyle',
  'Miscellaneous'
];

// Colors based on brand palette: #3EAFD2, #FF9800, #7E57C2, #4CAF50, #F06292, #AB47BC, #757575
export const SHOPPING_CATEGORY_COLORS: Record<ShoppingCategory, string> = {
  [ShoppingCategory.SUPERMARKET]: 'border-l-[#3EAFD2]',
  [ShoppingCategory.WET_MARKET]: 'border-l-[#4CAF50]',
  [ShoppingCategory.OTHERS]: 'border-l-[#757575]',
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh-CN', name: 'Chinese Simplified' },
  { code: 'zh-TW', name: 'Chinese Traditional' },
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
  'meal.type.snacks': 'Snacks',

  // Meal Audience
  'meals.audience_label': 'This meal is for',
  'meals.audience_all': 'Everyone',
  'meals.audience_adults': 'Adults',
  'meals.audience_kids': 'Kids',

  // Meal RSVP
  'meals.join': 'Join Meal',
  'meals.im_in': "I'm In",
  'meals.im_out': "I'm Out",
  'meals.leave': 'Leave',
  'meals.eating': 'Eating',
  'meals.ill_be_eating': "I'll be eating",
  'meals.no_dish_yet': 'No dish yet',
  'meals.not_for_you': 'Not for you',
  'meals.no_one_yet': 'No one yet',
  'meals.plan_dish': 'Plan Dish',
  'meals.edit_dish': 'Edit dish',
  'meals.add_meal_plan': 'Add Meal Plan',
  'meals.adults_only': 'Adults Only',
  'meals.kids_only': 'Kids Only',

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

  // ToDo (unified Shopping + Tasks)
  'todo.title': 'To Do',
  'todo.shopping': 'Shopping',
  'todo.tasks': 'Tasks',
  'todo.suggested': 'Suggested',
  'todo.completed': 'Completed',
  'todo.no_shopping': 'No shopping items yet',
  'todo.no_tasks': 'No tasks yet',
  'todo.category.home_care': 'Home Care',
  'todo.category.family_care': 'Family Care',
  'todo.category.others': 'Others',

  // Nav
  'nav.home': 'Home',
  'nav.todo': 'To Do',
  'nav.meals': 'Meals',
  'nav.cost': 'Expenses',
  'nav.info': 'Info',
  
  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.add': 'Add',
  'common.remove': 'Remove',
  'common.confirm_clear': 'Are you sure you want to clear these items?',
};