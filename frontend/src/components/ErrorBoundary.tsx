import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorState from './ErrorState';

interface ErrorBoundaryProps {
  children: ReactNode;
  // What to show instead of the crashed subtree. Defaults to a full-size
  // ErrorState with a Try Again button.
  fallback?: (context: { error: Error; reset: () => void }) => ReactNode;
  // Called when the user hits Try Again (before the subtree re-renders).
  onReset?: () => void;
  // When any of these change while in the error state, the boundary clears
  // itself and tries the subtree again - e.g. the route path, so navigating
  // away from a crashed page doesn't leave the error stuck on the next one.
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

// React only catches render/lifecycle errors in class components, hence the
// class. It does NOT catch errors in event handlers or async code - those are
// handled where they happen (toasts / inline error states).
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && haveKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ error: null });
    }
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      return this.props.fallback ? this.props.fallback({ error, reset: this.reset }) : <ErrorState onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function haveKeysChanged(a: unknown[] = [], b: unknown[] = []) {
  return a.length !== b.length || a.some((item, i) => !Object.is(item, b[i]));
}
