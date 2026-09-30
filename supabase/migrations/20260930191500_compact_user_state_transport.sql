begin;

-- The normalized top-level fields already contain the active book. Older
-- snapshots also keep the same book under bookStates, which doubles the
-- largest part of the RPC response. Compact only the transport document; the
-- stored snapshot remains complete for deletion guards and recovery.
create or replace function public.compact_user_state_transport(p_state jsonb)
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
  v_supplement jsonb;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    return p_state;
  end if;

  v_books := p_state -> 'bookStates';
  if v_books is null or jsonb_typeof(v_books) <> 'object' then
    return p_state;
  end if;

  v_active_book_id := coalesce(
    nullif(p_state ->> 'activeBookId', ''),
    'kaoyan'
  );
  v_active_book := v_books -> v_active_book_id;
  if v_active_book is null or jsonb_typeof(v_active_book) <> 'object' then
    return p_state;
  end if;

  -- Supplemental active-book fields such as sync vectors and confusion links
  -- remain available at the top level. Top-level values win when both mirrors
  -- exist because current clients treat that mirror as authoritative.
  v_supplement := v_active_book - array[
    'view', 'plan', 'session', 'introducedWords', 'progress',
    'activityLog', 'studyWindows', 'learningDayCounter', 'wordListSort',
    'wordBrowse', 'dataVersion'
  ];

  return v_supplement
    || (p_state - 'bookStates')
    || jsonb_build_object('bookStates', v_books - v_active_book_id);
end;
$$;

create or replace function public.load_user_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '12s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'found', true,
    'revision', meta.revision,
    'updatedAt', meta.updated_at,
    'state', public.compact_user_state_transport(
      coalesce(meta.extra_state, '{}'::jsonb) || jsonb_build_object(
        'view', 'home',
        'plan', plan.plan_data,
        'session', meta.session_data,
        'introducedWords', meta.introduced_words,
        'progress', progress.data,
        'activityLog', activity.data,
        'studyWindows', windows.data,
        'learningDayCounter', meta.learning_day_counter,
        'wordListSort', meta.word_list_sort,
        'wordBrowse', null,
        'dataVersion', meta.data_version
      )
    )
  )
  into v_result
  from public.user_state_meta as meta
  left join public.plans as plan
    on plan.user_id = meta.user_id
  cross join lateral (
    select coalesce(
      jsonb_object_agg(item.sense_key, item.progress_data),
      '{}'::jsonb
    ) as data
    from public.sense_progress as item
    where item.user_id = meta.user_id
  ) as progress
  cross join lateral (
    select coalesce(
      jsonb_object_agg(
        to_char(item.activity_date, 'YYYY-MM-DD'),
        item.activity_data
      ),
      '{}'::jsonb
    ) as data
    from public.daily_activity as item
    where item.user_id = meta.user_id
  ) as activity
  cross join lateral (
    select coalesce(
      jsonb_agg(item.window_data order by item.sort_order),
      '[]'::jsonb
    ) as data
    from public.study_windows as item
    where item.user_id = meta.user_id
  ) as windows
  where meta.user_id = v_user_id;

  return coalesce(
    v_result,
    jsonb_build_object(
      'found', false,
      'revision', 0,
      'updatedAt', null,
      'state', null
    )
  );
end;
$$;

revoke all on function public.compact_user_state_transport(jsonb)
  from public, anon, authenticated;
revoke all on function public.load_user_state() from public, anon;
grant execute on function public.load_user_state() to authenticated;

commit;
