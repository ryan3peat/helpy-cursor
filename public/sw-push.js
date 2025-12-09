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
  console.log('[SW] Push event received');
  console.log('[SW] Push event details:', {
    hasData: !!event.data,
    dataType: event.data ? typeof event.data : 'none',
    isArrayBuffer: event.data instanceof ArrayBuffer,
    timestamp: new Date().toISOString()
  });

  let data = {
    title: 'Helpy',
    body: 'Something new was added to your household!',
    type: 'general',
    url: '/',
  };

  // Parse the push data
  if (event.data) {
    try {
      // Try to parse as JSON first (for encrypted Web Push, browser decrypts automatically)
      const jsonData = event.data.json();
      console.log('[SW] Parsed push data:', jsonData);
      data = { ...data, ...jsonData };
    } catch (e) {
      console.error('[SW] Failed to parse push data as JSON:', e);
      try {
        // Fallback: try to get text
        const textData = event.data.text();
        console.log('[SW] Push data as text:', textData);
        data.body = textData || data.body;
      } catch (textError) {
        console.error('[SW] Failed to parse push data as text:', textError);
        // Use default data
      }
    }
  } else {
    console.log('[SW] No push data, using defaults');
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
  console.log('[SW] Showing notification:', { title: data.title, body: data.body, type: data.type });
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => {
        console.log('[SW] Notification shown successfully');
      })
      .catch((error) => {
        console.error('[SW] Failed to show notification:', error);
        console.error('[SW] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      })
  );
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
  }
  
  if (event.data && event.data.type === 'PING') {
    event.ports[0].postMessage({ 
      success: true, 
      message: 'Service worker is active',
      scope: self.registration?.scope 
    });
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

