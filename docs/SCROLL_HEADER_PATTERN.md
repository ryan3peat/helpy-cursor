# Scroll Header Animation Pattern

## Overview

A scroll-triggered header shrink animation that provides a polished, native-app feel. When the user scrolls down, the header collapses to maximize content visibility while maintaining navigation accessibility.

**Key Principle: Shrink Title Only, Snap Everything Else**

To avoid jitter, only the title uses a CSS transition (GPU-accelerated `transform: scale()`). All other properties (padding, margins, positions) snap instantly without transitions.

---

## Behavior

| Element | Default State | Scrolled State | Animation |
|---------|---------------|----------------|-----------|
| **Header Padding** | 48px top | 12px top | Instant snap (no transition) |
| **Title** | `scale(1)` | `scale(0.5)` | Smooth 300ms transition |
| **Collapsible Section** | Visible, opacity 1 | Hidden, opacity 0 | Opacity fades 200ms |
| **Tab Navigation Position** | `top: 96px` | `top: 52px` | Instant snap |
| **Tab Navigation Shadow** | none | shadow | Fades 200ms |

---

## Why This Pattern?

### The Problem with Animating Layout Properties

Animating `padding`, `margin`, `top`, or `maxHeight` triggers **layout recalculation** on every frame, causing:
- Micro-stutters/jitter
- Poor performance on mobile
- Worse on iOS elastic scrolling

### The Solution: GPU-Only Animations

Only these properties animate smoothly on the GPU:
- `transform` (scale, translate, rotate)
- `opacity`
- `box-shadow` (in most browsers)

Everything else should **snap instantly**.

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
        
        {/* STICKY HEADER - NO transition on padding */}
        <header 
          className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-hidden"
          style={{ 
            paddingTop: isScrolled ? '12px' : '48px',
            paddingBottom: '12px'
          }}
        >
          {/* TITLE - ONLY this animates (GPU-accelerated) */}
          <h1 
            className="text-display text-foreground transition-transform duration-300 origin-left will-change-transform"
            style={{ transform: isScrolled ? 'scale(0.5)' : 'scale(1)' }}
          >
            Page Title
          </h1>
        </header>

        {/* COLLAPSIBLE SECTION - opacity fades, layout snaps */}
        <div 
          className="transition-opacity duration-200 overflow-hidden"
          style={{
            opacity: isScrolled ? 0 : 1,
            maxHeight: isScrolled ? '0px' : '120px',
            marginBottom: isScrolled ? '0px' : '24px',
            marginTop: isScrolled ? '0px' : '16px',
            pointerEvents: isScrolled ? 'none' : 'auto',
          }}
        >
          {/* Toggle buttons, filters, etc. */}
        </div>

        {/* STICKY TAB NAVIGATION - position snaps, shadow fades */}
        <div 
          className="sticky z-10 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 transition-shadow duration-200"
          style={{ 
            top: isScrolled ? '52px' : '96px',
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

## Critical Rules

### DO

- Use `transition-transform` on title only
- Use `transition-opacity` for fade effects
- Use `transition-shadow` for shadow effects
- Let padding/margin/top snap instantly

### DO NOT

- Use `transition-[padding]` on header
- Use `transition-all` on containers with layout changes
- Animate `maxHeight` with transitions
- Animate `top` position with transitions

---

## Pixel-Perfect Specifications

### Header Container

| Property | Default | Scrolled | Transition |
|----------|---------|----------|------------|
| Padding Top | 48px | 12px | **None (instant)** |
| Padding Bottom | 12px | 12px | - |
| Background | `bg-background/95` | `bg-background/95` | - |
| Z-Index | 20 | 20 | - |

### Title

| Property | Default | Scrolled | Transition |
|----------|---------|----------|------------|
| Transform | `scale(1)` | `scale(0.5)` | 300ms ease |
| Origin | `origin-left` | `origin-left` | - |

### Collapsible Section

| Property | Default | Scrolled | Transition |
|----------|---------|----------|------------|
| Opacity | 1 | 0 | 200ms ease |
| Max Height | 120px | 0px | **None (instant)** |
| Margins | 16px/24px | 0px | **None (instant)** |
| Pointer Events | auto | none | - |

### Tab Navigation

| Property | Default | Scrolled | Transition |
|----------|---------|----------|------------|
| Top | 96px | 52px | **None (instant)** |
| Box Shadow | none | shadow | 200ms ease |

---

## Anti-Jitter System

The hook uses multiple techniques to prevent jitter:

### 1. Hysteresis (Wide Gap)
Different thresholds for collapsing vs expanding:
- **Collapse**: when `scrollY > 60px`
- **Expand**: when `scrollY < 35px`
- **Buffer zone**: 25px gap prevents oscillation

### 2. Cooldown Lock
After each state change, further changes are blocked for 150ms.

### 3. requestAnimationFrame
Throttles updates to screen refresh rate.

### 4. Ignore Elastic Scroll
Negative scroll values (iOS overscroll) are ignored.

---

## CSS Classes Summary

```css
/* Header - NO padding transition */
.sticky .top-0 .z-20 .bg-background/95 .backdrop-blur-sm .overflow-hidden

/* Title - ONLY transform animates */
.transition-transform .duration-300 .origin-left .will-change-transform

/* Collapsible - ONLY opacity animates */
.transition-opacity .duration-200 .overflow-hidden

/* Tab Nav - ONLY shadow animates */
.transition-shadow .duration-200
```

---

## Files

- **Hook**: `/hooks/useScrollHeader.ts`
- **Examples**: 
  - `/components/HouseholdInfo.tsx`
  - `/components/Meals.tsx`
  - `/components/ToDo.tsx`
  - `/components/Expenses.tsx`
- **Docs**: `/docs/SCROLL_HEADER_PATTERN.md`
