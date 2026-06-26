# Notifications & Toasts

Standard system for toast notifications in Next.js apps. Uses a lightweight custom implementation — no extra dependencies.

## Toast Store (Zustand)

```typescript
// lib/stores/use-toast-store.ts
import { create } from "zustand";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, 0 = persistent
}

interface ToastState {
  toasts: Toast[];
  add: (type: ToastType, message: string, duration?: number) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

const DEFAULTS: Record<ToastType, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 0, // persistent — user must dismiss
};

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  add: (type, message, duration) => {
    const id = crypto.randomUUID();
    const ms = duration ?? DEFAULTS[type];
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, type, message, duration: ms }] })); // max 3
    if (ms > 0) setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

// Shorthand helpers
export const toast = {
  success: (msg: string) => useToastStore.getState().add("success", msg),
  error: (msg: string) => useToastStore.getState().add("error", msg),
  warning: (msg: string) => useToastStore.getState().add("warning", msg),
  info: (msg: string) => useToastStore.getState().add("info", msg),
};
```

## Toast Container Component

```tsx
// components/ui/toast-container.tsx
"use client";
import { useToastStore } from "@/lib/stores/use-toast-store";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">{ICONS[t.type]}</span>
          <p className="toast-message">{t.message}</p>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Cerrar">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Add to root layout:**
```tsx
// app/layout.tsx
<body>
  {children}
  <ToastContainer />
</body>
```

## Usage

```typescript
import { toast } from "@/lib/stores/use-toast-store";

// After successful save
toast.success("Propiedad guardada correctamente");

// After error
toast.error("No se pudo conectar con el servidor. Inténtalo de nuevo.");

// Warning
toast.warning("Se han detectado campos incompletos");

// Info
toast.info("El informe se está generando. Puede tardar unos segundos.");
```

## CSS

```css
.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 420px;
  width: 100%;
  pointer-events: none;
}
@media (max-width: 640px) {
  .toast-container {
    top: auto;
    bottom: var(--space-4);
    right: var(--space-3);
    left: var(--space-3);
    max-width: none;
    align-items: stretch;
  }
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: white;
  border-left: 4px solid;
  box-shadow: var(--shadow-lg);
  animation: toast-in 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-success { border-color: var(--color-success); }
.toast-success .toast-icon { color: var(--color-success); }
.toast-error   { border-color: var(--color-error); }
.toast-error .toast-icon   { color: var(--color-error); }
.toast-warning { border-color: var(--color-warning); }
.toast-warning .toast-icon { color: var(--color-warning); }
.toast-info    { border-color: var(--color-info); }
.toast-info .toast-icon    { color: var(--color-info); }
.toast-message { flex: 1; font-size: var(--text-sm); }
.toast-close {
  background: none; border: none; cursor: pointer;
  color: var(--color-text-muted); padding: 4px;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(100%); }
  to   { opacity: 1; transform: translateX(0); }
}
```

## Message Standards

| Action | Type | Message |
|---|---|---|
| Create | success | `"{Recurso} creado correctamente"` |
| Update | success | `"Cambios guardados"` |
| Delete | success | `"{Recurso} eliminado"` |
| Network fail | error | `"Error de conexión. Comprueba tu red e inténtalo de nuevo."` |
| Validation | error | `"Revisa los campos marcados en rojo"` |
| Permission | error | `"No tienes permisos para esta acción"` |
| Background task | info | `"El informe se está generando..."` |
| Partial success | warning | `"Se importaron 8 de 10 registros. 2 con errores."` |

## Rules

- success: auto-dismiss 3.5s
- error: persistent until user dismisses
- warning: auto-dismiss 5s
- info: auto-dismiss 4s
- Max 3 visible toasts — oldest removed when exceeded
- Desktop: top-right. Mobile: bottom-center
- Messages: specific, actionable, in Spanish
- Never use `alert()` or `window.confirm()`
- Use `aria-live="polite"` on container for screen readers
