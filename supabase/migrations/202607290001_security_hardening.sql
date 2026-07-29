begin;

-- Account state is intentionally exposed only through revision-checked RPCs.
-- Removing direct table writes prevents clients from bypassing validation or
-- replacing one part of a state snapshot without the matching revision.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.plans from anon, authenticated;
revoke all on table public.user_state_meta from anon, authenticated;
revoke all on table public.sense_progress from anon, authenticated;
revoke all on table public.daily_activity from anon, authenticated;
revoke all on table public.study_windows from anon, authenticated;

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'feedback-images';

create or replace function public.can_upload_feedback_image(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select
    auth.uid() is not null
    and array_length(string_to_array(p_name, '/'), 1) = 3
    and split_part(p_name, '/', 1) = auth.uid()::text
    and split_part(p_name, '/', 3) ~ '^[1-4]\.(jpg|jpeg|png|webp)$'
    and exists (
      select 1
      from public.feedback_reports as feedback
      where feedback.user_id = auth.uid()
        and feedback.id::text = split_part(p_name, '/', 2)
        and feedback.image_paths = '[]'::jsonb
    );
$$;

revoke all on function public.can_upload_feedback_image(text)
  from public, anon;
grant execute on function public.can_upload_feedback_image(text)
  to authenticated;

drop policy if exists "feedback_images_insert_own" on storage.objects;
create policy "feedback_images_insert_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'feedback-images'
    and public.can_upload_feedback_image(name)
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
  if jsonb_typeof(coalesce(p_image_paths, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_image_paths, '[]'::jsonb)) <> 0 then
    raise exception 'Create feedback before attaching images'
      using errcode = '22023';
  end if;
  if jsonb_typeof(v_context) <> 'object'
    or octet_length(v_context::text) > 2048 then
    raise exception 'Invalid feedback context' using errcode = '22023';
  end if;

  -- Serialize submissions per account so simultaneous devices cannot race
  -- through the rate-limit counters.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 9137));
  if (
    select count(*)
    from public.feedback_reports
    where user_id = v_user_id
      and created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many feedback submissions; try again later'
      using errcode = 'P0001';
  end if;
  if (
    select count(*)
    from public.feedback_reports
    where user_id = v_user_id
      and created_at >= now() - interval '1 day'
  ) >= 30 then
    raise exception 'Daily feedback limit reached'
      using errcode = 'P0001';
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
    '[]'::jsonb,
    v_context
  );

  return jsonb_build_object(
    'ok', true,
    'id', p_feedback_id,
    'createdAt', now()
  );
end;
$$;

create or replace function public.attach_feedback_images(
  p_feedback_id uuid,
  p_image_paths jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_paths jsonb := coalesce(p_image_paths, '[]'::jsonb);
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_feedback_id is null then
    raise exception 'Feedback id is required' using errcode = '22023';
  end if;
  if jsonb_typeof(v_paths) <> 'array'
    or jsonb_array_length(v_paths) > 4 then
    raise exception 'Feedback may contain at most four images'
      using errcode = '22023';
  end if;
  if (
    select count(*) <> count(distinct image_path.path)
    from jsonb_array_elements_text(v_paths) as image_path(path)
  ) then
    raise exception 'Duplicate feedback image path'
      using errcode = '22023';
  end if;

  perform 1
  from public.feedback_reports
  where id = p_feedback_id
    and user_id = v_user_id
    and image_paths = '[]'::jsonb
    and created_at >= now() - interval '1 hour'
  for update;
  if not found then
    raise exception 'Feedback cannot accept images'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_paths) as image_path(path)
    where not public.can_upload_feedback_image(image_path.path)
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = 'feedback-images'
          and object.name = image_path.path
      )
  ) then
    raise exception 'Invalid or missing feedback image'
      using errcode = '22023';
  end if;

  update public.feedback_reports
  set image_paths = v_paths,
      updated_at = now()
  where id = p_feedback_id
    and user_id = v_user_id
    and image_paths = '[]'::jsonb;
  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'Feedback images were already attached'
      using errcode = '40001';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', p_feedback_id,
    'imageCount', jsonb_array_length(v_paths)
  );
end;
$$;

create or replace function public.discard_empty_feedback(p_feedback_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.feedback_reports
  where id = p_feedback_id
    and user_id = v_user_id
    and image_paths = '[]'::jsonb
    and created_at >= now() - interval '1 hour';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_feedback(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.submit_feedback(uuid, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.submit_feedback(uuid, text, jsonb, jsonb)
  to authenticated;
revoke all on function public.attach_feedback_images(uuid, jsonb)
  from public, anon;
grant execute on function public.attach_feedback_images(uuid, jsonb)
  to authenticated;
revoke all on function public.discard_empty_feedback(uuid)
  from public, anon;
grant execute on function public.discard_empty_feedback(uuid)
  to authenticated;

commit;
