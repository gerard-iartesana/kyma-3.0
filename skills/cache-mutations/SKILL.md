# Cache & Mutations (SWR)

Patterns for client-side caching and optimistic mutations using SWR in Next.js + Supabase apps.

## Library: SWR

Lightweight, built by Vercel, pairs perfectly with Next.js. No Redux-like boilerplate.

```bash
npm install swr
```

## SWR Provider

```tsx
// app/providers.tsx
"use client";
import { SWRConfig } from "swr";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{
      revalidateOnFocus: false,      // Don't refetch on tab focus (internal tool)
      revalidateOnReconnect: true,
      dedupingInterval: 5000,        // Dedup identical requests within 5s
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }}>
      {children}
    </SWRConfig>
  );
}
```

## Supabase Fetcher

```typescript
// lib/swr/fetcher.ts
import { createClient } from "@/lib/supabase/client";

export function supabaseFetcher<T>(query: string) {
  return async (): Promise<T> => {
    const supabase = createClient();
    const [table, select, ...filters] = query.split("|");
    let q = supabase.from(table).select(select || "*");
    // Apply filters passed as "eq:field:value"
    for (const f of filters) {
      const [method, field, value] = f.split(":");
      if (method === "eq") q = q.eq(field, value);
      if (method === "order") q = q.order(field, { ascending: value !== "desc" });
    }
    const { data, error } = await q;
    if (error) throw error;
    return data as T;
  };
}
```

## Basic Data Fetching Hook

```typescript
// lib/swr/use-properties.ts
"use client";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";

interface Property {
  id: string;
  name: string;
  status: string;
  manager_id: string;
}

export function useProperties(managerId?: string) {
  const key = managerId ? `properties-${managerId}` : "properties-all";

  const { data, error, isLoading, mutate } = useSWR<Property[]>(key, async () => {
    const supabase = createClient();
    let query = supabase.from("properties").select("*, manager:profiles!manager_id(full_name)");
    if (managerId) query = query.eq("manager_id", managerId);
    const { data, error } = await query.order("name");
    if (error) throw error;
    return data;
  });

  return { properties: data ?? [], error, isLoading, mutate };
}
```

## Optimistic Updates

### Create (Optimistic Insert)
```typescript
async function createProperty(newData: Partial<Property>) {
  const optimistic: Property = {
    id: crypto.randomUUID(), // temp ID
    ...newData as Property,
  };

  await mutate(
    async (current) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("properties").insert(newData).select().single();
      if (error) throw error;
      return [...(current ?? []), data];
    },
    {
      optimisticData: (current) => [...(current ?? []), optimistic],
      rollbackOnError: true,
      revalidate: false,  // We already have the correct data
    }
  );
  toast.success("Propiedad creada");
}
```

### Update (Optimistic Patch)
```typescript
async function updateProperty(id: string, updates: Partial<Property>) {
  await mutate(
    async (current) => {
      const supabase = createClient();
      const { error } = await supabase.from("properties").update(updates).eq("id", id);
      if (error) throw error;
      return current?.map((p) => (p.id === id ? { ...p, ...updates } : p));
    },
    {
      optimisticData: (current) =>
        current?.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      rollbackOnError: true,
      revalidate: false,
    }
  );
  toast.success("Cambios guardados");
}
```

### Delete (Optimistic Remove)
```typescript
async function deleteProperty(id: string) {
  await mutate(
    async (current) => {
      const supabase = createClient();
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
      return current?.filter((p) => p.id !== id);
    },
    {
      optimisticData: (current) => current?.filter((p) => p.id !== id),
      rollbackOnError: true,
      revalidate: false,
    }
  );
  toast.success("Propiedad eliminada");
}
```

## Cross-Key Invalidation

When mutating one resource invalidates another:

```typescript
import { useSWRConfig } from "swr";

function useInvalidate() {
  const { mutate: globalMutate } = useSWRConfig();

  return {
    invalidateProperties: () => globalMutate((key) =>
      typeof key === "string" && key.startsWith("properties"), undefined, { revalidate: true }
    ),
    invalidateDashboard: () => globalMutate("dashboard-stats"),
    invalidateAll: () => globalMutate(() => true, undefined, { revalidate: true }),
  };
}
```

## Conditional & Dependent Fetching

```typescript
// Only fetch when managerId is available
const { data } = useSWR(managerId ? `tasks-${managerId}` : null, fetcher);

// Dependent: fetch tasks after properties load
const { data: properties } = useProperties();
const { data: tasks } = useSWR(
  properties ? `tasks-for-${properties.map(p => p.id).join(",")}` : null,
  () => fetchTasksForProperties(properties!.map(p => p.id))
);
```

## Stale-While-Revalidate Pattern

```
1. User loads page → show cached data instantly (stale)
2. SWR refetches in background (revalidate)
3. UI updates seamlessly if data changed
4. User sees no loading spinner on subsequent visits
```

## Rules

- Use SWR for client-side data that needs to stay fresh
- Server Components for initial page load data — SWR for mutations and updates
- Key naming: `{resource}-{filter}` (e.g. `properties-all`, `tasks-manager-123`)
- Always set `rollbackOnError: true` for optimistic updates
- Show toast on success, show toast + rollback on error
- Don't cache sensitive data (use `revalidateOnMount: true`)
- Use `null` key to conditionally skip fetching
- Invalidate related caches after cross-resource mutations
