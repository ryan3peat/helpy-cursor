# Scroll Header Animation Pattern

## Overview

A scroll-triggered header shrink animation that provides a polished, native-app feel. When the user scrolls down, the header collapses to maximize content visibility while maintaining navigation accessibility.

---

## Behavior

| Element | Default State | Scrolled State |
|---------|---------------|----------------|
| **Header** | Full size, generous padding | Compact, minimal padding |
| **Title** | `scale(1)` - full size | `scale(0.5)` - 50% size |
| **Toggle Buttons** | Visible, full height | Faded out, collapsed to 0 |
| **Tab Navigation** | Below header | Sticky at top with shadow |

---

## Implementation

### 1. Import the Hook

```tsx
import { useScrollHeader } from '@/hooks/useScrollHeader';
```

### 2. Use in Component

```tsx
const MyPage: React.FC = () => {
  const { isScrolled } = useScrollHeader();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        
        {/* STICKY HEADER */}
        <header 
          className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 transition-[padding] duration-300 overflow-hidden"
          style={{ 
            paddingTop: isScrolled ? '12px' : '48px',
            paddingBottom: '12px'
          }}
        >
          <h1 
            className="text-display text-foreground transition-transform duration-300 origin-left will-change-transform"
            style={{ transform: isScrolled ? 'scale(0.5)' : 'scale(1)' }}
          >
            Page Title
          </h1>
        </header>

        {/* COLLAPSIBLE SECTION (optional) */}
        <div 
          className="transition-all duration-300 overflow-hidden"
          style={{
            opacity: isScrolled ? 0 : 1,
            maxHeight: isScrolled ? '0px' : '100px',
            marginBottom: isScrolled ? '0px' : '24px',
            marginTop: isScrolled ? '0px' : '16px'
          }}
        >
          {/* Toggle buttons, filters, etc. */}
        </div>

        {/* STICKY TAB NAVIGATION */}
        <div 
          className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-all duration-300"
          style={{ 
            top: isScrolled ? '52px' : '80px',
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

## Pixel-Perfect Specifications

### Header Container

| Property | Default | Scrolled | Notes |
|----------|---------|----------|-------|
| Padding Top | 48px | 12px | Generous → Compact |
| Padding Bottom | 12px | 12px | Consistent |
| Background | `bg-background/95` | `bg-background/95` | Semi-transparent |
| Backdrop | `backdrop-blur-sm` | `backdrop-blur-sm` | Subtle blur |
| Z-Index | 20 | 20 | Above tab nav |

### Title

| Property | Default | Scrolled | Notes |
|----------|---------|----------|-------|
| Transform | `scale(1)` | `scale(0.5)` | Shrinks to 50% |
| Origin | `origin-left` | `origin-left` | Scales from left edge |
| Duration | 300ms | 300ms | Smooth transition |

### Collapsible Section

| Property | Default | Scrolled | Notes |
|----------|---------|----------|-------|
| Opacity | 1 | 0 | Fades out |
| Max Height | 100px | 0px | Collapses |
| Margin Bottom | 24px | 0px | Removes spacing |
| Margin Top | 16px | 0px | Removes spacing |

### Tab Navigation

| Property | Default | Scrolled | Notes |
|----------|---------|----------|-------|
| Position | `sticky` | `sticky` | Always sticky |
| Top | 80px | 52px | Moves up |
| Z-Index | 10 | 10 | Below header |
| Box Shadow | none | `0 4px 12px -2px rgba(0,0,0,0.08)` | Scroll indicator |

---

## Anti-Jitter System

The hook uses multiple techniques to prevent jitter from elastic/bounce scrolling:

### 1. Hysteresis (Wide Gap)
Different thresholds for collapsing vs expanding:
- **Collapse**: when `scrollY > 60px`
- **Expand**: when `scrollY < 5px`
- **Buffer zone**: 55px gap prevents oscillation

### 2. Cooldown Lock
After each state change, further changes are blocked for 150ms:
```typescript
isLockedRef.current = true;
setTimeout(() => {
  isLockedRef.current = false;
}, 150);
```

### 3. requestAnimationFrame
Throttles updates to screen refresh rate for smoother animation.

### 4. Ignore Elastic Scroll
Negative scroll values (iOS overscroll) are ignored:
```typescript
if (scrollY >= 0) {
  // Only process positive scroll values
}
```

---

## CSS Classes Used

```css
/* Background with transparency and blur */
.bg-background/95    /* 95% opacity */
.backdrop-blur-sm    /* Subtle blur effect */

/* Transitions */
.transition-[padding]      /* Animate padding changes */
.transition-transform      /* Animate scale */
.transition-all            /* Animate all properties */
.duration-300              /* 300ms duration */

/* Performance */
.will-change-transform     /* GPU optimization hint */
.overflow-hidden           /* Prevents content flash during collapse */

/* Sticky positioning */
.sticky                    /* Enable sticky behavior */
.z-20, .z-10              /* Layer ordering */
```

---

## Shadow Specification

When scrolled, the tab navigation gets a subtle shadow to indicate it's "floating":

```css
box-shadow: 0 4px 12px -2px rgba(0,0,0,0.08)
```

| Value | Meaning |
|-------|---------|
| `0` | X offset (none) |
| `4px` | Y offset (downward) |
| `12px` | Blur radius |
| `-2px` | Spread (negative = tighter) |
| `rgba(0,0,0,0.08)` | Black at 8% opacity |

---

## Usage Notes

1. **Full-bleed Header**: Use negative margins (`-mx-4`, `-mx-6`) and matching padding (`px-4`, `px-6`) to make header span full width while keeping content aligned.

2. **Responsive**: Use `sm:` breakpoints to adjust padding on larger screens.

3. **Performance**: The `{ passive: true }` option on the scroll listener prevents blocking the main thread.

4. **Customization**: Adjust thresholds, timing, and scale values as needed for different page layouts.

---

## Files

- **Hook**: `/hooks/useScrollHeader.ts`
- **Example**: `/components/HouseholdInfo.tsx`
- **Docs**: `/docs/SCROLL_HEADER_PATTERN.md`

