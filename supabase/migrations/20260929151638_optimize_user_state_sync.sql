begin;

-- Keep the existing RPC contract, but avoid rebuilding and rewriting every
-- normalized row for each small learning update.
create or replace function public.save_user_state(
  p_state jsonb,
  p_expected_revision bigint default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '30s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_next_revision bigint;
  v_updated_at timestamptz := clock_timestamp();
  v_state jsonb;
  v_active_book jsonb := '{}'::jsonb;
  v_existing_extra_state jsonb;
  v_existing_state jsonb;
  v_destructive boolean := false;
  v_snapshot_due boolean := false;
  v_active_book_id text;
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

  v_active_book_id := nullif(p_state ->> 'activeBookId', '');
  if v_active_book_id is not null
    and jsonb_typeof(p_state -> 'bookStates') = 'object'
    and jsonb_typeof(p_state -> 'bookStates' -> v_active_book_id) = 'object' then
    v_active_book := p_state -> 'bookStates' -> v_active_book_id;
  end if;

  -- New clients may omit fields that are already present in the active book.
  -- Keeping this normalization server-side makes uploads smaller while old
  -- clients remain fully compatible.
  v_state := p_state || jsonb_build_object(
    'plan', coalesce(p_state -> 'plan', v_active_book -> 'plan'),
    'session', coalesce(p_state -> 'session', v_active_book -> 'session', 'null'::jsonb),
    'introducedWords', coalesce(
      p_state -> 'introducedWords',
      v_active_book -> 'introducedWords',
      '[]'::jsonb
    ),
    'progress', coalesce(
      p_state -> 'progress',
      v_active_book -> 'progress',
      '{}'::jsonb
    ),
    'activityLog', coalesce(
      p_state -> 'activityLog',
      v_active_book -> 'activityLog',
      '{}'::jsonb
    ),
    'studyWindows', coalesce(
      p_state -> 'studyWindows',
      v_active_book -> 'studyWindows',
      '[]'::jsonb
    ),
    'learningDayCounter', coalesce(
      p_state -> 'learningDayCounter',
      v_active_book -> 'learningDayCounter',
      '0'::jsonb
    ),
    'wordListSort', coalesce(
      p_state -> 'wordListSort',
      v_active_book -> 'wordListSort',
      '"mastery"'::jsonb
    ),
    'dataVersion', coalesce(
      p_state -> 'dataVersion',
      v_active_book -> 'dataVersion',
      '0'::jsonb
    )
  );

  if jsonb_typeof(coalesce(v_state -> 'introducedWords', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(v_state -> 'progress', '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(v_state -> 'activityLog', '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(v_state -> 'studyWindows', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(v_state -> 'session', 'null'::jsonb))
      not in ('object', 'null') then
    raise exception 'State contains an invalid collection type'
      using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(v_state -> 'introducedWords', '[]'::jsonb)) > 20000
    or (
      select count(*)
      from jsonb_object_keys(coalesce(v_state -> 'progress', '{}'::jsonb))
    ) > 50000
    or (
      select count(*)
      from jsonb_object_keys(coalesce(v_state -> 'activityLog', '{}'::jsonb))
    ) > 5000
    or jsonb_array_length(coalesce(v_state -> 'studyWindows', '[]'::jsonb)) > 2000 then
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

  select revision, extra_state
  into v_current_revision, v_existing_extra_state
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

  -- The deletion guard only needs the authoritative multi-book portion.
  -- Avoid reconstructing all normalized JSON unless a snapshot is required.
  v_destructive := public.state_has_undeclared_deletions(
    coalesce(v_existing_extra_state, '{}'::jsonb),
    v_state
  );
  select not exists (
    select 1
    from public.user_state_snapshots
    where user_id = v_user_id
      and captured_at >= v_updated_at - interval '5 minutes'
  )
  into v_snapshot_due;

  if p_force or v_destructive or v_snapshot_due then
    v_existing_state := public.user_state_document(v_user_id);
    insert into public.user_state_snapshots (
      user_id, revision, state_data, reason, captured_at
    )
    values (
      v_user_id,
      v_current_revision,
      v_existing_state,
      case
        when p_force then 'before_forced_write'
        when v_destructive then 'before_blocked_write'
        else 'periodic'
      end,
      v_updated_at
    )
    on conflict (user_id, revision) do nothing;
  end if;

  if v_destructive and not p_force then
    return jsonb_build_object(
      'ok', false,
      'conflict', false,
      'destructiveBlocked', true,
      'revision', v_current_revision,
      'reason', 'undeclared_deletions'
    );
  end if;

  if jsonb_typeof(v_state -> 'plan') = 'object' then
    insert into public.plans (user_id, plan_data, updated_at)
    values (v_user_id, v_state -> 'plan', v_updated_at)
    on conflict (user_id) do update
    set plan_data = excluded.plan_data,
        updated_at = excluded.updated_at
    where public.plans.plan_data is distinct from excluded.plan_data;
  else
    delete from public.plans where user_id = v_user_id;
  end if;

  insert into public.sense_progress (
    user_id, sense_key, progress_data, updated_at
  )
  select v_user_id, entry.key, entry.value, v_updated_at
  from jsonb_each(coalesce(v_state -> 'progress', '{}'::jsonb)) as entry
  on conflict (user_id, sense_key) do update
  set progress_data = excluded.progress_data,
      updated_at = excluded.updated_at
  where public.sense_progress.progress_data is distinct from excluded.progress_data;

  delete from public.sense_progress as existing
  where existing.user_id = v_user_id
    and not exists (
      select 1
      from jsonb_object_keys(coalesce(v_state -> 'progress', '{}'::jsonb)) as incoming(sense_key)
      where incoming.sense_key = existing.sense_key
    );

  insert into public.daily_activity (
    user_id, activity_date, activity_data, updated_at
  )
  select v_user_id, entry.key::date, entry.value, v_updated_at
  from jsonb_each(coalesce(v_state -> 'activityLog', '{}'::jsonb)) as entry
  where entry.key ~ '^\\d{4}-\\d{2}-\\d{2}$'
  on conflict (user_id, activity_date) do update
  set activity_data = excluded.activity_data,
      updated_at = excluded.updated_at
  where public.daily_activity.activity_data is distinct from excluded.activity_data;

  delete from public.daily_activity as existing
  where existing.user_id = v_user_id
    and not exists (
      select 1
      from jsonb_object_keys(coalesce(v_state -> 'activityLog', '{}'::jsonb)) as incoming(activity_date)
      where incoming.activity_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
        and incoming.activity_date::date = existing.activity_date
    );

  insert into public.study_windows (
    user_id, window_id, window_data, sort_order, updated_at
  )
  select
    v_user_id,
    coalesce(nullif(item.value ->> 'id', ''), item.ordinality::text),
    item.value,
    item.ordinality::integer,
    v_updated_at
  from jsonb_array_elements(coalesce(v_state -> 'studyWindows', '[]'::jsonb))
    with ordinality as item(value, ordinality)
  where jsonb_typeof(item.value) = 'object'
  on conflict (user_id, window_id) do update
  set window_data = excluded.window_data,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  where public.study_windows.window_data is distinct from excluded.window_data
    or public.study_windows.sort_order is distinct from excluded.sort_order;

  delete from public.study_windows as existing
  where existing.user_id = v_user_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(v_state -> 'studyWindows', '[]'::jsonb))
        with ordinality as item(value, ordinality)
      where jsonb_typeof(item.value) = 'object'
        and coalesce(nullif(item.value ->> 'id', ''), item.ordinality::text)
          = existing.window_id
    );

  v_next_revision := v_current_revision + 1;
  update public.user_state_meta
  set session_data = coalesce(v_state -> 'session', 'null'::jsonb),
      introduced_words = coalesce(v_state -> 'introducedWords', '[]'::jsonb),
      learning_day_counter = greatest(
        0,
        coalesce((v_state ->> 'learningDayCounter')::integer, 0)
      ),
      word_list_sort = coalesce(nullif(v_state ->> 'wordListSort', ''), 'mastery'),
      data_version = greatest(
        0,
        coalesce((v_state ->> 'dataVersion')::integer, 0)
      ),
      extra_state = p_state - array[
        'view', 'plan', 'session', 'introducedWords', 'progress',
        'activityLog', 'studyWindows', 'learningDayCounter', 'wordListSort',
        'wordBrowse', 'dataVersion'
      ],
      revision = v_next_revision,
      updated_at = v_updated_at
  where user_id = v_user_id;

  delete from public.user_state_snapshots
  where user_id = v_user_id
    and revision in (
      select revision
      from public.user_state_snapshots
      where user_id = v_user_id
      order by captured_at desc
      offset 200
    );

  return jsonb_build_object(
    'ok', true,
    'conflict', false,
    'revision', v_next_revision,
    'updatedAt', v_updated_at,
    'forced', p_force
  );
end;
$$;

revoke all on function public.save_user_state(jsonb, bigint, boolean)
  from public, anon;
grant execute on function public.save_user_state(jsonb, bigint, boolean)
  to authenticated;

commit;
