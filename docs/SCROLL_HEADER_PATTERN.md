# Scroll Header Animation Pattern

## Overview

A simple, jitter-free header pattern. The header stays fixed size at all times. Collapsible content below fades out when scrolling. No animations on padding, margin, or scale.

---

## Behavior

| Element | Default State | Scrolled State | Animation |
|---------|---------------|----------------|-----------|
| **Header** | Fixed size (pt-12 pb-3) | Same | None |
| **Title** | Full size | Same | None |
| **Collapsible Section** | Visible, opacity 1 | Hidden, height 0 | Opacity fades 200ms |
| **Tab Navigation** | Fixed top position | Same | Shadow fades 200ms |

---

## Implementation

```tsx
import { useScrollHeader } from '@/hooks/useScrollHeader';

const MyPage: React.FC = () => {
  const { isScrolled } = useScrollHeader();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        
        {/* STICKY HEADER - Fixed size, no animations */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 pt-12 pb-3">
          <h1 className="text-display text-foreground">
            Page Title
          </h1>
        </header>

        {/* COLLAPSIBLE SECTION - fades out on scroll */}
        <div 
          className="transition-opacity duration-200 overflow-hidden"
          style={{
            opacity: isScrolled ? 0 : 1,
            height: isScrolled ? 0 : 'auto',
            marginBottom: isScrolled ? 0 : '24px',
            marginTop: isScrolled ? 0 : '16px',
            pointerEvents: isScrolled ? 'none' : 'auto',
          }}
        >
          {/* Toggle buttons, filters, etc. */}
        </div>

        {/* STICKY TAB NAVIGATION */}
        <div 
          className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
          style={{ 
            top: '92px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          {/* Tab navigation component */}
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

1. **Header is fixed size** - `pt-12 pb-3`, never changes
2. **No title scale animation** - title stays full size
3. **Only opacity animates** - on collapsible section
4. **Only shadow animates** - on tab navigation
5. **Tab top is fixed** - `top: '92px'`, never changes

---

## Files

- **Hook**: `/hooks/useScrollHeader.ts`
- **Examples**: 
  - `/components/HouseholdInfo.tsx`
  - `/components/Meals.tsx`
  - `/components/ToDo.tsx`
  - `/components/Expenses.tsx`
