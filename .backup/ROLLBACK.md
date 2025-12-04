# Rollback Instructions (Option 2 Implementation)

If the invitation link changes don't work as expected, you can rollback using the following steps:

## Automatic Rollback (PowerShell)

Run this command in PowerShell from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .backup\rollback.ps1
```

Or manually:

```powershell
Copy-Item .backup\InviteWelcome.tsx.backup components\InviteWelcome.tsx -Force
Copy-Item .backup\SignUp.tsx.backup components\SignUp.tsx -Force
Copy-Item .backup\Auth.tsx.backup components\Auth.tsx -Force
```

**Note:** For App.tsx, you need to manually restore the InviteWelcome rendering:

```typescript
// Add this back to App.tsx (around line 480):
if (inviteParams && !currentUser && clerkLoaded && !isSignedIn) {
  return <InviteWelcome householdId={inviteParams.hid} userId={inviteParams.uid} onComplete={handleLogin} />;
}

// And restore the import:
import InviteWelcome from './components/InviteWelcome';
```

## Changes Made (Option 2 - Direct to SignUp)

### App.tsx
- Removed InviteWelcome rendering for unauthenticated users
- Users with invite links now go directly to Auth → SignUp
- Keeps InviteSetup for authenticated users who click invite links

### SignUp.tsx
- Added logic to detect and preserve invite params through the signup flow
- Modified OAuth redirect URLs to preserve invite params
- Modified email signup to preserve invite params before setActive

### Auth.tsx
- Added check for invite params - if present, shows SignUp component instead of SignIn

### InviteWelcome.tsx
- Removed redirect loop (cleanup)
- Component still exists but is no longer rendered for unauthenticated users

## Expected Flow (Option 2)

1. **User clicks invitation link:** `?invite=true&hid={householdId}&uid={userId}`
2. **SignUp page appears** (Auth.tsx detects invite params)
3. **User signs up** (Google OAuth or email)
4. **Auth.tsx activates pending user** and adds them to household
5. **Dashboard appears** ✅

**Total pages: 2-3** (SignUp → optional email verification → Dashboard)

## Testing

Test the following scenarios:
1. New user clicking invite link → should go to SignUp page (NOT InviteWelcome)
2. Sign up with Google → should preserve invite params and activate user
3. Sign up with email → should preserve invite params and activate user
4. Existing logged-in user clicking invite link → should show InviteSetup

