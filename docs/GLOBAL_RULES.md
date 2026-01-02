# Global Development Rules

This document contains global rules and guidelines for maintaining consistency across the Helpy codebase.

---

## Profile and HouseholdInfo Consistency

**Rule**: When handling user-related elements, **always check consistency between `Profile.tsx` and `HouseholdInfo.tsx`**.

### Why This Matters
Both components display user information and must maintain visual and behavioral consistency to ensure a cohesive user experience.

### Elements That Must Stay in Sync

#### 1. Role Badge Styling

**Note:** Profile.tsx and HouseholdInfo.tsx currently use **different color schemes** for some roles. This is intentional - Profile uses the standard badge colors, while HouseholdInfo uses a distinct palette for the user carousel cards.

- **Profile.tsx**: Uses `getRoleBadgeColor()` function
- **HouseholdInfo.tsx**: Uses `ROLE_STYLES` constant

**Profile.tsx & Dashboard.tsx (Role Badges):**

White solid background with colored text for all roles, **EXCEPT SuperAdmin** (solid blue bg + white text).

| Role | Background | Text |
|------|------------|------|
| **SuperAdmin** | `bg-primary` (#3EAFD2) | `text-white` |
| Admin (MASTER) | `bg-white` | `text-primary` (#3EAFD2) |
| Spouse | `bg-white` | `text-[#AB47BC]` (purple) |
| Helper | `bg-white` | `text-[#FF9800]` (orange) |
| Child | `bg-white` | `text-[#4CAF50]` (green) |
| Other | `bg-white` | `text-[#F06292]` (pink) |

This ensures badges are visible when overlaid on images (like in the Dashboard family carousel).

**HouseholdInfo.tsx Colors (Carousel Cards):**

Same color scheme as above:

| Role | Background | Text/Accent |
|------|------------|-------------|
| **SuperAdmin** | `#3EAFD2` (solid blue) | `#FFFFFF` (white) |
| Admin (MASTER) | `#FFFFFF` (white) | `#3EAFD2` (helpy blue) |
| Spouse | `#FFFFFF` (white) | `#AB47BC` (purple) |
| Helper | `#FFFFFF` (white) | `#FF9800` (orange) |
| Child | `#FFFFFF` (white) | `#4CAF50` (green) |
| Other | `#FFFFFF` (white) | `#F06292` (pink) |

#### 2. Role Priority (Sorting Order)
Both components should sort users in the same order:
1. SuperAdmin
2. Admin
3. Spouse
4. Helper
5. Child
6. Other

#### 3. User Avatar Display
- Use the shared `Avatar` component from `@/components/ui/Avatar`
- Same size variants (`sm`, `md`, `lg`)
- Same fallback behavior

#### 4. User Permissions
- Admins and SuperAdmins can edit all users
- Users can edit their own profile
- Helpers have read-only access to household info

### Checklist When Modifying User Elements

When making changes to user-related UI in either component, verify:

- [ ] All UserRole enum values are handled (including SUPERADMIN)
- [ ] Sorting/priority order is consistent
- [ ] Edit permissions follow the same logic
- [ ] Avatar styling is consistent
- [ ] Update both Profile.tsx and HouseholdInfo.tsx color schemes if adding new roles

### Code References

**Profile.tsx & Dashboard.tsx - Role Badge Colors:**
Badge style: White solid background with colored text, EXCEPT SuperAdmin (solid blue bg + white text)
```typescript
const getRoleBadgeColor = (role: UserRole) => {
  switch (role) {
    case UserRole.SUPERADMIN: return 'bg-primary text-white'; // Solid blue with white text
    case UserRole.MASTER: return 'bg-white text-primary'; // White bg, cyan text
    case UserRole.SPOUSE: return 'bg-white text-[#AB47BC]'; // White bg, purple text
    case UserRole.HELPER: return 'bg-white text-[#FF9800]'; // White bg, orange text
    case UserRole.CHILD: return 'bg-white text-[#4CAF50]'; // White bg, green text
    case UserRole.OTHER: return 'bg-white text-[#F06292]'; // White bg, pink text
    default: return 'bg-white text-[#757575]';
  }
};
```

**HouseholdInfo.tsx - Role Styles:**
```typescript
const ROLE_STYLES: Record<UserRole, { bg: string; color: string; gradient: string }> = {
  [UserRole.SUPERADMIN]: { bg: '#3EAFD2', color: '#FFFFFF', gradient: '...' },
  [UserRole.MASTER]: { bg: '#FFFFFF', color: '#3EAFD2', gradient: '...' },
  [UserRole.SPOUSE]: { bg: '#FFFFFF', color: '#AB47BC', gradient: '...' },
  [UserRole.HELPER]: { bg: '#FFFFFF', color: '#FF9800', gradient: '...' },
  [UserRole.CHILD]: { bg: '#FFFFFF', color: '#4CAF50', gradient: '...' },
  [UserRole.OTHER]: { bg: '#FFFFFF', color: '#F06292', gradient: '...' },
};
```

---

## Adding New User Roles

When adding a new `UserRole`:

1. Update `types.ts` - Add to `UserRole` enum
2. Update `Profile.tsx` - Add to `getRoleBadgeColor()`
3. Update `HouseholdInfo.tsx` - Add to `ROLE_STYLES` and `ROLE_PRIORITY`
4. Update any role-based permission checks
5. Update this documentation

---

## Color Palette Reference

**Profile.tsx Badge Colors:**

| Name | Hex | Usage |
|------|-----|-------|
| Helpy Blue (Primary) | `#3EAFD2` | Primary actions, Admin badges |
| Purple | `#AB47BC` | Spouse role |
| Orange | `#FF9800` | Helper role |
| Green | `#4CAF50` | Child role |
| Pink | `#F06292` | Other role |
| Gray | `#757575` | Default/unknown |

**HouseholdInfo.tsx Carousel Colors:**

| Name | Hex | Usage |
|------|-----|-------|
| Helpy Blue (Primary) | `#3EAFD2` | Admin badges |
| Pink | `#F06292` | Spouse role, Other role |
| Green | `#047857` | Helper role |
| Amber | `#D97706` | Child role |

---

*Last updated: January 2025*

