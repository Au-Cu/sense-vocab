create or replace function public.submit_feedback(
  p_feedback_id uuid,
  p_message text,
  p_image_paths jsonb,
  p_context jsonb,
  p_expected_image_count integer,
  p_attachment_rights_confirmed boolean,
  p_attachment_ai_disclosure text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_message text := btrim(coalesce(p_message, ''));
  v_context jsonb := coalesce(p_context, '{}'::jsonb);
  v_count integer := coalesce(p_expected_image_count, 0);
  v_ai text := coalesce(p_attachment_ai_disclosure, 'not_applicable');
  v_issue_type text;
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
  if jsonb_typeof(coalesce(p_image_paths, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_image_paths, '[]'::jsonb)) <> 0 then
    raise exception 'Create feedback before attaching images' using errcode = '22023';
  end if;
  if jsonb_typeof(v_context) <> 'object' or octet_length(v_context::text) > 2048 then
    raise exception 'Invalid feedback context' using errcode = '22023';
  end if;
  if v_count not between 0 and 4 then
    raise exception 'Invalid feedback image count' using errcode = '22023';
  end if;
  if v_ai not in ('not_applicable', 'not_ai', 'contains_ai', 'unknown') then
    raise exception 'Invalid feedback AI disclosure' using errcode = '22023';
  end if;
  if v_count > 0 and (
    p_attachment_rights_confirmed is not true or v_ai = 'not_applicable'
  ) then
    raise exception 'Attachment rights and AI disclosure are required'
      using errcode = '22023';
  end if;
  if v_count = 0 then v_ai := 'not_applicable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 9137));
  if (
    select count(*) from public.feedback_reports
    where user_id = v_user_id and created_at >= clock_timestamp() - interval '1 hour'
  ) >= 20 then
    raise exception 'Too many feedback submissions; try again later' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.feedback_reports
    where user_id = v_user_id and created_at >= clock_timestamp() - interval '1 day'
  ) >= 60 then
    raise exception 'Daily feedback limit reached' using errcode = 'P0001';
  end if;

  v_issue_type := nullif(left(btrim(v_context ->> 'issueType'), 80), '');
  if v_issue_type is not null and v_issue_type not in (
    'missing-sense',
    'redundant-sense',
    'meaning-definition-mismatch',
    'meaning-example-mismatch',
    'meaning-definition-zh-mismatch',
    'meaning-example-zh-mismatch',
    'self-referential-definition',
    'definition-zh-error',
    'example-zh-error',
    'garbled-mixed-language',
    'other'
  ) then
    raise exception 'Invalid feedback issue type' using errcode = '22023';
  end if;

  if v_context ->> 'source' = 'study'
    and nullif(btrim(v_context ->> 'wordId'), '') is not null
    and nullif(btrim(v_context ->> 'wordText'), '') is not null then
    v_context := jsonb_strip_nulls(jsonb_build_object(
      'source', 'study',
      'bookId', nullif(left(btrim(v_context ->> 'bookId'), 80), ''),
      'bookName', nullif(left(btrim(v_context ->> 'bookName'), 160), ''),
      'wordId', left(btrim(v_context ->> 'wordId'), 160),
      'wordText', left(btrim(v_context ->> 'wordText'), 160),
      'senseId', nullif(left(btrim(v_context ->> 'senseId'), 80), ''),
      'issueType', v_issue_type,
      'cardType', nullif(left(btrim(v_context ->> 'cardType'), 40), ''),
      'capturedAt', nullif(left(btrim(v_context ->> 'capturedAt'), 40), '')
    ));
  else
    v_context := '{}'::jsonb;
  end if;

  insert into public.feedback_reports (
    id, user_id, message, image_paths, context_data, expected_image_count,
    attachment_rights_confirmed_at, attachment_ai_disclosure
  ) values (
    p_feedback_id, v_user_id, v_message, '[]'::jsonb, v_context, v_count,
    case when v_count > 0 then clock_timestamp() else null end, v_ai
  );

  return jsonb_build_object('ok', true, 'id', p_feedback_id, 'createdAt', clock_timestamp());
end;
$$;

revoke all on function public.submit_feedback(uuid, text, jsonb, jsonb, integer, boolean, text)
  from public, anon;
grant execute on function public.submit_feedback(uuid, text, jsonb, jsonb, integer, boolean, text)
  to authenticated;

create or replace function public.admin_feedback_triage(
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
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
        feedback.status,
        feedback.context_data,
        feedback.message,
        feedback.created_at
      from public.feedback_reports as feedback
      where p_status is null or feedback.status = p_status
    ),
    paged as (
      select *
      from filtered
      order by
        case status when 'new' then 0 when 'in_progress' then 1 else 2 end,
        created_at desc
      limit v_limit
      offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', jsonb_build_object(
        'new', (select count(*) from filtered where status = 'new'),
        'inProgress', (select count(*) from filtered where status = 'in_progress'),
        'resolved', (select count(*) from filtered where status = 'resolved')
      ),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'anonymousId', md5(id::text),
          'status', status,
          'type', coalesce(
            nullif(context_data ->> 'issueType', ''),
            nullif(split_part(split_part(message, E'\n', 1), '：', 2), ''),
            'general'
          ),
          'contentId', coalesce(
            nullif(concat_ws(':', nullif(context_data ->> 'wordId', ''), nullif(context_data ->> 'senseId', '')), ''),
            null
          )
        ) order by
          case status when 'new' then 0 when 'in_progress' then 1 else 2 end,
          created_at desc
        )
        from paged
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.admin_feedback_detail(
  p_anonymous_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_anonymous_id text := lower(btrim(coalesce(p_anonymous_id, '')));
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if v_anonymous_id !~ '^[0-9a-f]{32}$' then
    raise exception 'Invalid anonymous feedback id' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'anonymousId', md5(feedback.id::text),
    'feedbackId', feedback.id,
    'status', feedback.status,
    'type', coalesce(
      nullif(feedback.context_data ->> 'issueType', ''),
      nullif(split_part(split_part(feedback.message, E'\n', 1), '：', 2), ''),
      'general'
    ),
    'contentId', coalesce(
      nullif(concat_ws(':', nullif(feedback.context_data ->> 'wordId', ''), nullif(feedback.context_data ->> 'senseId', '')), ''),
      null
    ),
    'message', feedback.message,
    'context', feedback.context_data,
    'imageCount', jsonb_array_length(feedback.image_paths),
    'adminReply', feedback.admin_reply,
    'repliedAt', feedback.replied_at,
    'createdAt', feedback.created_at,
    'updatedAt', feedback.updated_at
  )
  into v_result
  from public.feedback_reports as feedback
  where md5(feedback.id::text) = v_anonymous_id
  limit 1;

  if v_result is null then
    raise exception 'Feedback not found' using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;

revoke all on function public.admin_feedback_triage(text, integer, integer)
  from public, anon;
revoke all on function public.admin_feedback_detail(text)
  from public, anon;
grant execute on function public.admin_feedback_triage(text, integer, integer)
  to authenticated;
grant execute on function public.admin_feedback_detail(text)
  to authenticated;
