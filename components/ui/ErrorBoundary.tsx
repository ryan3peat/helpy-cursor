import React from 'react';
import { Rat, RotateCcw } from 'lucide-react';
import { logger } from '../../utils/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  autoReloading: boolean;
}

/**
 * Auto-reload key used to track whether the ErrorBoundary has already
 * attempted a silent reload. Stored in sessionStorage so it resets when
 * the user opens a fresh tab/session.
 */
const AUTO_RELOAD_KEY = 'helpy_error_auto_reload';
const AUTO_RELOAD_WINDOW_MS = 15_000; // ignore stale markers older than 15s

/**
 * Error Boundary component that catches JavaScript errors anywhere in the
 * child component tree and displays a fallback UI instead of crashing.
 * 
 * On the FIRST error it silently reloads the page (common on Android
 * Capacitor apps where the WebView loses state after being backgrounded).
 * If the error recurs within 15 seconds of the auto-reload, it shows the
 * "Way Too Dusty" fallback so the user isn't stuck in a reload loop.
 * 
 * Note: Error Boundaries do NOT catch errors in:
 * - Event handlers (use try/catch)
 * - Async code (setTimeout, fetch, etc.)
 * - Server-side rendering
 * - Errors thrown in the error boundary itself
 * 
 * Usage:
 *   <ErrorBoundary>
 *     <AppContent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, autoReloading: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Always log (uses console.error so it shows in Logcat on Android)
    try {
      console.error(
        '[HELpyErrorBoundary] ' +
          JSON.stringify({
            message: error?.message,
            stack: error?.stack?.substring(0, 500),
          })
      );
    } catch {
      // ignore
    }

    logger.error('[ErrorBoundary] Caught error:', error);
    logger.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // --- Auto-reload logic ---
    // If we haven't recently auto-reloaded, do a silent reload.
    // This handles the common Capacitor case where Android kills the WebView
    // while the app is in the background and the page needs a fresh load.
    try {
      const prev = sessionStorage.getItem(AUTO_RELOAD_KEY);
      const prevTs = prev ? parseInt(prev, 10) : 0;
      const now = Date.now();

      if (!prev || now - prevTs > AUTO_RELOAD_WINDOW_MS) {
        // First error (or stale marker) – attempt a silent reload
        sessionStorage.setItem(AUTO_RELOAD_KEY, String(now));
        this.setState({ autoReloading: true });
        logger.log('[ErrorBoundary] Auto-reloading after background resume error...');
        window.location.reload();
        return;
      }
      // If we get here, we already auto-reloaded recently and it didn't help.
      // Fall through to show the error UI.
    } catch {
      // sessionStorage might not be available – fall through to error UI.
    }
  }

  handleReload = (): void => {
    // Clear the auto-reload marker so the next crash gets one more try
    try {
      sessionStorage.removeItem(AUTO_RELOAD_KEY);
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render(): React.ReactNode {
    // While we're about to auto-reload, show nothing (avoids flash of error UI)
    if (this.state.autoReloading) {
      return null;
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 page-fade-in auth-gradient-bg">
          <div className="max-w-md w-full">
            {/* Error Card */}
            <div className="bg-card rounded-2xl p-6 shadow-sm">
              {/* Logo */}
              <div className="flex justify-center mb-4">
                <img 
                  src="/helpy-logo-blue.png" 
                  alt="Helpy" 
                  className="h-8 w-auto"
                />
              </div>
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <Rat className="text-primary" size={48} />
              </div>

              {/* Title */}
              <h1 className="text-title font-bold text-foreground text-center mb-2">
                Way Too Dusty
              </h1>

              {/* Message */}
              <p className="text-body text-muted-foreground text-center mb-6">
                The app encountered an unexpected error. Please reload to try again.
              </p>

              {/* Reload Button */}
              <button
                onClick={this.handleReload}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold shadow-sm flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

