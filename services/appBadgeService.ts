/**
 * App Badge Service
 * Manages the PWA app icon badge to show unread/new activity count.
 * 
 * Badge shows: Items added by OTHER household members since last visit.
 * Clears when: User opens the app.
 * 
 * Uses the Badging API (Chrome 81+, Edge 84+, Safari 17.4+)
 */

const LAST_SEEN_KEY = 'helpy_last_seen_at';

/**
 * Check if the Badging API is supported
 */
export const isBadgeSupported = (): boolean => {
  return 'setAppBadge' in navigator;
};

/**
 * Set the app badge count
 * @param count - Number to display (0 clears the badge)
 */
export const setAppBadge = async (count: number): Promise<void> => {
  if (!isBadgeSupported()) {
    console.log('[Badge] Badging API not supported');
    return;
  }

  try {
    if (count <= 0) {
      await (navigator as any).clearAppBadge();
      console.log('[Badge] Cleared');
    } else {
      await (navigator as any).setAppBadge(count);
      console.log(`[Badge] Set to ${count}`);
    }
  } catch (error) {
    console.warn('[Badge] Failed to set badge:', error);
  }
};

/**
 * Clear the app badge
 */
export const clearAppBadge = async (): Promise<void> => {
  await setAppBadge(0);
  
  // Also tell the service worker to clear its badge count storage
  await clearServiceWorkerBadge();
};

/**
 * Tell the service worker to clear its badge count from IndexedDB
 */
const clearServiceWorkerBadge = async (): Promise<void> => {
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (!registration?.active) {
      console.log('[Badge] No active service worker');
      return;
    }

    const messageChannel = new MessageChannel();
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[Badge] Service worker badge clear timed out');
        resolve();
      }, 1000);
      
      messageChannel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        console.log('[Badge] Service worker badge clear response:', event.data);
        resolve();
      };

      registration.active.postMessage(
        { type: 'CLEAR_BADGE' },
        [messageChannel.port2]
      );
    });
  } catch (error) {
    console.warn('[Badge] Failed to clear service worker badge:', error);
  }
};

/**
 * Get the last seen timestamp for the current user
 */
export const getLastSeenAt = (): Date | null => {
  const stored = localStorage.getItem(LAST_SEEN_KEY);
  if (!stored) return null;
  return new Date(stored);
};

/**
 * Update the last seen timestamp to now
 */
export const updateLastSeenAt = (): void => {
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
};

/**
 * Calculate badge count from collections
 * Counts items created AFTER lastSeenAt by OTHER users (not currentUserId)
 */
export const calculateBadgeCount = (
  currentUserId: string,
  lastSeenAt: Date | null,
  todoItems: Array<{ createdAt?: string; assigneeId?: string }>,
  meals: Array<{ createdAt?: string; createdBy?: string }>,
  expenses: Array<{ createdAt?: string; createdBy?: string }>
): number => {
  // If never seen before, don't show a huge badge - start fresh
  if (!lastSeenAt) {
    return 0;
  }

  const cutoff = lastSeenAt.getTime();
  let count = 0;

  // Count new todo items (created by others)
  // Note: ToDoItem doesn't have createdBy, but we can use assigneeId logic
  // For now, we'll count items where the current user is NOT the assignee
  // and was created after lastSeenAt
  todoItems.forEach(item => {
    if (!item.createdAt) return;
    const createdTime = new Date(item.createdAt).getTime();
    if (createdTime > cutoff) {
      // Count if user is not the assignee (likely added by someone else)
      // This is a heuristic - ideally we'd have createdBy field
      if (item.assigneeId !== currentUserId) {
        count++;
      }
    }
  });

  // Count new meals (created by others)
  meals.forEach(meal => {
    if (!meal.createdAt || !meal.createdBy) return;
    const createdTime = new Date(meal.createdAt).getTime();
    if (createdTime > cutoff && meal.createdBy !== currentUserId) {
      count++;
    }
  });

  // Count new expenses (created by others)
  expenses.forEach(expense => {
    if (!expense.createdAt || !expense.createdBy) return;
    const createdTime = new Date(expense.createdAt).getTime();
    if (createdTime > cutoff && expense.createdBy !== currentUserId) {
      count++;
    }
  });

  return count;
};

/**
 * Update badge based on current data
 * Call this after data subscriptions update
 */
export const updateBadgeFromData = (
  currentUserId: string,
  todoItems: Array<{ createdAt?: string; assigneeId?: string }>,
  meals: Array<{ createdAt?: string; createdBy?: string }>,
  expenses: Array<{ createdAt?: string; createdBy?: string }>
): void => {
  const lastSeenAt = getLastSeenAt();
  const count = calculateBadgeCount(currentUserId, lastSeenAt, todoItems, meals, expenses);
  setAppBadge(count);
};

/**
 * Mark app as seen and clear badge
 * Call this when the app becomes visible/active
 */
export const markAppAsSeen = async (): Promise<void> => {
  updateLastSeenAt();
  await clearAppBadge();
};

/**
 * Initialize badge tracking
 * Sets up visibility change listener to update "last seen" when app is opened
 */
export const initBadgeTracking = (
  currentUserId: string,
  getData: () => {
    todoItems: Array<{ createdAt?: string; assigneeId?: string }>;
    meals: Array<{ createdAt?: string; createdBy?: string }>;
    expenses: Array<{ createdAt?: string; createdBy?: string }>;
  }
): (() => void) => {
  // Mark as seen when initializing (app is being opened)
  markAppAsSeen();

  // Listen for visibility changes
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // App became visible - mark as seen and clear badge
      markAppAsSeen();
    } else if (document.visibilityState === 'hidden') {
      // App went to background - update the last seen timestamp
      // So next time we can calculate new items from this point
      updateLastSeenAt();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};

export default {
  isBadgeSupported,
  setAppBadge,
  clearAppBadge,
  getLastSeenAt,
  updateLastSeenAt,
  calculateBadgeCount,
  updateBadgeFromData,
  markAppAsSeen,
  initBadgeTracking,
};

