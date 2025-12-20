# Super Admin Permissions Summary

## Overview
Super Admins (`cryptohkrc@gmail.com` and `julianoliko@gmail.com`) have **ALL permissions of regular Admins** PLUS **app-wide access** across ALL households.

## Super Admin Users
- `cryptohkrc@gmail.com`
- `julianoliko@gmail.com`

---

## Database Permissions (RLS Policies)

### 1. Places (formerly Essential Info)
- ✅ **View**: All places across ALL households
- ✅ **Create**: Places in any household
- ✅ **Update**: Places in any household
- ✅ **Delete**: Places in any household

### 2. Training Modules (if table exists)
- ✅ **View**: All training modules across ALL households
- ✅ **Create**: Training modules in any household
- ✅ **Update**: Training modules in any household
- ✅ **Delete**: Training modules in any household
- ⚠️ **Note**: This table may not exist in all database instances

### 3. Todo Items (Shopping & Tasks)
- ✅ **View**: All todo items across ALL households
- ✅ **Create**: Todo items in any household
- ✅ **Update**: Todo items in any household
- ✅ **Delete**: Todo items in any household

### 4. Users
- ✅ **View**: ALL users across ALL households
- ✅ **Update**: ALL users across ALL households (including role changes, profile updates)
- ⚠️ **Create/Delete**: Handled via API routes (service role)

### 5. Households
- ✅ **View**: ALL households in the system
- ✅ **Update**: ALL households (settings, configuration)
- ⚠️ **Create/Delete**: Handled via API routes (service role)

### 6. Meals
- ✅ **View**: All meals across ALL households
- ✅ **Create**: Meals in any household
- ✅ **Update**: Meals in any household
- ✅ **Delete**: Meals in any household

### 7. Expenses
- ✅ **View**: All expenses across ALL households
- ✅ **Create**: Expenses in any household
- ✅ **Update**: Expenses in any household
- ✅ **Delete**: Expenses in any household

### 8. Practices (formerly House Routine)
- ✅ **View**: All practices across ALL households
- ✅ **Create**: Practices in any household
- ✅ **Update**: Practices in any household
- ✅ **Delete**: Practices in any household

### 9. Receipts
- ✅ **View**: All receipts across ALL households
- ✅ **Create**: Receipts in any household
- ✅ **Update**: Receipts in any household
- ✅ **Delete**: Receipts in any household

### 10. Sections
- ✅ **View**: All sections across ALL households
- ✅ **Create**: Sections in any household
- ✅ **Update**: Sections in any household
- ✅ **Delete**: Sections in any household

### 11. Push Subscriptions
- ✅ **View**: ALL push subscriptions (for debugging/admin purposes)
- ✅ **Create**: Push subscriptions for any user
- ✅ **Update**: Push subscriptions for any user
- ✅ **Delete**: Push subscriptions for any user

### 12. Notifications
- ✅ **View**: ALL notifications across ALL households
- ✅ **Update**: ALL notifications (mark as read, etc.)
- ✅ **Delete**: ALL notifications
- ⚠️ **Create**: Handled via edge functions (service role)

### 13. Helper Holiday Records
- ✅ **View**: All helper holiday records across ALL households
- ✅ **Create**: Helper holiday records in any household
- ✅ **Update**: Helper holiday records in any household
- ✅ **Delete**: Helper holiday records in any household

### 14. Helper Payslip Confirmations
- ✅ **View**: All payslip confirmations across ALL households
- ✅ **Create**: Payslip confirmations in any household
- ✅ **Update**: Payslip confirmations in any household

### 15. Support Tickets
- ✅ **View**: ALL support tickets across ALL households
- ✅ **Create**: Support tickets (can create in any household)
- ✅ **Update**: ALL support tickets (add messages, change status)
- ✅ **Delete**: ALL support tickets

### 16. HK Statutory Holidays
- ✅ **View**: All HK statutory holidays (reference data, publicly readable)

---

## Application-Level Permissions

### Profile Management
- ✅ **View**: All user profiles across ALL households
- ✅ **Edit**: All user profiles (name, role, avatar, preferences, etc.)
- ✅ **Change Roles**: Can change user roles in any household
- ✅ **Manage Subscriptions**: Can view and manage subscription plans for any household

### Helper Management
- ✅ **View**: All helper information across ALL households
- ✅ **Manage Salaries**: Can configure helper salaries in any household
- ✅ **Manage Holidays**: Can manage helper holiday records in any household
- ✅ **Manage Payslips**: Can create and sign payslips for helpers in any household
- ✅ **Overtime Management**: Can manage overtime records for helpers in any household

### Subscription Management
- ✅ **View**: Subscription status for ALL households
- ✅ **Upgrade/Downgrade**: Can change subscription plans for any household
- ✅ **Payment Management**: Can view payment history for any household

### Feedback/Support System
- ✅ **View**: ALL support tickets across ALL households
- ✅ **Reply**: Can reply to any support ticket
- ✅ **Status Management**: Can change ticket status (open, in_progress, resolved, closed)
- ✅ **Delete**: Can delete any support ticket

### Household Administration
- ✅ **View**: All household settings and configurations
- ✅ **Edit**: Can modify household settings (name, preferences, etc.)
- ✅ **User Management**: Can add/remove users from any household
- ✅ **Invite Management**: Can manage invites for any household

---

## Key Differences: Admin vs Super Admin

| Feature | Regular Admin | Super Admin |
|---------|--------------|-------------|
| **Scope** | Own household only | ALL households |
| **Support Tickets** | Household tickets only | ALL tickets |
| **User Management** | Own household only | ALL households |
| **Data Access** | Household-scoped | App-wide |
| **Subscription** | Own household only | ALL households |

---

## Technical Implementation

### Helper Function
The migration creates a helper function `is_superadmin()` that checks if the current user has the `SuperAdmin` role:

```sql
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE clerk_id = get_clerk_id() 
    AND role = 'SuperAdmin'
  );
$$ LANGUAGE SQL STABLE;
```

### RLS Policy Pattern
All RLS policies follow this pattern to grant Super Admin access:

```sql
USING (
  household_id = get_user_household_id()  -- Regular user/Admin access
  OR is_superadmin()                       -- Super Admin app-wide access
)
```

---

## Migration Files

1. **059_add_superadmin_role.sql**: Initial Super Admin setup (support tickets only)
2. **060_comprehensive_superadmin_permissions.sql**: Comprehensive permissions for all tables

---

## Notes

- Super Admins retain their own household access (like regular Admins)
- Super Admins have **ADDITIONAL** app-wide access (can access ALL households)
- All permissions are enforced at the database level via RLS policies
- Super Admins can perform all operations that regular Admins can, but across ALL households
- Service role operations (API routes, edge functions) bypass RLS and are not affected by Super Admin status

---

## Verification

To verify Super Admin permissions, run:

```sql
-- Check Super Admin users
SELECT id, name, email, role, household_id
FROM users
WHERE email IN ('cryptohkrc@gmail.com', 'julianoliko@gmail.com')
  AND role = 'SuperAdmin';

-- Test Super Admin access (should return all rows)
SELECT COUNT(*) FROM support_tickets;  -- Should see ALL tickets
SELECT COUNT(*) FROM users;             -- Should see ALL users
SELECT COUNT(*) FROM households;        -- Should see ALL households
```

---

**Last Updated**: Migration 060_comprehensive_superadmin_permissions.sql
