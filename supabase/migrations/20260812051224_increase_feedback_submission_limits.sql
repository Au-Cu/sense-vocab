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

  if v_context ->> 'source' = 'study'
    and nullif(btrim(v_context ->> 'wordId'), '') is not null
    and nullif(btrim(v_context ->> 'wordText'), '') is not null then
    v_context := jsonb_strip_nulls(jsonb_build_object(
      'source', 'study',
      'bookId', nullif(left(btrim(v_context ->> 'bookId'), 80), ''),
      'bookName', nullif(left(btrim(v_context ->> 'bookName'), 160), ''),
      'wordId', left(btrim(v_context ->> 'wordId'), 160),
      'wordText', left(btrim(v_context ->> 'wordText'), 160),
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
