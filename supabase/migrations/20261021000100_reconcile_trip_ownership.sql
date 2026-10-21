-- Reconcile the deployed trips schema with the authenticated application.
-- Existing trips retain a NULL owner; no historical ownership is inferred.
alter table public.trips
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists trips_user_id_created_at_idx
  on public.trips (user_id, created_at desc);

alter table public.trips enable row level security;
alter table public.itineraries enable row level security;

-- Policies combine with OR, so remove prior policies before reinstating the
-- owner-only rules used by the application.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('trips', 'itineraries')
  loop
    execute format('drop policy %I on %I.%I', existing_policy.policyname,
      existing_policy.schemaname, existing_policy.tablename);
  end loop;
end
$$;

create policy trips_owner_select
  on public.trips for select to authenticated
  using (user_id = (select auth.uid()));

create policy trips_owner_insert
  on public.trips for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy trips_owner_delete
  on public.trips for delete to authenticated
  using (user_id = (select auth.uid()));

create policy itineraries_owner_select
  on public.itineraries for select to authenticated
  using (exists (
    select 1 from public.trips
    where trips.id = itineraries.trip_id
      and trips.user_id = (select auth.uid())
  ));

create policy itineraries_owner_insert
  on public.itineraries for insert to authenticated
  with check (exists (
    select 1 from public.trips
    where trips.id = itineraries.trip_id
      and trips.user_id = (select auth.uid())
  ));

create policy itineraries_owner_delete
  on public.itineraries for delete to authenticated
  using (exists (
    select 1 from public.trips
    where trips.id = itineraries.trip_id
      and trips.user_id = (select auth.uid())
  ));

-- Refresh PostgREST's schema cache when this migration is applied manually.
notify pgrst, 'reload schema';