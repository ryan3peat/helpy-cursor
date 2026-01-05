# Page Header Structure Standard

This document defines the **pixel-perfect unified structure** for page headers, section cards, and tab navigation used across Helpy pages.

## Reference Implementation
- `HouseholdInfo.tsx` (Family Info) - **PRIMARY ANCHOR** - 3 section cards (Places/Practice/Helper)
- `ToDo.tsx` - 2 section cards (Tasks/Shopping)
- `Expenses.tsx` - 1 summary card (Monthly Total)
- `Meals.tsx` - Week navigation (no section cards, just header + sticky nav)

All pages follow identical structure and must remain synchronized. **Family Info is the anchor** - always match other pages to it, never modify Family Info to match others.

---

## 1. Page Container

```jsx
<div className="min-h-screen bg-background pb-40">
  <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
    {/* Content */}
  </div>
</div>
```

---

## 2. Sticky Header

```jsx
<header 
  className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
  style={{ height: '120px', boxShadow: '0 10px 0 0 hsl(var(--background))' }}
>
  <div className="flex items-center justify-between w-full">
    <h1 className="w-full">
      <span className="text-primary font-bold" style={{ fontSize: '20px' }}>
        {/* Subtitle - e.g., "To Do", "Family Info" */}
      </span><br />
      <span className="text-display text-foreground">
        {/* Main Title - e.g., "Tasks", "Places" */}
      </span>
    </h1>
    {/* Optional: Right-side button (filter, etc.) */}
  </div>
</header>
```

### Key Rules:
- Height: Fixed `120px`
- Header uses negative margin pattern: `-mx-4 px-4 sm:-mx-6 sm:px-6`
- `h1` must have `className="w-full"`
- Subtitle: `text-primary font-bold` + `fontSize: '20px'`
- Main title: `text-display text-foreground`
- boxShadow creates visual separation: `'0 10px 0 0 hsl(var(--background))'`

---

## 3. Section Toggle Cards

```jsx
{/* Section Toggle Cards */}
<div className="mt-4 mb-2 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 [overflow-x-auto scrollbar-hide]">
  <div className="flex gap-3">
    {/* Card buttons */}
  </div>
</div>
```

### Outer Container Classes:
| Base Classes | Optional (if scrollable) |
|-------------|-------------------------|
| `mt-4 mb-2 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6` | `overflow-x-auto scrollbar-hide` |

**Note:** `pb-2` provides internal padding for button shadows to remain visible within the overflow container. `mb-2` is reduced from `mb-4` to maintain total 16px spacing.

### Inner Container:
- Always: `flex gap-3`

### Card Button - 2 Cards (ToDo):
```jsx
<button
  className={`flex-1 px-3 py-2.5 rounded-xl text-left transition-all ${
    isActive
      ? 'bg-primary text-primary-foreground shadow-md'
      : 'bg-card text-foreground shadow-sm'
  }`}
>
  <div className="flex items-center gap-2">
    <Icon size={16} />
    <span className="text-title">{label}</span>
  </div>
  <div className={`text-caption mt-1 ml-6 ${
    isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
  }`}>
    {subtitle}
  </div>
</button>
```

### Card Button - 3+ Cards (Family Info, scrollable):
```jsx
<button
  className={`flex-shrink-0 min-w-[130px] px-3 py-2.5 rounded-xl text-left transition-all ${
    isActive
      ? 'bg-primary text-primary-foreground shadow-md'
      : 'bg-card text-foreground shadow-sm'
  }`}
>
  {/* Same inner structure as above */}
</button>
```

### Key Differences:
| Scenario | Button Classes |
|----------|---------------|
| 2 cards (fits screen) | `flex-1` (expands equally) |
| 3+ cards (scrollable) | `flex-shrink-0 min-w-[130px]` (fixed minimum width) |
| 1 card (Expenses) | `flex-shrink-0 w-full` (full width, no shrink) |

### Expenses Summary Card (Special Case)

Expenses has a single summary card showing the monthly total. It uses the **same wrapper structure** as section cards but with simplified content (no icon, bigger font, tighter margins):

```jsx
{/* Summary Card - Same wrapper structure, simplified content */}
<div className="mt-4 mb-2 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto scrollbar-hide">
  <div className="flex gap-3">
    <div className="flex-shrink-0 w-full px-3 py-2 rounded-xl text-left bg-transparent">
      <span className="text-title font-bold text-foreground" style={{ fontSize: '1.25rem' }}>{amount}</span>
      <div className="text-caption mt-0.5 text-muted-foreground">
        {subtitle}
      </div>
    </div>
  </div>
</div>
```

**Key differences from section card buttons:**
- Uses `flex-shrink-0 w-full` instead of `flex-1` or `min-w-[130px]`
- Uses `py-2` (slightly less padding to match section card height)
- **No icon** - just the amount text directly
- Amount uses `fontSize: '1.25rem'` (larger than standard `text-title`)
- Subtitle uses `mt-0.5` (tighter than section cards)
- Uses `bg-transparent` (no background, blends with page)

### Meals Week Navigation (No Section Cards)

Meals doesn't have section toggle cards - it goes directly from header to **fixed** week navigation:

```jsx
{/* Header */}
<header 
  className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
  style={{ height: '120px', boxShadow: '0 10px 0 0 hsl(var(--background))' }}
>
  {/* ... */}
</header>

{/* ErrorBanner (returns null when no error) */}
<ErrorBanner ... />

{/* Week Navigation - FIXED (not sticky!) to prevent ANY movement */}
<div 
  className="fixed left-0 right-0 z-20 bg-background py-3"
  style={{ top: '120px' }}
>
  <div className="max-w-2xl mx-auto px-4 sm:px-6">
    {/* Week selector content */}
  </div>
</div>

{/* Spacer for fixed week navigation */}
<div style={{ height: '72px' }} />
```

**CRITICAL - Meals Uses FIXED, Not Sticky:**

| Property | Other Pages | Meals | Reason |
|----------|-------------|-------|--------|
| Position | `sticky` | `fixed` | Prevents ANY movement during scroll |
| `top` | `118px` | `120px` | Flush below header |
| `z-index` | `z-10` | `z-20` | Must be above iOS Safari shield at z-[19] |
| Inner wrapper | None | `max-w-2xl mx-auto px-4 sm:px-6` | Centers content (since fixed breaks page-content flow) |
| Spacer | None | `<div style={{ height: '72px' }} />` | Prevents content from hiding behind fixed nav |

Meals has a **fixed background shield at z-[19]** to prevent iOS Safari scroll flickering:
```jsx
<div className="fixed top-0 left-0 right-0 z-[19] bg-background" style={{ height: '200px' }} />
```

**DO NOT:**
- Change week nav to `sticky` (causes movement on scroll)
- Change week nav `z-index` to `z-10` (hides behind iOS shield)
- Remove the spacer div (content will hide behind fixed nav)
- Remove the inner centering wrapper (content will be full-width)

---

## 4. Sticky Tab Navigation

```jsx
<div 
  className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
  style={{ 
    top: '118px',
    boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
  }}
>
  <div 
    className="relative rounded-full overflow-hidden"
    style={{ backgroundColor: 'hsl(var(--muted))' }}
  >
    <div className="flex p-1 overflow-x-auto scrollbar-hide">
      {/* Tab buttons */}
    </div>
    {/* Inset shadow overlay */}
    <div 
      className="absolute inset-0 rounded-full pointer-events-none"
      style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
    />
  </div>
</div>
```

### Key Rules:
- `top: '118px'` - Positions below the 120px header (with 2px gap, prevents pill cut-off)
- `z-10` - Below header's `z-20`
- Dynamic shadow on scroll: `isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'`
- Pill container background: `hsl(var(--muted))`
- Inner padding: `p-1`

### Tab Button:
```jsx
<button
  className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all ${
    isActive
      ? 'bg-card text-primary shadow-sm'
      : 'text-muted-foreground'
  }`}
>
  {label}
</button>
```

---

## 5. Complete Class Reference

| Element | Classes |
|---------|---------|
| Page outer | `min-h-screen bg-background pb-40` |
| Page content | `max-w-2xl mx-auto px-4 sm:px-6 page-content` |
| Header | `sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end` |
| Header style | `height: '120px', boxShadow: '0 10px 0 0 hsl(var(--background))'` |
| Header inner | `flex items-center justify-between w-full` |
| h1 | `w-full` |
| Subtitle span | `text-primary font-bold` + `fontSize: '20px'` |
| Main title span | `text-display text-foreground` |
| Cards outer | `mt-4 mb-2 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto scrollbar-hide` |
| Cards inner | `flex gap-3` |
| Card (2 cards) | `flex-1 px-3 py-2.5 rounded-xl text-left transition-all` |
| Card (3+ cards) | `flex-shrink-0 min-w-[130px] px-3 py-2.5 rounded-xl text-left transition-all` |
| Card (1 card/Expenses) | `flex-shrink-0 w-full px-3 py-2 rounded-xl text-left bg-transparent` |
| Card active | `bg-primary text-primary-foreground shadow-md` |
| Card inactive | `bg-card text-foreground shadow-sm` |
| Tab nav outer | `sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200` |
| Tab nav style | `top: '118px', boxShadow: isScrolled ? '...' : 'none'` |
| Tab pills container | `relative rounded-full overflow-hidden` + `backgroundColor: 'hsl(var(--muted))'` |
| Tab pills scroll | `flex p-1 overflow-x-auto scrollbar-hide` |
| Tab button | `px-4 py-2 rounded-full text-body whitespace-nowrap transition-all` |
| Tab active | `bg-card text-primary shadow-sm` |
| Tab inactive | `text-muted-foreground` |
| Tab inset shadow | `absolute inset-0 rounded-full pointer-events-none` + `boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)'` |
| Main content | `pt-4` (NO min-height!) |

---

## 6. Z-Index Hierarchy

| Element | Z-Index |
|---------|---------|
| Header | `z-20` |
| Tab Navigation | `z-10` |

---

## 7. Spacing Summary

| Gap | Value |
|-----|-------|
| Header height | 120px |
| Tab nav top position | 118px |
| Cards margin top/bottom | mt-4 mb-4 (16px) |
| Cards gap | gap-3 (12px) |
| Tab nav padding | py-3 (12px) |
| Tab pills inner padding | p-1 (4px) |

---

## 8. Main Content Area

After the tab navigation, the main content area starts:

```jsx
{/* MAIN CONTENT */}
<div className="pt-4">
  {/* Page content */}
</div>
```

### Critical Rule: NO min-height

**DO NOT** add `min-h-[...]` to the main content area:

```jsx
// WRONG - causes scroll alignment issues
<div className="pt-4 min-h-[350px]">

// CORRECT
<div className="pt-4">
```

**Background:** During the Expenses audit (January 2026), a `min-h-[350px]` was discovered on the main content area. This had been added when Expenses had a tall "hero" summary card to ensure enough scroll space for the card to scroll behind the header. After converting to the standard small summary card, this became redundant and caused the content to scroll "too far up" compared to Family Info.

---

## 9. Conditional Rendering Pattern

When hiding elements for certain user roles (e.g., helpers), wrap individual sections:

```jsx
{/* Summary Card - Hidden for helpers */}
{!isHelper && (
  <div className="mt-4 mb-4 ...">
    {/* ... */}
  </div>
)}

{/* Tab Navigation - Hidden for helpers */}
{!isHelper && (
  <div className="sticky z-10 ...">
    {/* ... */}
  </div>
)}
```

This pattern doesn't affect layout when the condition is true (elements render normally).

---

## Maintenance Notes

When modifying these pages:
1. **Family Info is the anchor** - always match other pages to it
2. **Update all three pages together**: ToDo.tsx, HouseholdInfo.tsx, Expenses.tsx
3. Use the debug CSS in `index.css` to verify pixel alignment
4. Test on all pages after any structural changes
5. Do NOT add extra padding/margin between section cards and tab nav
6. Do NOT add `min-h-[...]` to main content areas
7. For future audits, temporarily add color-coded debug CSS to `index.css` to visually compare element positions

---

## History

| Date | Change |
|------|--------|
| Jan 2026 | Meals week nav: Changed to FIXED (not sticky) to prevent ANY movement on scroll |
| Jan 2026 | Added Expenses.tsx to unified structure |
| Jan 2026 | Removed redundant `min-h-[350px]` from Expenses main content |
| Jan 2026 | Converted Expenses hero card to standard summary card format |
| Jan 2026 | Established Family Info as the anchor for pixel-perfect alignment |

Last updated: January 2026

