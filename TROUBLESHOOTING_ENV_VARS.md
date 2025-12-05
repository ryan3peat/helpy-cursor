# Troubleshooting Environment Variables

## Issue: VITE_ALIBABA_CLOUD_API_KEY not being loaded

### ✅ Verified:
- `.env.local` file exists in project root
- Variable `VITE_ALIBABA_CLOUD_API_KEY` is present in `.env.local`

### 🔧 Solution Steps:

1. **Restart the Dev Server** (Most Common Fix)
   - Stop your current `npm run dev` process (Ctrl+C)
   - Start it again: `npm run dev`
   - Vite only loads environment variables when the server starts

2. **Verify .env.local Format**
   - Make sure there are NO spaces around the `=` sign
   - Correct: `VITE_ALIBABA_CLOUD_API_KEY=sk-...`
   - Wrong: `VITE_ALIBABA_CLOUD_API_KEY = sk-...` (spaces)
   - Wrong: `VITE_ALIBABA_CLOUD_API_KEY= sk-...` (space after =)

3. **Check for Quotes**
   - You can use quotes, but they're not required
   - Both work: `VITE_ALIBABA_CLOUD_API_KEY=sk-...` or `VITE_ALIBABA_CLOUD_API_KEY="sk-..."`
   - If using quotes, make sure they match (both single or both double)

4. **Verify Variable Name**
   - Must start with `VITE_` to be exposed to client-side code
   - Exact name: `VITE_ALIBABA_CLOUD_API_KEY` (case-sensitive)

5. **Check Console Output**
   - After restarting, check the browser console
   - The debug logging will show if the variable is loaded
   - Look for: `Environment check:` in the console

6. **For Vercel Deployment:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `VITE_ALIBABA_CLOUD_API_KEY` with your API key value
   - Make sure it's set for the correct environment (Production, Preview, Development)
   - **Redeploy** after adding the variable (Vercel doesn't auto-redeploy)

7. **Clear Build Cache (if still not working)**
   ```bash
   # Delete node_modules and reinstall
   rm -rf node_modules
   npm install
   
   # Or on Windows PowerShell:
   Remove-Item -Recurse -Force node_modules
   npm install
   ```

### 🧪 Test if Variable is Loaded:

After restarting, open browser console and you should see:
```
Environment check: {
  hasApiKey: true,
  apiKeyLength: 40,  // or whatever your key length is
  apiKeyPrefix: "sk-6615...",
  allViteEnvKeys: ["VITE_ALIBABA_CLOUD_API_KEY", "VITE_SUPABASE_URL", ...]
}
```

If `hasApiKey: false`, the variable is not being loaded.

### 📝 Common Mistakes:

- ❌ Forgetting to restart dev server after adding env var
- ❌ Using wrong variable name (missing `VITE_` prefix)
- ❌ Spaces around `=` sign
- ❌ File named `.env` instead of `.env.local`
- ❌ File in wrong directory (must be in project root, same level as `package.json`)
- ❌ Not redeploying on Vercel after adding env var

