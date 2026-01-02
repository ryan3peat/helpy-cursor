# Meals Page Auto-Scroll Fix

## ⚠️ CRITICAL - DO NOT MODIFY THIS PATTERN

This document explains the auto-scroll fix for the Meals page that scrolls to "Today" on load.

---

## The Problem

When users land on the Meals page, it should auto-scroll to show "Today's" meals at the top of the viewport.

**Previous issues:**
- First visit: today card appeared at bottom (scroll not working)
- Re-visit: today card correctly at top

**Root cause:** Single scroll attempt would fire before layout was fully settled, especially on first app load when data was still loading.

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

### 2. Multiple Timed Scroll Attempts

The bulletproof fix uses **multiple scroll attempts** at increasing delays:

```tsx
useEffect(() => {
  if (!shouldAutoScroll.current) return;

  if (view === 'day') {
    const headerOffset = 200;
    
    const scrollToToday = (): boolean => {
      const targetEl = document.getElementById(`day-${targetDateStr}`);
      if (!targetEl) return false;
      
      const rect = targetEl.getBoundingClientRect();
      
      // Check if already in correct position
      if (rect.top >= headerOffset - 20 && rect.top <= headerOffset + 50) {
        return true;
      }
      
      const elementPosition = rect.top + window.scrollY;
      window.scrollTo({ top: elementPosition - headerOffset, behavior: 'auto' });
      return true;
    };

    // Multiple attempts at 0ms, 50ms, 150ms, 300ms
    const timeouts: number[] = [];
    [0, 50, 150, 300].forEach((delay, i, arr) => {
      const id = window.setTimeout(() => {
        scrollToToday();
        if (i === arr.length - 1) {
          shouldAutoScroll.current = false;
        }
      }, delay);
      timeouts.push(id);
    });

    return () => timeouts.forEach(id => clearTimeout(id));
  }
}, [view, currentViewDate, weekDays]);
```

**Why this works:**
- `0ms`: Catches fast renders
- `50ms`: After initial paint settles
- `150ms`: After async data might load
- `300ms`: Final safety net

Each attempt checks if already in position (avoids visible jumps) and scrolls if needed.

---

## Rules - DO NOT BREAK

| Rule | Why |
|------|-----|
| Match ToDo/Expenses structure | Proven to work without flicker |
| Header INSIDE page-content | Consistent with other pages |
| Use `-mx-4 px-4` on header | Extends header edge-to-edge |
| Use multiple timed attempts | Handles async data loading + layout shifts |
| Check position before scrolling | Prevents visible scroll jumps |
| Use `useEffect` (not useLayoutEffect) | Works better with timed attempts |

---

## Files

- `/components/Meals.tsx` - Reference implementation
- `/components/ToDo.tsx` - Reference implementation
- `/components/Expenses.tsx` - Reference implementation
- `/docs/SCROLL_HEADER_PATTERN.md` - Header pattern documentation
- `/docs/DESIGN_SYSTEM.md` - Comprehensive design system

---

*Last updated: January 2025*
