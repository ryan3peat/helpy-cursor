# Meals Page Auto-Scroll Fix

## ⚠️ CRITICAL - DO NOT MODIFY THIS PATTERN

This document explains the auto-scroll fix for the Meals page that scrolls to "Today" on load.

---

## The Problem

When users land on the Meals page, it should auto-scroll to show "Today's" meals.

---

## The Solution

### 1. Match ToDo/Expenses Structure

The Meals page must use the **exact same structure** as ToDo and Expenses:

```tsx
return (
  <div className="min-h-screen bg-background pb-40">
    <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
      <header 
        className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
        style={{ height: '120px' }}
      >
        {/* Header content */}
      </header>
      
      {/* Rest of page content */}
    </div>
  </div>
);
```

Key points:
- Header is INSIDE the `page-content` wrapper
- Header uses `-mx-4 px-4` to extend edge-to-edge
- No `scroll-pending` class

### 2. useLayoutEffect for Auto-Scroll

```tsx
useLayoutEffect(() => {
  if (view !== 'day') return;
  if (!shouldAutoScroll.current) return;

  const performScroll = (): boolean => {
    const targetEl = document.getElementById(`day-${targetDateStr}`);
    if (targetEl) {
      window.scrollTo({ top: position, behavior: 'auto' });
      return true;
    }
    return false;
  };

  if (performScroll()) {
    shouldAutoScroll.current = false;
  } else {
    const rafId = requestAnimationFrame(() => {
      performScroll();
      shouldAutoScroll.current = false;
    });
    return () => cancelAnimationFrame(rafId);
  }
}, [view, currentViewDate]);
```

---

## Rules - DO NOT BREAK

| Rule | Why |
|------|-----|
| Match ToDo/Expenses structure | Proven to work without flicker |
| Header INSIDE page-content | Consistent with other pages |
| Use `-mx-4 px-4` on header | Extends header edge-to-edge |
| Use `useLayoutEffect` | Runs before browser paint |
| NO `useEffect` for scroll | Runs after paint → visible jump |
| RAF fallback for missing element | Handles rare DOM timing issue |

---

## Files

- `/components/Meals.tsx` - Reference implementation
- `/components/ToDo.tsx` - Reference implementation
- `/components/Expenses.tsx` - Reference implementation
- `/docs/SCROLL_HEADER_PATTERN.md` - Header pattern documentation
- `/docs/DESIGN_SYSTEM.md` - Comprehensive design system

---

*Last updated: January 2025*
