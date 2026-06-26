-- KYMA DATABASE SCHEMA (FASE 2)

-- 1. ENUMS
create type public.tipo_elemento as enum ('evento', 'tarea', 'nota', 'interes', 'vinculo', 'reflexion');
create type public.origen_elemento as enum ('manual', 'kyma_sugerido', 'kyma_confirmado');
create type public.estado_elemento as enum ('activo', 'archivado');
create type public.tipo_tag as enum ('sistemico', 'tematico', 'handle', 'estado');

-- 2. TABLES

-- Profiles (linked to auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  pronombres text,
  preferencias jsonb default '{"theme": "dark", "export_prominence": "normal"}'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Elementos (unified table for all door items)
create table public.elementos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  tipo tipo_elemento not null,
  titulo text not null,
  cuerpo text,
  peso smallint default 1 check (peso >= 1 and peso <= 3),
  datos jsonb default '{}'::jsonb not null,
  origen origen_elemento default 'manual'::origen_elemento not null,
  estado estado_elemento default 'activo'::estado_elemento not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Tags
create table public.tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  nombre text not null,
  tipo tipo_tag default 'tematico'::tipo_tag not null,
  unique (user_id, nombre)
);

-- Elemento-Tags connection
create table public.elemento_tags (
  elemento_id uuid references public.elementos on delete cascade not null,
  tag_id uuid references public.tags on delete cascade not null,
  primary key (elemento_id, tag_id)
);

-- Mapa Análisis (Placeholder layer)
create table public.mapa_analisis (
  user_id uuid references public.profiles on delete cascade primary key,
  datos jsonb default '{}'::jsonb not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Conversación Buffer (Short-term context)
create table public.conversacion_buffer (
  user_id uuid references public.profiles on delete cascade primary key,
  mensajes jsonb default '[]'::jsonb not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. AUTOMATIC PROFILE CREATION TRIGGER
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, preferencias)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    '{"theme": "dark", "export_prominence": "normal"}'::jsonb
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. ACCOUNT DELETION HELPER (Right to be Forgotten)
create or replace function public.delete_user_account()
returns void as $$
begin
  -- Deleting from auth.users cascades to public.profiles and all other user-related tables
  delete from auth.users where id = auth.uid();
end;
$$ language plpgsql security definer;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.elementos enable row level security;
alter table public.tags enable row level security;
alter table public.elemento_tags enable row level security;
alter table public.mapa_analisis enable row level security;
alter table public.conversacion_buffer enable row level security;

-- Profiles Policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can delete own profile" on public.profiles
  for delete using (auth.uid() = id);

-- Elementos Policies
create policy "Users can view own elements" on public.elementos
  for select using (auth.uid() = user_id);

create policy "Users can insert own elements" on public.elementos
  for insert with check (auth.uid() = user_id);

create policy "Users can update own elements" on public.elementos
  for update using (auth.uid() = user_id);

create policy "Users can delete own elements" on public.elementos
  for delete using (auth.uid() = user_id);

-- Tags Policies
create policy "Users can view own tags" on public.tags
  for select using (auth.uid() = user_id);

create policy "Users can insert own tags" on public.tags
  for insert with check (auth.uid() = user_id);

create policy "Users can update own tags" on public.tags
  for update using (auth.uid() = user_id);

create policy "Users can delete own tags" on public.tags
  for delete using (auth.uid() = user_id);

-- Elemento-Tags Policies
create policy "Users can view own element_tags" on public.elemento_tags
  for select using (
    exists (
      select 1 from public.elementos
      where id = elemento_tags.elemento_id and user_id = auth.uid()
    )
  );

create policy "Users can insert own element_tags" on public.elemento_tags
  for insert with check (
    exists (
      select 1 from public.elementos
      where id = elemento_tags.elemento_id and user_id = auth.uid()
    )
    and
    exists (
      select 1 from public.tags
      where id = elemento_tags.tag_id and user_id = auth.uid()
    )
  );

-- Users can delete own element_tags connections
create policy "Users can delete own element_tags" on public.elemento_tags
  for delete using (
    exists (
      select 1 from public.elementos
      where id = elemento_tags.elemento_id and user_id = auth.uid()
    )
  );

-- Mapa Análisis Policies
create policy "Users can view own analysis" on public.mapa_analisis
  for select using (auth.uid() = user_id);

create policy "Users can manage own analysis" on public.mapa_analisis
  for all using (auth.uid() = user_id);

-- Conversación Buffer Policies
create policy "Users can view own convo buffer" on public.conversacion_buffer
  for select using (auth.uid() = user_id);

create policy "Users can manage own convo buffer" on public.conversacion_buffer
  for all using (auth.uid() = user_id);
