-- FitForge Database Schema (Supabase Postgres + RLS)
create extension if not exists "uuid-ossp";

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text, weight_kg numeric, height_cm numeric, goal text,
  wake_time time default '04:30', sleep_time time default '22:00',
  city text, lat double precision, lng double precision,
  prayer_method int default 20, created_at timestamptz default now()
);

create table workouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  day_key text not null, mode text check (mode in ('gym','home')) default 'home',
  started_at timestamptz default now(), finished_at timestamptz,
  total_volume numeric default 0, total_reps int default 0
);

create table workout_sets (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references workouts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  exercise_id text not null, set_index int not null,
  reps int, weight_kg numeric, duration_sec int, created_at timestamptz default now()
);

create table run_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null, duration_sec int, distance_m numeric,
  avg_pace_sec_km numeric, elevation_gain_m numeric, calories_kcal numeric,
  polyline jsonb, splits jsonb, created_at timestamptz default now()
);

create table nutrition_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  meal_type text check (meal_type in ('breakfast','lunch','dinner','snack')),
  food_name text, portion_estimate text, calories_kcal numeric,
  protein_g numeric, carbs_g numeric, fat_g numeric, fiber_g numeric,
  health_score int, tips text, image_path text, logged_at timestamptz default now()
);

create table daily_habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null, water_ml int default 0, steps int default 0, sleep_hours numeric,
  rules jsonb default '{"protein":false,"water":false,"sleep":false,"overload":false,"steps":false}',
  prayers jsonb default '{"subuh":false,"dzuhur":false,"ashar":false,"maghrib":false,"isya":false}',
  unique (user_id, day)
);

create table user_schedules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade unique,
  wake_alarm_enabled boolean default false, wake_alarm_time time,
  prayer_toggles jsonb default '{"subuh":true,"dzuhur":true,"ashar":true,"maghrib":true,"isya":true}',
  hydration_enabled boolean default true, hydration_interval_min int default 60,
  quiet_start time, quiet_end time
);

create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text unique not null, p256dh text not null, auth text not null,
  created_at timestamptz default now()
);

-- RLS: aktifkan di semua tabel + policy "owner only"
do $$ declare t text; begin
  foreach t in array array['workouts','workout_sets','run_sessions','nutrition_logs','daily_habits','user_schedules','push_subscriptions']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "%1$s_owner" on %1$I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
alter table profiles enable row level security;
create policy "profiles_owner" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create index on run_sessions (user_id, started_at desc);
create index on nutrition_logs (user_id, logged_at desc);
create index on workouts (user_id, started_at desc);
