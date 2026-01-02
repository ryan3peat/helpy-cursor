# Helpy Design System

A comprehensive guide to the visual design language and component patterns used in Helpy.

---

## Table of Contents

1. [Brand Colors](#brand-colors)
2. [Typography](#typography)
3. [Spacing & Layout](#spacing--layout)
4. [Border Radius](#border-radius)
5. [Shadows](#shadows)
6. [Z-Index Layers](#z-index-layers)
7. [Buttons](#buttons)
8. [Inputs & Forms](#inputs--forms)
9. [Cards](#cards)
10. [Tags & Badges](#tags--badges)
11. [Role Badges](#role-badges)
12. [Avatars](#avatars)
13. [Icons](#icons)
14. [Bottom Sheets](#bottom-sheets)
15. [Headers](#headers)
16. [Footer](#footer)
17. [Safe Area Handling](#safe-area-handling)
18. [Forbidden Patterns](#forbidden-patterns)

---

## Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Primary (Helpy Blue)** | `#3EAFD2` | CTAs, links, accents, Admin badges |
| **Destructive (Pink)** | `#F06292` | Delete actions, allergy warnings |
| **Purple** | `#AB47BC` | Spouse role |
| **Orange** | `#FF9800` | Helper role |
| **Green** | `#4CAF50` | Child role |
| **Gray** | `#757575` | Default/unknown |

These colors are consistent in both light and dark modes.

---

## Typography

### Font Sizes

| Class | Size | Usage |
|-------|------|-------|
| `text-display` | 2rem (32px) | Page titles |
| `text-title` | 1rem (16px) | Card titles, headings |
| `text-body` | 0.875rem (14px) | Body text, button labels |
| `text-caption` | 0.75rem (12px) | Labels, tags, badges |
| `text-micro` | 0.625rem (10px) | Smallest text |

### Font Weights

| Class | Usage |
|-------|-------|
| `font-bold` | Headings, titles |
| `font-semibold` | Buttons, badges, important labels |
| `font-medium` | Body text, tag content |

### Two-Line Headers

For headers with two lines (like "Good morning / Liko"):
- **First line** (smaller text): `text-primary` (Helpy blue #3EAFD2)
- **Second line** (bigger text): `text-foreground` (Helpy black)

Single-line headers remain unchanged with just `text-foreground`.

---

## Spacing & Layout

### Page Container

```tsx
<div className="min-h-screen bg-background pb-24">
  {/* pb-40 for pages with bottom nav */}
  <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
    {/* Content */}
  </div>
</div>
```

The `page-content` class ensures min-height and flex column for footer positioning.

### Common Spacing

| Context | Classes |
|---------|---------|
| Sticky headers | `pt-12 pb-3` with `-mx-4 px-4 sm:-mx-6 sm:px-6` |
| Card padding | `p-6` |
| Section gaps | `space-y-6` or `space-y-4` |
| Button gaps | `gap-2` or `gap-3` |
| Footer safe area | `pb-8` |

---

## Border Radius

| Element | Class |
|---------|-------|
| Cards | `rounded-3xl` |
| Buttons | `rounded-xl` |
| Inputs | `rounded-lg` |
| Tags/badges | `rounded-full` |
| Avatars | `rounded-full` |
| Icon containers | `rounded-xl` or `rounded-full` |

---

## Shadows

| Element | Class | Notes |
|---------|-------|-------|
| Cards | `shadow-sm` | Subtle elevation |
| Primary buttons | `shadow-sm` | Subtle elevation |
| Elevated/hero sections | `shadow-md` | More depth |
| Sticky elements on scroll | Dynamic shadow | Use `isScrolled` state |

> **Never use heavy shadows** - keep them subtle.

---

## Z-Index Layers

| Element | Z-Index |
|---------|---------|
| Sticky headers | `z-20` |
| Tab navigation | `z-10` |
| Bottom sheets/modals | `z-[60]` |
| Close buttons inside modals | `z-10` (relative to modal) |

---

## Buttons

### Primary Button

```tsx
<button className="bg-primary text-primary-foreground rounded-xl transition-colors shadow-sm">
  Label
</button>
```

### Secondary Button

```tsx
<button className="bg-secondary text-foreground rounded-xl transition-colors">
  Label
</button>
```

### Destructive Button

```tsx
<button className="bg-destructive/10 text-destructive rounded-xl transition-colors">
  Delete
</button>
```

### Icon Button

```tsx
<button className="p-2 rounded-full transition-colors">
  <Icon size={20} />
</button>
```

### Full-Width CTA

Use `py-3.5` or `py-4` with `rounded-xl` for full-width call-to-action buttons.

---

## Inputs & Forms

### Input Base Style

```tsx
<input 
  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border focus:border-primary outline-none transition-all text-body"
/>
```

Key points:
- Always use `bg-secondary` for input backgrounds (not `bg-muted` or `bg-card`)
- Focus state changes border-color to primary
- No outline rings - use `focus:border-primary`

### Form Labels

```tsx
<label className="text-caption text-muted-foreground mb-2">
  Label Text
</label>
```

Or for inline labels:

```tsx
<label className="text-caption font-bold text-muted-foreground ml-1">
  Label Text
</label>
```

Use block display with margin-bottom for spacing.

---

## Cards

Cards (`.bg-card`) should **never have visible borders**. The global CSS enforces `border: none !important` on `.bg-card` elements.

### Line Separators Inside Cards

Borders/dividers inside cards should **never touch the edges**. Always use inset margins:

```tsx
{/* Separator with inset */}
<div className="border-t border-border mx-4" />
```

Bottom sheets use 1.25rem (`left-5 right-5`) inset for separators.

---

## Tags & Badges

### Allergy Tags

```tsx
<span className="px-3 py-1.5 bg-destructive/10 text-destructive rounded-full text-caption font-medium">
  Allergy
</span>
```

### Preference Tags

```tsx
<span className="px-3 py-1.5 bg-foreground/10 text-foreground rounded-full text-caption font-medium">
  Preference
</span>
```

---

## Role Badges

White solid background with colored text, **EXCEPT SuperAdmin** which uses solid blue background with white text.

| Role | Classes |
|------|---------|
| **SuperAdmin** | `bg-primary text-white` |
| **Admin (MASTER)** | `bg-white text-primary` |
| **Spouse** | `bg-white text-[#AB47BC]` |
| **Helper** | `bg-white text-[#FF9800]` |
| **Child** | `bg-white text-[#4CAF50]` |
| **Other** | `bg-white text-[#F06292]` |

Base classes: `px-3 py-1 rounded-full text-caption font-semibold`

---

## Avatars

| Context | Size |
|---------|------|
| Profile card main avatar | `w-20 h-20` |
| Carousel/list avatars | `w-16 h-16` |
| Small avatars (icons, thumbnails) | `w-10 h-10` |

All avatars use `rounded-full`.

Use the shared `Avatar` component from `@/components/ui/Avatar`.

---

## Icons

Using lucide-react:

| Context | Size |
|---------|------|
| Headers/large actions | `size={24}` |
| Standard buttons | `size={18}` or `size={20}` |
| Inline with text | `size={16}` |
| Inside tags/small elements | `size={12}` or `size={14}` |

Icon containers typically use `w-10 h-10` with `size={20}` icon.

---

## Bottom Sheets

### Structure

```tsx
{/* Backdrop */}
<div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-end justify-center bottom-sheet-backdrop">
  
  {/* Content Container */}
  <div 
    className="bg-card w-full max-w-lg rounded-t-2xl overflow-hidden bottom-sheet-content"
    style={{ marginBottom: 'env(safe-area-inset-bottom, 34px)' }}
  >
    {/* Drag Handle */}
    <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
    
    {/* Header */}
    <div className="pt-6 pb-4 px-5 border-b">
      <h2 className="text-title text-foreground">Title</h2>
      <p className="text-body text-muted-foreground mt-1">Description</p>
    </div>
    
    {/* Body */}
    <div className="p-5">
      {/* Content */}
    </div>
    
    {/* Footer */}
    <div className="p-5 pb-8 border-t flex gap-3">
      {/* Buttons */}
    </div>
  </div>
</div>
```

### Bottom Sheet Titles

- Titles (h2) should be **LEFT aligned** - no `text-center`
- Sub-text (descriptions) should also be **LEFT aligned**
- Standard styling: `text-title text-foreground` for titles
- Description: `text-body text-muted-foreground mt-1`

### Close Button (Modal/Sheet)

```tsx
<button className="absolute z-10 right-4 top-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors text-muted-foreground">
  <X size={20} />
</button>
```

---

## Headers

### New Header Style (with shadow on scroll)

```tsx
<header 
  className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end transition-shadow duration-200" 
  style={{ 
    height: '120px', 
    boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none' 
  }}
>
  {/* Header content aligned to bottom */}
</header>
```

### New Header Style 2 (without shadow on scroll)

Same as above but **without dynamic shadow**:

```tsx
<header 
  className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end" 
  style={{ height: '120px' }}
>
  {/* Header content aligned to bottom */}
</header>
```

Key points:
- Fixed height of 120px
- Use `flex items-end` to align content at bottom
- No pt-12 (no top padding)

### Sticky Header (Classic)

```tsx
<header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 sm:-mx-6 sm:px-6 pt-12 pb-3">
  {/* Header content */}
</header>
```

The negative margins with matching padding create full-width bleed while maintaining content alignment.

---

## Footer

### Helpy Footer

```tsx
<div className="helpy-footer">
  <span className="helpy-logo">Helpy</span>
</div>
```

CSS properties:
- Uses Peanut Butter font at 20px
- Color: `#D1D5DB` (light) / `#4B5563` (dark)
- Footer: `text-align: center`, `padding: 2rem 0`, `margin-top: auto`

---

## Safe Area Handling

- **Bottom sheets**: Use `marginBottom: env(safe-area-inset-bottom, 34px)`
- **Some sheets**: Add a cover div at bottom with same height
- **Footer sections**: Use `pb-8` for extra safe area spacing
- **General**: Use `safe-area-bottom` class for `padding-bottom: env(safe-area-inset-bottom)`

---

## Forbidden Patterns

These patterns are **NOT allowed** in the Helpy codebase:

### No Hover Effects

This is a mobile-first PWA where hover states are irrelevant.

**Forbidden classes:**
- `hover:*`
- `group-hover:*`
- `active:scale-*`
- Any `:hover` CSS selectors

### No Uppercase Text

Avoid `uppercase`, `tracking-wide` for uppercase text, or `text-transform: uppercase`.

### No Italic Text

The `.italic` class is overridden to `font-style: normal`. Avoid `font-italic`.

### No Emojis

The codebase should be emoji-free for a clean UI.

### No Visible Borders on Cards

Cards (`.bg-card`) should never have visible borders.

---

## Opacity Patterns

| Context | Opacity |
|---------|---------|
| Inactive/unselected items | `opacity-60` |
| Active items | `opacity-100` |
| Disabled states | `disabled:opacity-50` |
| Background overlays | `/10`, `/20`, `/30` (e.g., `bg-primary/10`) |

**Note:** Do NOT use `hover:opacity-*` as hover effects are forbidden.

---

## Focus States

- **No outline rings** on focus
- **Inputs/selects**: Change `border-color` to primary on focus
- **Buttons**: No visible focus indicator (`outline: none`)
- Use `focus:border-primary` for form elements

---

## Horizontal Scroll Containers

Use `scrollbar-hide` class for horizontal scroll containers (carousels, tab bars). This hides the scrollbar but keeps scroll functionality.

---

## Currency Display

Hong Kong currency should always be displayed as "HK$" (e.g., HK$123.45). The currency symbol stays the same across all languages and is not translated.

---

*Last updated: January 2025*

