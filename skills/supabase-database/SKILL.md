# Supabase Database Management

Skill for managing Supabase PostgreSQL databases: migrations, RLS policies, storage, and Edge Functions.

## Migration System

### File Naming Convention
```
migration_NNN_descriptive_name.sql
```
- `NNN`: Zero-padded sequential number (001, 002, ..., 022, 023)
- Always check the latest migration number in the project before creating a new one
- NEVER modify existing migration files — always create new ones

### Migration File Structure
```sql
-- migration_023_description.sql
-- Description: Brief explanation of what this migration does

-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.table_name (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- columns...
);

-- 2. Enable RLS
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
CREATE POLICY "policy_name" ON public.table_name
  FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Grant permissions
GRANT ALL ON public.table_name TO authenticated;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_table_column ON public.table_name(column);
```

### Running Migrations
- Use Node.js scripts with `@supabase/supabase-js` to execute migrations
- Store migration runner scripts in `scripts/` or project root
- Always test migrations on a staging environment first

## RLS Policy Patterns

### Common Policies
```sql
-- Authenticated users can read all
CREATE POLICY "select_authenticated" ON public.table_name
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only modify their own records
CREATE POLICY "modify_own" ON public.table_name
  FOR ALL USING (auth.uid() = user_id);

-- Role-based access (using profiles table)
CREATE POLICY "admin_only" ON public.table_name
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### RLS Debugging
- If a query returns empty but data exists → check RLS policies
- Use `service_role` key temporarily for debugging (never in production)
- Check the `profiles` table for user roles/permissions
- Test with: `SELECT * FROM table_name;` using different user sessions

## Supabase Storage

### File Upload Pattern
```typescript
const { data, error } = await supabase.storage
  .from('bucket-name')
  .upload(`folder/${fileName}`, file, {
    cacheControl: '3600',
    upsert: false
  });
```

### Storage Policies
- Create bucket-level policies similar to table RLS
- Use authenticated uploads with proper path rules
- Set appropriate MIME type restrictions

## Common Queries

### Joins
```typescript
const { data } = await supabase
  .from('properties')
  .select(`
    *,
    owner:owners(*),
    manager:profiles!manager_id(*)
  `)
  .order('name');
```

### Upsert
```typescript
const { data, error } = await supabase
  .from('table')
  .upsert(record, { onConflict: 'unique_column' });
```

### Realtime
```typescript
const channel = supabase
  .channel('changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'table_name'
  }, (payload) => {
    // handle change
  })
  .subscribe();
```

## Views

- Use PostgreSQL views for complex reports/dashboards
- When modifying views, use `CREATE OR REPLACE VIEW`
- Document view dependencies in migration comments

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-only, never expose
```

## Don'ts

- ❌ Never expose the service_role key in client-side code
- ❌ Never modify existing migration files
- ❌ Never disable RLS on production tables
- ❌ Never use raw SQL in client components — use the Supabase JS client
- ❌ Never store sensitive data without encryption
- ❌ Never create tables without RLS policies
