begin;

-- The transport form removes the active book from bookStates and keeps its
-- durable fields at the top level. Reconstruct that book before applying
-- deletion checks or persisting the authoritative multi-book extra state.
create or replace function public.expand_user_state_transport(p_state jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_active_book_id text;
  v_books jsonb;
  v_active_book jsonb;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    return p_state;
  end if;

  v_active_book_id := nullif(p_state ->> 'activeBookId', '');
  if v_active_book_id is null then
    return p_state;
  end if;

  v_books := coalesce(p_state -> 'bookStates', '{}'::jsonb);
  if jsonb_typeof(v_books) <> 'object' then
    v_books := '{}'::jsonb;
  end if;
  if jsonb_typeof(v_books -> v_active_book_id) = 'object' then
    return p_state;
  end if;

  v_active_book := p_state - array[
    'schemaVersion', 'activeBookId', 'bookStates'
  ];
  v_books := jsonb_set(
    v_books,
    array[v_active_book_id],
    v_active_book,
    true
  );
  return jsonb_set(p_state, '{bookStates}', v_books, true);
end;
$$;

revoke all on function public.expand_user_state_transport(jsonb)
  from public, anon, authenticated;

-- Keep the proven field-level deletion detector intact, but normalize compact
-- and expanded states to the same logical representation before comparing.
alter function public.state_has_undeclared_deletions(jsonb, jsonb)
  rename to state_has_undeclared_deletions_unexpanded;

revoke all on function public.state_has_undeclared_deletions_unexpanded(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.state_has_undeclared_deletions(
  p_existing jsonb,
  p_incoming jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select public.state_has_undeclared_deletions_unexpanded(
    public.expand_user_state_transport(p_existing),
    public.expand_user_state_transport(p_incoming)
  )
$$;

revoke all on function public.state_has_undeclared_deletions(jsonb, jsonb)
  from public, anon, authenticated;

-- Full uploads remain compact while crossing the RPC boundary, but the
-- authoritative extra state must retain every logical book. This also keeps
-- future deletion checks as strong as they were before transport compaction.
create or replace function public.save_user_state(
  p_state jsonb,
  p_expected_revision bigint default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '120s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_input jsonb;
  v_authoritative jsonb;
  v_state jsonb;
  v_document jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_input := public.compact_user_state_transport(p_state);
  v_authoritative := public.expand_user_state_transport(v_input);
  v_result := public.save_user_state_legacy(
    v_input,
    p_expected_revision,
    p_force
  );

  if coalesce((v_result ->> 'ok')::boolean, false) then
    v_state := public.materialize_user_state_transport(v_input);
    v_document := jsonb_build_object(
      'found', true,
      'revision', (v_result ->> 'revision')::bigint,
      'updatedAt', v_result -> 'updatedAt',
      'state', v_state
    );
    if octet_length(v_document::text) > 67108864 then
      raise exception 'State exceeds the 64 MB transport safety limit'
        using errcode = '22023';
    end if;

    update public.user_state_meta
    set extra_state = v_authoritative - array[
          'view', 'plan', 'session', 'introducedWords', 'progress',
          'activityLog', 'studyWindows', 'learningDayCounter', 'wordListSort',
          'wordBrowse', 'dataVersion'
        ],
        transport_state = v_state,
        transport_bytes = octet_length(v_document::text)
    where user_id = v_user_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.save_user_state(jsonb, bigint, boolean)
  from public, anon;
grant execute on function public.save_user_state(jsonb, bigint, boolean)
  to authenticated;

-- Migration-time regression: compacting an equivalent state must be safe,
-- while removing a durable active-book record must still be rejected.
do $regression$
declare
  v_full jsonb;
  v_compact jsonb;
  v_deleted jsonb;
begin
  v_full := jsonb_build_object(
    'activeBookId', 'kaoyan',
    'introducedWords', jsonb_build_array('alpha'),
    'progress', jsonb_build_object(
      'alpha:n-1', jsonb_build_object('status', 'review')
    ),
    'activityLog', jsonb_build_object(
      '2026-10-03', jsonb_build_object('newWords', 1)
    ),
    'studyWindows', jsonb_build_array(
      jsonb_build_object('id', 'window-1')
    ),
    'confusionLinks', '{}'::jsonb,
    'bookStates', jsonb_build_object(
      'kaoyan', jsonb_build_object(
        'introducedWords', jsonb_build_array('alpha'),
        'progress', jsonb_build_object(
          'alpha:n-1', jsonb_build_object('status', 'review')
        ),
        'activityLog', jsonb_build_object(
          '2026-10-03', jsonb_build_object('newWords', 1)
        ),
        'studyWindows', jsonb_build_array(
          jsonb_build_object('id', 'window-1')
        ),
        'confusionLinks', '{}'::jsonb
      ),
      'ielts', jsonb_build_object(
        'introducedWords', jsonb_build_array('beta'),
        'progress', jsonb_build_object(
          'beta:n-1', jsonb_build_object('status', 'reinforce')
        ),
        'activityLog', '{}'::jsonb,
        'studyWindows', '[]'::jsonb,
        'confusionLinks', '{}'::jsonb
      )
    )
  );
  v_compact := public.compact_user_state_transport(v_full);

  if public.state_has_undeclared_deletions(v_full, v_compact) then
    raise exception 'Equivalent compact transport was classified as destructive';
  end if;
  if not (
    public.expand_user_state_transport(v_compact) -> 'bookStates' ? 'kaoyan'
  ) then
    raise exception 'Compact transport did not restore its active book';
  end if;

  v_deleted := jsonb_set(v_compact, '{progress}', '{}'::jsonb, true);
  if not public.state_has_undeclared_deletions(v_full, v_deleted) then
    raise exception 'A durable progress deletion bypassed the state guard';
  end if;
end;
$regression$;

commit;
