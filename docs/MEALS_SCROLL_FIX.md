# Meals Page iOS Scroll Flicker Fix

## ⚠️ CRITICAL - DO NOT MODIFY THIS PATTERN

This document explains the iOS Safari flicker fix for the Meals page auto-scroll to "Today" feature. **This fix has been implemented multiple times because it keeps getting accidentally reverted. Please read this before modifying any scroll-related code in Meals.tsx.**

---

## The Problems (2 Issues)

### Problem 1: iOS Flicker
When users land on the Meals page, it auto-scrolls to show "Today's" meals. On iOS Safari, this causes a **visual flicker** where:

1. Page renders at scroll position 0 (top)
2. User briefly sees content at wrong position
3. Page scrolls to Today
4. User sees content jump → **FLICKER!**

This does NOT happen on Chrome desktop because Chrome batches paints differently.

### Problem 2: Today Card Not Showing
Occasionally, the "Today" card element doesn't exist in the DOM when `useLayoutEffect` first runs. This causes the scroll to fail silently, leaving users at the top of the page instead of at Today.

---

## The Solution (4 Parts)

### Part 1: `isScrollReady` State

```tsx
const [isScrollReady, setIsScrollReady] = useState(false);
```

Content is hidden (`opacity: 0`) until scroll completes. This prevents users from seeing content at the wrong position.

### Part 2: `useLayoutEffect` (NOT useEffect)

```tsx
useLayoutEffect(() => {
  // scroll logic here
}, [view, currentViewDate, isScrollReady]);
```

- `useLayoutEffect` runs **synchronously BEFORE browser paint**
- `useEffect` runs **AFTER browser paint** ← causes flicker!

### Part 3: Synchronous Scroll FIRST

The primary scroll attempt is synchronous (no RAF):

```tsx
// Try synchronous scroll first (prevents iOS flicker)
if (performScroll()) {
  shouldAutoScroll.current = false;
  if (!isScrollReady) setIsScrollReady(true);
}
```

This happens before the browser paints, so no flicker.

### Part 4: RAF Fallback ONLY If Element Not Found

If the element doesn't exist on first try, use RAF as fallback:

```tsx
else {
  // Element not found yet - retry on next animation frame
  const rafId = requestAnimationFrame(() => {
    performScroll();
    shouldAutoScroll.current = false;
    if (!isScrollReady) setIsScrollReady(true);
  });
  return () => cancelAnimationFrame(rafId);
}
```

**Why this doesn't cause flicker:** Content is still hidden (`opacity: 0`) because `isScrollReady` is still `false`. The content only becomes visible AFTER the RAF scroll completes.

---

## The Complete Pattern

```tsx
// State to track if scroll is complete
const [isScrollReady, setIsScrollReady] = useState(false);
const shouldAutoScroll = useRef(true);

// useLayoutEffect - runs BEFORE paint
useLayoutEffect(() => {
  if (view !== 'day') {
    if (!isScrollReady) setIsScrollReady(true);
    return;
  }
  if (!shouldAutoScroll.current) {
    if (!isScrollReady) setIsScrollReady(true);
    return;
  }

  const performScroll = (): boolean => {
    const targetEl = document.getElementById(`day-${targetDateStr}`);
    if (targetEl) {
      window.scrollTo({ top: position, behavior: 'auto' });
      return true;
    }
    return false;
  };

  // Try synchronous scroll first (prevents iOS flicker)
  if (performScroll()) {
    shouldAutoScroll.current = false;
    if (!isScrollReady) setIsScrollReady(true);
  } else {
    // Element not found - RAF fallback (content still hidden)
    const rafId = requestAnimationFrame(() => {
      performScroll();
      shouldAutoScroll.current = false;
      if (!isScrollReady) setIsScrollReady(true);
    });
    return () => cancelAnimationFrame(rafId);
  }
}, [view, currentViewDate, isScrollReady]);

// Content wrapper - hidden until ready
<div style={{ opacity: isScrollReady ? 1 : 0 }}>
  {/* content */}
</div>
```

---

## Rules - DO NOT BREAK

| Rule | Why |
|------|-----|
| Use `useLayoutEffect` | Runs before browser paint |
| NO `useEffect` for scroll | Runs after paint → flicker |
| Synchronous scroll FIRST | Prevents iOS flicker in normal case |
| RAF ONLY as fallback | Handles rare "element not found" case |
| `isScrollReady` state | Hides content until scroll done |
| `opacity: 0` until ready | Prevents speculative paint visibility |
| `behavior: 'auto'` | Instant scroll, no animation |

---

## Why RAF Fallback Doesn't Cause Flicker

You might think "but RAF runs after paint, won't that cause flicker?"

**No, because:**
1. Content has `opacity: 0` (hidden) until `isScrollReady` is `true`
2. `isScrollReady` is only set to `true` AFTER the scroll (inside RAF callback)
3. So the sequence is: hidden → RAF scrolls → set visible → paint at correct position

---

## History

This fix has been implemented and accidentally reverted multiple times. The issue only appears on **iOS Safari** (not Chrome desktop), which is why it's easy to miss during development.

- Initial fix: `useLayoutEffect` without RAF
- Enhanced fix: Added `isScrollReady` state to hide content until scroll completes
- Final fix: Added RAF fallback for rare "today card not showing" bug

---

## Files

- `/components/Meals.tsx` - Lines ~124-140, ~475-525, ~765
