begin;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_state_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_data jsonb not null default 'null'::jsonb,
  introduced_words jsonb not null default '[]'::jsonb,
  learning_day_counter integer not null default 0,
  word_list_sort text not null default 'mastery',
  data_version integer not null default 0,
  extra_state jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sense_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  sense_key text not null,
  progress_data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, sense_key)
);

create table if not exists public.daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  activity_data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create table if not exists public.study_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_id text not null,
  window_data jsonb not null,
  sort_order integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, window_id)
);

create index if not exists sense_progress_user_id_idx
  on public.sense_progress (user_id);
create index if not exists daily_activity_user_date_idx
  on public.daily_activity (user_id, activity_date);
create index if not exists study_windows_user_order_idx
  on public.study_windows (user_id, sort_order);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.user_state_meta enable row level security;
alter table public.sense_progress enable row level security;
alter table public.daily_activity enable row level security;
alter table public.study_windows enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using ((select auth.uid()) = user_id);

drop policy if exists "plans_own_rows" on public.plans;
create policy "plans_own_rows" on public.plans
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_state_meta_own_rows" on public.user_state_meta;
create policy "user_state_meta_own_rows" on public.user_state_meta
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "sense_progress_own_rows" on public.sense_progress;
create policy "sense_progress_own_rows" on public.sense_progress
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_activity_own_rows" on public.daily_activity;
create policy "daily_activity_own_rows" on public.daily_activity
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "study_windows_own_rows" on public.study_windows;
create policy "study_windows_own_rows" on public.study_windows
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do update
  set email = excluded.email,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (user_id, email)
select id, email
from auth.users
on conflict (user_id) do update
set email = excluded.email,
    updated_at = now();

create or replace function public.load_user_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_meta public.user_state_meta%rowtype;
  v_plan jsonb;
  v_progress jsonb;
  v_activity jsonb;
  v_windows jsonb;
  v_state jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_meta
  from public.user_state_meta
  where user_id = v_user_id;

  if not found then
    return jsonb_build_object(
      'found', false,
      'revision', 0,
      'updatedAt', null,
      'state', null
    );
  end if;

  select plan_data
  into v_plan
  from public.plans
  where user_id = v_user_id;

  select coalesce(jsonb_object_agg(sense_key, progress_data), '{}'::jsonb)
  into v_progress
  from public.sense_progress
  where user_id = v_user_id;

  select coalesce(
    jsonb_object_agg(to_char(activity_date, 'YYYY-MM-DD'), activity_data),
    '{}'::jsonb
  )
  into v_activity
  from public.daily_activity
  where user_id = v_user_id;

  select coalesce(
    jsonb_agg(window_data order by sort_order),
    '[]'::jsonb
  )
  into v_windows
  from public.study_windows
  where user_id = v_user_id;

  v_state := coalesce(v_meta.extra_state, '{}'::jsonb) || jsonb_build_object(
    'view', 'home',
    'plan', v_plan,
    'session', v_meta.session_data,
    'introducedWords', v_meta.introduced_words,
    'progress', v_progress,
    'activityLog', v_activity,
    'studyWindows', v_windows,
    'learningDayCounter', v_meta.learning_day_counter,
    'wordListSort', v_meta.word_list_sort,
    'wordBrowse', null,
    'dataVersion', v_meta.data_version
  );

  return jsonb_build_object(
    'found', true,
    'revision', v_meta.revision,
    'updatedAt', v_meta.updated_at,
    'state', v_state
  );
end;
$$;

create or replace function public.save_user_state(
  p_state jsonb,
  p_expected_revision bigint default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_next_revision bigint;
  v_updated_at timestamptz := clock_timestamp();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'State must be a JSON object' using errcode = '22023';
  end if;

  insert into public.profiles (user_id, email)
  select v_user_id, email
  from auth.users
  where id = v_user_id
  on conflict (user_id) do update
  set email = excluded.email,
      updated_at = v_updated_at;

  insert into public.user_state_meta (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select revision
  into v_current_revision
  from public.user_state_meta
  where user_id = v_user_id
  for update;

  if not p_force
    and p_expected_revision is not null
    and p_expected_revision <> v_current_revision then
    return jsonb_build_object(
      'ok', false,
      'conflict', true,
      'revision', v_current_revision
    );
  end if;

  if jsonb_typeof(p_state -> 'plan') = 'object' then
    insert into public.plans (user_id, plan_data, updated_at)
    values (v_user_id, p_state -> 'plan', v_updated_at)
    on conflict (user_id) do update
    set plan_data = excluded.plan_data,
        updated_at = excluded.updated_at;
  else
    delete from public.plans where user_id = v_user_id;
  end if;

  delete from public.sense_progress where user_id = v_user_id;
  if jsonb_typeof(p_state -> 'progress') = 'object' then
    insert into public.sense_progress (
      user_id,
      sense_key,
      progress_data,
      updated_at
    )
    select v_user_id, entry.key, entry.value, v_updated_at
    from jsonb_each(p_state -> 'progress') as entry;
  end if;

  delete from public.daily_activity where user_id = v_user_id;
  if jsonb_typeof(p_state -> 'activityLog') = 'object' then
    insert into public.daily_activity (
      user_id,
      activity_date,
      activity_data,
      updated_at
    )
    select
      v_user_id,
      entry.key::date,
      entry.value,
      v_updated_at
    from jsonb_each(p_state -> 'activityLog') as entry
    where entry.key ~ '^\d{4}-\d{2}-\d{2}$';
  end if;

  delete from public.study_windows where user_id = v_user_id;
  if jsonb_typeof(p_state -> 'studyWindows') = 'array' then
    insert into public.study_windows (
      user_id,
      window_id,
      window_data,
      sort_order,
      updated_at
    )
    select
      v_user_id,
      coalesce(nullif(item.value ->> 'id', ''), item.ordinality::text),
      item.value,
      item.ordinality::integer,
      v_updated_at
    from jsonb_array_elements(p_state -> 'studyWindows')
      with ordinality as item(value, ordinality)
    where jsonb_typeof(item.value) = 'object'
    on conflict (user_id, window_id) do update
    set window_data = excluded.window_data,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at;
  end if;

  v_next_revision := v_current_revision + 1;
  update public.user_state_meta
  set session_data = coalesce(p_state -> 'session', 'null'::jsonb),
      introduced_words = case
        when jsonb_typeof(p_state -> 'introducedWords') = 'array'
          then p_state -> 'introducedWords'
        else '[]'::jsonb
      end,
      learning_day_counter = greatest(
        0,
        coalesce((p_state ->> 'learningDayCounter')::integer, 0)
      ),
      word_list_sort = coalesce(nullif(p_state ->> 'wordListSort', ''), 'mastery'),
      data_version = greatest(
        0,
        coalesce((p_state ->> 'dataVersion')::integer, 0)
      ),
      extra_state = p_state - array[
        'view',
        'plan',
        'session',
        'introducedWords',
        'progress',
        'activityLog',
        'studyWindows',
        'learningDayCounter',
        'wordListSort',
        'wordBrowse',
        'dataVersion'
      ],
      revision = v_next_revision,
      updated_at = v_updated_at
  where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'conflict', false,
    'revision', v_next_revision,
    'updatedAt', v_updated_at
  );
end;
$$;

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from auth.users where id = v_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, update, delete on public.user_state_meta to authenticated;
grant select, insert, update, delete on public.sense_progress to authenticated;
grant select, insert, update, delete on public.daily_activity to authenticated;
grant select, insert, update, delete on public.study_windows to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.load_user_state() from public, anon;
revoke all on function public.save_user_state(jsonb, bigint, boolean) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.load_user_state() to authenticated;
grant execute on function public.save_user_state(jsonb, bigint, boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

commit;
