# Global Development Rules

This document contains global rules and guidelines for maintaining consistency across the Helpy codebase.

---

## Profile and HouseholdInfo Consistency

**Rule**: When handling user-related elements, **always check consistency between `Profile.tsx` and `HouseholdInfo.tsx`**.

### Why This Matters
Both components display user information and must maintain visual and behavioral consistency to ensure a cohesive user experience.

### Elements That Must Stay in Sync

#### 1. Role Badge Styling
- **Profile.tsx**: Uses `getRoleBadgeColor()` function
- **HouseholdInfo.tsx**: Uses `ROLE_STYLES` constant

| Role | Style |
|------|-------|
| Admin (MASTER) | Light blue bg (`#E6F7FB`), helpy blue text (`#3EAFD2`) |
| SuperAdmin | **Solid helpy blue** bg (`#3EAFD2`), white text |
| Spouse | Light purple bg (`#F3E5F5`), purple text (`#AB47BC`) |
| Helper | Light orange bg (`#FFF3E0`), orange text (`#FF9800`) |
| Child | Light green bg (`#E8F5E9`), green text (`#4CAF50`) |
| Other | Light pink bg (`#FCE4EC`), pink text (`#F06292`) |

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

- [ ] Role badge colors match between Profile and HouseholdInfo
- [ ] All UserRole enum values are handled (including SUPERADMIN)
- [ ] Sorting/priority order is consistent
- [ ] Edit permissions follow the same logic
- [ ] Avatar styling is consistent

### Code References

**Profile.tsx - Role Badge Colors:**
```typescript
const getRoleBadgeColor = (role: UserRole) => {
  switch (role) {
    case UserRole.MASTER: return 'bg-primary/10 text-primary';
    case UserRole.SUPERADMIN: return 'bg-primary text-white'; // Solid blue
    case UserRole.SPOUSE: return 'bg-[#F3E5F5] text-[#AB47BC]';
    case UserRole.HELPER: return 'bg-[#FFF3E0] text-[#FF9800]';
    case UserRole.CHILD: return 'bg-[#E8F5E9] text-[#4CAF50]';
    case UserRole.OTHER: return 'bg-[#FCE4EC] text-[#F06292]';
    default: return 'bg-[#F5F5F5] text-[#757575]';
  }
};
```

**HouseholdInfo.tsx - Role Styles:**
```typescript
const ROLE_STYLES: Record<UserRole, { bg: string; color: string; gradient: string }> = {
  [UserRole.MASTER]: { bg: '#E6F7FB', color: '#3EAFD2', ... },
  [UserRole.SUPERADMIN]: { bg: '#3EAFD2', color: '#FFFFFF', ... }, // Solid blue
  [UserRole.SPOUSE]: { bg: '#FCE4EC', color: '#F06292', ... },
  // ... etc
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

| Name | Hex | Usage |
|------|-----|-------|
| Helpy Blue (Primary) | `#3EAFD2` | Primary actions, Admin badges |
| Orange | `#FF9800` | Helper role |
| Purple | `#AB47BC` | Spouse role |
| Green | `#4CAF50` | Child role |
| Pink | `#F06292` | Other role |
| Gray | `#757575` | Default/unknown |

---

*Last updated: December 2024*

