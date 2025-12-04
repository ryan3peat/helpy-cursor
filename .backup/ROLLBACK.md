# Rollback Instructions

If the invitation link changes don't work as expected, you can rollback using the following steps:

## Automatic Rollback (PowerShell)

Run this command in PowerShell from the project root:

```powershell
Copy-Item .backup\InviteWelcome.tsx.backup components\InviteWelcome.tsx -Force
Copy-Item .backup\SignUp.tsx.backup components\SignUp.tsx -Force
Copy-Item .backup\Auth.tsx.backup components\Auth.tsx -Force
```

## Manual Rollback

1. Copy `.backup\InviteWelcome.tsx.backup` to `components\InviteWelcome.tsx`
2. Copy `.backup\SignUp.tsx.backup` to `components\SignUp.tsx`
3. Copy `.backup\Auth.tsx.backup` to `components\Auth.tsx`

## Changes Made

### InviteWelcome.tsx
- Modified to redirect users to the standard SignUp page with invite params preserved
- Removed custom signup form logic (now handled by SignUp component)

### SignUp.tsx
- Added logic to detect and preserve invite params (`invite=true&hid=...&uid=...`) through the signup flow
- Modified OAuth redirect URLs to preserve invite params
- Modified email signup to preserve invite params before setActive

### Auth.tsx
- Added check for invite params - if present, shows SignUp component instead of SignIn
- This ensures users clicking invitation links go directly to signup

## Expected Flow

1. User clicks invitation link: `?invite=true&hid={householdId}&uid={userId}`
2. InviteWelcome component loads, validates invite, then redirects to SignUp page with params
3. SignUp component preserves params through OAuth or email signup
4. After signup completes, Auth.tsx detects invite params and activates pending user
5. User is added to the household automatically

## Testing

Test the following scenarios:
1. New user clicking invite link → should go to SignUp page
2. Sign up with Google → should preserve invite params and activate user
3. Sign up with email → should preserve invite params and activate user
4. Existing user clicking invite link → should handle appropriately

