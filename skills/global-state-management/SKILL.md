# Global State Management

Patterns for managing global state with Zustand in Next.js applications.

## Library: Zustand 4.x

Minimal, performant, no boilerplate. Default for all projects.

## Store Structure

One store per domain. Keep stores small and focused.

```
lib/
  stores/
    use-auth-store.ts       # User session, profile, role
    use-ui-store.ts         # Sidebar, modals, theme, toasts
    use-filters-store.ts    # Global filters (date range, search)
    use-[feature]-store.ts  # Feature-specific state
```

## Base Store Pattern

```typescript
// lib/stores/use-auth-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "manager" | "operator" | "viewer";
}

interface AuthState {
  profile: Profile | null;
  isAuthenticated: boolean;
  // Actions
  setProfile: (profile: Profile) => void;
  clear: () => void;
  // Computed
  isAdmin: () => boolean;
  can: (roles: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  profile: null,
  isAuthenticated: false,

  setProfile: (profile) => set({ profile, isAuthenticated: true }),
  clear: () => set({ profile: null, isAuthenticated: false }),

  isAdmin: () => get().profile?.role === "admin",
  can: (roles) => roles.includes(get().profile?.role ?? ""),
}));
```

## UI Store (Sidebar, Theme, Modals)

```typescript
// lib/stores/use-ui-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  // Modal state
  activeModal: string | null;
  modalData: unknown;
  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: UIState["theme"]) => void;
  openModal: (id: string, data?: unknown) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: "system",
      activeModal: null,
      modalData: null,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      openModal: (id, data) => set({ activeModal: id, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),
    }),
    {
      name: "ui-preferences",
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen, theme: state.theme }),
    }
  )
);
```

## Filters Store (Global Filters)

```typescript
// lib/stores/use-filters-store.ts
import { create } from "zustand";

interface FiltersState {
  dateRange: { from: string; to: string } | null;
  managerId: string | null;
  zoneId: string | null;
  searchQuery: string;
  // Actions
  setDateRange: (range: FiltersState["dateRange"]) => void;
  setManager: (id: string | null) => void;
  setZone: (id: string | null) => void;
  setSearch: (q: string) => void;
  clearAll: () => void;
  hasActiveFilters: () => boolean;
}

const INITIAL: Omit<FiltersState, "setDateRange" | "setManager" | "setZone" | "setSearch" | "clearAll" | "hasActiveFilters"> = {
  dateRange: null,
  managerId: null,
  zoneId: null,
  searchQuery: "",
};

export const useFiltersStore = create<FiltersState>()((set, get) => ({
  ...INITIAL,
  setDateRange: (dateRange) => set({ dateRange }),
  setManager: (managerId) => set({ managerId }),
  setZone: (zoneId) => set({ zoneId }),
  setSearch: (searchQuery) => set({ searchQuery }),
  clearAll: () => set(INITIAL),
  hasActiveFilters: () => {
    const s = get();
    return !!(s.dateRange || s.managerId || s.zoneId || s.searchQuery);
  },
}));
```

## Persist Middleware

Use `persist` only for state that should survive page refresh:

```typescript
// ✅ Persist: user preferences, theme, sidebar state
persist(storeConfig, { name: "key", partialize: (s) => ({ theme: s.theme }) })

// ❌ Don't persist: modal state, loading flags, temp form data
```

## Usage in Components

```tsx
"use client";
import { useAuthStore } from "@/lib/stores/use-auth-store";
import { useUIStore } from "@/lib/stores/use-ui-store";

function Header() {
  const profile = useAuthStore((s) => s.profile);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  // ✅ Select only what you need — prevents unnecessary rerenders
  // ❌ const store = useAuthStore(); // selects entire store
}
```

## Hydration Safety (SSR)

```typescript
// Prevent hydration mismatch with persisted stores
import { useEffect, useState } from "react";

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

// Usage
function ThemeToggle() {
  const hydrated = useHydrated();
  const theme = useUIStore((s) => s.theme);
  if (!hydrated) return <Skeleton className="w-8 h-8" />;
  return <button>{theme === "dark" ? "🌙" : "☀️"}</button>;
}
```

## Rules

- ONE store per domain — never a single giant store
- Select specific fields: `useStore(s => s.field)` — never `useStore()`
- Actions inside the store — never modify state from outside
- Use `persist` + `partialize` for preferences only
- Handle SSR hydration for persisted state
- Computed values as functions: `isAdmin: () => get().role === "admin"`
- No async logic inside stores — fetch in components, then `set()` the result
- Name stores with `use-` prefix for hook convention
