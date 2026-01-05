# Section Toggle Cards & Sticky Tab Nav Scroll Pattern

## Overview

This document explains the pattern used in `HouseholdInfo.tsx` (Family Info) and `ToDo.tsx` to handle Section Toggle Cards with proper shadow visibility and scroll hiding behavior.

## The Problem

Both pages have:
1. **Section Toggle Cards** - Buttons like Places/Practice/Helper or Tasks/Shopping
2. **Sticky Tab Navigation** - The pill-shaped category tabs (All/Home/School etc.)

When scrolling, the Section Toggle Cards should:
- Show button shadows when **not scrolled** (unscrolled state)
- Be **fully hidden** when scrolled up (no peeking through)

## The Solution

### Family Info (`HouseholdInfo.tsx`)

Family Info uses **horizontal scrolling** for its Section Toggle Cards, which creates a CSS overflow context that clips content (including shadows) on both axes.

**Header (lines ~952-955):**
```tsx
<header 
  className="sticky top-0 z-20 relative bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end after:content-[''] after:absolute after:inset-x-0 after:top-full after:h-2 after:bg-background after:pointer-events-none" 
  style={{ height: '120px' }}
>
```

**Section Toggle Cards (line ~974):**
```tsx
<div className="mt-4 mb-2 -mx-4 px-4 pb-2 overflow-x-auto scrollbar-hide">
```

**Key elements:**
| Class | Value | Purpose |
|-------|-------|---------|
| `pb-2` | 8px | Internal padding for shadow visibility within scroll container |
| `mb-2` | 8px | External margin (reduced from mb-4 to compensate for pb-2) |
| `after:h-2` | 8px | Header pseudo-element extending coverage below header |
| `overflow-x-auto` | - | Enables horizontal scrolling |

**Total bottom space:** `mb-2` (8px) + `pb-2` (8px) = 16px

### ToDo (`ToDo.tsx`)

ToDo uses a **grid layout** (no overflow context), so it doesn't need internal padding for shadows.

**Header (lines ~953-956):**
```tsx
<header 
  className="sticky top-0 z-20 relative bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end after:content-[''] after:absolute after:inset-x-0 after:top-full after:h-2 after:bg-background after:pointer-events-none" 
  style={{ height: '120px' }}
>
```

**Section Toggle Cards (line ~1067):**
```tsx
<div className="mt-4 mb-4 -mx-4 px-4">
```

**Key elements:**
| Class | Value | Purpose |
|-------|-------|---------|
| `mb-4` | 16px | External margin (no pb needed since no overflow clipping) |
| `after:h-2` | 8px | Header pseudo-element extending coverage below header |

**Total bottom space:** `mb-4` (16px) = 16px

## How It Works

### Unscrolled State
- Cards display normally with shadows visible
- In Family Info, `pb-2` provides internal space for shadows within the `overflow-x-auto` container
- In ToDo, shadows naturally extend beyond the container (no overflow clipping)

### Scrolled State
- Cards scroll up toward the header
- The `after:h-2` pseudo-element on the header creates an 8px invisible background extension below the header (120px to 128px)
- This extension **covers/hides** the cards as they scroll, preventing them from peeking through

### Sticky Tab Nav
Both pages have sticky tab navigation at `top: 116px`:
```tsx
<div 
  className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
  style={{ top: '116px', ... }}
>
```

## Critical Rules

1. **DO NOT remove `pb-2`** from Family Info Section Toggle Cards - it prevents shadow clipping in the overflow context

2. **DO NOT remove `after:h-2`** from headers - it covers scrolling content

3. **Keep total bottom space at 16px** for visual consistency between pages:
   - Family Info: `mb-2` + `pb-2` = 16px
   - ToDo: `mb-4` = 16px

4. **`overflow-y-visible` does NOT work** with `overflow-x-auto` due to CSS specs - browsers compute it to `auto`

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Shadows cut off (Family Info) | Missing `pb-2` | Add `pb-2` to scroll container |
| Buttons peek through when scrolled | Missing header pseudo-element | Add `after:h-2 after:bg-background` etc. to header |
| Gap too wide between cards and tab nav | Extra padding without margin adjustment | Reduce `mb-*` to compensate for `pb-*` |
| Buttons cut off at top | Header pseudo-element too tall | Keep `after:h-2` (8px), not larger |

## Summary

The pattern balances three requirements:
1. Shadow visibility (unscrolled) → `pb-2` internal padding
2. Full hiding (scrolled) → `after:h-2` header extension  
3. Consistent spacing → Total 16px bottom space

