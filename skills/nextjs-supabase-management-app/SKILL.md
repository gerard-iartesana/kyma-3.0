# Next.js + Supabase Internal Management App

Skill for building and maintaining internal management applications (dashboards, admin panels, CRUD tools) using our established stack.

## Stack & Versions

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: TailwindCSS 3.4 + shadcn/ui (Radix primitives + CVA + clsx + tailwind-merge)
- **Icons**: Lucide React
- **State**: Zustand 4.5
- **Database**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Auth**: @supabase/ssr for SSR cookie-based auth
- **PWA**: next-pwa (for mobile-first apps)
- **Export**: xlsx for Excel exports

## Project Structure

```
app/
  layout.tsx          # Root layout with Supabase provider
  page.tsx            # Home/dashboard
  admin/              # Admin routes
    [resource]/       # Dynamic resource pages
      page.tsx        # List view
      [id]/           # Detail/edit views
        page.tsx
components/
  ui/                 # shadcn/ui primitives (Button, Select, Accordion, etc.)
  [feature]/          # Feature-specific components
lib/
  supabase/
    client.ts         # Browser Supabase client
    server.ts         # Server Supabase client (cookies)
    middleware.ts      # Auth middleware
  utils.ts            # cn() helper and shared utilities
middleware.ts          # Next.js middleware for auth
```

## Coding Conventions

### Components
- Use `"use client"` directive only when the component needs client-side interactivity
- Prefer Server Components for data fetching
- Use shadcn/ui components from `@/components/ui/` — never install new UI libraries without asking
- Always use the `cn()` utility from `@/lib/utils` for conditional classes:
  ```tsx
  import { cn } from "@/lib/utils"
  className={cn("base-class", condition && "conditional-class")}
  ```

### Supabase
- **Browser client**: `import { createClient } from '@/lib/supabase/client'`
- **Server client**: `import { createClient } from '@/lib/supabase/server'`
- Always handle Supabase errors explicitly — never silently ignore them
- Use RLS policies for security; never bypass RLS in production code
- For new tables or schema changes, create numbered migration files: `migration_NNN_description.sql`
- Keep migration files at the project root

### Naming & Style
- Spanish for user-facing text (labels, placeholders, toasts, etc.)
- English for code (variables, functions, file names, comments)
- File names: kebab-case for pages, PascalCase for components
- Use `interface` over `type` for object shapes
- Always add `"use client"` at the very top of client components, before any imports

### Data Patterns
- Use Zustand stores for complex client-side state (filters, selections, temp data)
- For simple server data, use Next.js server components + Supabase queries directly
- Always provide loading states (skeleton or spinner) for async operations
- Use optimistic updates when appropriate for better UX

## Mobile-First Rules

These apps are frequently used on tablets and phones by field workers:

1. Always design mobile-first, then enhance for desktop
2. Touch targets must be at least 44px × 44px
3. Use responsive padding: `p-3 sm:p-4 lg:p-6`
4. Bottom-anchored action buttons for mobile forms
5. Prefer bottom sheets or full-screen modals on mobile over small centered modals
6. Test that all interactive elements are reachable with one thumb

## Common Patterns

### CRUD Page Pattern
```tsx
// List page with filters, search, and responsive table/cards
// Desktop: table layout
// Mobile: card layout with swipe actions or icon buttons
```

### Form Pattern
```tsx
// Always validate before submit
// Show loading state on submit button
// Use toast notifications for success/error (never alert())
// Redirect or update UI after successful operation
```

### Export Pattern
```tsx
// Use xlsx library for Excel exports
// Generate filename with date: `export_${resource}_${date}.xlsx`
// Always include relevant filters in export
```

## Deployment

- Deploy to Firebase Hosting
- Build command: `next build`
- Use `.env.local` for Supabase keys (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
- Never commit `.env.local` to git

## Don'ts

- ❌ Don't install new major dependencies without asking
- ❌ Don't use `any` type — use proper TypeScript types
- ❌ Don't create API routes when a direct Supabase query (with RLS) suffices
- ❌ Don't use `alert()` or `confirm()` — use proper UI components
- ❌ Don't add test/debug scripts to the project root (use `scripts/` directory)
- ❌ Don't modify existing migration files — create new ones
