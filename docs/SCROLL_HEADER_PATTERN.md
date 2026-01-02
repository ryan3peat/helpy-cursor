# Scroll Header Pattern

## Overview

A simple, jitter-free header pattern. The header stays fixed (sticky) at the top. All other content scrolls naturally with the page.

---

## Behavior

| Element | Behavior |
|---------|----------|
| **Header** | Sticky at top, 120px height, `flex items-end` |
| **Section Toggle Cards / Summary Card** | Regular content, scrolls naturally |
| **Tab Navigation** | Sticky below header, shadow appears on scroll |

---

## Implementation

### Standard Header (with scroll shadow)

```tsx
import { useScrollHeader } from '@/hooks/useScrollHeader';

const MyPage: React.FC = () => {
  const { isScrolled } = useScrollHeader();

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        
        {/* STICKY HEADER - 120px fixed height, content at bottom */}
        <header 
          className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end transition-shadow duration-200"
          style={{ 
            height: '120px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          <h1 className="text-display text-foreground">
            Page Title
          </h1>
        </header>

        {/* MAIN CONTENT */}
        <div className="pt-4">
          {/* Page content */}
        </div>

      </div>
    </div>
  );
};
```

### Header without shadow (simpler variant)

```tsx
<header 
  className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end"
  style={{ height: '120px' }}
>
  <h1 className="text-display text-foreground">
    Page Title
  </h1>
</header>
```

---

## Key Points

1. **Header is sticky** - stays at top when scrolling, 120px fixed height
2. **Content aligned to bottom** - use `flex items-end` for header content
3. **No top padding** - removed `pt-12`, use fixed height instead
4. **Dynamic shadow** - optional shadow on scroll using `isScrolled` state
5. **Negative margin trick** - `-mx-4 px-4` extends header edge-to-edge

---

## Files

- **Hook**: `/hooks/useScrollHeader.ts` (used only for tab shadow)
- **Components**: 
  - `/components/HouseholdInfo.tsx`
  - `/components/ToDo.tsx`
  - `/components/Expenses.tsx`
  - `/components/Meals.tsx`
  - `/components/Dashboard.tsx`
  - `/components/Profile.tsx`

---

## Related Documentation

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Comprehensive design system guide
- [MEALS_SCROLL_FIX.md](./MEALS_SCROLL_FIX.md) - Meals page auto-scroll fix

---

*Last updated: January 2025*
