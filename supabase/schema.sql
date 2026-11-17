-- Cuentas · Fase 1
-- Estado completo de la app como un documento jsonb por usuario.
-- Ejecutar una vez en Supabase → SQL Editor. Es idempotente: se puede volver a correr.

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------
create table if not exists public.app_state (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  -- Copia de data->>'t' (ms desde 1970): marca de la última modificación hecha
  -- en el cliente. Se usa para "gana el más nuevo".
  t          bigint      not null default 0,
  updated_at timestamptz not null default now(),
  constraint app_state_data_is_object check (jsonb_typeof(data) = 'object')
);

comment on table public.app_state is 'Estado completo de Cuentas (mismo JSON que el respaldo), uno por usuario.';

-- ---------------------------------------------------------------------------
-- Seguridad: solo el dueño ve y toca su fila
-- ---------------------------------------------------------------------------
alter table public.app_state enable row level security;
alter table public.app_state force row level security;

revoke all on public.app_state from anon;
revoke all on public.app_state from public;
grant select, insert, update, delete on public.app_state to authenticated;

drop policy if exists "app_state: leer la propia"     on public.app_state;
drop policy if exists "app_state: crear la propia"    on public.app_state;
drop policy if exists "app_state: editar la propia"   on public.app_state;
drop policy if exists "app_state: borrar la propia"   on public.app_state;

create policy "app_state: leer la propia" on public.app_state
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "app_state: crear la propia" on public.app_state
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "app_state: editar la propia" on public.app_state
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "app_state: borrar la propia" on public.app_state
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Guardado atómico con "gana el más nuevo"
-- ---------------------------------------------------------------------------
-- El cliente llama a rpc('save_state', { p_data }). Si en la nube ya hay una
-- versión con t mayor (guardada desde otro dispositivo), NO se pisa: la función
-- devuelve la versión de la nube para que el cliente la adopte.
-- Corre con los permisos de quien llama (security invoker), así que RLS aplica.
create or replace function public.save_state(p_data jsonb)
returns table (data jsonb, t bigint, applied boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_t   bigint;
begin
  if v_uid is null then
    raise exception 'No hay sesión' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'El estado tiene que ser un objeto JSON' using errcode = '22023';
  end if;

  v_t := coalesce((p_data ->> 't')::numeric, 0)::bigint;

  insert into public.app_state as s (user_id, data, t, updated_at)
  values (v_uid, p_data, v_t, now())
  on conflict (user_id) do update
    set data = excluded.data, t = excluded.t, updated_at = now()
    where s.t < excluded.t;

  return query
    select s.data, s.t, (s.t = v_t and s.data = p_data)
    from public.app_state s
    where s.user_id = v_uid;
end;
$$;

revoke all on function public.save_state(jsonb) from public, anon;
grant execute on function public.save_state(jsonb) to authenticated;
