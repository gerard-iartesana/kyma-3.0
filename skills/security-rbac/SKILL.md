# Security & Roles (RBAC)

Role-Based Access Control patterns for Next.js + Supabase applications.

## Role Hierarchy

```
admin       → Full access to everything
manager     → CRUD on assigned resources, read on others
operator    → Limited CRUD on assigned tasks/items
viewer      → Read-only access
```

## Supabase: Profiles Table

```sql
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'manager', 'operator', 'viewer')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read profiles (for display names, etc.)
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can modify profiles
CREATE POLICY "profiles_admin_modify" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

## Supabase: RLS by Role

```sql
-- Admin: full access
CREATE POLICY "admin_all" ON public.properties
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Manager: access assigned properties
CREATE POLICY "manager_own" ON public.properties
  FOR ALL USING (
    manager_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Viewer: read only
CREATE POLICY "viewer_select" ON public.properties
  FOR SELECT USING (auth.role() = 'authenticated');
```

## Next.js Middleware: Route Protection

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];
const ROLE_ROUTES: Record<string, string[]> = {
  "/admin": ["admin"],
  "/settings": ["admin"],
  "/properties/new": ["admin", "manager"],
};

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(/* cookies config */);

  const { data: { user } } = await supabase.auth.getUser();

  // Not authenticated → redirect to login
  if (!user && !PUBLIC_ROUTES.includes(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check role-based routes
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    for (const [route, roles] of Object.entries(ROLE_ROUTES)) {
      if (req.nextUrl.pathname.startsWith(route) && !roles.includes(profile?.role ?? "")) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
  }

  return res;
}
```

## React: Auth Context

```typescript
// lib/auth/context.tsx
"use client";
import { createContext, useContext } from "react";

interface AuthContext {
  user: User | null;
  profile: Profile | null;
  role: string;
  can: (action: Permission) => boolean;
}

const AuthCtx = createContext<AuthContext>(null!);
export const useAuth = () => useContext(AuthCtx);
```

## Permission Checks in Components

```tsx
// Helper hook
function usePermission() {
  const { role } = useAuth();

  return {
    canCreate: ["admin", "manager"].includes(role),
    canEdit: ["admin", "manager"].includes(role),
    canDelete: role === "admin",
    canExport: ["admin", "manager"].includes(role),
    canManageUsers: role === "admin",
    isAdmin: role === "admin",
  };
}

// Usage in component
function PropertyActions({ property }) {
  const { canEdit, canDelete } = usePermission();
  return (
    <>
      {canEdit && <button onClick={() => edit(property)}>Editar</button>}
      {canDelete && <button onClick={() => confirmDelete(property)}>Eliminar</button>}
    </>
  );
}
```

## Protected Route Wrapper

```tsx
function RequireRole({ roles, children, fallback }: {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { role } = useAuth();
  if (!roles.includes(role)) return fallback ?? null;
  return <>{children}</>;
}

// Usage
<RequireRole roles={["admin", "manager"]}>
  <AdminPanel />
</RequireRole>
```

## Rules

- ALWAYS enforce permissions at BOTH levels: Supabase RLS + Next.js middleware
- Never trust client-side role checks alone — they are for UI only
- RLS is the source of truth for data security
- Admin override: admins should pass all RLS policies
- Log permission-denied events for auditing
- Default to most restrictive: deny first, allow explicitly
- Never store role in JWT claims alone — always verify from profiles table
