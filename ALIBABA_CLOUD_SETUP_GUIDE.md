# Alibaba Cloud Model Studio - API Key Setup Guide

## Finding Your API Key in Model Studio

### Step 1: Access API Key Management

1. **Log in to Alibaba Cloud Model Studio**
   - Go to: https://modelstudio.alibabacloud.com/
   - Sign in with your Alibaba Cloud account

2. **Navigate to API Key Section**
   - Look for a menu item like:
     - "API Keys" or "API Key Management"
     - "Developer Tools" → "API Keys"
     - "Settings" → "API Keys"
     - Sometimes it's in the top-right user menu → "API Keys"
   - The exact location varies by interface version

3. **Find or Create API Key**
   - If you see existing keys, verify one starts with `sk-`
   - If no keys exist, click "Create API Key" or "Generate API Key"
   - Copy the entire key (it should be long, starting with `sk-`)

### Step 2: Verify DashScope Access

**Option A: Through Model Studio**
1. In Model Studio, look for:
   - "Services" or "Available Services"
   - "DashScope" in the service list
   - Check if it shows as "Enabled" or "Activated"

**Option B: Through Alibaba Cloud Console**
1. Go to main Alibaba Cloud Console: https://ecs.console.aliyun.com/ (or your region)
2. Search for "DashScope" in the top search bar
3. Or navigate to: "Products" → "AI & Machine Learning" → "DashScope"
4. Check if DashScope service is activated

**Option C: Direct DashScope Console**
1. Try accessing: https://dashscope.console.aliyun.com/
2. If you can access it, DashScope is enabled
3. If you get an error, you may need to activate it

### Step 3: Activate DashScope (If Needed)

If DashScope is not activated:

1. **Go to Alibaba Cloud Console**
   - Main console: https://ecs.console.aliyun.com/

2. **Search for DashScope**
   - Use the top search bar
   - Or go to: Products → AI & Machine Learning → DashScope

3. **Activate the Service**
   - Click "Activate" or "Open Service"
   - Complete any required verification steps
   - Some services require payment method setup (even for free tier)

4. **Verify Activation**
   - You should see a dashboard or service status page
   - Status should show as "Activated" or "Enabled"

### Step 4: Verify API Key Permissions

1. **In Model Studio or DashScope Console**
   - Go to API Key Management
   - Check if your API key has:
     - "DashScope" permissions
     - "Multimodal Generation" permissions
     - Or "Full Access" to DashScope services

2. **If Permissions Are Missing**
   - Some accounts may need to grant explicit permissions
   - Contact Alibaba Cloud support if you can't find permission settings

### Step 5: Test Your API Key

You can test if your API key works by making a simple API call:

**Using curl (in terminal):**
```bash
curl -X POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-vl-plus",
    "input": {
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "text": "Hello"
            }
          ]
        }
      ]
    }
  }'
```

**What to expect:**
- If successful: You'll get a JSON response with model output
- If 401 Unauthorized: API key is invalid or doesn't have permissions
- If 403 Forbidden: Service not activated or account issue
- If 404: Endpoint issue (less likely)

### Step 6: Common Issues and Solutions

**Issue: Can't find API Key section in Model Studio**
- Solution: Try accessing DashScope console directly: https://dashscope.console.aliyun.com/
- Or check Alibaba Cloud main console → Products → DashScope

**Issue: API key exists but getting 401 errors**
- Solution: 
  1. Verify the key is copied completely (no truncation)
  2. Check for extra spaces (trim them)
  3. Generate a new API key and try again
  4. Verify DashScope service is activated

**Issue: DashScope service not found**
- Solution:
  1. Make sure you're in the correct region (some services are region-specific)
  2. Check if your account type supports DashScope
  3. Contact Alibaba Cloud support to activate DashScope

**Issue: Model Studio shows different interface**
- Solution: Alibaba Cloud updates their UI frequently
- Look for:
  - "Developer" or "Developer Tools" section
  - "API" or "API Management" section
  - User profile/settings menu
  - Search bar: type "API key"

### Step 7: Alternative - Use DashScope Console Directly

If Model Studio doesn't show API keys:

1. **Go to DashScope Console**
   - URL: https://dashscope.console.aliyun.com/
   - Or search "DashScope" in Alibaba Cloud main console

2. **Find API Key Management**
   - Usually in left sidebar: "API Keys" or "Access Keys"
   - Or in Settings/Configuration section

3. **Create/View API Keys**
   - Same process as Model Studio
   - Keys work the same way

### Step 8: Verify in Vercel

After getting your API key:

1. **Go to Vercel Dashboard**
   - Your Project → Settings → Environment Variables

2. **Add Variable**
   - Name: `ALIBABA_CLOUD_API_KEY`
   - Value: Your API key (starts with `sk-`)
   - Environments: Select all (Production, Preview, Development)

3. **Important**
   - No `VITE_` prefix (this is server-side)
   - No quotes around the value
   - No spaces before/after
   - Copy the entire key

4. **Redeploy**
   - Vercel doesn't auto-redeploy when env vars change
   - Go to Deployments → Redeploy latest, or push a new commit

### Still Having Issues?

1. **Check Alibaba Cloud Documentation**
   - Search: "Alibaba Cloud DashScope API key setup"
   - Or: "Model Studio API key guide"

2. **Contact Alibaba Cloud Support**
   - They can help verify your account has DashScope access
   - They can check if your API key has correct permissions

3. **Verify Account Type**
   - Some account types may have restrictions
   - Enterprise vs Individual accounts may differ

