// ============================================================================
// Service Worker for Push Notifications - Helpy App
// ============================================================================
// This service worker handles:
// 1. Push events - displaying notifications when received
// 2. Notification clicks - opening the app to the relevant view
// 3. Notification close - tracking dismissed notifications
// ============================================================================

// App base URL (will be set dynamically based on where SW is registered)
const APP_BASE_URL = self.location.origin;

// Icon paths
const ICON_PATH = '/icons/icon-192.png';
const BADGE_PATH = '/icons/favicon-32.png';

// Default notification options
const DEFAULT_NOTIFICATION_OPTIONS = {
  icon: ICON_PATH,
  badge: BADGE_PATH,
  vibrate: [100, 50, 100], // Vibration pattern
  requireInteraction: false, // Auto-dismiss after a while
  renotify: true, // Alert user even if notification with same tag exists
};

// ============================================================================
// PUSH EVENT HANDLER
// ============================================================================
// Called when a push notification is received from the server
// ============================================================================

self.addEventListener('push', (event) => {
  console.log('[SW] 🔔 Push event received');
  console.log('[SW] Push event details:', {
    hasData: !!event.data,
    dataType: event.data ? typeof event.data : 'none',
    isArrayBuffer: event.data instanceof ArrayBuffer,
    isBlob: event.data instanceof Blob,
    isText: event.data ? typeof event.data.text === 'function' : false,
    isJson: event.data ? typeof event.data.json === 'function' : false,
    timestamp: new Date().toISOString()
  });

  // Wrap async parsing in event.waitUntil
  event.waitUntil((async () => {
    let data = {
      title: 'Helpy',
      body: 'Something new was added to your household!',
      type: 'general',
      url: '/',
    };

    // Parse the push data
    if (event.data) {
      // First, check what type of data we have
      let dataType = 'unknown';
      let rawData = null;
      
      try {
        // Try to get as text first to see what we're dealing with
        const textData = await event.data.text();
        console.log('[SW] Raw push data as text:', textData);
        console.log('[SW] Text data length:', textData.length);
        console.log('[SW] Text data preview (first 100 chars):', textData.substring(0, 100));
        
        // Check if it looks like JSON
        const trimmed = textData.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const jsonData = JSON.parse(textData);
            console.log('[SW] ✅ Successfully parsed push data as JSON:', jsonData);
            data = { ...data, ...jsonData };
            dataType = 'json';
          } catch (parseError) {
            console.error('[SW] ❌ Text looks like JSON but failed to parse:', parseError.message);
            dataType = 'text';
            data.body = textData || data.body;
          }
        } else {
          // Plain text
          console.log('[SW] ⚠️ Push data is plain text (not JSON)');
          dataType = 'text';
          data.body = textData || data.body;
        }
      } catch (textError) {
        console.error('[SW] ❌ Failed to get push data as text:', {
          error: textError.message || String(textError),
          errorName: textError.name
        });
        
        // Try JSON directly (browser might have already decrypted)
        try {
          const jsonData = event.data.json();
          console.log('[SW] ✅ Successfully got push data as JSON (direct):', jsonData);
          data = { ...data, ...jsonData };
          dataType = 'json-direct';
        } catch (jsonError) {
          console.error('[SW] ❌ Failed to get push data as JSON (direct):', {
            error: jsonError.message || String(jsonError),
            errorName: jsonError.name
          });
          
          // Try arrayBuffer as last resort
          try {
            const arrayBuffer = await event.data.arrayBuffer();
            console.log('[SW] ⚠️ Got push data as ArrayBuffer (length:', arrayBuffer.byteLength, ')');
            console.log('[SW] ⚠️ First 20 bytes:', Array.from(new Uint8Array(arrayBuffer.slice(0, 20))));
            // Browser should have decrypted it, but if we get raw bytes, something went wrong
            console.error('[SW] ❌ Received raw encrypted data - browser decryption may have failed');
            console.error('[SW] This usually means:');
            console.error('[SW]   1. Content-Encoding header mismatch (should be aes128gcm)');
            console.error('[SW]   2. Subscription keys (p256dh, auth) don\'t match');
            console.error('[SW]   3. VAPID keys don\'t match between client and server');
            dataType = 'arraybuffer';
          } catch (abError) {
            console.error('[SW] ❌ Failed to get push data as ArrayBuffer:', abError);
            dataType = 'error';
          }
        }
      }
      
      console.log('[SW] Final data type detected:', dataType);
    } else {
      console.log('[SW] ⚠️ No push data in event, using defaults');
    }

    // Determine the action URL based on notification type
    const getActionUrl = (type) => {
      switch (type) {
        case 'todo_item':
        case 'shopping':
          return '/#todo?section=shopping';
        case 'task':
          return '/#todo?section=task';
        case 'meal':
          return '/#meals';
        case 'expense':
          return '/#expenses';
        default:
          return '/';
      }
    };

    // Build notification options
    const options = {
      ...DEFAULT_NOTIFICATION_OPTIONS,
      body: data.body,
      tag: data.tag || `helpy-${data.type}-${Date.now()}`,
      data: {
        url: data.url || getActionUrl(data.type),
        type: data.type,
        referenceId: data.referenceId,
        notificationId: data.notificationId,
      },
      actions: [
        {
          action: 'view',
          title: 'View',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
        },
      ],
    };

    // Show the notification
    console.log('[SW] 📱 Showing notification:', { 
      title: data.title, 
      body: data.body, 
      type: data.type,
      tag: options.tag,
      url: options.data?.url
    });
    
    try {
      await self.registration.showNotification(data.title, options);
      console.log('[SW] ✅ Notification shown successfully');
      console.log('[SW] Notification details:', {
        title: data.title,
        body: data.body,
        type: data.type,
        tag: options.tag,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[SW] ❌ Failed to show notification:', {
        error: error.message || String(error),
        errorName: error.name,
        stack: error.stack,
        notificationTitle: data.title,
        notificationBody: data.body,
        timestamp: new Date().toISOString()
      });
    }
  })());
});


// ============================================================================
// NOTIFICATION CLICK HANDLER
// ============================================================================
// Called when user clicks on the notification or an action button
// ============================================================================

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Close the notification
  notification.close();

  // Handle different actions
  if (action === 'dismiss') {
    // User dismissed - just close
    console.log('[SW] Notification dismissed');
    return;
  }

  // Default action or 'view' action - open the app
  const urlToOpen = data.url || '/';

  event.waitUntil(
    // Check if the app is already open
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Try to find an existing window with our app
        for (const client of windowClients) {
          if (client.url.startsWith(APP_BASE_URL) && 'focus' in client) {
            // Found an open window - navigate and focus it
            return client.navigate(APP_BASE_URL + urlToOpen)
              .then(() => client.focus())
              .catch(() => client.focus()); // If navigate fails, just focus
          }
        }
        // No open window - open a new one
        return clients.openWindow(APP_BASE_URL + urlToOpen);
      })
  );
});


// ============================================================================
// NOTIFICATION CLOSE HANDLER
// ============================================================================
// Called when notification is dismissed (swiped away)
// ============================================================================

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
  
  // Could track analytics here if needed
  const data = event.notification.data || {};
  if (data.notificationId) {
    // Mark as read in database (optional)
    // This would require sending a fetch request to the server
  }
});


// ============================================================================
// MESSAGE HANDLER (for debugging)
// ============================================================================
// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return; // No response needed
  }
  
  if (event.data && event.data.type === 'PING') {
    // Only respond if a port is available
    if (event.ports && event.ports.length > 0 && event.ports[0]) {
      try {
        event.ports[0].postMessage({ 
          success: true, 
          message: 'Service worker is active',
          scope: self.registration?.scope 
        });
      } catch (error) {
        console.error('[SW] Failed to send PING response:', error);
      }
    } else {
      console.log('[SW] PING received but no message port available');
    }
    return; // Don't continue processing
  }
  
  if (event.data && event.data.type === 'TEST') {
    console.log('[SW] ✅ Test message received - service worker is active and responding');
    console.log('[SW] Test message content:', event.data.message);
    // No response needed for TEST messages
    return;
  }
  
  // For any other messages, optionally respond if port is available
  if (event.ports && event.ports.length > 0 && event.ports[0]) {
    try {
      event.ports[0].postMessage({ 
        received: true,
        message: 'Message received by service worker'
      });
    } catch (error) {
      // Port might be closed, that's okay
      console.log('[SW] Could not send response (port may be closed):', error.message);
    }
  }
});

// ============================================================================
// SERVICE WORKER LIFECYCLE
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing push service worker...');
  console.log('[SW] Service worker scope:', self.registration?.scope);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Push service worker activated');
  console.log('[SW] Service worker state:', self.registration?.active?.state);
  // Take control of all clients immediately
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Log all controlled clients
      clients.matchAll().then(clientList => {
        console.log('[SW] Controlling', clientList.length, 'client(s)');
        clientList.forEach((client, index) => {
          console.log(`[SW] Client ${index + 1}:`, client.url);
        });
      })
    ])
  );
});


// ============================================================================
// PUSH SUBSCRIPTION CHANGE HANDLER
// ============================================================================
// Called when the push subscription changes (e.g., browser refreshes keys)
// ============================================================================

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed:', event);
  
  // Re-subscribe and update the server
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey
    })
    .then((newSubscription) => {
      // Send the new subscription to the server
      return fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldEndpoint: event.oldSubscription?.endpoint,
          newSubscription: newSubscription.toJSON()
        })
      });
    })
    .catch((error) => {
      console.error('[SW] Failed to resubscribe:', error);
    })
  );
});

