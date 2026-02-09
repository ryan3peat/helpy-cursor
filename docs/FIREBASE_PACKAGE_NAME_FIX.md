# Fix: No matching client for package name 'com.helpyfam.app'

## Problem
Your `google-services.json` was created for `com.helpyfam.com`, but your app uses `com.helpyfam.app`. They must match exactly.

## Solution: Add the correct Android app in Firebase

1. **Go to [Firebase Console](https://console.firebase.google.com)** and open your project (`helpy-bfac9`).

2. **Click the gear icon** (Project Settings) next to "Project Overview".

3. **Scroll to "Your apps"** and click **"Add app"** → select the **Android** icon (robot).

4. **Register the app:**
   - **Android package name:** Enter exactly `com.helpyfam.app` (not `.com`)
   - App nickname: optional (e.g. "Helpy Android")
   - Click **"Register app"**

5. **Download the new `google-services.json`** when prompted (or from Project Settings → Your apps → your new app → download).

6. **Replace the file** at `android/app/google-services.json` with the new one.

7. **If you have two Android apps** (com.helpyfam.com and com.helpyfam.app), the downloaded `google-services.json` will contain both clients. That's fine — the plugin will pick the one matching your app's `applicationId`.

8. **Rebuild** the Android app.

## Quick check
After replacing the file, verify the new `google-services.json` contains a client with:
```json
"package_name": "com.helpyfam.app"
```
