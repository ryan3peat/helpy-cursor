/**
 * Emergency Cache Clear Utility
 * Use this if the app ever breaks due to cached files.
 * 
 * This clears:
 * 1. All browser caches (via Cache API)
 * 2. Service worker caches (via message to SW)
 * 3. Forces a page reload
 */

/**
 * Clear all caches and reload the app
 * @returns Promise that resolves when caches are cleared
 */
export const clearAllCachesAndReload = async (): Promise<void> => {
  console.log('[ClearCache] Starting emergency cache clear...');
  
  try {
    // 1. Clear Cache API directly
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('[ClearCache] Found caches:', cacheNames);
      await Promise.all(
        cacheNames.map(name => {
          console.log('[ClearCache] Deleting cache:', name);
          return caches.delete(name);
        })
      );
      console.log('[ClearCache] All browser caches cleared');
    }
    
    // 2. Send message to service worker to clear its caches
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('[ClearCache] SW response timeout - continuing anyway');
          resolve();
        }, 3000);
        
        messageChannel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          console.log('[ClearCache] SW response:', event.data);
          resolve();
        };
        
        navigator.serviceWorker.controller.postMessage(
          { type: 'CLEAR_ALL_CACHES' },
          [messageChannel.port2]
        );
      });
      console.log('[ClearCache] Service worker caches cleared');
    }
    
    // 3. Clear localStorage items that might cause issues (but keep user data)
    // We only clear cache-related keys, not user preferences
    const cacheKeys = ['helpy_static_cache', 'helpy_runtime_cache'];
    cacheKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('[ClearCache] ✅ All caches cleared successfully');
    
    // 4. Force reload to get fresh files
    window.location.reload();
    
  } catch (error) {
    console.error('[ClearCache] Error clearing caches:', error);
    // Still try to reload even if clearing failed
    window.location.reload();
  }
};

/**
 * Unregister all service workers (nuclear option)
 * Use this if the service worker itself is broken
 */
export const unregisterAllServiceWorkers = async (): Promise<void> => {
  console.log('[ClearCache] Unregistering all service workers...');
  
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log('[ClearCache] Found', registrations.length, 'service worker(s)');
    
    await Promise.all(
      registrations.map(registration => {
        console.log('[ClearCache] Unregistering:', registration.scope);
        return registration.unregister();
      })
    );
    
    console.log('[ClearCache] ✅ All service workers unregistered');
  }
};

/**
 * Full nuclear reset - clears everything and reloads
 */
export const nuclearReset = async (): Promise<void> => {
  console.log('[ClearCache] 🔥 NUCLEAR RESET - clearing everything...');
  
  // Unregister service workers
  await unregisterAllServiceWorkers();
  
  // Clear all caches
  await clearAllCachesAndReload();
};

