import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  // Shown as the primary "try again" button. Omit for an error with no retry.
  onRetry?: () => void;
  retryLabel?: string;
  // An optional second way out (e.g. "Go home", "Close").
  secondaryLabel?: string;
  onSecondary?: () => void;
  // Small inline variant for a panel/area (e.g. the persona preview) rather
  // than a whole page.
  compact?: boolean;
  className?: string;
}

// The blueprint's UX principle for Phase 4: never leave the user with a blank
// screen after something fails - say what happened and offer a way forward.
// Used by ErrorBoundary and by pages whose data failed to load.
const ErrorState: React.FC<ErrorStateProps> = ({
  title = "We couldn't complete this action",
  message = 'Something went wrong on our side. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  secondaryLabel,
  onSecondary,
  compact = false,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'gap-3 p-4' : 'gap-5 py-24 px-6'
      } ${className}`}
    >
      <div
        className={`rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 ${
          compact ? 'w-10 h-10' : 'w-16 h-16'
        }`}
      >
        <AlertTriangle size={compact ? 18 : 28} />
      </div>

      <div className="space-y-2 max-w-sm">
        <h2
          className={`font-light tracking-tight text-text-primary ${compact ? 'text-sm' : 'text-2xl'}`}
        >
          {title}
        </h2>
        <p className={`text-text-secondary leading-relaxed ${compact ? 'text-[11px]' : 'text-sm'}`}>
          {message}
        </p>
      </div>

      {(onRetry || onSecondary) && (
        <div className="flex items-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className={`inline-flex items-center gap-2 rounded-2xl bg-ink text-background-main font-medium hover:scale-[1.02] active:scale-[0.98] transition-all ${
                compact ? 'px-4 py-2 text-[10px] tracking-widest uppercase' : 'px-6 py-3 text-xs tracking-widest uppercase'
              }`}
            >
              <RotateCcw size={compact ? 12 : 14} />
              {retryLabel}
            </button>
          )}
          {onSecondary && secondaryLabel && (
            <button
              onClick={onSecondary}
              className={`rounded-2xl bg-ink/5 hover:bg-ink/10 text-text-primary transition-all ${
                compact ? 'px-4 py-2 text-[10px] tracking-widest uppercase' : 'px-6 py-3 text-xs tracking-widest uppercase'
              }`}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorState;
