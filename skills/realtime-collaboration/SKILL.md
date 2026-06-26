# Realtime & Collaboration

Patterns for live data updates and multi-user collaboration using Supabase Realtime.

## Supabase Realtime: Database Changes

### Listen to Table Changes
```typescript
// lib/hooks/use-realtime.ts
"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Event = "INSERT" | "UPDATE" | "DELETE" | "*";

interface UseRealtimeOptions<T> {
  table: string;
  event?: Event;
  filter?: string;           // "manager_id=eq.uuid-123"
  onInsert?: (record: T) => void;
  onUpdate?: (record: T, old: Partial<T>) => void;
  onDelete?: (old: Partial<T>) => void;
  enabled?: boolean;
}

export function useRealtime<T extends Record<string, unknown>>({
  table, event = "*", filter, onInsert, onUpdate, onDelete, enabled = true,
}: UseRealtimeOptions<T>) {
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`realtime-${table}`)
      .on("postgres_changes",
        { event, schema: "public", table, ...(filter && { filter }) },
        (payload) => {
          if (payload.eventType === "INSERT") onInsert?.(payload.new as T);
          if (payload.eventType === "UPDATE") onUpdate?.(payload.new as T, payload.old as Partial<T>);
          if (payload.eventType === "DELETE") onDelete?.(payload.old as Partial<T>);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table, event, filter, enabled]);
}
```

### Usage: Auto-Update List
```tsx
function PropertiesList() {
  const { properties, mutate } = useProperties();

  useRealtime<Property>({
    table: "properties",
    onInsert: (newProp) => mutate((prev) => [...(prev ?? []), newProp], false),
    onUpdate: (updated) => mutate(
      (prev) => prev?.map((p) => (p.id === updated.id ? updated : p)), false
    ),
    onDelete: (old) => mutate(
      (prev) => prev?.filter((p) => p.id !== old.id), false
    ),
  });

  return <>{/* render properties */}</>;
}
```

## Presence: Who's Online

```typescript
// lib/hooks/use-presence.ts
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PresenceUser {
  userId: string;
  name: string;
  avatar?: string;
  currentPage?: string;
  lastSeen: string;
}

export function usePresence(roomId: string, currentUser: PresenceUser) {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence-${roomId}`);

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const online = Object.values(state).flat();
        setUsers(online.filter((u) => u.userId !== currentUser.userId));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(currentUser);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [roomId, currentUser.userId]);

  return users;
}
```

### Presence UI: Online Avatars
```tsx
function OnlineUsers({ roomId }: { roomId: string }) {
  const { profile } = useAuthStore();
  const users = usePresence(roomId, {
    userId: profile!.id,
    name: profile!.full_name,
    currentPage: window.location.pathname,
    lastSeen: new Date().toISOString(),
  });

  if (users.length === 0) return null;

  return (
    <div className="online-users" aria-label="Usuarios conectados">
      {users.map((u) => (
        <div key={u.userId} className="avatar-badge" title={`${u.name} está en línea`}>
          {u.name.charAt(0).toUpperCase()}
        </div>
      ))}
      <span className="online-count">{users.length} en línea</span>
    </div>
  );
}
```

## Live Editing Indicators

```typescript
// Show "Carlos está editando..." on a specific record
export function useEditingPresence(resourceType: string, resourceId: string) {
  const { profile } = useAuthStore();
  const roomId = `editing-${resourceType}-${resourceId}`;

  const editors = usePresence(roomId, {
    userId: profile!.id,
    name: profile!.full_name,
    lastSeen: new Date().toISOString(),
  });

  return {
    otherEditors: editors,
    isBeingEdited: editors.length > 0,
    editingMessage: editors.length > 0
      ? `${editors.map((e) => e.name).join(", ")} ${editors.length === 1 ? "está" : "están"} editando`
      : null,
  };
}
```

```tsx
// Usage in a form
function PropertyForm({ propertyId }: { propertyId: string }) {
  const { otherEditors, editingMessage } = useEditingPresence("property", propertyId);

  return (
    <div>
      {editingMessage && (
        <div className="editing-banner" role="status">
          <UsersIcon size={14} />
          {editingMessage}
        </div>
      )}
      <form>{/* ... */}</form>
    </div>
  );
}
```

## Live Notifications

```typescript
// Listen for events directed at the current user
export function useUserNotifications(userId: string) {
  useRealtime<Notification>({
    table: "notifications",
    event: "INSERT",
    filter: `recipient_id=eq.${userId}`,
    onInsert: (notification) => {
      toast.info(notification.message);
      // Update notification badge count
    },
  });
}
```

## CSS

```css
.online-users {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.avatar-badge {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--color-primary-100);
  color: var(--color-primary-700);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600;
  border: 2px solid white;
  margin-left: -8px;
}
.avatar-badge:first-child { margin-left: 0; }
.online-count {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-left: var(--space-2);
}
.editing-banner {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: hsl(38 92% 50% / 0.1);
  border: 1px solid hsl(38 92% 50% / 0.25);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: hsl(38 50% 30%);
  margin-bottom: var(--space-4);
}
```

## Supabase Setup

```sql
-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE properties;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

## Rules

- Enable Realtime only on tables that need it — not everything
- Always clean up channels on component unmount (`removeChannel`)
- Use filters to limit events to relevant records
- Presence rooms scoped by resource: `editing-property-{id}`
- Merge Realtime events with SWR cache via `mutate(fn, false)`
- Show editing indicators as non-blocking banners — never lock the form
- Fire-and-forget for presence tracking — don't block UI
- Maximum channel subscriptions: keep under 10 per user session
