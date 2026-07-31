begin;

create table if not exists public.user_state_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  state_data jsonb not null,
  reason text not null default 'periodic',
  captured_at timestamptz not null default clock_timestamp(),
  primary key (user_id, revision)
);

create index if not exists user_state_snapshots_user_captured_idx
  on public.user_state_snapshots (user_id, captured_at desc);

alter table public.user_state_snapshots enable row level security;
revoke all on table public.user_state_snapshots from public, anon, authenticated;

create or replace function public.user_state_document(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(meta.extra_state, '{}'::jsonb) || jsonb_build_object(
    'view', 'home',
    'plan', (
      select plan_data
      from public.plans
      where user_id = p_user_id
    ),
    'session', meta.session_data,
    'introducedWords', meta.introduced_words,
    'progress', (
      select coalesce(jsonb_object_agg(sense_key, progress_data), '{}'::jsonb)
      from public.sense_progress
      where user_id = p_user_id
    ),
    'activityLog', (
      select coalesce(
        jsonb_object_agg(to_char(activity_date, 'YYYY-MM-DD'), activity_data),
        '{}'::jsonb
      )
      from public.daily_activity
      where user_id = p_user_id
    ),
    'studyWindows', (
      select coalesce(jsonb_agg(window_data order by sort_order), '[]'::jsonb)
      from public.study_windows
      where user_id = p_user_id
    ),
    'learningDayCounter', meta.learning_day_counter,
    'wordListSort', meta.word_list_sort,
    'wordBrowse', null,
    'dataVersion', meta.data_version
  )
  from public.user_state_meta as meta
  where meta.user_id = p_user_id
$$;

revoke all on function public.user_state_document(uuid)
  from public, anon, authenticated;

create or replace function public.sync_record_declares_delete(
  p_book jsonb,
  p_domain text,
  p_key text
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      p_book #> array['_sync', 'records', p_domain, p_key]
    ) ->> 'deleted',
    'false'
  ) = 'true'
$$;

revoke all on function public.sync_record_declares_delete(jsonb, text, text)
  from public, anon, authenticated;

create or replace function public.state_has_undeclared_deletions(
  p_existing jsonb,
  p_incoming jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_existing_books jsonb := coalesce(p_existing -> 'bookStates', '{}'::jsonb);
  v_incoming_books jsonb := coalesce(p_incoming -> 'bookStates', '{}'::jsonb);
  v_existing_book jsonb;
  v_incoming_book jsonb;
  v_book_id text;
  v_domain text;
  v_key text;
  v_has_data boolean;
begin
  if jsonb_typeof(v_existing_books) <> 'object'
    or jsonb_typeof(v_incoming_books) <> 'object' then
    return false;
  end if;

  for v_book_id in
    select jsonb_object_keys(v_existing_books)
  loop
    v_existing_book := v_existing_books -> v_book_id;
    v_incoming_book := v_incoming_books -> v_book_id;
    v_has_data :=
      jsonb_array_length(
        coalesce(v_existing_book -> 'introducedWords', '[]'::jsonb)
      ) > 0
      or (
        select count(*)
        from jsonb_object_keys(
          coalesce(v_existing_book -> 'progress', '{}'::jsonb)
        )
      ) > 0
      or (
        select count(*)
        from jsonb_object_keys(
          coalesce(v_existing_book -> 'activityLog', '{}'::jsonb)
        )
      ) > 0
      or jsonb_array_length(
        coalesce(v_existing_book -> 'studyWindows', '[]'::jsonb)
      ) > 0;

    if v_incoming_book is null then
      if v_has_data then
        return true;
      end if;
      continue;
    end if;

    for v_key in
      select value
      from jsonb_array_elements_text(
        coalesce(v_existing_book -> 'introducedWords', '[]'::jsonb)
      )
    loop
      if not coalesce(
        v_incoming_book -> 'introducedWords',
        '[]'::jsonb
      ) @> jsonb_build_array(v_key)
        and not public.sync_record_declares_delete(
          v_incoming_book,
          'introducedWords',
          v_key
        ) then
        return true;
      end if;
    end loop;

    foreach v_domain in array array['progress', 'activityLog']
    loop
      for v_key in
        select jsonb_object_keys(
          coalesce(v_existing_book -> v_domain, '{}'::jsonb)
        )
      loop
        if not coalesce(
          v_incoming_book -> v_domain,
          '{}'::jsonb
        ) ? v_key
          and not public.sync_record_declares_delete(
            v_incoming_book,
            v_domain,
            v_key
          ) then
          return true;
        end if;
      end loop;
    end loop;

    for v_key in
      select coalesce(
        nullif(item.value ->> 'id', ''),
        item.ordinality::text
      )
      from jsonb_array_elements(
        coalesce(v_existing_book -> 'studyWindows', '[]'::jsonb)
      ) with ordinality as item(value, ordinality)
      where jsonb_typeof(item.value) = 'object'
    loop
      if not exists (
        select 1
        from jsonb_array_elements(
          coalesce(v_incoming_book -> 'studyWindows', '[]'::jsonb)
        ) with ordinality as item(value, ordinality)
        where jsonb_typeof(item.value) = 'object'
          and coalesce(
            nullif(item.value ->> 'id', ''),
            item.ordinality::text
          ) = v_key
      )
        and not public.sync_record_declares_delete(
          v_incoming_book,
          'studyWindows',
          v_key
        ) then
        return true;
      end if;
    end loop;
  end loop;

  return false;
end;
$$;

revoke all on function public.state_has_undeclared_deletions(jsonb, jsonb)
  from public, anon, authenticated;

insert into public.user_state_snapshots (
  user_id,
  revision,
  state_data,
  reason
)
select
  meta.user_id,
  meta.revision,
  public.user_state_document(meta.user_id),
  'migration_baseline'
from public.user_state_meta as meta
where public.user_state_document(meta.user_id) is not null
on conflict (user_id, revision) do nothing;

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
  v_existing_state jsonb;
  v_destructive boolean := false;
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

  v_existing_state := public.user_state_document(v_user_id);
  v_destructive := public.state_has_undeclared_deletions(
    v_existing_state,
    p_state
  );

  if v_existing_state is not null and (
    p_force
    or v_destructive
    or not exists (
      select 1
      from public.user_state_snapshots
      where user_id = v_user_id
        and captured_at >= v_updated_at - interval '5 minutes'
    )
  ) then
    insert into public.user_state_snapshots (
      user_id,
      revision,
      state_data,
      reason,
      captured_at
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
