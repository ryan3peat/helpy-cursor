# Meals Page - Header & Cards Implementation

## ⚠️ CRITICAL - DO NOT MODIFY THIS PATTERN

**Status: 100% flicker-free (header + body).**

This solution is **permanent** and **must not be changed, removed, or overwritten**.
All agents must treat this as a locked pattern.

**If git pull causes conflicts with these files, KEEP THE LOCAL VERSION.**

---

## Protected Files

These files contain the locked implementation:

| File | What's Protected |
|------|------------------|
| `components/Meals.tsx` | Header overlays, scroll logic, isActive prop |
| `App.tsx` | Meals always-mounted pattern, isActive prop |
| `index.css` | `.header-title-stable`, `.header-sticky-stable` |

---

## Part 1: Header Flicker Fix

### Problem
iOS Safari flickers the header area during scroll and page transitions due to compositor repaint timing.

### Solution: Fixed Overlay Pattern

The Meals header uses **fixed visual overlays** that never reflow:

1. **Solid background shield** at z-[19]
2. **Fixed title overlay** at z-[21] (pointer-events-none, aria-hidden)
3. **Fixed week selector overlay** at z-[21] (pointer-events-none, aria-hidden)
4. **Real interactive elements** with opacity-0 (invisible but clickable)

Required CSS in index.css:
- `.header-title-stable` - GPU layer for title
- `.header-sticky-stable` - GPU layer for sticky elements

**DO NOT REMOVE** these overlays or CSS classes.

---

## Part 2: Cards Scroll Fix

### Problem
When landing on Meals, cards render at top (Mon) then scroll to today, causing visible "jump".

### Solution: Always-Mounted + isActive Prop

**App.tsx** renders Meals **outside Layout's keyed container** so it stays mounted:

- In renderView(), meals case returns null
- Meals rendered separately with display:block/none based on activeView
- isActive={activeView === 'meals'} passed to Meals

**Meals.tsx** scroll effect:
- Only runs when isActive is true
- Uses multiple timed attempts [0, 50, 150]ms
- hasInitiallyScrolled ref prevents duplicate scrolls
- **Resets** when isActive becomes false (user leaves page)

---

## Rules - DO NOT BREAK

| Rule | Why |
|------|-----|
| **Keep header overlays + shield** | Prevents iOS repaint flicker |
| **Keep opacity-0 on real header elements** | Overlays provide visuals |
| **Keep Meals always-mounted in App.tsx** | Preserves state, enables instant show |
| **Keep isActive prop flow** | Controls when scroll runs |
| **Keep scroll reset on !isActive** | Ensures scroll runs on every visit |
| **Do NOT use content-visibility on cards** | Causes delayed rendering |
| **Do NOT use useLayoutEffect for scroll** | Causes inconsistent positioning |
| **Do NOT add key={} to Meals wrapper** | Would destroy state on navigation |

---

## Git Conflict Resolution

If git pull conflicts with any of these protected patterns:

1. **ALWAYS keep local version** for:
   - Header overlay structure in Meals.tsx
   - Always-mounted Meals in App.tsx
   - CSS classes in index.css
   - Scroll effect logic with isActive

2. Use `git checkout --ours <file>` if needed

---

## Testing Checklist

- [ ] Land on Meals from any page - header appears instantly, no flicker
- [ ] Today's card scrolls into view smoothly
- [ ] Navigate away and back - same behavior, no blank page
- [ ] Switch Day/Week view - scroll works correctly
- [ ] Dark mode - header overlays match theme

---

*Last updated: January 2026*
*This pattern is LOCKED - do not modify without explicit approval.*
