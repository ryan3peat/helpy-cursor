import { useState, useEffect, useCallback } from 'react';
import { onConnectionStatusChange } from '../services/supabaseService';
import { logger } from '../utils/logger';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

interface UseRealtimeStatusOptions {
  /** Enable periodic sync as backup (default: true) */
  enablePeriodicSync?: boolean;
  /** Sync interval in milliseconds (default: 3 minutes) */
  syncInterval?: number;
  /** Callback to trigger data refresh */
  onSyncRequest?: () => void;
}

/**
 * Hook to track Supabase real-time connection status
 * 
 * This monitors the ACTUAL data subscriptions (todo_items, users, meals, etc.)
 * instead of creating a separate test channel.
 * 
 * Provides:
 * - Connection status based on real data subscriptions
 * - Periodic sync as backup
 */
export function useRealtimeStatus(options: UseRealtimeStatusOptions = {}) {
  const {
    enablePeriodicSync = true,
    syncInterval = 3 * 60 * 1000, // 3 minutes
    onSyncRequest,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Subscribe to connection status changes from actual data subscriptions
  useEffect(() => {
    logger.log('📡 [Realtime] Monitoring actual data subscriptions...');
    
    const unsubscribe = onConnectionStatusChange((newStatus) => {
      logger.log(`📡 [Realtime] Connection status: ${newStatus}`);
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Periodic sync as backup
  useEffect(() => {
    if (!enablePeriodicSync || !onSyncRequest) return;

    logger.log(`⏰ [Realtime] Periodic sync enabled, interval: ${syncInterval / 1000}s`);

    const intervalId = setInterval(() => {
      logger.log('⏰ [Realtime] Periodic sync triggered');
      onSyncRequest();
      setLastSyncTime(new Date());
    }, syncInterval);

    // Initial sync after a short delay (let subscriptions set up first)
    const initialSyncTimeout = setTimeout(() => {
      onSyncRequest();
      setLastSyncTime(new Date());
    }, 2000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(initialSyncTimeout);
    };
  }, [enablePeriodicSync, syncInterval, onSyncRequest]);

  // Manual sync function
  const syncNow = useCallback(() => {
    if (onSyncRequest) {
      logger.log('🔄 [Realtime] Manual sync requested');
      onSyncRequest();
      setLastSyncTime(new Date());
    }
  }, [onSyncRequest]);

  return {
    status,
    isConnected: status === 'connected',
    isDisconnected: status === 'disconnected',
    isConnecting: status === 'connecting',
    lastSyncTime,
    syncNow,
  };
}

export default useRealtimeStatus;
