# App Not Loading - Troubleshooting Guide

If you're seeing nothing in the console and no requests to Supabase/Clerk, follow these steps:

## Step 1: Check for JavaScript Errors

1. **Open DevTools** (F12)
2. **Go to Console tab**
3. **Look for red error messages**

Common errors to look for:
- `Uncaught ReferenceError: ...`
- `Failed to load resource: ...`
- `CORS error`
- `Missing environment variable`

**If you see errors, note them down - they're the root cause.**

## Step 2: Check Network Requests

1. **Open DevTools** (F12)
2. **Go to Network tab**
3. **Refresh the page** (F5 or Ctrl+R)
4. **Look for:**
   - Failed requests (red)
   - Requests to Supabase (should see `supabase.co` URLs)
   - Requests to Clerk (should see `clerk.com` URLs)
   - Main JavaScript bundle loading

**What to check:**
- Is `index.html` loading? (Status 200)
- Is the main JS bundle loading? (usually `index-[hash].js`)
- Are there any 404 errors?
- Are there any CORS errors?

## Step 3: Check if React App is Mounting

Run this in the console:

```javascript
// Check if React root exists
const root = document.getElementById('root');
console.log('Root element:', root ? '✅ Found' : '❌ Not found');
console.log('Root content:', root?.innerHTML?.substring(0, 100) || 'Empty');

// Check if React is loaded
console.log('React available:', typeof React !== 'undefined' ? '✅' : '❌');
```

## Step 4: Check Environment Variables

Run this in the console:

```javascript
// Check Clerk key
console.log('Clerk Key:', import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? '✅ Set' : '❌ Missing');
console.log('Clerk Key preview:', import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 20) || 'N/A');

// Check Supabase URL
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('Supabase URL preview:', import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) || 'N/A');

// Check Supabase Anon Key
console.log('Supabase Anon Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
```

**If any are missing, check your `.env` or `.env.local` file.**

## Step 5: Check if App Component is Loading

Look for these console logs when the page loads:
- `🔵 [Clerk] Initializing with key: ...`
- Any other initialization logs from your App component

If you don't see these, the app isn't initializing.

## Step 6: Check Browser Console Filter

Make sure console filters aren't hiding messages:

1. **In Console tab**, check the filter buttons at the top
2. **Make sure all are enabled:**
   - ✅ Errors
   - ✅ Warnings  
   - ✅ Info
   - ✅ Logs
3. **Clear any text in the filter box**

## Step 7: Check for Blocked Content

1. **Look for shield icon** in address bar (Chrome/Edge)
   - Click it and allow blocked content if needed
2. **Check browser extensions** - disable ad blockers/extensions temporarily
3. **Try incognito/private mode** - rules out extension issues

## Step 8: Check Page Source

1. **Right-click page → View Page Source** (or Ctrl+U)
2. **Look for:**
   - `<script>` tags loading your JS bundle
   - Any error messages in HTML
   - Missing resources

## Step 9: Quick Diagnostic Script

Paste this in the console to check everything at once:

```javascript
(async () => {
  console.log('=== APP DIAGNOSTICS ===\n');
  
  // 1. Check root element
  const root = document.getElementById('root');
  console.log('1. Root element:', root ? '✅ Found' : '❌ Missing');
  
  // 2. Check React
  console.log('2. React loaded:', typeof React !== 'undefined' ? '✅' : '❌');
  
  // 3. Check environment variables
  const env = import.meta.env;
  console.log('3. Environment Variables:');
  console.log('   Clerk Key:', env.VITE_CLERK_PUBLISHABLE_KEY ? '✅' : '❌');
  console.log('   Supabase URL:', env.VITE_SUPABASE_URL ? '✅' : '❌');
  console.log('   Supabase Key:', env.VITE_SUPABASE_ANON_KEY ? '✅' : '❌');
  
  // 4. Check network connectivity
  try {
    const response = await fetch('https://api.github.com', { method: 'HEAD' });
    console.log('4. Network:', response.ok ? '✅ Connected' : '⚠️ Issues');
  } catch (e) {
    console.log('4. Network:', '❌ Not connected');
  }
  
  // 5. Check for errors in console
  const errorCount = console.error.toString().includes('native') ? 'Check manually' : 'Unknown';
  console.log('5. Check console above for errors');
  
  // 6. Check service worker
  const swReg = await navigator.serviceWorker.getRegistration('/');
  console.log('6. Service Worker:', swReg ? '✅ Registered' : '❌ Not registered');
  
  console.log('\n=== END DIAGNOSTICS ===');
  console.log('\nNext steps:');
  console.log('- Check Network tab for failed requests');
  console.log('- Check Console tab for red errors');
  console.log('- Verify .env file has all required variables');
})();
```

## Common Issues & Fixes

### Issue: "Missing Clerk Publishable Key"
**Fix:** Check `.env` or `.env.local` file has `VITE_CLERK_PUBLISHABLE_KEY`

### Issue: "Failed to load resource"
**Fix:** 
- Check if you're running a dev server (`npm run dev`)
- Check if the file paths are correct
- Check Network tab to see which file failed

### Issue: Blank white page
**Fix:**
- Check Console for errors
- Check if React is mounting (Step 3)
- Check if environment variables are set (Step 4)

### Issue: CORS errors
**Fix:**
- Check Supabase URL is correct
- Check if you're using the right Supabase project
- Check Supabase CORS settings

### Issue: No network requests at all
**Fix:**
- Check if JavaScript is enabled in browser
- Check if you're blocking JavaScript
- Try a different browser
- Check browser console for errors preventing execution

## Still Not Working?

Share:
1. **Any red errors** from Console tab
2. **Failed requests** from Network tab (screenshot or list)
3. **Output from diagnostic script** (Step 9)
4. **Browser and version** (Chrome, Firefox, etc.)








