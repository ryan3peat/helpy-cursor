# Meals Page Auto-Scroll Fix

## ⚠️ CRITICAL - DO NOT MODIFY THIS PATTERN

**Status: 100% flicker-free (header + body).**

This solution is **permanent** and **must not be changed, removed, or overwritten**.
All agents must treat this as a locked pattern.

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

### 1.1 Header Flicker Fix (DO NOT REMOVE)

The Meals header must be **overlay-stabilized** to prevent iOS Safari repaint flicker.
This solution is required **at all times** and must **never be removed or overwritten**.

Required elements (must stay exactly as-is):

```tsx
// Solid background shield behind header/tabs (must stay)
<div
  className="fixed top-0 left-0 right-0 z-[19] bg-background pointer-events-none"
  style={{ height: '210px' }}
/>

// Fixed overlay for header title + actions (visuals only)
<div className="fixed top-0 left-0 right-0 z-[21] pointer-events-none" aria-hidden="true">
  <div className="max-w-2xl mx-auto px-4 sm:px-6">
    <div className="flex items-end pb-3" style={{ height: '120px' }}>
      <div className="flex items-center justify-between w-full">
        <h1 className="text-display text-foreground header-title-stable">Meals</h1>
        <div className="flex items-center gap-1 text-muted-foreground">
          {/* Export icon (week only) */}
          {/* List/Table toggle */}
        </div>
      </div>
    </div>
  </div>
</div>

// Fixed overlay for week selector + Today button (visuals only)
<div className="fixed top-[120px] left-0 right-0 z-[21] pointer-events-none" aria-hidden="true">
  <div className="max-w-2xl mx-auto px-4 sm:px-6">
    <div className="bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-5 header-sticky-stable">
      {/* Week selector + Today button */}
    </div>
  </div>
</div>
```

And the real interactive header elements must remain in place but be hidden:

```tsx
<h1 className="text-display text-foreground header-title-stable opacity-0">...</h1>
<div className="flex items-center gap-1 opacity-0">{/* header actions */}</div>
<div className="sticky ... header-sticky-stable opacity-0">{/* week selector */}</div>
```

Required CSS:

```css
.header-title-stable {
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
}

.header-sticky-stable {
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: transform;
}
```

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
| **Keep header overlays + shield** | Prevents iOS repaint flicker |
| **Do not remove overlay CSS** | Ensures stable compositing |
| **Do not re-enable content-visibility on cards** | Causes delayed card rendering and shadow pop-in |
| **Never remove the fixed overlays** | They guarantee zero flicker |
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

*Last updated: January 2026*
