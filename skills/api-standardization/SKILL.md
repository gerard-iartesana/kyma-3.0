# API Standardization

Standard patterns for API responses, data fetching, and backend communication in Next.js + Supabase projects.

## Response Format

Every API route MUST return this shape:

```typescript
// Success
interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// Error
interface ApiError {
  ok: false;
  error: {
    code: string;        // machine-readable: "VALIDATION_ERROR", "NOT_FOUND"
    message: string;     // human-readable (Spanish): "El email ya está registrado"
    details?: unknown;   // optional field-level errors or extra info
  };
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

### Helper Functions
```typescript
// lib/api/response.ts
export function success<T>(data: T, meta?: ApiSuccess<T>["meta"]): ApiSuccess<T> {
  return { ok: true, data, ...(meta && { meta }) };
}

export function error(code: string, message: string, details?: unknown): ApiError {
  return { ok: false, error: { code, message, ...(details && { details }) } };
}
```

### Usage in Route Handlers
```typescript
// app/api/properties/route.ts
import { success, error } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 20);

  const { data, count, error: dbError } = await supabase
    .from("properties")
    .select("*", { count: "exact" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (dbError) {
    return Response.json(error("DB_ERROR", "Error al cargar propiedades"), { status: 500 });
  }

  return Response.json(success(data, {
    page,
    pageSize,
    total: count ?? 0,
    hasMore: (count ?? 0) > page * pageSize,
  }));
}
```

## Error Codes

Use consistent codes across the app:

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Input data invalid |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Authenticated but no permission |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Duplicate / already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `DB_ERROR` | 500 | Database operation failed |
| `EXTERNAL_API_ERROR` | 502 | Third-party API failed |
| `UNKNOWN_ERROR` | 500 | Unexpected error |

## Client-Side Fetching

### Typed Fetch Wrapper
```typescript
// lib/api/client.ts
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
    return await res.json();
  } catch {
    return { ok: false, error: { code: "NETWORK_ERROR", message: "Error de conexión" } };
  }
}

// Usage:
const result = await apiFetch<Property[]>("/api/properties?page=1");
if (result.ok) {
  setProperties(result.data);
} else {
  toast.error(result.error.message);
}
```

### Direct Supabase Queries (Preferred)
When possible, skip API routes and query Supabase directly with RLS:

```typescript
// Server Component
const supabase = await createClient();
const { data, error } = await supabase
  .from("properties")
  .select("*, owner:owners(name, email)")
  .order("name");

// Client Component
const supabase = createClient();
const { data, error } = await supabase
  .from("properties")
  .select("*")
  .eq("manager_id", userId);
```

**Use API routes only when:**
- You need to call external APIs (Hostaway, Caspio, etc.)
- You need server-side logic beyond what RLS provides
- You need to aggregate data from multiple sources

## External API Integration Pattern

```typescript
// lib/api/external/hostaway.ts
const HOSTAWAY_BASE = process.env.HOSTAWAY_API_URL;
const HOSTAWAY_TOKEN = process.env.HOSTAWAY_API_TOKEN;

export async function hostawayFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${HOSTAWAY_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${HOSTAWAY_TOKEN}` },
    next: { revalidate: 300 }, // Cache 5 min
  });

  if (!res.ok) {
    throw new Error(`Hostaway API error: ${res.status}`);
  }

  const json = await res.json();
  return json.result as T;
}
```

## Pagination Convention

URL params: `?page=1&pageSize=20&sort=name&order=asc`

```typescript
interface PaginationParams {
  page: number;      // 1-based
  pageSize: number;  // default 20, max 100
  sort?: string;     // column name
  order?: "asc" | "desc";
}
```

## Rules

- Always return `{ ok, data }` or `{ ok, error }` — never raw data
- Error messages in Spanish, human-readable
- Error codes in English, UPPER_SNAKE_CASE
- Prefer direct Supabase queries over API routes when RLS suffices
- Always validate pagination params (clamp pageSize to 1–100)
- Cache external API responses when appropriate
- Never expose API keys in client-side code
- Log server-side errors with context (endpoint, params, user)
