# Global Search & Debounce

Patterns for debounced search across the app to avoid database saturation.

## useDebounce Hook

```typescript
// lib/hooks/use-debounce.ts
"use client";
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
```

## useDebouncedCallback Hook

For cases where you need a debounced function (not a debounced value):

```typescript
// lib/hooks/use-debounced-callback.ts
"use client";
import { useCallback, useRef } from "react";

export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delayMs = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delayMs);
  }, [callback, delayMs]) as T;
}
```

## Search Input Component

```tsx
// components/search-input.tsx
"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  delay?: number;
  initialValue?: string;
}

export function SearchInput({
  onSearch,
  placeholder = "Buscar...",
  delay = 300,
  initialValue = "",
}: SearchInputProps) {
  const [value, setValue] = useState(initialValue);
  const debounced = useDebounce(value, delay);

  // Trigger search when debounced value changes
  useEffect(() => {
    onSearch(debounced);
  }, [debounced, onSearch]);

  const clear = () => {
    setValue("");
    onSearch("");
  };

  return (
    <div className="search-input-wrap">
      <Search size={16} className="search-icon" aria-hidden="true" />
      <input
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="search-input"
        aria-label={placeholder}
      />
      {value && (
        <button onClick={clear} className="search-clear" aria-label="Limpiar búsqueda">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
```

## Server-Side Search (Supabase)

```typescript
// Debounced search with Supabase full-text or ILIKE
async function searchProperties(query: string) {
  const supabase = createClient();

  if (!query.trim()) {
    // Empty query = return all (or paginated default)
    return supabase.from("properties").select("*").order("name").limit(50);
  }

  // Option A: ILIKE (simple, works everywhere)
  return supabase
    .from("properties")
    .select("*")
    .or(`name.ilike.%${query}%,zone.ilike.%${query}%`)
    .order("name")
    .limit(50);

  // Option B: Full-text search (faster on large datasets)
  // Requires a tsvector column + GIN index
  // return supabase.from("properties").select("*").textSearch("search_vector", query);
}
```

## Full-Text Search Setup (Supabase)

```sql
-- For large datasets, add a search vector column + index
ALTER TABLE public.properties
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(zone, '') || ' ' || coalesce(address, ''))
  ) STORED;

CREATE INDEX idx_properties_search ON public.properties USING GIN (search_vector);
```

## URL-Synced Search

```typescript
// Sync search query with URL for shareable/bookmarkable results
import { useSearchParams, useRouter, usePathname } from "next/navigation";

function useUrlSearch() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = searchParams.get("q") ?? "";

  const setQuery = useCallback((q: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (q) sp.set("q", q);
    else sp.delete("q");
    sp.set("page", "1"); // Reset pagination on new search
    router.push(`${pathname}?${sp.toString()}`);
  }, [searchParams, router, pathname]);

  return { query, setQuery };
}
```

## CSS

```css
.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  max-width: 320px;
  width: 100%;
}
.search-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-muted);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 8px 36px 8px 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  background: var(--color-surface);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.search-input:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px hsl(var(--hue-brand) 55% 48% / 0.12);
  outline: none;
}
.search-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 4px;
  border-radius: 50%;
}
.search-clear:hover { color: var(--color-text); }
```

## Timing Guidelines

| Context | Delay | Why |
|---|---|---|
| Search input (filter list) | 300ms | Good balance: fast feel, fewer requests |
| Search input (API call) | 400–500ms | Gives user time to finish typing |
| Autocomplete suggestions | 200ms | Needs to feel instant |
| Resize/scroll handlers | 100–150ms | Performance optimization |

## Rules

- ALWAYS debounce search inputs — never query on every keystroke
- Default delay: 300ms for client-side, 400ms for server-side
- Show result count updating as user types: "X resultados"
- Clear button (X) visible when input has value
- Escape key clears search input
- Sync search to URL `?q=` param for shareable results
- Reset pagination to page 1 on new search
- Empty query returns default/all results — never an empty state
- For datasets > 10k rows, use full-text search with GIN index
- `type="search"` on input for native clear button on mobile
