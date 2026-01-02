# Helpy Documentation

## Overview

This folder contains design system documentation, patterns, and troubleshooting guides for the Helpy codebase.

---

## Core Documentation

| Document | Description |
|----------|-------------|
| **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** | Comprehensive design system guide: colors, typography, spacing, components |
| **[GLOBAL_RULES.md](./GLOBAL_RULES.md)** | Global development rules and consistency guidelines |

---

## Pattern Documentation

| Pattern | File | Description |
|---------|------|-------------|
| **Scroll Header** | `SCROLL_HEADER_PATTERN.md` | Scroll-triggered header animation with anti-jitter |
| **Segmented Control** | `SEGMENTED_CONTROL_PATTERN.md` | Pill-shaped tab navigation with deboss effect |
| **Meals Scroll Fix** | `MEALS_SCROLL_FIX.md` | Auto-scroll fix for Meals page (CRITICAL - do not modify) |

---

## Reusable Hooks

| Hook | File | Description |
|------|------|-------------|
| `useScrollHeader` | `/hooks/useScrollHeader.ts` | Scroll state with hysteresis and cooldown |
| `useScrollLock` | `/hooks/useScrollLock.ts` | Lock body scroll when modals are open |
| `useSheetTheme` | `/hooks/useSheetTheme.ts` | Theme handling for bottom sheets |
| `useTranslatedContent` | `/hooks/useTranslatedContent.ts` | Translation support for content |

---

## Setup & Configuration

| Document | Description |
|----------|-------------|
| `LOCAL_DEV_SETUP.md` | Local development environment setup |
| `SUPABASE_SETUP_CLARIFICATION.md` | Supabase configuration guide |
| `CLERK_JWT_RLS_DEPLOYMENT.md` | Clerk JWT and RLS deployment |
| `WEBHOOK_SETUP_GUIDE.md` | Stripe webhook configuration |
| `VAPID_KEYS_BACKUP.md` | Push notification VAPID keys backup |

---

## Push Notifications

| Document | Description |
|----------|-------------|
| `PUSH_NOTIFICATIONS_SETUP.md` | Complete push notification setup |
| `NOTIFICATION_COMPLETE_SETUP.md` | Notification system configuration |
| `NOTIFICATION_DEPLOYMENT_GUIDE.md` | Deployment guide for notifications |
| `PUSH_NOTIFICATION_TROUBLESHOOTING.md` | Troubleshooting push notifications |

---

## Troubleshooting

| Document | Description |
|----------|-------------|
| `APP_NOT_LOADING_TROUBLESHOOTING.md` | App loading issues |
| `JWT_TROUBLESHOOTING_GUIDE.md` | JWT authentication issues |
| `RLS_VERIFICATION_GUIDE.md` | Row Level Security verification |
| `FEEDBACK_ADMIN_DEBUG.md` | Feedback admin debugging |

---

## Design Tokens

All design tokens are defined in:
- `/index.css` - CSS variables
- `/index.html` - Tailwind config extension

---

## Applied Pages

| Page | Status | Notes |
|------|--------|-------|
| Dashboard | Complete | Uses `useScrollHeader` |
| HouseholdInfo | Complete | Full design system + scroll animation |
| ToDo (Tasks + Shopping) | Complete | Uses `useScrollHeader`, combined Tasks and Shopping |
| Meals | Complete | Uses `useScrollHeader` + iOS scroll fix |
| Expenses | Complete | Uses `useScrollHeader` |
| Profile | Complete | Full design system with settings |

---

## Quick Start

### 1. Read the Design System

Start with **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** for a comprehensive guide to all styling patterns.

### 2. Add Scroll Header Animation

```tsx
import { useScrollHeader } from '@/hooks/useScrollHeader';

const MyPage = () => {
  const { isScrolled } = useScrollHeader();
  
  return (
    <header 
      className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
      style={{ height: '120px' }}
    >
      <h1 className="text-display text-foreground">
        Page Title
      </h1>
    </header>
  );
};
```

### 3. Add Segmented Control

See `SEGMENTED_CONTROL_PATTERN.md` for full implementation.

---

## Key Rules (Quick Reference)

1. **No hover effects** - Mobile-first PWA
2. **No uppercase text** - Use normal case
3. **No italic text** - Font style is normal
4. **No emojis** - Clean UI
5. **No borders on cards** - `.bg-card` has no visible borders
6. **Two-line headers** - First line `text-primary`, second line `text-foreground`
7. **Bottom sheet titles** - Always LEFT aligned
8. **Currency** - Always display as "HK$" format

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for complete guidelines.

---

*Last updated: January 2025*
