-- Q-ADR operational schema (Supabase / Postgres 15).
-- Mirrors frontend/disfront/src/store/types.ts. Positions are stored as lng/lat
-- doubles to keep the client simple; add PostGIS geography columns when needed.
-- Apply: supabase db push   (or paste into the SQL editor)

create extension if not exists "pgcrypto";

create type unit_status     as enum ('available','staging','en_route','on_scene','offline');
create type incident_status as enum ('open','assigned','on_scene','resolved');
create type report_decision as enum ('opened','merged','held');
create type approval_status as enum ('pending','approved','declined');
create type approval_kind   as enum ('outside_team','over_capacity');
create type app_role        as enum ('citizen','field','command','admin');

-- who is who --------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  role        app_role not null default 'citizen',
  unit_id     text,                       -- set for field crews
  phone       text,
  created_at  timestamptz not null default now()
);

-- an event is one disaster (e.g. "Krishna flood Sep 2026") ---------------
create table events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  region      text not null default 'NTR + Krishna, Andhra Pradesh',
  started_at  timestamptz not null default now(),
  closed_at   timestamptz,
  scenario    text not null default 't0'  -- current QAOA scenario id
);

create table units (
  id            text primary key,         -- e.g. 'ndrf-boat-1'
  event_id      uuid references events on delete cascade,
  label         text not null,
  agency        text not null,
  capabilities  text[] not null default '{}',
  speed_kmh     real not null,
  home_lng      double precision not null,
  home_lat      double precision not null,
  lng           double precision not null,
  lat           double precision not null,
  crew          text,
  status        unit_status not null default 'available',
  task          jsonb,                    -- Task (path, steps, eta, engine, reason)
  outside_district boolean not null default false,
  updated_at    timestamptz not null default now()
);

create table incidents (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events on delete cascade,
  title       text not null,
  category    text not null,
  severity    smallint not null check (severity between 1 and 5),
  people      integer not null default 1,
  lng         double precision not null,
  lat         double precision not null,
  place       text,
  status      incident_status not null default 'open',
  trust       real not null,
  unit_ids    text[] not null default '{}',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events on delete cascade,
  source      text not null,              -- citizen | field | official | social | sensor
  category    text not null,
  people      integer not null default 1,
  lng         double precision not null,
  lat         double precision not null,
  place       text,
  body        text,
  photo_path  text,                       -- storage bucket 'report-photos'
  reporter    uuid references auth.users,
  reporter_key text,                      -- anonymous device key when not signed in
  trust       real not null,
  trust_parts jsonb not null,             -- TrustParts
  decision    report_decision not null,
  incident_id uuid references incidents on delete set null,
  corroborators integer not null default 0,
  created_at  timestamptz not null default now()
);

create table shelters (
  id          text primary key,
  event_id    uuid references events on delete cascade,
  name        text not null,
  lng         double precision not null,
  lat         double precision not null,
  capacity    integer not null,
  occupancy   integer not null default 0,
  overflow_approved boolean not null default false
);

create table closures (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events on delete cascade,
  lng         double precision not null,
  lat         double precision not null,
  reason      text not null,
  reported_by text not null,
  created_at  timestamptz not null default now(),
  cleared_at  timestamptz
);

create table approvals (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events on delete cascade,
  kind        approval_kind not null,
  title       text not null,
  detail      text,
  rule_id     text not null,
  rule_text   text not null,
  ref_id      text not null,
  status      approval_status not null default 'pending',
  decided_by  uuid references auth.users,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table alerts (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events on delete cascade,
  title       text not null,
  body        text not null,
  area        text not null,
  channels    text[] not null,
  lang        text not null default 'both',
  sent_by     uuid references auth.users,
  created_at  timestamptz not null default now()
);

-- QAOA staging plans (one row per solve) ----------------------------------
create table plans (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events on delete cascade,
  scenario    text not null,
  method      text not null,              -- uniform | greedy | exact | qaoa_sim | qaoa_ibm
  k           smallint not null,
  selection   smallint[] not null,
  coverage    real not null,
  ratio       real,
  result      jsonb not null,             -- full SolveResult incl. regions + params
  created_at  timestamptz not null default now()
);

-- append-only audit log (the after-action timeline) -----------------------
create table event_log (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references events on delete cascade,
  kind        text not null,
  body        text not null,
  cause       text,
  actor       uuid references auth.users,
  created_at  timestamptz not null default now()
);
create or replace function forbid_change() returns trigger language plpgsql as $$
begin raise exception 'event_log is append-only'; end $$;
create trigger event_log_append_only before update or delete on event_log
  for each row execute function forbid_change();

create index on incidents (event_id, status);
create index on reports (event_id, created_at desc);
create index on reports (reporter_key, created_at desc);
create index on approvals (event_id, status);
create index on event_log (event_id, created_at);

-- row level security ------------------------------------------------------
create or replace function my_role() returns app_role language sql stable security definer set search_path = public as
  $$ select coalesce((select role from profiles where id = auth.uid()), 'citizen') $$;

alter table profiles  enable row level security;
alter table events    enable row level security;
alter table units     enable row level security;
alter table incidents enable row level security;
alter table reports   enable row level security;
alter table shelters  enable row level security;
alter table closures  enable row level security;
alter table approvals enable row level security;
alter table alerts    enable row level security;
alter table plans     enable row level security;
alter table event_log enable row level security;

-- public, read-only information for the citizen app
create policy "read events"    on events    for select using (true);
create policy "read shelters"  on shelters  for select using (true);
create policy "read closures"  on closures  for select using (true);
create policy "read alerts"    on alerts    for select using (true);
create policy "read incidents" on incidents for select using (true);
create policy "read units"     on units     for select using (my_role() in ('field','command','admin'));
create policy "read plans"     on plans     for select using (true);

-- profiles: see and edit yourself; command sees all
create policy "own profile"    on profiles for select using (id = auth.uid() or my_role() in ('command','admin'));
create policy "edit own"       on profiles for update using (id = auth.uid()) with check (role = (select role from profiles where id = auth.uid()));

-- reports: anyone may file (the FastAPI backend scores trust with the service key);
-- a reporter sees their own, staff see all
create policy "see own reports" on reports for select using (reporter = auth.uid() or my_role() in ('field','command','admin'));

-- field crews update their own unit; command updates anything operational
create policy "crew updates unit" on units for update using (my_role() = 'field' and id = (select unit_id from profiles where id = auth.uid()));
create policy "command units"     on units     for all using (my_role() in ('command','admin'));
create policy "command incidents" on incidents for all using (my_role() in ('command','admin'));
create policy "command shelters"  on shelters  for all using (my_role() in ('command','admin'));
create policy "staff closures"    on closures  for insert with check (my_role() in ('field','command','admin'));
create policy "command approvals" on approvals for all using (my_role() in ('command','admin'));
create policy "command alerts"    on alerts    for insert with check (my_role() in ('command','admin'));
create policy "staff log read"    on event_log for select using (my_role() in ('field','command','admin'));

-- realtime for the live map
alter publication supabase_realtime add table units, incidents, closures, approvals, alerts, shelters;

-- photos: private bucket, backend writes with the service key
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', false)
  on conflict do nothing;
