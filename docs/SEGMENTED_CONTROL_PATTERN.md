# Segmented Control (Tab Navigation) Pattern

## Overview

A pill-shaped segmented control with a debossed container effect. The active tab appears as a raised white pill inside the pressed-in track.

---

## Visual Effect

```
╭─────────────────────────────────────────────────────╮
│  ╭───────╮                                          │  ← Deboss shadow overlay
│  │  All  │   Home    School    Doctor    Hospital   │
│  ╰───────╯                                          │  ← Active = white pill
╰─────────────────────────────────────────────────────╯
     ↑                    ↑
  Raised              Transparent
  (shadow-sm)         (no bg)
```

---

## Structure

```jsx
{/* Outer Container - defines shape and background */}
<div 
  className="relative rounded-full overflow-hidden"
  style={{ backgroundColor: 'hsl(var(--muted))' }}
>
  {/* Inner Scroll Container - buttons scroll here */}
  <div className="flex p-1 overflow-x-auto scrollbar-hide">
    <button className={active ? "bg-card shadow-sm" : ""}>
      Tab 1
    </button>
    <button>Tab 2</button>
    <button>Tab 3</button>
  </div>
  
  {/* Shadow Overlay - sits ON TOP of buttons, doesn't scroll */}
  <div 
    className="absolute inset-0 rounded-full pointer-events-none"
    style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
  />
</div>
```

---

## Key CSS Properties

### Outer Container
| Property | Value | Purpose |
|----------|-------|---------|
| `position` | `relative` | Anchor for shadow overlay |
| `rounded-full` | 9999px | Pill shape |
| `overflow-hidden` | hidden | Clip buttons to rounded corners |
| `background` | `hsl(var(--muted))` | Debossed track color |

### Inner Scroll Container
| Property | Value | Purpose |
|----------|-------|---------|
| `display` | `flex` | Horizontal layout |
| `padding` | `p-1` (4px) | Space for pill to float |
| `overflow-x` | `auto` | Horizontal scroll |
| `scrollbar-hide` | - | Hide scrollbar |

### Active Tab Button
| Property | Value | Purpose |
|----------|-------|---------|
| `background` | `bg-card` (white) | Raised pill |
| `color` | `text-primary` | Teal-gray text |
| `shadow` | `shadow-sm` | Subtle elevation |
| `rounded-full` | 9999px | Pill shape |

### Inactive Tab Button
| Property | Value | Purpose |
|----------|-------|---------|
| `background` | transparent | No background |
| `color` | `text-muted-foreground` | Gray text |
| `hover:color` | `text-foreground` | Darker on hover |

### Shadow Overlay (Critical!)
| Property | Value | Purpose |
|----------|-------|---------|
| `position` | `absolute` | Positioned relative to outer |
| `inset-0` | 0 | Cover entire container |
| `rounded-full` | 9999px | Match container shape |
| `pointer-events-none` | - | Allow clicks through |
| `box-shadow` | `inset 0 2px 4px rgba(0,0,0,0.06)` | Deboss effect |

---

## Why the Shadow Overlay?

The deboss shadow must appear **on top of** the buttons to create the illusion that buttons are sitting **inside** the pressed track.

**Wrong (shadow behind buttons):**
```
Container (with inset shadow)
  └── Buttons ← buttons cover the shadow
```

**Correct (shadow on top):**
```
Container
  ├── Buttons ← buttons render first
  └── Shadow Overlay ← renders on top, pointer-events: none
```

---

## Why `overflow-hidden` on Outer Container?

Without it, buttons overflow past the rounded corners when scrolling, showing sharp edges. The `overflow-hidden` clips content to the rounded shape.

---

## Complete Implementation

```tsx
const SegmentedControl = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div 
      className="relative rounded-full overflow-hidden"
      style={{ backgroundColor: 'hsl(var(--muted))' }}
    >
      {/* Scrollable button container */}
      <div className="flex p-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 rounded-full text-body whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Inset shadow overlay - sits ON TOP of buttons */}
      <div 
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
      />
    </div>
  );
};
```

---

## Files

- **Example**: `/components/HouseholdInfo.tsx`
- **Docs**: `/docs/SEGMENTED_CONTROL_PATTERN.md`














