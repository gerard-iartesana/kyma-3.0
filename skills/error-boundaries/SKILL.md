# Error Boundaries & Telemetry

Patterns for graceful error handling so a broken widget never crashes the whole page.

## React Error Boundary

```tsx
// components/error-boundary.tsx
"use client";
import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  label?: string; // "Gráfico de ocupación", "Tabla de propiedades"
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`, error, info);
    this.props.onError?.(error, info);
    // Send to telemetry
    reportError(error, { component: this.props.label, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="error-fallback" role="alert">
          <AlertCircle size={24} className="error-icon" />
          <div>
            <p className="error-title">
              Error en {this.props.label ?? "este componente"}
            </p>
            <p className="error-detail">
              Algo salió mal. Intenta recargar esta sección.
            </p>
          </div>
          <button className="error-retry" onClick={() => this.setState({ hasError: false, error: null })}>
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## Usage: Wrap Risky Components

```tsx
// Dashboard with isolated errors
<div className="dashboard-grid">
  <ErrorBoundary label="KPIs">
    <KpiCards />
  </ErrorBoundary>

  <ErrorBoundary label="Gráfico de ocupación">
    <OccupancyChart />
  </ErrorBoundary>

  <ErrorBoundary label="Tabla de tareas">
    <TasksTable />
  </ErrorBoundary>
</div>
```

## Next.js error.tsx (Page-Level)

```tsx
// app/admin/error.tsx
"use client";

export default function AdminError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { page: "admin" });
  }, [error]);

  return (
    <div className="page-error">
      <h2>Algo salió mal</h2>
      <p>No se pudo cargar esta página. Inténtalo de nuevo.</p>
      <button onClick={reset}>Reintentar</button>
    </div>
  );
}
```

## Telemetry: Error Reporting

```typescript
// lib/telemetry/report.ts

interface ErrorContext {
  component?: string;
  page?: string;
  userId?: string;
  componentStack?: string | null;
  extra?: Record<string, unknown>;
}

export function reportError(error: Error, context?: ErrorContext) {
  // Console in development
  if (process.env.NODE_ENV === "development") {
    console.error("[Telemetry]", error, context);
    return;
  }

  // Production: send to your error tracking service
  // Option A: Sentry
  // Sentry.captureException(error, { extra: context });

  // Option B: Custom endpoint
  fetch("/api/telemetry/error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {}); // Fire and forget
}
```

## Sentry Setup (Optional)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,     // 10% of transactions
  replaysSessionSampleRate: 0, // No session replay by default
  replaysOnErrorSampleRate: 1, // Record replay on errors
});
```

## Global Unhandled Error Catch

```typescript
// app/layout.tsx or a global provider
"use client";
useEffect(() => {
  const onUnhandled = (e: PromiseRejectionEvent) => {
    reportError(new Error(e.reason), { component: "unhandled-promise" });
  };
  window.addEventListener("unhandledrejection", onUnhandled);
  return () => window.removeEventListener("unhandledrejection", onUnhandled);
}, []);
```

## CSS

```css
.error-fallback {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: hsl(0 72% 51% / 0.06);
  border: 1px solid hsl(0 72% 51% / 0.15);
}
.error-icon { color: var(--color-error); flex-shrink: 0; }
.error-title { font-weight: 600; font-size: var(--text-sm); }
.error-detail { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }
.error-retry {
  margin-left: auto; display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: var(--radius-sm); font-size: var(--text-xs);
  background: white; border: 1px solid var(--color-border); cursor: pointer;
}
```

## Rules

- Wrap EVERY independent widget/section in an ErrorBoundary
- Every route directory should have an `error.tsx`
- ErrorBoundary label describes the broken section in Spanish
- Retry button resets the boundary state — user can recover
- Never show raw stack traces to users
- Log to console in dev, send to service in production
- Catch unhandled promise rejections globally
- reportError is fire-and-forget — never block UI for telemetry
