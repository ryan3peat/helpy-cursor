# Section Toggle Cards & Sticky Tab Nav Scroll Pattern

## Overview

This document explains the pattern used in `HouseholdInfo.tsx` (Family Info), `ToDo.tsx`, and `Expenses.tsx` to handle Section Toggle Cards with proper shadow visibility and scroll hiding behavior.

**Family Info is the anchor** - always match other pages to it.

## The Problem

These pages have:
1. **Section Toggle Cards** - Buttons like Places/Practice/Helper, Tasks/Shopping, or Summary Card
2. **Sticky Tab Navigation** - The pill-shaped category tabs (All/Home/School, List/Summary, etc.)

When scrolling, the Section Toggle Cards should:
- Show button shadows when **not scrolled** (unscrolled state)
- Be **fully hidden** when scrolled up (no peeking through)

## Current Solution (January 2026)

All pages now use `boxShadow` on the header instead of pseudo-elements:

### Standard Header

```tsx
<header 
  className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
  style={{ height: '120px', boxShadow: '0 10px 0 0 hsl(var(--background))' }}
>
```

**Key elements:**
| Property | Value | Purpose |
|----------|-------|---------|
| `height` | 120px | Fixed header height |
| `boxShadow` | `0 10px 0 0 hsl(var(--background))` | Creates 10px visual extension below header to cover scrolling content |

### Section Toggle Cards

All pages use the same wrapper structure:

```tsx
<div className="mt-4 mb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto scrollbar-hide">
  <div className="flex gap-3">
    {/* Card buttons */}
  </div>
</div>
```

| Class | Purpose |
|-------|---------|
| `mt-4 mb-4` | 16px top/bottom margin |
| `-mx-4 px-4 sm:-mx-6 sm:px-6` | Edge-to-edge layout |
| `overflow-x-auto scrollbar-hide` | Horizontal scroll for 3+ cards |

### Card Variations

| Page | # Cards | Card Classes |
|------|---------|--------------|
| ToDo | 2 | `flex-1 px-3 py-2.5 rounded-xl...` |
| Family Info | 3 | `flex-shrink-0 min-w-[130px] px-3 py-2.5 rounded-xl...` |
| Expenses | 1 | `flex-shrink-0 w-full px-3 py-1 rounded-xl text-left bg-card shadow-sm` (no icon, larger font) |

### Sticky Tab Nav

All pages have sticky tab navigation at `top: 118px`:

```tsx
<div 
  className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
  style={{ 
    top: '118px',
    boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
  }}
>
```

### Main Content Area

**CRITICAL:** Do NOT add `min-height` to main content:

```tsx
// CORRECT
<div className="pt-4">

// WRONG - causes scroll alignment issues
<div className="pt-4 min-h-[350px]">
```

## How It Works

### Unscrolled State
- Cards display normally with shadows visible
- `overflow-x-auto` enables horizontal scroll for 3+ cards

### Scrolled State
- Cards scroll up toward the header
- The `boxShadow: '0 10px 0 0 hsl(var(--background))'` creates a 10px background-colored shadow below the header
- This visually covers the cards as they scroll behind the header
- Tab nav sticks at `top: 118px` (2px gap from header bottom, prevents pill cut-off)

## Critical Rules

1. **Family Info is the anchor** - never modify it to match other pages

2. **Use `boxShadow` not pseudo-elements** - the `0 10px 0 0` shadow provides cleaner coverage

3. **Keep `mt-4 mb-4`** on all section card wrappers - this ensures 16px consistent spacing

4. **Always include `overflow-x-auto scrollbar-hide`** on section card wrappers - even for single cards, for structural consistency

5. **NO `min-height` on main content** - this was a legacy fix for tall hero cards that caused scroll misalignment

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Cards/Tab nav scroll too far up | `min-h-[...]` on main content | Remove min-height |
| Cards peek through when scrolled | Missing or wrong boxShadow | Add `boxShadow: '0 10px 0 0 hsl(var(--background))'` |
| Horizontal scroll not working | Missing overflow classes | Add `overflow-x-auto scrollbar-hide` |
| Scroll position different between pages | Different margin/padding | Match all values to Family Info |

## History

- **Jan 2026:** Migrated from `after:` pseudo-elements to `boxShadow` approach
- **Jan 2026:** Added Expenses to unified structure
- **Jan 2026:** Removed redundant `min-h-[350px]` from Expenses (legacy hero card fix)

