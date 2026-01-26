# Meals Page - Container-Based Scroll Implementation

## ⚠️ CRITICAL - DO NOT MODIFY THIS PATTERN

**Status: Clean, flicker-free implementation using contained scrolling.**

This solution is **permanent** and **must not be changed, removed, or overwritten**.
All agents must treat this as a locked pattern.

**If git pull causes conflicts with these files, KEEP THE LOCAL VERSION.**

---

## Overview

The Meals page uses a **container-based scroll** approach:
- The outer page is **locked to viewport** (`h-screen overflow-hidden`)
- All scrolling happens inside the **cards container** only
- No page-level scroll, no dual-scroll confusion
- Shadow appears under week nav when cards are scrolled

This is **much simpler** than the previous overlay-based approach.

---

## Protected Files

| File | What's Protected |
|------|------------------|
| `components/Meals.tsx` | Container scroll, header structure, isActive prop |
| `components/Layout.tsx` | Fragment pattern for null children |
| `App.tsx` | Meals always-mounted pattern, isActive prop |

---

## Key Implementation Details

### 1. Outer Container - Locked to Viewport

```tsx
<div className="h-screen bg-background overflow-hidden">
```

- `h-screen` - Fixed to viewport height
- `overflow-hidden` - No page scroll
- This prevents confusing dual-scroll behavior

### 2. Header - Standard Sticky (No Overlays!)

```tsx
<header 
  className="sticky top-0 z-20 bg-background ..."
  style={{ 
    height: '120px', 
    boxShadow: '0 10px 0 0 hsl(var(--background))' 
  }}
>
```

- **No fixed overlays** - real elements are visible
- **No opacity-0** - removed the overlay pattern
- Same structure as ToDo header
- `boxShadow` prevents content bleed-through

### 3. Week Navigation - Shadow on Container Scroll

```tsx
<div 
  className="sticky z-20 bg-background ... transition-shadow duration-200"
  style={{ 
    top: '120px',
    boxShadow: isContainerScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
  }}
>
```

- Shadow controlled by `isContainerScrolled` state
- Tracks scroll of the cards container, not window

### 4. Cards Container - Self-Contained Scroll

```tsx
<div
  ref={dayViewRef}
  className="overflow-y-auto scrollbar-hide"
  style={{
    height: 'calc(100vh - 210px - var(--meals-bottom-nav-h, 64px) - env(safe-area-inset-bottom, 0px))',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  }}
>
  <div className="space-y-4 pb-6">
    {/* Day cards */}
    
    {/* Footer inside scroll container */}
    <div className="helpy-footer">
      <span className="helpy-logo">helpy</span>
    </div>
  </div>
</div>
```

- Container has **calculated height** to fill remaining space
- `scrollbar-hide` - Hidden scrollbar, scroll still works
- `overscrollBehavior: 'contain'` - No overscroll beyond container
- **Footer inside container** - Visible when scrolled to bottom

### 5. Scroll-to-Today Logic

```tsx
// Uses getBoundingClientRect for accurate positioning
const containerTop = scrollContainer.getBoundingClientRect().top;
const elementTop = targetEl.getBoundingClientRect().top;
const currentScroll = scrollContainer.scrollTop;
const scrollToPosition = currentScroll + (elementTop - containerTop);
scrollContainer.scrollTo({ top: scrollToPosition, behavior: 'auto' });
```

- Multiple timed attempts [0, 50, 150]ms for reliability
- `hasInitiallyScrolled` ref prevents duplicate scrolls
- Resets when `isActive` becomes false

### 6. Container Scroll Tracking

```tsx
useEffect(() => {
  if (!isActive || view !== 'day') {
    setIsContainerScrolled(false);
    return;
  }
  
  const container = dayViewRef.current;
  if (!container) return;
  
  const handleScroll = () => {
    setIsContainerScrolled(container.scrollTop > 10);
  };
  
  container.addEventListener('scroll', handleScroll, { passive: true });
  return () => container.removeEventListener('scroll', handleScroll);
}, [isActive, view]);
```

---

## Layout.tsx - Fragment Pattern

When Meals is active, Layout receives `null` children. Updated to use fragment:

```tsx
return (
  <>
    {children && (
      <div className="min-h-screen pb-20 bg-background">
        <div key={activeView} className="flex-1 page-fade-in">{children}</div>
      </div>
    )}
    <nav>...</nav>
  </>
);
```

This prevents an empty 80px div from appearing above Meals when scrolling.

---

## What Was Removed (No Longer Needed)

| Old Pattern | Why Removed |
|-------------|-------------|
| Fixed background shield (z-[19]) | Container scroll eliminates flicker |
| Fixed title overlay (z-[21]) | No longer needed |
| Fixed week-nav overlay (z-[21]) | No longer needed |
| `opacity-0` on real elements | No longer needed |
| `.header-title-stable` CSS class | No longer needed |
| `.header-sticky-stable` CSS class | No longer needed |
| Window scroll clamp | Container handles boundaries |
| TouchMove preventDefault | Container handles overscroll |

---

## Rules - DO NOT BREAK

| Rule | Why |
|------|-----|
| **Keep outer container `h-screen overflow-hidden`** | Prevents page scroll |
| **Keep cards container with calculated height** | Proper scroll boundaries |
| **Keep `scrollbar-hide` on cards container** | Clean mobile appearance |
| **Keep `overscrollBehavior: contain`** | Prevents rubber band effect |
| **Keep footer inside cards container** | Visible on scroll to bottom |
| **Keep Meals always-mounted in App.tsx** | Preserves state |
| **Keep isActive prop flow** | Controls when scroll runs |
| **Keep Layout fragment pattern** | Prevents empty div above Meals |

---

## Testing Checklist

- [ ] Land on Meals from any page - today's card visible immediately
- [ ] Scroll cards - shadow appears under week nav
- [ ] Scroll to bottom - helpy footer visible
- [ ] No scrollbar visible on mobile
- [ ] No overscroll/rubber band effect
- [ ] Header area cannot be scrolled (no empty space above)
- [ ] Navigate away and back - same behavior
- [ ] Switch Day/Week view - works correctly
- [ ] Dark mode - all elements correct

---

*Last updated: January 2026*
*Container-based scroll pattern - LOCKED*
