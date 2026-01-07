import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
  title?: string;
  className?: string;
}

/**
 * Reusable error banner component for consistent error display across the app.
 * 
 * Usage:
 * ```tsx
 * const [error, setError] = useState<string | null>(null);
 * 
 * <ErrorBanner 
 *   error={error} 
 *   onDismiss={() => setError(null)} 
 *   title={t['common.error'] || 'Error'}
 * />
 * ```
 */
const ErrorBanner: React.FC<ErrorBannerProps> = ({ 
  error, 
  onDismiss, 
  title = 'Error',
  className = ''
}) => {
  if (!error) return null;

  return (
    <div className={`mt-4 mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3 ${className}`}>
      <AlertCircle className="text-destructive flex-shrink-0 mt-0.5" size={20} />
      <div className="flex-1 min-w-0">
        <p className="text-title text-destructive">{title}</p>
        <p className="text-body text-destructive/80">{error}</p>
      </div>
      <button 
        onClick={onDismiss} 
        className="text-destructive/60 transition-colors flex-shrink-0"
        aria-label="Dismiss error"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default ErrorBanner;

