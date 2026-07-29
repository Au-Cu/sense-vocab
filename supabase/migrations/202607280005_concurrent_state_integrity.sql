begin;

create or replace function public.load_user_state()
returns jsonb
language plpgsql
volatile
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
  where user_id = v_user_id
  for share;

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
  if octet_length(p_state::text) > 12582912 then
    raise exception 'State exceeds the 12 MB limit' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_state -> 'introducedWords', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_state -> 'progress', '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_state -> 'activityLog', '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_state -> 'studyWindows', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_state -> 'session', 'null'::jsonb))
      not in ('object', 'null') then
    raise exception 'State contains an invalid collection type'
      using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_state -> 'introducedWords', '[]'::jsonb)) > 20000
    or (
      select count(*)
      from jsonb_object_keys(coalesce(p_state -> 'progress', '{}'::jsonb))
    ) > 50000
    or (
      select count(*)
      from jsonb_object_keys(coalesce(p_state -> 'activityLog', '{}'::jsonb))
    ) > 5000
    or jsonb_array_length(coalesce(p_state -> 'studyWindows', '[]'::jsonb)) > 2000 then
    raise exception 'State contains too many collection entries'
      using errcode = '22023';
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

  if p_expected_revision is null
    or p_expected_revision < 0
    or p_expected_revision <> v_current_revision then
    return jsonb_build_object(
      'ok', false,
      'conflict', true,
      'revision', v_current_revision,
      'reason', case
        when p_expected_revision is null then 'expected_revision_required'
        else 'revision_mismatch'
      end
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
  insert into public.sense_progress (
    user_id,
    sense_key,
    progress_data,
    updated_at
  )
  select v_user_id, entry.key, entry.value, v_updated_at
  from jsonb_each(coalesce(p_state -> 'progress', '{}'::jsonb)) as entry;

  delete from public.daily_activity where user_id = v_user_id;
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
  from jsonb_each(coalesce(p_state -> 'activityLog', '{}'::jsonb)) as entry
  where entry.key ~ '^\d{4}-\d{2}-\d{2}$';

  delete from public.study_windows where user_id = v_user_id;
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
  from jsonb_array_elements(coalesce(p_state -> 'studyWindows', '[]'::jsonb))
    with ordinality as item(value, ordinality)
  where jsonb_typeof(item.value) = 'object'
  on conflict (user_id, window_id) do update
  set window_data = excluded.window_data,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at;

  v_next_revision := v_current_revision + 1;
  update public.user_state_meta
  set session_data = coalesce(p_state -> 'session', 'null'::jsonb),
      introduced_words = coalesce(p_state -> 'introducedWords', '[]'::jsonb),
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
    'updatedAt', v_updated_at,
    'forceIgnored', p_force
  );
end;
$$;

revoke all on function public.load_user_state() from public, anon;
grant execute on function public.load_user_state() to authenticated;
revoke all on function public.save_user_state(jsonb, bigint, boolean)
  from public, anon;
grant execute on function public.save_user_state(jsonb, bigint, boolean)
  to authenticated;

commit;
