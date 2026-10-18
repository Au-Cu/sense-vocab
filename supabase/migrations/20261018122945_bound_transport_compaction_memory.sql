begin;

-- The active book is a mirror that is discarded from transport. Do not copy
-- its complete history through jsonb_object_agg or compact its session twice.
create or replace function public.compact_user_state_transport(p_state jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_state jsonb;
  v_active_book_id text;
  v_books jsonb;
  v_active_book jsonb;
  v_supplement jsonb := '{}'::jsonb;
  v_replacements jsonb;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    return p_state;
  end if;
  v_books := p_state -> 'bookStates';
  if v_books is null or jsonb_typeof(v_books) <> 'object' then
    if jsonb_typeof(p_state -> 'session') = 'object' then
      return jsonb_set(p_state, '{session}',
        public.compact_user_session_transport(p_state -> 'session'), true);
    end if;
    return p_state;
  end if;
  v_active_book_id := coalesce(nullif(p_state ->> 'activeBookId', ''), 'kaoyan');
  v_active_book := v_books -> v_active_book_id;
  if jsonb_typeof(v_active_book) = 'object' then
    -- Top-level fields win, including explicit JSON nulls. Keep unknown book
    -- supplements only when the root does not already supply the same key.
    v_supplement := (v_active_book - array[
      'view', 'plan', 'session', 'introducedWords', 'progress',
      'activityLog', 'studyWindows', 'learningDayCounter', 'wordListSort',
      'planTargetHistory', 'wordBrowse', 'dataVersion'
    ]) - array(select jsonb_object_keys(p_state));
    v_books := v_books - v_active_book_id;
  end if;
  select coalesce(jsonb_object_agg(item.key,
    case when jsonb_typeof(item.value) = 'object'
      and jsonb_typeof(item.value -> 'session') = 'object'
      then jsonb_set(item.value, '{session}',
        public.compact_user_session_transport(item.value -> 'session'), true)
      else item.value end), '{}'::jsonb)
  into v_books from jsonb_each(v_books) as item(key, value);

  v_replacements := jsonb_build_object('bookStates', v_books);
  if p_state ? 'session' then
    v_replacements := v_replacements || jsonb_build_object('session',
      case when jsonb_typeof(p_state -> 'session') = 'object'
        then public.compact_user_session_transport(p_state -> 'session')
        else p_state -> 'session' end);
  end if;
  v_state := p_state - array['bookStates', 'session'];
  if v_supplement <> '{}'::jsonb then v_state := v_state || v_supplement; end if;
  return v_state || v_replacements;
end;
$$;
revoke all on function public.compact_user_state_transport(jsonb)
  from public, anon, authenticated;

-- Build the expanded mirror after the authoritative CAS/guard operation, not
-- while its full incoming state and recovery snapshot are also live.
do $writer$
declare
  v_source text := pg_get_functiondef('public.save_user_state(jsonb,bigint,boolean)'::regprocedure);
  v_before text := E'  v_authoritative := public.expand_user_state_transport(v_input);\n';
  v_after text := E'  if coalesce((v_result ->> ''ok'')::boolean, false) then\n';
begin
  if (length(v_source)-length(replace(v_source,v_before,'')))/length(v_before) <> 1
    or (length(v_source)-length(replace(v_source,v_after,'')))/length(v_after) <> 1 then
    raise exception 'Unexpected full-state writer definition';
  end if;
  v_source := replace(v_source,v_before,'');
  v_source := replace(v_source,v_after,v_after || '  ' || v_before);
  execute v_source;
end;
$writer$;

-- Release scratch documents after their final use. Holding old and expanded
-- histories during row/transport writes needlessly raises the per-call peak.
do $scratch$
declare
  v_signature text;
  v_source text;
  v_pairs text[][];
  v_pair text[];
begin
  foreach v_signature in array array[
    'public.save_user_state_legacy(jsonb,bigint,boolean)',
    'public.save_user_state_delta(jsonb,bigint,boolean)',
    'public.save_user_state(jsonb,bigint,boolean)'
  ] loop
    v_source := pg_get_functiondef(v_signature::regprocedure);
    if v_signature like '%_legacy(%' then
      v_pairs := array[array[
        E'    on conflict (user_id, revision) do nothing;\n  end if;\n',
        E'    on conflict (user_id, revision) do nothing;\n  end if;\n  v_existing_state := null;\n'
      ]];
    elsif v_signature like '%_delta(%' then
      v_pairs := array[
        array[E'  v_expanded := jsonb_set(v_transport, ''{bookStates}'', v_books, true);\n',
          E'  v_expanded := jsonb_set(v_transport, ''{bookStates}'', v_books, true);\n  v_books := null;\n  v_active_book := null;\n'],
        array[E'  -- Rebuild the active-book mirror expected by older clients and by the\n',
          E'  v_book := null;\n  v_sync := null;\n  v_map := null;\n  -- Rebuild the active-book mirror expected by older clients and by the\n'],
        array[E'  if octet_length(jsonb_build_object(\n',
          E'  v_previous_transport := null;\n  if octet_length(jsonb_build_object(\n'],
        array[E'    on conflict (user_id, revision) do nothing;\n  end if;\n',
          E'    on conflict (user_id, revision) do nothing;\n  end if;\n  v_existing_state := null;\n']
      ];
    else
      v_pairs := array[
        array['  v_document jsonb;', '  v_document_bytes bigint;'],
        array[E'    v_state := public.materialize_user_state_transport(v_input);\n',
          E'    v_state := public.materialize_user_state_transport(v_input);\n    v_input := null;\n'],
        array['    v_document := jsonb_build_object(',
          '    v_document_bytes := octet_length(jsonb_build_object('],
        array[E'      ''state'', v_state\n    );',
          E'      ''state'', v_state\n    )::text);']
      ];
      if (length(v_source)-length(replace(v_source,'octet_length(v_document::text)','')))
        /length('octet_length(v_document::text)') <> 2 then
        raise exception 'Unexpected full-state byte checks';
      end if;
      v_source := replace(v_source,'octet_length(v_document::text)','v_document_bytes');
    end if;
    foreach v_pair slice 1 in array v_pairs loop
      if (length(v_source)-length(replace(v_source,v_pair[1],'')))/length(v_pair[1]) <> 1 then
        raise exception 'Unexpected scratch lifetime in %', v_signature;
      end if;
      v_source := replace(v_source,v_pair[1],v_pair[2]);
    end loop;
    execute v_source;
  end loop;
end;
$scratch$;

commit;
