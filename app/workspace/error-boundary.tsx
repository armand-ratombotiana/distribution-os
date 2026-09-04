"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export type ErrorBoundaryProps = {
  children: ReactNode;
  /**
   * Optional fallback. May be a static ReactNode or a render function
   * that receives the caught error and a `reset` callback (which clears
   * the boundary so the children re-render).
   */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Optional callback fired when an error is caught (logging, telemetry). */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Optional test id for snapshot/axe targeting. */
  testId?: string;
};

type ErrorBoundaryState = { error: Error | null };

/**
 * Reusable React error boundary for the workspace UI. Catches render-time
 * errors anywhere in its subtree and shows a friendly fallback with a
 * retry button. The boundary is intentionally simple — it does not wrap
 * async errors (those are handled by the per-panel try/catch blocks) but
 * it does stop a single broken panel from taking down the whole shell.
 *
 * Use `fallback` to override the default UI, or pass a render function
 * to get access to the caught error and a `reset()` callback.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, info);
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback, testId } = this.props;
    if (typeof fallback === "function") {
      return fallback(error, this.reset);
    }
    if (fallback !== undefined) {
      return fallback;
    }

    return (
      <section
        className="error-boundary ws-panel"
        role="alert"
        aria-live="assertive"
        data-testid={testId}
      >
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <CircleAlert /> Something broke
            </p>
            <h2>This panel hit an unexpected error</h2>
            <p className="ws-panel-lede">
              The rest of the workspace is unaffected. Try again — if the
              error persists, refresh the page.
            </p>
          </div>
        </header>
        <div className="ws-error">
          <CircleAlert /> {error.message || "Unknown render error"}
        </div>
        <div className="ws-empty">
          <Button variant="outline" size="sm" onClick={this.reset}>
            <RefreshCw /> Retry
          </Button>
        </div>
      </section>
    );
  }
}

export default ErrorBoundary;
