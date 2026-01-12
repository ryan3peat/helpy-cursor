import React from 'react';
import { Rat, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the
 * child component tree and displays a fallback UI instead of crashing.
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
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
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

