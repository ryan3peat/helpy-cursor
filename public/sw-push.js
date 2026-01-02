// ============================================================================
// Service Worker for Helpy App
// ============================================================================
// This service worker handles:
// 1. Push events - displaying notifications when received
// 2. Notification clicks - opening the app to the relevant view
// 3. Notification close - tracking dismissed notifications
// 4. Offline caching - cache static assets for offline access
// ============================================================================

// App base URL (will be set dynamically based on where SW is registered)
const APP_BASE_URL = self.location.origin;

// ============================================================================
// OFFLINE CACHING CONFIGURATION
// ============================================================================

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `helpy-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `helpy-runtime-${CACHE_VERSION}`;

// Static assets to pre-cache during install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/helpy-logo.PNG',
];

// URL patterns that should use cache-first strategy
const CACHE_FIRST_PATTERNS = [
  /\/icons\//,
  /\/fonts\//,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.svg$/,
  /\.woff2?$/,
  /\.ttf$/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /cdn\.tailwindcss\.com/,
  /api\.dicebear\.com/,
  /cdn-icons-png\.flaticon\.com/,
];

// URL patterns that should never be cached
const NO_CACHE_PATTERNS = [
  /\/api\//,
  /supabase\.co/,
  /clerk\./,
  /stripe\./,
];

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
      // Note: Don't set default url here - let getActionUrl() determine it based on type
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
  console.log('[SW] 🔔 Notification clicked:', {
    action: event.action,
    tag: event.notification.tag,
    data: event.notification.data
  });

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Always close the notification first
  notification.close();

  // Handle dismiss action - just close, nothing else needed
  if (action === 'dismiss') {
    console.log('[SW] Notification dismissed by user');
    return;
  }

  // Default action or 'view' action - open the app
  const urlToOpen = data.url || '/';
  const fullUrl = APP_BASE_URL + urlToOpen;
  
  console.log('[SW] Opening URL:', fullUrl);

  // IMPORTANT: Must wrap ALL async operations in event.waitUntil()
  // This keeps the service worker alive until the window opens
  event.waitUntil(
    (async () => {
      try {
        // Check if the app is already open
        const windowClients = await clients.matchAll({ 
          type: 'window', 
          includeUncontrolled: true 
        });
        
        console.log('[SW] Found', windowClients.length, 'open window(s)');

        // Try to find an existing window with our app
        for (const client of windowClients) {
          console.log('[SW] Checking client:', client.url);
          if (client.url.startsWith(APP_BASE_URL)) {
            console.log('[SW] Found existing app window, navigating and focusing...');
            // Navigate to the target URL
            try {
              await client.navigate(fullUrl);
            } catch (navError) {
              console.log('[SW] Navigate failed (may already be on page):', navError.message);
            }
            // Focus the window
            await client.focus();
            console.log('[SW] ✅ Focused existing window');
            return;
          }
        }

        // No open window found - open a new one
        console.log('[SW] No existing window found, opening new window...');
        const newWindow = await clients.openWindow(fullUrl);
        console.log('[SW] ✅ Opened new window:', newWindow?.url);
      } catch (error) {
        console.error('[SW] ❌ Error handling notification click:', error);
        // Last resort: try to open window anyway
        try {
          await clients.openWindow(fullUrl);
        } catch (e) {
          console.error('[SW] ❌ Failed to open window:', e);
        }
      }
    })()
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
  console.log('[SW] Installing service worker...');
  console.log('[SW] Service worker scope:', self.registration?.scope);
  
  // Pre-cache static assets
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Pre-caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch(error => {
        console.warn('[SW] Failed to pre-cache some assets:', error);
        // Still skip waiting even if caching fails
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  console.log('[SW] Service worker state:', self.registration?.active?.state);
  
  // Clean up old caches and take control
  event.waitUntil(
    Promise.all([
      // Delete old cache versions
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('helpy-') && name !== STATIC_CACHE && name !== RUNTIME_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Take control of all clients immediately
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
// FETCH HANDLER - OFFLINE CACHING
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip requests that should never be cached (API, Supabase, Clerk, Stripe)
  if (NO_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
    return;
  }
  
  // Check if this is a cache-first request (static assets, fonts, images)
  const isCacheFirst = CACHE_FIRST_PATTERNS.some(pattern => pattern.test(request.url));
  
  if (isCacheFirst) {
    // Cache-first strategy: Try cache, fall back to network, update cache
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached response, but also fetch and update cache in background
            event.waitUntil(
              fetch(request)
                .then(networkResponse => {
                  if (networkResponse.ok) {
                    return caches.open(RUNTIME_CACHE)
                      .then(cache => cache.put(request, networkResponse));
                  }
                })
                .catch(() => {/* Network failed, that's fine - we served from cache */})
            );
            return cachedResponse;
          }
          
          // Not in cache - fetch from network and cache it
          return fetch(request)
            .then(networkResponse => {
              if (networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(RUNTIME_CACHE)
                  .then(cache => cache.put(request, responseClone));
              }
              return networkResponse;
            });
        })
    );
    return;
  }
  
  // Network-first strategy for navigation and HTML
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          // Cache successful HTML responses
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(RUNTIME_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed - try to serve from cache
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Last resort: serve the cached index.html for SPA routing
              return caches.match('/index.html');
            });
        })
    );
    return;
  }
  
  // Default: Network first, cache as fallback
  event.respondWith(
    fetch(request)
      .then(networkResponse => {
        // Only cache successful responses
        if (networkResponse.ok && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(RUNTIME_CACHE)
            .then(cache => cache.put(request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});


// ============================================================================
// PUSH SUBSCRIPTION CHANGE HANDLER
// ============================================================================
// Called when the push subscription changes (e.g., browser refreshes keys)
// ============================================================================

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed:', event);
  
  // Get the applicationServerKey from the old subscription
  const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
  
  // If we don't have the key, we can't resubscribe here
  // The main app will handle resubscription when the user opens it
  if (!applicationServerKey) {
    console.log('[SW] No applicationServerKey available, skipping auto-resubscribe');
    console.log('[SW] The app will resubscribe when opened');
    return;
  }
  
  // Re-subscribe and update the server
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
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
      console.log('[SW] The app will attempt resubscription when opened');
    })
  );
});

