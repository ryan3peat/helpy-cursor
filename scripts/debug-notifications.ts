/**
 * Push Notification Debugging Script
 * 
 * This script helps diagnose push notification issues.
 * Run it in the browser console or use the exported functions.
 */

export interface DiagnosticResult {
  step: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

export async function runFullDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       HELPY PUSH NOTIFICATION DIAGNOSTICS                  ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  // 1. Check VAPID Key
  const vapidKey = (window as any).__VITE_VAPID_PUBLIC_KEY__ || 
                   (import.meta as any)?.env?.VITE_VAPID_PUBLIC_KEY || '';
  
  if (vapidKey) {
    results.push({
      step: 'VAPID Public Key',
      status: 'pass',
      message: `Key configured (${vapidKey.length} chars)`,
      details: { keyPreview: vapidKey.substring(0, 20) + '...' }
    });
    console.log('║ ✅ VAPID Public Key: Configured');
  } else {
    results.push({
      step: 'VAPID Public Key',
      status: 'fail',
      message: 'VAPID_PUBLIC_KEY is missing!',
      details: { fix: 'Add VITE_VAPID_PUBLIC_KEY to .env.local' }
    });
    console.log('║ ❌ VAPID Public Key: MISSING');
  }
  
  // 2. Check Browser Support
  const hasSW = 'serviceWorker' in navigator;
  const hasPush = 'PushManager' in window;
  const hasNotification = 'Notification' in window;
  
  if (hasSW && hasPush && hasNotification) {
    results.push({
      step: 'Browser Support',
      status: 'pass',
      message: 'All APIs supported'
    });
    console.log('║ ✅ Browser Support: Full');
  } else {
    results.push({
      step: 'Browser Support',
      status: 'fail',
      message: `Missing: ${!hasSW ? 'ServiceWorker ' : ''}${!hasPush ? 'PushManager ' : ''}${!hasNotification ? 'Notification' : ''}`
    });
    console.log('║ ❌ Browser Support: Incomplete');
  }
  
  // 3. Check Notification Permission
  const permission = Notification.permission;
  if (permission === 'granted') {
    results.push({
      step: 'Notification Permission',
      status: 'pass',
      message: 'Granted'
    });
    console.log('║ ✅ Notification Permission: Granted');
  } else if (permission === 'denied') {
    results.push({
      step: 'Notification Permission',
      status: 'fail',
      message: 'Denied - user must enable in browser settings',
      details: { 
        fix: 'Click lock icon in address bar → Site settings → Notifications → Allow'
      }
    });
    console.log('║ ❌ Notification Permission: DENIED');
  } else {
    results.push({
      step: 'Notification Permission',
      status: 'warn',
      message: 'Not yet requested - will be asked on toggle',
    });
    console.log('║ ⚠️ Notification Permission: Not yet requested');
  }
  
  // 4. Check Service Worker Registration
  let swRegistration: ServiceWorkerRegistration | undefined;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const pushSw = registrations.find(reg => 
      reg.active?.scriptURL?.includes('sw-push.js') ||
      reg.waiting?.scriptURL?.includes('sw-push.js') ||
      reg.installing?.scriptURL?.includes('sw-push.js')
    );
    
    if (pushSw) {
      swRegistration = pushSw;
      results.push({
        step: 'Service Worker',
        status: 'pass',
        message: 'Registered and active',
        details: { scope: pushSw.scope, scriptURL: pushSw.active?.scriptURL }
      });
      console.log('║ ✅ Service Worker: Active');
    } else {
      // Try to get by scope
      const scopeReg = await navigator.serviceWorker.getRegistration('/');
      if (scopeReg) {
        swRegistration = scopeReg;
        results.push({
          step: 'Service Worker',
          status: 'pass',
          message: 'Registered',
          details: { scope: scopeReg.scope }
        });
        console.log('║ ✅ Service Worker: Registered');
      } else {
        results.push({
          step: 'Service Worker',
          status: 'fail',
          message: 'Not registered',
          details: { fix: 'Refresh the page to trigger registration' }
        });
        console.log('║ ❌ Service Worker: NOT REGISTERED');
      }
    }
  } catch (error) {
    results.push({
      step: 'Service Worker',
      status: 'fail',
      message: 'Error checking registration',
      details: { error }
    });
    console.log('║ ❌ Service Worker: Error');
  }
  
  // 5. Check Push Subscription
  if (swRegistration) {
    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        results.push({
          step: 'Push Subscription',
          status: 'pass',
          message: 'Active subscription found',
          details: { 
            endpoint: subscription.endpoint.substring(0, 50) + '...',
            hasKeys: !!(subscription.toJSON().keys)
          }
        });
        console.log('║ ✅ Push Subscription: Active');
      } else {
        results.push({
          step: 'Push Subscription',
          status: 'fail',
          message: 'No subscription - user needs to enable notifications',
          details: { fix: 'Go to Profile → Settings → Enable Notifications' }
        });
        console.log('║ ❌ Push Subscription: NONE');
      }
    } catch (error) {
      results.push({
        step: 'Push Subscription',
        status: 'fail',
        message: 'Error checking subscription',
        details: { error }
      });
      console.log('║ ❌ Push Subscription: Error');
    }
  }
  
  // 6. Check HTTPS
  if (location.protocol === 'https:' || location.hostname === 'localhost') {
    results.push({
      step: 'HTTPS',
      status: 'pass',
      message: location.protocol === 'https:' ? 'Secure connection' : 'Localhost (OK for dev)'
    });
    console.log('║ ✅ HTTPS: OK');
  } else {
    results.push({
      step: 'HTTPS',
      status: 'fail',
      message: 'Push requires HTTPS (except localhost)',
    });
    console.log('║ ❌ HTTPS: NOT SECURE');
  }
  
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;
  
  console.log(`║ SUMMARY: ${passed} passed, ${failed} failed, ${warned} warnings`);
  
  if (failed > 0) {
    console.log('║');
    console.log('║ 🔧 FIXES NEEDED:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`║   - ${r.step}: ${r.details?.fix || r.message}`);
    });
  }
  
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  return results;
}

/**
 * Test sending a local notification (doesn't go through server)
 */
export async function testLocalNotification(): Promise<boolean> {
  console.log('Testing local notification...');
  
  if (Notification.permission !== 'granted') {
    console.log('❌ Permission not granted');
    return false;
  }
  
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) {
      console.log('❌ No service worker registration');
      return false;
    }
    
    await reg.showNotification('Helpy Test', {
      body: 'If you see this, local notifications work!',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      tag: 'test-' + Date.now()
    });
    
    console.log('✅ Local notification sent!');
    return true;
  } catch (error) {
    console.log('❌ Failed to show notification:', error);
    return false;
  }
}

/**
 * Force resubscribe to push notifications
 */
export async function forceResubscribe(): Promise<void> {
  console.log('Force resubscribing...');
  
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) {
    console.log('❌ No service worker - refresh page first');
    return;
  }
  
  // Unsubscribe first
  const existingSub = await reg.pushManager.getSubscription();
  if (existingSub) {
    await existingSub.unsubscribe();
    console.log('Unsubscribed from existing subscription');
  }
  
  // Get VAPID key (you'd need to pass this in a real scenario)
  console.log('To resubscribe, disable and re-enable notifications in Settings');
}

// Make functions available globally for browser console
if (typeof window !== 'undefined') {
  (window as any).helpyNotificationDiagnostics = runFullDiagnostics;
  (window as any).helpyTestNotification = testLocalNotification;
  (window as any).helpyForceResubscribe = forceResubscribe;
}
















