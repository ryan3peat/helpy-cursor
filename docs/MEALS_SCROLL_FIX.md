# Meals Page Auto-Scroll Fix

## ⚠️ CRITICAL - DO NOT MODIFY THIS PATTERN

This document explains the auto-scroll fix for the Meals page that scrolls to "Today" on load.

---

## The Problem

When users land on the Meals page, it should auto-scroll to show "Today's" meals at the top of the viewport.

**Previous issues:**
- iOS Safari flicker: header would briefly disappear during scroll
- Multiple timed scroll attempts (0ms, 50ms, 150ms, 300ms) caused race conditions
- Each setTimeout created a separate macrotask, iOS Safari repainted between each one

**Root cause:** Multiple scroll attempts caused iOS Safari's compositor to flicker between repaints.

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
- No background shield divs needed

### 2. Single Scroll with useLayoutEffect

The fix uses `useLayoutEffect` with a **single** `requestAnimationFrame`:

```tsx
useLayoutEffect(() => {
  if (!shouldAutoScroll.current) return;

  if (view === 'day') {
    const headerOffset = 200;
    const targetDateStr = formatDateStr(new Date(currentViewDate));
    
    // Single requestAnimationFrame - no race conditions
    const frameId = requestAnimationFrame(() => {
      const targetEl = document.getElementById(`day-${targetDateStr}`);
      if (!targetEl) {
        shouldAutoScroll.current = false;
        return;
      }
      
      const rect = targetEl.getBoundingClientRect();
      const elementPosition = rect.top + window.scrollY;
      window.scrollTo({ top: elementPosition - headerOffset, behavior: 'auto' });
      shouldAutoScroll.current = false;
    });

    return () => cancelAnimationFrame(frameId);
  }
}, [view, currentViewDate, weekDays]);
```

**Why this works:**
- `useLayoutEffect` runs BEFORE browser paint (not after like useEffect)
- Single `requestAnimationFrame` ensures DOM is ready
- ONE scroll operation = no race conditions
- No multiple repaints = no flicker on iOS Safari

---

## Rules - DO NOT BREAK

| Rule | Why |
|------|-----|
| Match ToDo/Expenses structure | Proven to work without flicker |
| Header INSIDE page-content | Consistent with other pages |
| Use `-mx-4 px-4` on header | Extends header edge-to-edge |
| Use `useLayoutEffect` | Runs before paint, prevents flicker |
| Single requestAnimationFrame | No race conditions, no multiple repaints |
| NO multiple setTimeout attempts | This causes iOS Safari flicker! |

---

## Files

- `/components/Meals.tsx` - Reference implementation
- `/components/ToDo.tsx` - Reference implementation
- `/components/Expenses.tsx` - Reference implementation
- `/docs/SCROLL_HEADER_PATTERN.md` - Header pattern documentation
- `/docs/DESIGN_SYSTEM.md` - Comprehensive design system

---

*Last updated: January 2025*
