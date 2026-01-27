# Meals Page - Fixed Header + Container Scroll Implementation

## ⚠️ CRITICAL - DO NOT MODIFY THIS PATTERN

**Status: Clean, iOS-stable implementation using fixed headers and contained scrolling.**

This solution is **permanent** and **must not be changed, removed, or overwritten**.
All agents must treat this as a locked pattern.

---

## Overview

The Meals page uses a **fixed header + container scroll** approach:
- **Fixed headers** positioned relative to viewport (immune to iOS layout bugs)
- **Content area** has padding to account for fixed headers
- **Scrolling happens inside** the content containers only
- Shadow appears under week nav when content is scrolled

This approach is more stable than sticky positioning on iOS Safari.

---

## Protected Files

| File | What's Protected |
|------|------------------|
| `components/Meals.tsx` | Fixed headers, container scroll, isActive prop |
| `components/Layout.tsx` | Fragment pattern for null children |
| `App.tsx` | Meals always-mounted pattern, isActive prop |

---

## Key Implementation Details

### 1. Outer Container - Locked to Viewport

```tsx
<div className="h-screen bg-background overflow-hidden">
```

- `h-screen` - Fixed to viewport height
- `overflow-hidden` - No page scroll
- This prevents confusing dual-scroll behavior

### 2. Fixed Header - Viewport-Relative (NOT Sticky!)

```tsx
<header 
  className="fixed top-0 left-0 right-0 z-30 bg-background"
  style={{ 
    paddingTop: 'env(safe-area-inset-top)',
    touchAction: 'none',
  }}
>
  <div 
    className="max-w-2xl mx-auto px-4 sm:px-6 pb-3 flex items-end" 
    style={{ 
      height: '120px', 
      boxShadow: '0 10px 0 0 hsl(var(--background))' 
    }}
  >
    {/* Title and action buttons */}
  </div>
</header>
```

**Why Fixed Instead of Sticky:**
- `position: fixed` is relative to the **viewport**, not the scroll container
- Immune to iOS Safari stacking context and layout bugs
- Never moves regardless of scroll position or touch behavior
- `touchAction: 'none'` prevents touch-triggered scroll on header area

### 3. Fixed Week Navigation - Below Fixed Header

```tsx
<div 
  ref={weekNavOverlayRef}
  className="fixed left-0 right-0 z-20 bg-background transition-shadow duration-200"
  style={{ 
    top: 'calc(env(safe-area-inset-top) + 120px)',
    boxShadow: isContainerScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none',
    touchAction: 'none',
  }}
>
  <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
    {/* Week selector and Today button */}
  </div>
</div>
```

- Positioned directly below header using `top: calc(env(safe-area-inset-top) + 120px)`
- Shadow controlled by `isContainerScrolled` state
- `touchAction: 'none'` prevents scroll on touch

### 4. Content Area - Padding for Fixed Headers

```tsx
<div 
  className="max-w-2xl mx-auto px-4 sm:px-6 h-full flex flex-col"
  style={{ 
    paddingTop: 'calc(env(safe-area-inset-top) + 208px)',  /* 120px header + 88px week nav */
    touchAction: 'none',
  }}
>
  {/* Error banner and main content */}
</div>
```

- `paddingTop` creates space for the fixed headers
- Uses `calc()` to handle safe area + header heights
- Content flows naturally below the fixed elements

### 5. Day View - Scrollable Container

```tsx
<div
  ref={dayViewRef}
  className="flex-1 min-h-0 overflow-y-auto scrollbar-hide"
  style={{
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-y',
  }}
>
  <div className="space-y-4 pb-40 px-1">
    {/* Day cards */}
  </div>
</div>
```

- `flex-1 min-h-0` - Fills remaining space, allows shrinking
- `overflow-y-auto` - Vertical scroll only
- `overscrollBehavior: 'contain'` - No overscroll beyond container
- `touchAction: 'pan-y'` - Only vertical scroll gestures

### 6. Week View (Table) - Bidirectional Scroll

```tsx
<div
  ref={weekScrollRef}
  className="flex-1 min-h-0 overflow-auto scrollbar-hide"
  style={{
    overscrollBehavior: 'none',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-x pan-y',
  }}
>
  <table style={{ minHeight: 'calc(100vh - 200px)' }}>
    {/* Table with sticky thead and sticky first column */}
  </table>
</div>
```

- `overflow-auto` - Both horizontal and vertical scroll
- `overscrollBehavior: 'none'` - No bounce effect
- `touchAction: 'pan-x pan-y'` - Allow both scroll directions
- Table has `minHeight` to ensure enough scrollable area

### 7. Scroll-to-Today Logic

```tsx
// Uses getBoundingClientRect for accurate positioning
const containerTop = scrollContainer.getBoundingClientRect().top;
const elementTop = targetEl.getBoundingClientRect().top;
const currentScroll = scrollContainer.scrollTop;
const topOffset = 12; // Small gap between today card and container top
const scrollToPosition = currentScroll + (elementTop - containerTop) - topOffset;
scrollContainer.scrollTo({ top: Math.max(0, scrollToPosition), behavior: 'auto' });
```

- Multiple timed attempts [0, 50, 150]ms for reliability
- `hasInitiallyScrolled` ref prevents duplicate scrolls
- Resets when `isActive` becomes false
- Uses container refs (not window) for both day and week views

### 8. Container Scroll Tracking

```tsx
useEffect(() => {
  if (!isActive || view !== 'day') {
    setIsContainerScrolled(false);
    return;
  }
  
  const container = dayViewRef.current;
  if (!container) return;
  
  const handleScroll = () => {
    setIsContainerScrolled(container.scrollTop > 10);
  };
  
  container.addEventListener('scroll', handleScroll, { passive: true });
  return () => container.removeEventListener('scroll', handleScroll);
}, [isActive, view]);
```

---

## Layout.tsx - Fragment Pattern

When Meals is active, Layout receives `null` children. Updated to use fragment:

```tsx
return (
  <>
    {children && (
      <div className="min-h-screen pb-20 bg-background">
        <div key={activeView} className="flex-1 page-fade-in">{children}</div>
      </div>
    )}
    <nav>...</nav>
  </>
);
```

This prevents an empty div from appearing above Meals.

---

## Z-Index Hierarchy

| Element | Z-Index | Position |
|---------|---------|----------|
| Fixed Header | `z-30` | `fixed top-0` |
| Fixed Week Nav | `z-20` | `fixed` below header |
| Table thead | `z-10` | `sticky top-0` within table |
| Table corner cell | `z-[15]` | `sticky left-0` |
| Table date cells | `z-[5]` | `sticky left-0` |

---

## Rules - DO NOT BREAK

| Rule | Why |
|------|-----|
| **Keep headers as `position: fixed`** | Immune to iOS layout bugs |
| **Keep `touchAction: 'none'` on header areas** | Prevents scroll on header touch |
| **Keep content `paddingTop` calc** | Creates space for fixed headers |
| **Keep outer container `h-screen overflow-hidden`** | Prevents page scroll |
| **Keep day view `touchAction: 'pan-y'`** | Vertical scroll only |
| **Keep week view `touchAction: 'pan-x pan-y'`** | Both scroll directions |
| **Keep `overscrollBehavior: none/contain`** | Prevents rubber band effect |
| **Keep Meals always-mounted in App.tsx** | Preserves state |
| **Keep isActive prop flow** | Controls when scroll runs |
| **Keep Layout fragment pattern** | Prevents empty div above Meals |

---

## Testing Checklist

- [ ] Header stays completely fixed while scrolling content
- [ ] Touching header area does NOT scroll content
- [ ] Day view scrolls vertically only
- [ ] Week view scrolls both horizontally and vertically
- [ ] Shadow appears under week nav when scrolled
- [ ] Today card/row scrolls into view on page load
- [ ] No overscroll/rubber band effect
- [ ] Works on iOS Safari (the target platform)
- [ ] Navigate away and back - same behavior
- [ ] Switch Day/Week view - works correctly

---

*Last updated: January 2026*
*Fixed header + container scroll pattern - LOCKED*
