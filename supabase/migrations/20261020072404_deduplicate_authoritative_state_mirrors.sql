begin;

-- This describes equivalent aliases, not another copy of historical data.
-- Existing rows are untouched; successful CAS writes opt into the encoding.
alter table public.user_state_meta
  add column if not exists extra_state_mirror_keys text[];

create or replace function public.prepare_user_state_extra(
  p_state jsonb,
  p_delta boolean default false,
  p_active_book_id text default null
)
returns table(extra_state jsonb, mirror_keys text[])
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_id text := coalesce(p_active_book_id, nullif(p_state ->> 'activeBookId', ''));
  v_books jsonb := p_state -> 'bookStates';
  v_book jsonb;
  v_keys text[] := array[]::text[];
  v_remove text[] := array[
    'view', 'plan', 'session', 'introducedWords', 'progress', 'activityLog',
    'studyWindows', 'learningDayCounter', 'wordListSort', 'wordBrowse', 'dataVersion', 'bookStates'
  ];
  v_root jsonb;
  v_nulls jsonb;
begin
  if v_id is not null then
    if jsonb_typeof(v_books) is distinct from 'object' then v_books := '{}'::jsonb; end if;
    v_book := v_books -> v_id;
    if jsonb_typeof(v_book) is distinct from 'object' then
      v_book := p_state - array['schemaVersion', 'activeBookId', 'bookStates'];
      v_books := jsonb_set(v_books, array[v_id], v_book, true);
    end if;
  end if;

  if p_delta then
    -- The historical delta writer projects these four aliases, including null
    -- for an absent book field. It does not persist root planTargetHistory.
    v_remove := v_remove || array['planTargetHistory', 'dashboardEvents',
      'dashboardSnapshots', 'confusionLinks', '_sync'];
    select coalesce(array_agg(k) filter(where v_book ? k), array[]::text[]),
      coalesce(jsonb_object_agg(k, 'null'::jsonb) filter(where not (v_book ? k)), '{}'::jsonb)
    into v_keys, v_nulls
    from unnest(array['dashboardEvents', 'dashboardSnapshots', 'confusionLinks', '_sync']) k;
  else
    select coalesce(array_agg(k), array[]::text[]) into v_keys
    from unnest(array['planTargetHistory', 'dashboardEvents', 'dashboardSnapshots', 'confusionLinks', '_sync']) k
    where p_state ? k and v_book ? k and p_state -> k = v_book -> k;
    v_remove := v_remove || v_keys;
    v_nulls := '{}'::jsonb;
  end if;

  -- Remove all aliases in one pass before attaching the large book map.
  v_root := (p_state - v_remove) || v_nulls;
  if p_delta then v_root := v_root || jsonb_build_object('activeBookId', v_id); end if;
  if p_state ? 'bookStates' or v_id is not null then
    v_root := v_root || jsonb_build_object('bookStates', v_books);
  end if;
  return query select v_root, v_keys;
end;
$$;
revoke all on function public.prepare_user_state_extra(jsonb, boolean, text) from public, anon, authenticated;

-- Restore only aliases actually removed by the internal writer. Legacy rows,
-- missing fields, explicit nulls and distinct root values keep their meaning.
create or replace function public.user_state_document(p_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_meta record;
  v_extra jsonb;
  v_book jsonb;
  v_projection jsonb;
begin
  -- Detoast the large metadata once, not once for every alias in an aggregate.
  select extra_state, extra_state_mirror_keys, session_data, introduced_words,
    learning_day_counter, word_list_sort, data_version into v_meta
  from public.user_state_meta where user_id = p_user_id;
  if not found then return null; end if;
  v_extra := coalesce(v_meta.extra_state, '{}'::jsonb) || '{}'::jsonb;
  v_book := v_extra #> array['bookStates', v_extra ->> 'activeBookId'];
  select coalesce(jsonb_object_agg(k, v_book -> k), '{}'::jsonb) into v_projection
  from unnest(v_meta.extra_state_mirror_keys) k
  where k in ('planTargetHistory','dashboardEvents','dashboardSnapshots','confusionLinks','_sync')
    and not (v_extra ? k);
  v_book := null;
  v_projection := v_projection || jsonb_build_object(
    'view', 'home',
    'plan', (select plan_data from public.plans where user_id = p_user_id),
    'session', v_meta.session_data,
    'introducedWords', v_meta.introduced_words,
    'progress', (select coalesce(jsonb_object_agg(sense_key, progress_data), '{}'::jsonb)
      from public.sense_progress where user_id = p_user_id),
    'activityLog', (select coalesce(jsonb_object_agg(to_char(activity_date, 'YYYY-MM-DD'), activity_data), '{}'::jsonb)
      from public.daily_activity where user_id = p_user_id),
    'studyWindows', (select coalesce(jsonb_agg(window_data order by sort_order), '[]'::jsonb)
      from public.study_windows where user_id = p_user_id),
    'learningDayCounter', v_meta.learning_day_counter,
    'wordListSort', v_meta.word_list_sort,
    'wordBrowse', null,
    'dataVersion', v_meta.data_version
  );
  return v_extra || v_projection;
end;
$$;
revoke all on function public.user_state_document(uuid) from public, anon, authenticated;

-- Restrict deletion comparison to the durable domains it actually examines.
-- In particular, never expand two complete dashboard histories for this test.
create or replace function public.project_user_state_deletions(p_state jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_keys text[] := array['introducedWords','progress','activityLog','studyWindows','confusionLinks','_sync'];
  v_result jsonb;
  v_state jsonb;
  v_books jsonb;
  v_projected jsonb := '{}'::jsonb;
  v_id text;
  v_book jsonb;
begin
  if jsonb_typeof(p_state) is distinct from 'object' then return p_state; end if;
  -- A selected JSONB column can still be a compressed TOAST pointer. Force a
  -- flat local datum once so the per-field projection does not detoast it anew.
  v_state := p_state || '{}'::jsonb;
  v_books := v_state -> 'bookStates';
  select coalesce(jsonb_object_agg(k, v_state -> k), '{}'::jsonb) into v_result
    from unnest(v_keys || array['activeBookId']) k where v_state ? k;
  if jsonb_typeof(v_books) = 'object' then
    for v_id in select jsonb_object_keys(v_books) loop
      v_book := v_books -> v_id;
      if jsonb_typeof(v_book) = 'object' then
        select coalesce(jsonb_object_agg(k, v_book -> k), '{}'::jsonb) into v_book
          from unnest(v_keys) k where v_book ? k;
      end if;
      v_projected := v_projected || jsonb_build_object(v_id, v_book);
    end loop;
    v_result := v_result || jsonb_build_object('bookStates', v_projected);
  elsif v_state ? 'bookStates' then
    v_result := v_result || jsonb_build_object('bookStates', v_books);
  end if;
  return public.expand_user_state_transport(v_result);
end;
$$;
revoke all on function public.project_user_state_deletions(jsonb) from public, anon, authenticated;

create or replace function public.state_has_undeclared_deletions(p_existing jsonb, p_incoming jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select public.state_has_undeclared_deletions_unexpanded(
    public.project_user_state_deletions(p_existing), public.project_user_state_deletions(p_incoming))
$$;
revoke all on function public.state_has_undeclared_deletions(jsonb, jsonb) from public, anon, authenticated;

-- Return compact inputs unchanged instead of copying every byte through an
-- object aggregate, remove/concat, and materialization on each writer layer.
create or replace function public.compact_user_state_transport(p_state jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_books jsonb := p_state -> 'bookStates';
  v_session jsonb := p_state -> 'session';
  v_compact_session jsonb;
  v_id text := coalesce(nullif(p_state ->> 'activeBookId', ''), 'kaoyan');
  v_book_id text;
  v_book jsonb;
  v_supplement jsonb := '{}'::jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_changed boolean := false;
begin
  if jsonb_typeof(p_state) is distinct from 'object' then return p_state; end if;
  if jsonb_typeof(v_session) = 'object' then
    v_compact_session := public.compact_user_session_transport(v_session);
    if v_compact_session is distinct from v_session then
      v_changes := jsonb_build_object('session', v_compact_session);
    end if;
  end if;
  if jsonb_typeof(v_books) = 'object' then
    v_book := v_books -> v_id;
    if jsonb_typeof(v_book) = 'object' then
      v_supplement := (v_book - array['view','plan','session','introducedWords','progress','activityLog',
        'studyWindows','learningDayCounter','wordListSort','planTargetHistory','wordBrowse','dataVersion'])
        - array(select jsonb_object_keys(p_state));
      v_books := v_books - v_id;
      v_changed := true;
    end if;
    for v_book_id in select jsonb_object_keys(v_books) loop
      v_book := v_books -> v_book_id;
      if jsonb_typeof(v_book -> 'session') = 'object' then
        v_compact_session := public.compact_user_session_transport(v_book -> 'session');
        if v_compact_session is distinct from v_book -> 'session' then
          v_books := jsonb_set(v_books, array[v_book_id,'session'], v_compact_session, true);
          v_changed := true;
        end if;
      end if;
    end loop;
    if v_changed then v_changes := v_changes || jsonb_build_object('bookStates', v_books); end if;
  end if;
  if v_changes = '{}'::jsonb and v_supplement = '{}'::jsonb then return p_state; end if;
  return (p_state - array(select jsonb_object_keys(v_changes))) || v_supplement || v_changes;
end;
$$;
revoke all on function public.compact_user_state_transport(jsonb) from public, anon, authenticated;

do $materialize$
declare
  v_source text := pg_get_functiondef('public.materialize_user_state_transport(jsonb)'::regprocedure);
  v_before text := E'  v_active_book_id := nullif(p_state ->> ''activeBookId'', '''');';
begin
  if position(v_before in v_source) = 0 then raise exception 'Unexpected materializer definition'; end if;
  execute replace(v_source, v_before, E'  if p_state ?& array[''plan'',''session'',''introducedWords'',''progress'',''activityLog'',\n'
    || E'    ''studyWindows'',''learningDayCounter'',''wordListSort'',''dataVersion''] then\n'
    || E'    return public.compact_user_state_transport(p_state);\n  end if;\n' || v_before);
end;
$materialize$;

-- One authoritative metadata update, rather than a legacy write followed by
-- a second full rewrite of both extra_state and transport_state.
do $legacy$
declare
  v_source text := pg_get_functiondef('public.save_user_state_legacy(jsonb,bigint,boolean)'::regprocedure);
  v_start integer;
  v_end integer;
  v_before text;
begin
  v_source := replace(v_source, E'  v_state jsonb;', E'  v_state jsonb;\n  v_extra jsonb;\n  v_mirrors text[];');
  v_before := E'  select revision, extra_state\n  into v_current_revision, v_existing_extra_state';
  if position(v_before in v_source) = 0 then raise exception 'Unexpected legacy deletion input'; end if;
  v_source := replace(v_source, v_before,
    E'  select revision, public.project_user_state_deletions(extra_state)\n  into v_current_revision, v_existing_extra_state');
  v_before := E'    v_state\n  );';
  if position(v_before in v_source) = 0 then raise exception 'Unexpected legacy deletion comparison'; end if;
  v_source := replace(v_source, v_before, v_before || E'\n  v_existing_extra_state := null;');
  v_start := position('  v_state := p_state || jsonb_build_object(' in v_source);
  v_end := position('  if jsonb_typeof(coalesce(v_state' in v_source);
  if v_start = 0 or v_end <= v_start then raise exception 'Unexpected legacy normalization'; end if;
  v_source := overlay(v_source placing E'  v_state := public.materialize_user_state_transport(p_state);\n\n'
    from v_start for v_end-v_start);
  v_before := '  v_next_revision := v_current_revision + 1;';
  v_source := replace(v_source, v_before,
    E'  select extra_state, mirror_keys into v_extra, v_mirrors\n'
    || E'  from public.prepare_user_state_extra(p_state);\n' || v_before);
  v_before := E'      extra_state = p_state - array[\n'
    || E'        ''view'', ''plan'', ''session'', ''introducedWords'', ''progress'',\n'
    || E'        ''activityLog'', ''studyWindows'', ''learningDayCounter'', ''wordListSort'',\n'
    || E'        ''wordBrowse'', ''dataVersion''\n      ],';
  if position(v_before in v_source) = 0 then raise exception 'Unexpected legacy extra-state write'; end if;
  execute replace(v_source, v_before, E'      extra_state = v_extra,\n      extra_state_mirror_keys = v_mirrors,\n'
    || E'      transport_state = v_state,\n      transport_bytes = null,');
end;
$legacy$;

create or replace function public.save_user_state(p_state jsonb, p_expected_revision bigint default null, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '120s'
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return public.save_user_state_legacy(public.compact_user_state_transport(p_state), p_expected_revision, p_force);
end;
$$;
revoke all on function public.save_user_state(jsonb,bigint,boolean) from public, anon;
grant execute on function public.save_user_state(jsonb,bigint,boolean) to authenticated;

do $delta$
declare
  v_source text := pg_get_functiondef('public.save_user_state_delta(jsonb,bigint,boolean)'::regprocedure);
  v_before text;
  v_block text;
  v_start integer;
  v_end integer;
begin
  v_source := replace(v_source, E'  v_expanded jsonb;', E'  v_expanded jsonb;\n  v_extra jsonb;\n  v_mirrors text[];\n  v_original_book jsonb;');
  v_before := E'  if p_force or v_snapshot_due then\n    v_existing_state := public.user_state_document(v_user_id);\n  end if;\n';
  if position(v_before in v_source) = 0 then raise exception 'Unexpected early delta snapshot'; end if;
  v_source := replace(v_source, v_before, '');
  v_before := E'  if p_force or v_snapshot_due then\n    insert into public.user_state_snapshots';
  if position(v_before in v_source) = 0 then raise exception 'Unexpected delta snapshot insert'; end if;
  v_source := replace(v_source, v_before,
    E'  if p_force or v_snapshot_due then\n    v_existing_state := public.user_state_document(v_user_id);\n'
    || '    insert into public.user_state_snapshots');

  v_before := E'  v_expanded := jsonb_set(v_transport, ''{bookStates}'', v_books, true);';
  if position(v_before in v_source) = 0 then raise exception 'Unexpected delta expansion'; end if;
  v_source := replace(v_source, v_before,
    E'  v_expanded := jsonb_set(v_transport - array[''view'',''plan'',''session'',''introducedWords'',''progress'',\n'
    || E'    ''activityLog'',''studyWindows'',''planTargetHistory'',''learningDayCounter'',''wordListSort'',\n'
    || E'    ''wordBrowse'',''dataVersion'',''dashboardEvents'',''dashboardSnapshots'',''confusionLinks'',''_sync''],\n'
    || E'    ''{bookStates}'', v_books, true);');

  -- Apply field patches to a small working set. Unchanged historical maps are
  -- attached only once, instead of recopied by every scalar/map/sync update.
  v_before := E'    if v_book_id = v_active_book_id then\n'
    || E'      v_book := v_book || (v_expanded - array[\n'
    || E'        ''schemaVersion'', ''activeBookId'', ''bookStates''\n      ]);\n    end if;';
  if position(v_before in v_source) = 0 then raise exception 'Unexpected delta book projection'; end if;
  v_source := replace(v_source, v_before,
    E'    v_original_book := v_book;\n    if jsonb_typeof(v_original_book) = ''object'' then\n'
    || E'      select coalesce(jsonb_object_agg(k, v_original_book -> k), ''{}''::jsonb) into v_book\n'
    || E'      from (select key as k from jsonb_object_keys(coalesce(v_patch_book -> ''scalars'', ''{}''::jsonb)) key\n'
    || E'        where key in (''plan'',''session'',''learningDayCounter'',''wordListSort'',''dataVersion'')\n'
    || E'        union select key from jsonb_object_keys(coalesce(v_patch_book -> ''replacements'', ''{}''::jsonb)) key\n'
    || E'        where key in (''introducedWords'',''studyWindows'')\n'
    || E'        union select key from jsonb_object_keys(coalesce(v_patch_book -> ''maps'', ''{}''::jsonb)) key\n'
    || E'        where key in (''progress'',''activityLog'',''planTargetHistory'',''dashboardEvents'',''dashboardSnapshots'',''confusionLinks'')\n'
    || E'          and jsonb_typeof(v_patch_book -> ''maps'' -> key) = ''object''\n'
    || E'        union select ''_sync'') fields where v_original_book ? k;\n    end if;');
  v_before := E'    v_book := jsonb_set(v_book, ''{_sync}'', v_sync, true);';
  if position(v_before in v_source) = 0 then raise exception 'Unexpected delta book update'; end if;
  v_source := replace(v_source, v_before, v_before
    || E'\n    if jsonb_typeof(v_original_book) = ''object'' then v_book := v_original_book || v_book; end if;\n'
    || E'    v_original_book := null;');
  v_before := E'      v_map_patch := v_patch_book -> ''maps'' -> v_domain;';
  if position(v_before in v_source) = 0 then raise exception 'Unexpected delta map lookup'; end if;
  v_source := replace(v_source, v_before, v_before
    || E'\n      if v_map_patch is null then\n'
    || E'        if not (v_original_book ? v_domain) then\n'
    || E'          v_book := jsonb_set(v_book, array[v_domain], ''{}''::jsonb, true);\n        end if;\n'
    || E'        continue;\n      end if;');

  v_start := position('  v_expanded := v_expanded || jsonb_build_object(' in v_source);
  v_before := E'  );\n  v_transport := public.compact_user_state_transport(v_expanded);';
  v_end := position(v_before in v_source);
  if v_start = 0 or v_end <= v_start then raise exception 'Unexpected delta root mirror'; end if;
  v_block := substring(v_source from v_start for v_end-v_start+length(v_before));
  v_block := replace(v_block, '  v_expanded := v_expanded || jsonb_build_object(',
    E'  select extra_state, mirror_keys into v_extra, v_mirrors\n'
    || E'  from public.prepare_user_state_extra(v_expanded, true, v_active_book_id);\n'
    || E'  v_transport := public.compact_user_state_transport((v_expanded - ''bookStates'') || jsonb_build_object(\n'
    || E'    ''bookStates'', (v_expanded -> ''bookStates'') - v_active_book_id,');
  v_block := replace(v_block, v_before, E'  ));\n  v_expanded := null;');
  v_source := overlay(v_source placing v_block from v_start for v_end-v_start+length(v_before));

  v_before := E'      extra_state = v_expanded - array[\n'
    || E'        ''view'', ''plan'', ''session'', ''introducedWords'', ''progress'',\n'
    || E'        ''activityLog'', ''studyWindows'', ''planTargetHistory'',\n'
    || E'        ''learningDayCounter'', ''wordListSort'',\n'
    || E'        ''wordBrowse'', ''dataVersion''\n      ],';
  if position(v_before in v_source) = 0 then raise exception 'Unexpected delta extra-state write'; end if;
  execute replace(v_source, v_before, E'      extra_state = v_extra,\n      extra_state_mirror_keys = v_mirrors,');
end;
$delta$;

do $staging$
declare
  v_source text := pg_get_functiondef('public.finalize_user_state_upload(uuid)'::regprocedure);
  v_before text := E'    v_payload := v_payload_text::jsonb;';
begin
  if position(v_before in v_source) = 0 then raise exception 'Unexpected staged JSON parser'; end if;
  execute replace(v_source, v_before, v_before || E'\n    v_payload_text := null;');
end;
$staging$;

-- INSERT ... ON CONFLICT DO NOTHING still fires BEFORE INSERT triggers. Its
-- empty draft row must never remove the existing account's committed chunks.
do $chunks$
declare
  v_source text := pg_get_functiondef('public.sync_user_state_transport_chunks()'::regprocedure);
  v_before text := E'  if new.transport_state is null then\n'
    || E'    delete from public.user_state_transport_chunks where user_id = new.user_id;';
begin
  if position(v_before in v_source) = 0 then raise exception 'Unexpected null transport trigger'; end if;
  execute replace(v_source, v_before, E'  if new.transport_state is null then\n'
    || E'    if tg_op <> ''INSERT'' then\n'
    || E'      delete from public.user_state_transport_chunks where user_id = new.user_id;\n    end if;');
end;
$chunks$;

commit;
