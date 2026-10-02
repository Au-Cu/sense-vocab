begin;

-- Incremental writes keep the full save RPC for old clients, but let current
-- clients send only records changed since the last authoritative read.  The
-- materialized transport document remains the source used by load RPCs.
create or replace function public.save_user_state_delta(
  p_patch jsonb,
  p_expected_revision bigint default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '35s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_next_revision bigint;
  v_updated_at timestamptz := clock_timestamp();
  v_transport jsonb;
  v_existing_state jsonb;
  v_expanded jsonb;
  v_books jsonb;
  v_active_book_id text;
  v_active_book jsonb;
  v_patch_book jsonb;
  v_book jsonb;
  v_sync jsonb;
  v_map jsonb;
  v_map_patch jsonb;
  v_key text;
  v_book_id text;
  v_domain text;
  v_value jsonb;
  v_snapshot_due boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
    or coalesce((p_patch ->> 'version')::integer, 0) <> 1
    or jsonb_typeof(p_patch -> 'books') <> 'object' then
    raise exception 'Delta state must be a version 1 JSON object'
      using errcode = '22023';
  end if;
  if octet_length(p_patch::text) > 4194304 then
    raise exception 'Delta state exceeds the 4 MB limit' using errcode = '22023';
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

  select revision, transport_state
  into v_current_revision, v_transport
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

  -- Keep the recovery snapshot on the same side of the write as the legacy
  -- writer.  Do not snapshot the patched transport document: that would make
  -- a failed or malformed delta impossible to roll back to the prior state.
  select not exists (
    select 1
    from public.user_state_snapshots
    where user_id = v_user_id
      and captured_at >= v_updated_at - interval '5 minutes'
  )
  into v_snapshot_due;
  if p_force or v_snapshot_due then
    v_existing_state := public.user_state_document(v_user_id);
  end if;

  if v_transport is null then
    v_transport := public.compact_user_state_transport(
      public.user_state_document(v_user_id)
    );
  end if;
  v_transport := coalesce(v_transport, '{}'::jsonb);
  v_active_book_id := coalesce(
    nullif(p_patch ->> 'activeBookId', ''),
    nullif(v_transport ->> 'activeBookId', ''),
    'kaoyan'
  );

  -- Expand the compact transport just long enough to apply nested changes.
  -- The active book is represented by the durable top-level fields in the
  -- compact form; inactive books remain under bookStates.
  v_books := coalesce(v_transport -> 'bookStates', '{}'::jsonb);
  v_active_book := coalesce(v_books -> v_active_book_id, '{}'::jsonb) ||
    (v_transport - array['schemaVersion', 'activeBookId', 'bookStates']);
  v_books := jsonb_set(
    v_books,
    array[v_active_book_id],
    v_active_book,
    true
  );
  v_expanded := jsonb_set(v_transport, '{bookStates}', v_books, true);

  for v_book_id in
    select jsonb_object_keys(coalesce(p_patch -> 'books', '{}'::jsonb))
  loop
    v_patch_book := p_patch -> 'books' -> v_book_id;
    if jsonb_typeof(v_patch_book) <> 'object' then
      continue;
    end if;
    v_book := coalesce(v_expanded -> 'bookStates' -> v_book_id, '{}'::jsonb);
    if v_book_id = v_active_book_id then
      v_book := v_book || (v_expanded - array[
        'schemaVersion', 'activeBookId', 'bookStates'
      ]);
    end if;

    for v_key in
      select jsonb_object_keys(coalesce(v_patch_book -> 'scalars', '{}'::jsonb))
    loop
      if v_key in ('plan', 'session', 'learningDayCounter', 'wordListSort', 'dataVersion') then
        v_book := jsonb_set(
          v_book,
          array[v_key],
          v_patch_book -> 'scalars' -> v_key,
          true
        );
      end if;
    end loop;

    for v_key in
      select jsonb_object_keys(coalesce(v_patch_book -> 'replacements', '{}'::jsonb))
    loop
      if v_key in ('introducedWords', 'studyWindows') then
        v_book := jsonb_set(
          v_book,
          array[v_key],
          v_patch_book -> 'replacements' -> v_key,
          true
        );
      end if;
    end loop;

    for v_domain in
      select value
      from jsonb_array_elements_text(
        jsonb_build_array(
          'progress', 'activityLog', 'dashboardEvents',
          'dashboardSnapshots', 'confusionLinks'
        )
      )
    loop
      v_map_patch := v_patch_book -> 'maps' -> v_domain;
      if jsonb_typeof(v_map_patch) <> 'object' then
        continue;
      end if;
      v_map := coalesce(v_book -> v_domain, '{}'::jsonb);
      if jsonb_typeof(v_map_patch -> 'upsert') = 'object' then
        v_map := v_map || (v_map_patch -> 'upsert');
      end if;
      for v_key in
        select value
        from jsonb_array_elements_text(
          coalesce(v_map_patch -> 'delete', '[]'::jsonb)
        )
      loop
        v_map := v_map - v_key;
      end loop;
      v_book := jsonb_set(v_book, array[v_domain], v_map, true);
    end loop;

    v_sync := coalesce(v_book -> '_sync', '{}'::jsonb);
    if jsonb_typeof(v_patch_book -> 'sync' -> 'counters') = 'object' then
      for v_key in
        select jsonb_object_keys(v_patch_book -> 'sync' -> 'counters')
      loop
        if greatest(
          coalesce((v_sync -> 'counters' ->> v_key)::bigint, 0),
          coalesce((v_patch_book -> 'sync' -> 'counters' ->> v_key)::bigint, 0)
        ) > 0 then
          v_sync := jsonb_set(
            v_sync,
            array['counters', v_key],
            to_jsonb(greatest(
              coalesce((v_sync -> 'counters' ->> v_key)::bigint, 0),
              coalesce((v_patch_book -> 'sync' -> 'counters' ->> v_key)::bigint, 0)
            )),
            true
          );
        end if;
      end loop;
    end if;
    for v_domain in
      select value
      from jsonb_array_elements_text(
        jsonb_build_array(
          'plan', 'session', 'learningDayCounter', 'wordListSort',
          'introducedWords', 'progress', 'activityLog', 'studyWindows',
          'dashboardEvents', 'dashboardSnapshots', 'confusionLinks'
        )
      )
    loop
      if jsonb_typeof(v_patch_book -> 'sync' -> 'records' -> v_domain) = 'object' then
        v_sync := jsonb_set(
          v_sync,
          array['records', v_domain],
          coalesce(v_sync -> 'records' -> v_domain, '{}'::jsonb) ||
            (v_patch_book -> 'sync' -> 'records' -> v_domain),
          true
        );
      end if;
    end loop;
    v_book := jsonb_set(v_book, '{_sync}', v_sync, true);
    v_expanded := jsonb_set(
      v_expanded,
      array['bookStates', v_book_id],
      v_book,
      true
    );
  end loop;

  -- Rebuild the active-book mirror expected by older clients and by the
  -- normalized tables, then compact it for transport.
  v_active_book := v_expanded -> 'bookStates' -> v_active_book_id;
  v_expanded := v_expanded || jsonb_build_object(
    'activeBookId', v_active_book_id,
    'view', 'home',
    'plan', v_active_book -> 'plan',
    'session', v_active_book -> 'session',
    'introducedWords', v_active_book -> 'introducedWords',
    'progress', v_active_book -> 'progress',
    'activityLog', v_active_book -> 'activityLog',
    'studyWindows', v_active_book -> 'studyWindows',
    'learningDayCounter', v_active_book -> 'learningDayCounter',
    'wordListSort', v_active_book -> 'wordListSort',
    'wordBrowse', null,
    'dataVersion', v_active_book -> 'dataVersion',
    'dashboardEvents', v_active_book -> 'dashboardEvents',
    'dashboardSnapshots', v_active_book -> 'dashboardSnapshots',
    'confusionLinks', v_active_book -> 'confusionLinks',
    '_sync', v_active_book -> '_sync'
  );
  v_transport := public.compact_user_state_transport(v_expanded);

  if p_force or v_snapshot_due then
    insert into public.user_state_snapshots (
      user_id, revision, state_data, reason, captured_at
    )
    values (
      v_user_id,
      v_current_revision,
      v_existing_state,
      case when p_force then 'before_forced_write' else 'periodic' end,
      v_updated_at
    )
    on conflict (user_id, revision) do nothing;
  end if;

  -- Apply only the active-book rows named by the patch. Other rows remain
  -- untouched, which is the key difference from the legacy full writer.
  v_patch_book := p_patch -> 'books' -> v_active_book_id;
  if jsonb_typeof(v_patch_book) = 'object' then
    if (v_patch_book -> 'scalars') ? 'plan' then
      if jsonb_typeof(v_patch_book -> 'scalars' -> 'plan') = 'object' then
        insert into public.plans (user_id, plan_data, updated_at)
        values (v_user_id, v_patch_book -> 'scalars' -> 'plan', v_updated_at)
        on conflict (user_id) do update
        set plan_data = excluded.plan_data, updated_at = excluded.updated_at;
      else
        delete from public.plans where user_id = v_user_id;
      end if;
    end if;

    if jsonb_typeof(v_patch_book -> 'maps' -> 'progress' -> 'upsert') = 'object' then
      for v_key, v_value in
        select key, value
        from jsonb_each(v_patch_book -> 'maps' -> 'progress' -> 'upsert')
      loop
        insert into public.sense_progress(user_id, sense_key, progress_data, updated_at)
        values (v_user_id, v_key, v_value, v_updated_at)
        on conflict (user_id, sense_key) do update
        set progress_data = excluded.progress_data, updated_at = excluded.updated_at;
      end loop;
    end if;
    delete from public.sense_progress
    where user_id = v_user_id
      and sense_key in (
        select value
        from jsonb_array_elements_text(
          coalesce(v_patch_book -> 'maps' -> 'progress' -> 'delete', '[]'::jsonb)
        )
      );

    if jsonb_typeof(v_patch_book -> 'maps' -> 'activityLog' -> 'upsert') = 'object' then
      for v_key, v_value in
        select key, value
        from jsonb_each(v_patch_book -> 'maps' -> 'activityLog' -> 'upsert')
      loop
        if v_key ~ '^\\d{4}-\\d{2}-\\d{2}$' then
          insert into public.daily_activity(user_id, activity_date, activity_data, updated_at)
          values (v_user_id, v_key::date, v_value, v_updated_at)
          on conflict (user_id, activity_date) do update
          set activity_data = excluded.activity_data, updated_at = excluded.updated_at;
        end if;
      end loop;
    end if;
    delete from public.daily_activity
    where user_id = v_user_id
      and activity_date in (
        select value::date
        from jsonb_array_elements_text(
          coalesce(v_patch_book -> 'maps' -> 'activityLog' -> 'delete', '[]'::jsonb)
        )
        where value ~ '^\\d{4}-\\d{2}-\\d{2}$'
      );

    if (v_patch_book -> 'replacements') ? 'studyWindows' then
      delete from public.study_windows where user_id = v_user_id;
      insert into public.study_windows(
        user_id, window_id, window_data, sort_order, updated_at
      )
      select
        v_user_id,
        coalesce(nullif(item.value ->> 'id', ''), item.ordinality::text),
        item.value,
        item.ordinality::integer,
        v_updated_at
      from jsonb_array_elements(
        coalesce(v_patch_book -> 'replacements' -> 'studyWindows', '[]'::jsonb)
      ) with ordinality as item(value, ordinality)
      where jsonb_typeof(item.value) = 'object';
    end if;
  end if;

  v_next_revision := v_current_revision + 1;
  update public.user_state_meta
  set session_data = coalesce(v_active_book -> 'session', 'null'::jsonb),
      introduced_words = coalesce(v_active_book -> 'introducedWords', '[]'::jsonb),
      learning_day_counter = greatest(
        0, coalesce((v_active_book ->> 'learningDayCounter')::integer, 0)
      ),
      word_list_sort = coalesce(nullif(v_active_book ->> 'wordListSort', ''), 'mastery'),
      data_version = greatest(0, coalesce((v_active_book ->> 'dataVersion')::integer, 0)),
      extra_state = v_expanded - array[
        'view', 'plan', 'session', 'introducedWords', 'progress',
        'activityLog', 'studyWindows', 'learningDayCounter', 'wordListSort',
        'wordBrowse', 'dataVersion'
      ],
      transport_state = v_transport,
      transport_bytes = octet_length(jsonb_build_object(
        'found', true,
        'revision', v_next_revision,
        'updatedAt', v_updated_at,
        'state', v_transport
      )::text),
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
    'incremental', true,
    'forced', p_force
  );
end;
$$;

revoke all on function public.save_user_state_delta(jsonb, bigint, boolean)
  from public, anon;
grant execute on function public.save_user_state_delta(jsonb, bigint, boolean)
  to authenticated;

commit;
