begin;

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

  -- Read the complete snapshot in one statement. The previous FOR SHARE lock
  -- could wait behind a concurrent save and leave browser retries stacked.
  select jsonb_build_object(
    'found', true,
    'revision', meta.revision,
    'updatedAt', meta.updated_at,
    'state', coalesce(meta.extra_state, '{}'::jsonb) || jsonb_build_object(
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

revoke all on function public.load_user_state() from public, anon;
grant execute on function public.load_user_state() to authenticated;

commit;
