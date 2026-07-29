begin;

alter table public.feedback_reports
  add column context_data jsonb not null default '{}'::jsonb;

alter table public.feedback_reports
  add constraint feedback_context_object
  check (
    jsonb_typeof(context_data) = 'object'
    and octet_length(context_data::text) <= 2048
  );

create or replace function public.submit_feedback(
  p_feedback_id uuid,
  p_message text,
  p_image_paths jsonb,
  p_context jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_message text := btrim(coalesce(p_message, ''));
  v_context jsonb := coalesce(p_context, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_feedback_id is null then
    raise exception 'Feedback id is required' using errcode = '22023';
  end if;
  if char_length(v_message) < 3 or char_length(v_message) > 4000 then
    raise exception 'Feedback must contain between 3 and 4000 characters'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_image_paths) <> 'array'
    or jsonb_array_length(p_image_paths) > 4 then
    raise exception 'Feedback may contain at most four images'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_image_paths) as image_path(path)
    where image_path.path not like
      v_user_id::text || '/' || p_feedback_id::text || '/%'
  ) then
    raise exception 'Invalid feedback image path' using errcode = '22023';
  end if;
  if jsonb_typeof(v_context) <> 'object'
    or octet_length(v_context::text) > 2048 then
    raise exception 'Invalid feedback context' using errcode = '22023';
  end if;

  if v_context ->> 'source' = 'study'
    and nullif(btrim(v_context ->> 'wordId'), '') is not null
    and nullif(btrim(v_context ->> 'wordText'), '') is not null then
    v_context := jsonb_strip_nulls(jsonb_build_object(
      'source', 'study',
      'wordId', left(btrim(v_context ->> 'wordId'), 160),
      'wordText', left(btrim(v_context ->> 'wordText'), 160),
      'cardType', nullif(left(btrim(v_context ->> 'cardType'), 40), ''),
      'capturedAt', nullif(left(btrim(v_context ->> 'capturedAt'), 40), '')
    ));
  else
    v_context := '{}'::jsonb;
  end if;

  insert into public.feedback_reports (
    id,
    user_id,
    message,
    image_paths,
    context_data
  )
  values (
    p_feedback_id,
    v_user_id,
    v_message,
    p_image_paths,
    v_context
  );

  return jsonb_build_object(
    'ok', true,
    'id', p_feedback_id,
    'createdAt', now()
  );
end;
$$;

create or replace function public.admin_feedback_list(
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(200, greatest(1, coalesce(p_limit, 100)));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_status is not null
    and p_status not in ('new', 'in_progress', 'resolved') then
    raise exception 'Invalid feedback status' using errcode = '22023';
  end if;

  return (
    with filtered as (
      select
        feedback.id,
        feedback.user_id,
        profile.email,
        feedback.message,
        feedback.image_paths,
        feedback.context_data,
        feedback.status,
        feedback.created_at,
        feedback.updated_at
      from public.feedback_reports as feedback
      left join public.profiles as profile
        on profile.user_id = feedback.user_id
      where p_status is null or feedback.status = p_status
    ),
    paged as (
      select *
      from filtered
      order by
        case status
          when 'new' then 0
          when 'in_progress' then 1
          else 2
        end,
        created_at desc
      limit v_limit
      offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'items', coalesce(
        (
          select jsonb_agg(jsonb_build_object(
            'id', id,
            'userId', user_id,
            'email', email,
            'message', message,
            'imagePaths', image_paths,
            'context', context_data,
            'status', status,
            'createdAt', created_at,
            'updatedAt', updated_at
          ))
          from paged
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke all on function public.submit_feedback(uuid, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.submit_feedback(uuid, text, jsonb, jsonb)
  to authenticated;

commit;
