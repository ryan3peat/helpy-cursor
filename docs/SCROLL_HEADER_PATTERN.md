# Scroll Header Pattern

## Overview

A simple, jitter-free header pattern. The header stays fixed (sticky) at the top. All other content scrolls naturally with the page.

---

## Behavior

| Element | Behavior |
|---------|----------|
| **Header** | Sticky at top (`pt-12 pb-3`), fixed size |
| **Section Toggle Cards / Summary Card** | Regular content, scrolls naturally |
| **Tab Navigation** | Sticky below header, shadow appears on scroll |

---

## Implementation

```tsx
import { useScrollHeader } from '@/hooks/useScrollHeader';

const MyPage: React.FC = () => {
  const { isScrolled } = useScrollHeader();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        
        {/* STICKY HEADER */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 pt-12 pb-3">
          <h1 className="text-display text-foreground">
            Page Title
          </h1>
        </header>

        {/* SECTION TOGGLE CARDS - regular content */}
        <div className="mt-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            {/* Cards */}
          </div>
        </div>

        {/* STICKY TAB NAVIGATION */}
        <div 
          className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
          style={{ 
            top: '92px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          {/* Tab navigation */}
        </div>

        {/* MAIN CONTENT */}
        <div className="pt-4">
          {/* Page content */}
        </div>

      </div>
    </div>
  );
};
```

---

## Key Points

1. **Header is sticky** - stays at top when scrolling
2. **Cards are regular content** - scroll naturally with the page
3. **Tabs are sticky** - stay below header, shadow fades in on scroll
4. **No animations on cards** - simple and clean

---

## Files

- **Hook**: `/hooks/useScrollHeader.ts` (used only for tab shadow)
- **Components**: 
  - `/components/HouseholdInfo.tsx`
  - `/components/ToDo.tsx`
  - `/components/Expenses.tsx`
  - `/components/Meals.tsx`
  - `/components/Dashboard.tsx`
