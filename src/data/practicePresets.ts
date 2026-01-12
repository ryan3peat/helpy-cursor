// src/data/practicePresets.ts
// Practice Ideas - Suggested templates for Hong Kong households
// These are common household practices that first-time employers can use as a starting point

import type { PracticeCategory } from '@src/types/practice';

export interface PracticePreset {
  id: string;
  category: PracticeCategory;
  name: string;
  note: string;
}

export const PRACTICE_PRESETS: PracticePreset[] = [
  // ─────────────────────────────────────────────────────────────────
  // HOME RULES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'hk-rules-phone',
    category: 'Home Rules',
    name: 'Phone Usage',
    note: 'Personal mobile phone usage is restricted to break times and emergencies. Please avoid using it while performing active tasks or caring for children.'
  },
  {
    id: 'hk-rules-visitor',
    category: 'Home Rules',
    name: 'Visitor Policy',
    note: 'No friends or relatives are allowed to enter the home without explicit permission from the employer.'
  },
  {
    id: 'hk-rules-privacy',
    category: 'Home Rules',
    name: 'Social Media & Privacy',
    note: 'Do not post photos or videos of the home, family members, or children on social media platforms to protect the family\'s privacy.'
  },
  {
    id: 'hk-rules-leaving',
    category: 'Home Rules',
    name: 'Leaving the House',
    note: 'Always inform the employer before leaving the flat. Please return home by the agreed curfew on rest days.'
  },
  {
    id: 'hk-rules-keys',
    category: 'Home Rules',
    name: 'Key Security',
    note: 'Household keys are for your personal use only. Do not duplicate them or lend them to anyone else.'
  },

  // ─────────────────────────────────────────────────────────────────
  // SAFETY
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'hk-safety-window',
    category: 'Safety',
    name: 'Window Cleaning Safety',
    note: 'Only clean the interior of windows. Exterior cleaning is strictly prohibited unless there are fixed grilles and you remain on the floor.'
  },
  {
    id: 'hk-safety-door',
    category: 'Safety',
    name: 'Door Security',
    note: 'Keep the main door locked at all times. Do not open the door for strangers, delivery people, or technicians unless pre-arranged by the employer.'
  },
  {
    id: 'hk-safety-cooking',
    category: 'Safety',
    name: 'Cooking Safety',
    note: 'Never leave the stove unattended while it is on. Ensure the gas/electricity is switched off immediately after use.'
  },
  {
    id: 'hk-safety-chemicals',
    category: 'Safety',
    name: 'Chemical Storage',
    note: 'Store all cleaning detergents and chemicals in the designated high cabinet, away from food and out of children\'s reach.'
  },

  // ─────────────────────────────────────────────────────────────────
  // CLEANING
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'hk-clean-cloths',
    category: 'Cleaning',
    name: 'Color-Coded Cloths',
    note: 'Use specific colored cloths for different areas: Red for toilets, Blue for the kitchen, and White for dining surfaces.'
  },
  {
    id: 'hk-clean-trash',
    category: 'Cleaning',
    name: 'Trash Disposal',
    note: 'Empty all household trash bins before finishing work. Separate recyclables (paper, plastic, metal) from general waste.'
  },
  {
    id: 'hk-clean-deepclean',
    category: 'Cleaning',
    name: 'Deep Cleaning Areas',
    note: 'Areas that need regular deep cleaning: under beds and sofas, inside microwave and oven, behind furniture, and inside the fridge.'
  },
  {
    id: 'hk-clean-linen',
    category: 'Cleaning',
    name: 'Bedding & Towels',
    note: 'Bedsheets, pillowcases, and towels should be changed regularly. Use hot water for white linens and cold water for colored items.'
  },

  // ─────────────────────────────────────────────────────────────────
  // COOKING
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'hk-cook-hygiene',
    category: 'Cooking',
    name: 'Food Hygiene',
    note: 'Use separate cutting boards and knives for raw meat and vegetables to prevent cross-contamination.'
  },
  {
    id: 'hk-cook-grocery',
    category: 'Cooking',
    name: 'Grocery Alerts',
    note: 'Please update the Shopping List in Helpy when staples (rice, oil, milk) are about 20% remaining.'
  },
  {
    id: 'hk-cook-leftovers',
    category: 'Cooking',
    name: 'Leftover Labeling',
    note: 'Store leftovers in airtight containers. Label them with the date before putting them in the fridge.'
  },
  {
    id: 'hk-cook-kitchen',
    category: 'Cooking',
    name: 'Kitchen Hygiene',
    note: 'Clean the sink and wipe down the stovetop immediately after every meal preparation.'
  },

  // ─────────────────────────────────────────────────────────────────
  // CHILD CARE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'hk-child-supervision',
    category: 'Child Care',
    name: 'Child Supervision',
    note: 'Never leave children unattended, especially in the bathroom, on high chairs, or at the public playground.'
  },
  {
    id: 'hk-child-diet',
    category: 'Child Care',
    name: 'Dietary Restrictions',
    note: 'Do not give the children candy, chocolate, or juice without checking with the parents first.'
  },
  {
    id: 'hk-child-hygiene',
    category: 'Child Care',
    name: 'Hand Hygiene',
    note: 'Ensure children wash their hands immediately upon returning home from school or the park.'
  },
  {
    id: 'hk-child-reporting',
    category: 'Child Care',
    name: 'Health Reporting',
    note: 'Inform parents immediately if a child has a fever, a fall/injury, or displays unusual behavior.'
  },

  // ─────────────────────────────────────────────────────────────────
  // LAUNDRY
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'hk-laundry-sorting',
    category: 'Laundry',
    name: 'Laundry Sorting',
    note: 'Separate whites, darks, and colors before washing. Check all pockets before loading the machine.'
  },
  {
    id: 'hk-laundry-delicates',
    category: 'Laundry',
    name: 'Delicate Items',
    note: 'Hand wash delicate items or use laundry bags. Do not put wool, silk, or items with beading in the dryer.'
  },
  {
    id: 'hk-laundry-ironing',
    category: 'Laundry',
    name: 'Ironing Guidelines',
    note: 'Work shirts and school uniforms should be ironed and hung ready before they are needed. Check care labels for temperature settings.'
  },

  // ─────────────────────────────────────────────────────────────────
  // HELPER CARE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'hk-helper-health',
    category: 'Helper Care',
    name: 'Health First',
    note: 'Please inform us immediately if you feel unwell or are injured so we can arrange medical care.'
  },
  {
    id: 'hk-helper-feedback',
    category: 'Helper Care',
    name: 'Open Communication',
    note: 'We value open communication. Please feel free to discuss any concerns, questions, or suggestions with us at any time.'
  },
  {
    id: 'hk-helper-rest',
    category: 'Helper Care',
    name: 'Rest Period',
    note: 'We respect your 8 hours of uninterrupted sleep. Unless it is an emergency, we will not call for you after 10:00 PM.'
  },
  {
    id: 'hk-helper-wifi',
    category: 'Helper Care',
    name: 'WiFi Access',
    note: 'You are welcome to use the home WiFi during your rest periods and breaks. Ask us for the password.'
  },

  // ─────────────────────────────────────────────────────────────────
  // ROUTINE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'hk-routine-priority',
    category: 'Routine',
    name: 'Task Priorities',
    note: 'Priority order: Child safety first, then meal preparation, followed by cleaning tasks. Urgent requests from employers take precedence.'
  },
  {
    id: 'hk-routine-endofday',
    category: 'Routine',
    name: 'End of Day Checklist',
    note: 'Before finishing work: ensure kitchen is clean, trash is emptied, doors are locked, and children have completed their evening routine.'
  },
];

// Helper function to get presets by category
export const getPresetsByCategory = (category: PracticeCategory): PracticePreset[] => {
  return PRACTICE_PRESETS.filter(preset => preset.category === category);
};

// Get all unique categories that have presets
export const getPresetCategories = (): PracticeCategory[] => {
  const categories = new Set(PRACTICE_PRESETS.map(p => p.category));
  return Array.from(categories) as PracticeCategory[];
};

