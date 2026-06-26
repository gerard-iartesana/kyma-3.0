# Audit Logs

Structure and logic for tracking "who did what and when" in Supabase-backed internal tools.

## Database Schema

```sql
-- migration_NNN_audit_logs.sql
CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Who
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  user_name text,

  -- What
  action text NOT NULL CHECK (action IN (
    'create', 'update', 'delete', 'login', 'logout',
    'export', 'import', 'assign', 'status_change'
  )),
  resource_type text NOT NULL,     -- 'property', 'task', 'inventory', etc.
  resource_id text,                -- UUID or identifier of the affected record
  resource_name text,              -- Human-readable name for display

  -- Details
  changes jsonb,                   -- { field: { old: x, new: y } }
  metadata jsonb,                  -- Extra context (IP, user-agent, etc.)

  -- Search
  description text                 -- Human-readable: "María actualizó el estado de Villa Aurora a 'activa'"
);

-- Index for common queries
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_user ON public.audit_logs(user_id);

-- RLS: only admins can read audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Everyone can insert (for logging their own actions)
CREATE POLICY "authenticated_insert_audit" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;
```

## Logger Utility

```typescript
// lib/audit/logger.ts
import { createClient } from "@/lib/supabase/client";

interface AuditEntry {
  action: string;
  resource_type: string;
  resource_id?: string;
  resource_name?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
  description?: string;
}

export async function logAudit(entry: AuditEntry) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from("audit_logs").insert({
    user_id: user?.id,
    user_email: user?.email,
    ...entry,
  });
}

// Diff helper: compare old and new objects, return only changed fields
export function diffChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  fields: string[]
): Record<string, { old: unknown; new: unknown }> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const f of fields) {
    if (JSON.stringify(oldData[f]) !== JSON.stringify(newData[f])) {
      changes[f] = { old: oldData[f], new: newData[f] };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}
```

## Usage Examples

```typescript
// On create
await logAudit({
  action: "create",
  resource_type: "property",
  resource_id: newProperty.id,
  resource_name: newProperty.name,
  description: `Creada nueva propiedad "${newProperty.name}"`,
});

// On update (with diff)
const changes = diffChanges(oldData, newData, ["name", "status", "manager_id"]);
if (changes) {
  await logAudit({
    action: "update",
    resource_type: "property",
    resource_id: property.id,
    resource_name: property.name,
    changes,
    description: `Actualizada propiedad "${property.name}"`,
  });
}

// On delete
await logAudit({
  action: "delete",
  resource_type: "task",
  resource_id: task.id,
  resource_name: task.title,
  description: `Eliminada tarea "${task.title}"`,
});

// On export
await logAudit({
  action: "export",
  resource_type: "inventory",
  metadata: { format: "xlsx", filters: currentFilters, count: data.length },
  description: `Exportado inventario (${data.length} registros)`,
});
```

## Audit Log Viewer (Admin)

```tsx
// app/admin/audit/page.tsx — server component
export default async function AuditPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  // Render table with: Fecha, Usuario, Acción, Recurso, Descripción
  // Expandable row to show `changes` JSON diff
}
```

## What to Log

| Always log | Don't log |
|---|---|
| Create/update/delete of entities | Read/list operations |
| Status changes | Filter/search queries |
| Permission changes (role updates) | UI interactions (clicks, opens) |
| Data exports | Page views |
| Bulk imports | Failed validation (not an action) |
| Login/logout | |

## Rules

- Log AFTER the action succeeds — never log failed attempts as completed
- Audit logging must never block the main operation — fire and forget
- Include human-readable `description` for quick scanning
- Use `changes` JSON diff for updates — shows exactly what changed
- Only admins can view audit logs
- Retain logs for minimum 1 year
- Index `created_at`, `resource_type`, and `user_id` for fast queries
