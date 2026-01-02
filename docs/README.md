# Design System Documentation

## Overview

This folder contains reusable patterns and documentation for the Helpy design system.

---

## Pattern Documentation

| Pattern | File | Description |
|---------|------|-------------|
| **Scroll Header** | `SCROLL_HEADER_PATTERN.md` | Scroll-triggered header shrink animation with anti-jitter |
| **Segmented Control** | `SEGMENTED_CONTROL_PATTERN.md` | Pill-shaped tab navigation with deboss effect |

---

## Reusable Hooks

| Hook | File | Description |
|------|------|-------------|
| `useScrollHeader` | `/hooks/useScrollHeader.ts` | Scroll state with hysteresis and cooldown |

---

## Design Tokens

All design tokens are defined in:
- `/index.css` - CSS variables
- `/index.html` - Tailwind config extension

---

## Applied Pages

| Page | Status | Notes |
|------|--------|-------|
| HouseholdInfo | Complete | Full design system + scroll animation |
| Dashboard | Complete | Uses `useScrollHeader` |
| ToDo (Tasks + Shopping) | Complete | Uses `useScrollHeader`, combined Tasks and Shopping |
| Meals | Complete | Uses `useScrollHeader` + iOS scroll fix |
| Expenses | Complete | Uses `useScrollHeader` |

---

## Quick Start

### 1. Add Scroll Header Animation

```tsx
import { useScrollHeader } from '@/hooks/useScrollHeader';

const MyPage = () => {
  const { isScrolled } = useScrollHeader();
  
  return (
    <header style={{ 
      paddingTop: isScrolled ? '12px' : '48px',
    }}>
      <h1 style={{ 
        transform: isScrolled ? 'scale(0.5)' : 'scale(1)' 
      }}>
        Title
      </h1>
    </header>
  );
};
```

### 2. Add Segmented Control

See `SEGMENTED_CONTROL_PATTERN.md` for full implementation.

---

*Last updated: January 2025*
