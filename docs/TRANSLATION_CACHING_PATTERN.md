# Translation Caching Pattern

## Overview

User-generated content (meals, places, practices) supports automatic translation when the user's language differs from the content's original language. Translations are cached in the database to avoid re-translating on every page visit.

## How It Works

1. **Content is created** with `{field}Lang` (e.g., `nameLang: 'en'`, `descriptionLang: 'zh-TW'`)
2. **User views content** in a different language
3. **`useTranslatedContent` hook** detects language mismatch and translates via Gemini API
4. **Translation saved** to `{field}Translations` object (e.g., `nameTranslations: { 'ko': '한국어 번역' }`)
5. **Next visit** - cached translation is displayed instantly (no API call)

## Database Schema

Each translatable field has three columns:

```sql
-- Example: practices table
name TEXT NOT NULL,
name_lang TEXT,                    -- Original language code (e.g., 'en', 'zh-TW')
name_translations JSONB DEFAULT '{}', -- Cached translations: { 'ko': '...', 'ja': '...' }
```

## Component Pattern

### CRITICAL: Card Components Must Pass Update Callback

When creating a card component that displays translated content, you MUST:

1. **Add the update callback to the interface:**

```tsx
interface PracticeCardProps {
  item: Practice;
  // ... other props
  onUpdatePractice: (id: string, data: Partial<Practice>) => void;  // ← REQUIRED
}
```

2. **Destructure the callback in the component:**

```tsx
const PracticeCard: React.FC<PracticeCardProps> = ({
  item,
  // ... other props
  onUpdatePractice,  // ← REQUIRED
}) => {
```

3. **Pass it when rendering the card:**

```tsx
<PracticeCard
  key={item.id}
  item={item}
  // ... other props
  onUpdatePractice={onUpdatePractice}  // ← REQUIRED
/>
```

4. **Use it in the Translated component:**

```tsx
<TranslatedPracticeName 
  item={item} 
  currentLang={currentLang}
  onUpdate={(id, data) => onUpdatePractice(id, data)}  // ← Saves translation
/>
```

## Bug History (January 2026)

### The Bug

`PracticeCard` and `PlaceCard` were using `onUpdatePractice`/`onUpdatePlace` callbacks but **they were never passed as props**. This caused:

1. `ReferenceError: onUpdatePractice is not defined` on every translation attempt
2. Translations completed successfully but **never saved to database**
3. Every page visit triggered live re-translation (expensive API calls, poor UX)

### Root Cause

When the card components were refactored into separate components, the update callbacks were used inside but not added to the props interface.

### The Fix

Added `onUpdatePractice`/`onUpdatePlace` to:
- Component interface (`PracticeCardProps`, `PlaceCardProps`)
- Component destructured props
- Component render call

### How to Avoid This

**When creating any component that renders translated content:**

1. Check if the component uses any `Translated*` components
2. Verify ALL callbacks are in the interface AND passed as props
3. Test by checking browser console for `ReferenceError` when viewing translated content

## Translation Components Reference

| Component | Used For | Update Callback |
|-----------|----------|-----------------|
| `TranslatedPracticeName` | Practice name | `onUpdatePractice(id, { nameTranslations })` |
| `TranslatedPracticeNote` | Practice note | `onUpdatePractice(id, { noteTranslations })` |
| `TranslatedPlaceNote` | Place note | `onUpdatePlace(id, { noteTranslations })` |
| `TranslatedMealDescription` | Meal description | `onUpdateMeal(id, { descriptionTranslations })` |
| `TranslatedTaskTitle` | Todo task title | `onUpdateTask(id, { titleTranslations })` |
| `TranslatedExpenseDescription` | Expense description | `onUpdateExpense(id, { descriptionTranslations })` |

## Update Handler Pattern (App.tsx)

Update handlers should follow this pattern (optimistic update, skip temp IDs):

```tsx
const handleUpdatePractice = async (id: string, data: Partial<Practice>) => {
  const previousItems = practices;
  
  // Optimistic update - immediately reflect in UI
  setPractices(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  
  // Skip database call for temp IDs - real-time sync will handle it
  if (isTempId(id)) {
    console.warn('⚠️ Skipping update for temp practice - waiting for real ID:', id);
    return;
  }
  
  try {
    // Fire and forget - real-time sync will bring latest data
    await updatePractice(hid, id, data);
  } catch (error) {
    console.error('Failed to update practice:', error);
    setPractices(previousItems);  // Rollback on error
  }
};
```

**Important:** Do NOT set state again after the database call. This can cause race conditions where stale data overwrites optimistic translations.

## Testing Translation Caching

1. Add content in English while using English language
2. Switch app language to Korean/Chinese/etc.
3. Visit the page - should see live translation animation (first time)
4. Run SQL to verify translation saved:
   ```sql
   SELECT id, name, name_translations 
   FROM practices 
   WHERE name_translations != '{}';
   ```
5. Navigate away and return - should show cached translation instantly (no animation)
6. Hard refresh browser - should still show cached translation
