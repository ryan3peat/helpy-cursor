# Fix Clerk JWT Template Error

## Error Message
```
No JWT template exists with name: supabase
```

## Solution

The JWT template in Clerk either doesn't exist, has a different name, or isn't properly configured.

### Step 1: Check Template Name

1. Go to **Clerk Dashboard** → **Configure** → **JWT Templates**
2. Look for a template - check the exact name
3. The code expects a template named **`supabase`** (lowercase)

### Step 2: Create or Rename Template

**Option A: Create New Template (Recommended)**

1. Click **"New template"** or **"Create template"**
2. **Name:** `supabase` (must be exactly this, lowercase)
3. **Token lifetime:** `3600` seconds (1 hour)
4. **Claims:** Click "Add claim" and add:
   ```json
   {
     "clerk_id": "{{user.id}}"
   }
   ```
5. **Save** the template

**Option B: Use Different Template Name**

If you want to use a different template name:

1. Set environment variable in Vercel:
   ```
   VITE_CLERK_JWT_TEMPLATE_NAME=your_template_name
   ```
2. Or update the code in `contexts/SupabaseContext.tsx`:
   ```typescript
   const templateName = 'your_template_name'; // Change this
   ```

### Step 3: Verify Template Configuration

The template should have:
- ✅ Name: `supabase` (or match your env var)
- ✅ Custom claim: `clerk_id` with value `{{user.id}}`
- ✅ Token lifetime: 3600 seconds (or your preference)
- ✅ Status: Active/Enabled

### Step 4: Test

1. Sign out and sign back in (to get a fresh token)
2. Check browser console - should not see template error
3. Check Network tab - JWT token should be in Authorization header

## Troubleshooting

### Template exists but still getting error

1. **Check template name** - must be exactly `supabase` (case-sensitive)
2. **Check template is active** - make sure it's enabled
3. **Clear browser cache** - old tokens might be cached
4. **Sign out and back in** - forces new token generation

### Template name is different

If your template has a different name (e.g., `Supabase`, `supabase-integration`):

1. **Option 1:** Rename it to `supabase` in Clerk Dashboard
2. **Option 2:** Set environment variable:
   ```
   VITE_CLERK_JWT_TEMPLATE_NAME=your_actual_template_name
   ```
3. **Option 3:** Update code in `contexts/SupabaseContext.tsx`

### Still not working

1. Check Clerk Dashboard → Logs for JWT generation errors
2. Verify you're using the correct Clerk instance (production vs development)
3. Check that the template includes the `clerk_id` claim
4. Verify the claim value is exactly `{{user.id}}` (with double curly braces)

## Quick Checklist

- [ ] Template exists in Clerk Dashboard
- [ ] Template name is exactly `supabase` (lowercase)
- [ ] Template has custom claim: `clerk_id` = `{{user.id}}`
- [ ] Template is active/enabled
- [ ] Signed out and back in (fresh token)
- [ ] No errors in browser console
- [ ] JWT token appears in Network tab headers



