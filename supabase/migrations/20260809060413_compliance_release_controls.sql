begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Legal documents are versioned server-side. Existing v1 receipts remain in the
-- audit table but no longer satisfy the active v3 requirements, which makes
-- re-consent mandatory before cloud learning data is read again.
create table if not exists public.legal_document_versions (
  consent_type text not null check (
    consent_type in ('terms_privacy', 'cross_border', 'age_14_or_over')
  ),
  document_version text not null check (char_length(document_version) between 1 and 80),
  effective_at timestamptz not null,
  document_url text not null check (char_length(document_url) between 1 and 500),
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  requires_reconsent boolean not null default true,
  active boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  primary key (consent_type, document_version)
);

create unique index if not exists legal_document_versions_one_active_idx
  on public.legal_document_versions (consent_type)
  where active;

alter table public.legal_document_versions enable row level security;
revoke all on table public.legal_document_versions from public, anon, authenticated;

update public.legal_document_versions set active = false where active;
insert into public.legal_document_versions (
  consent_type,
  document_version,
  effective_at,
  document_url,
  content_sha256,
  requires_reconsent,
  active
)
values
  ('terms_privacy', '2026-08-09-v3', '2026-08-09T00:00:00+08:00', '/legal.html#terms', 'a4e836365f0ddb003371f4ed9844ee1defabefebf649cb63a7f932621ff100de', true, true),
  ('cross_border', '2026-08-09-v3', '2026-08-09T00:00:00+08:00', '/legal.html#cross-border', 'a4e836365f0ddb003371f4ed9844ee1defabefebf649cb63a7f932621ff100de', true, true),
  ('age_14_or_over', '2026-08-09-v3', '2026-08-09T00:00:00+08:00', '/legal.html#terms', 'a4e836365f0ddb003371f4ed9844ee1defabefebf649cb63a7f932621ff100de', true, true)
on conflict (consent_type, document_version) do update set
  effective_at = excluded.effective_at,
  document_url = excluded.document_url,
  requires_reconsent = excluded.requires_reconsent,
  active = excluded.active;

create or replace function public.load_my_legal_consents()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_terms_version text;
  v_cross_border_version text;
  v_age_version text;
  v_terms boolean;
  v_cross_border boolean;
  v_age boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select document_version into strict v_terms_version
  from public.legal_document_versions
  where consent_type = 'terms_privacy' and active;
  select document_version into strict v_cross_border_version
  from public.legal_document_versions
  where consent_type = 'cross_border' and active;
  select document_version into strict v_age_version
  from public.legal_document_versions
  where consent_type = 'age_14_or_over' and active;

  select exists (
    select 1 from public.user_legal_consents
    where user_id = v_user_id
      and consent_type = 'terms_privacy'
      and document_version = v_terms_version
  ) into v_terms;
  select exists (
    select 1 from public.user_legal_consents
    where user_id = v_user_id
      and consent_type = 'cross_border'
      and document_version = v_cross_border_version
  ) into v_cross_border;
  select exists (
    select 1 from public.user_legal_consents
    where user_id = v_user_id
      and consent_type = 'age_14_or_over'
      and document_version = v_age_version
  ) into v_age;

  return jsonb_build_object(
    'complete', v_terms and v_cross_border and v_age,
    'termsPrivacy', v_terms,
    'crossBorder', v_cross_border,
    'age14OrOver', v_age,
    'termsVersion', v_terms_version,
    'privacyVersion', v_terms_version,
    'crossBorderVersion', v_cross_border_version,
    'ageVersion', v_age_version
  );
end;
$$;

create or replace function public.record_my_legal_consents(
  p_terms_privacy boolean,
  p_cross_border boolean,
  p_age_14_or_over boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_terms_version text;
  v_cross_border_version text;
  v_age_version text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_terms_privacy is not true
    or p_cross_border is not true
    or p_age_14_or_over is not true then
    raise exception 'all required consents must be explicitly accepted'
      using errcode = '22023';
  end if;

  select document_version into strict v_terms_version
  from public.legal_document_versions
  where consent_type = 'terms_privacy' and active;
  select document_version into strict v_cross_border_version
  from public.legal_document_versions
  where consent_type = 'cross_border' and active;
  select document_version into strict v_age_version
  from public.legal_document_versions
  where consent_type = 'age_14_or_over' and active;

  insert into public.user_legal_consents (
    user_id,
    consent_type,
    document_version,
    consented_at
  ) values
    (v_user_id, 'terms_privacy', v_terms_version, clock_timestamp()),
    (v_user_id, 'cross_border', v_cross_border_version, clock_timestamp()),
    (v_user_id, 'age_14_or_over', v_age_version, clock_timestamp())
  on conflict (user_id, consent_type) do update set
    document_version = excluded.document_version,
    consented_at = excluded.consented_at;

  return public.load_my_legal_consents();
end;
$$;

-- Feedback attachments are private, but the submitter must still confirm that
-- the app may receive and process them. The original binary is never retained.
alter table public.feedback_reports
  add column if not exists expected_image_count integer not null default 0,
  add column if not exists attachment_rights_confirmed_at timestamptz,
  add column if not exists attachment_ai_disclosure text not null default 'not_applicable',
  add column if not exists resolved_at timestamptz;

alter table public.feedback_reports
  drop constraint if exists feedback_reports_expected_image_count_check;
alter table public.feedback_reports
  add constraint feedback_reports_expected_image_count_check
  check (expected_image_count between 0 and 4);
alter table public.feedback_reports
  drop constraint if exists feedback_reports_attachment_ai_disclosure_check;
alter table public.feedback_reports
  add constraint feedback_reports_attachment_ai_disclosure_check
  check (attachment_ai_disclosure in ('not_applicable', 'not_ai', 'contains_ai', 'unknown'));

create or replace function private.apply_feedback_retention_deadline()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := clock_timestamp();
    new.expires_at := least(new.expires_at, new.resolved_at + interval '180 days');
  elsif new.status = 'resolved' and new.resolved_at is null then
    new.resolved_at := coalesce(new.updated_at, clock_timestamp());
    new.expires_at := least(new.expires_at, new.resolved_at + interval '180 days');
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_reports_retention_deadline on public.feedback_reports;
create trigger feedback_reports_retention_deadline
before update of status on public.feedback_reports
for each row execute function private.apply_feedback_retention_deadline();

update public.feedback_reports
set resolved_at = coalesce(resolved_at, updated_at, created_at),
    expires_at = least(
      expires_at,
      coalesce(resolved_at, updated_at, created_at) + interval '180 days'
    )
where status = 'resolved';

create table if not exists private.feedback_retention_jobs (
  feedback_id uuid primary key references public.feedback_reports(id) on delete cascade,
  image_paths text[] not null default '{}'::text[],
  status text not null default 'pending' check (status in ('pending', 'processing', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 100),
  next_attempt_at timestamptz not null default clock_timestamp(),
  locked_by uuid,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists feedback_retention_jobs_ready_idx
  on private.feedback_retention_jobs (next_attempt_at, created_at)
  where status in ('pending', 'failed');

create table if not exists private.feedback_retention_runs (
  id bigint generated always as identity primary key,
  invoked_at timestamptz not null default clock_timestamp(),
  status text not null check (status in ('invoked', 'skipped_missing_secret', 'request_failed')),
  request_id bigint,
  detail text
);

create or replace function private.enqueue_expired_feedback_retention()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into private.feedback_retention_jobs (feedback_id, image_paths)
  select feedback.id, coalesce(
    array(select jsonb_array_elements_text(feedback.image_paths)),
    '{}'::text[]
  )
  from public.feedback_reports as feedback
  where feedback.expires_at <= clock_timestamp()
  on conflict (feedback_id) do update set
    image_paths = excluded.image_paths,
    updated_at = clock_timestamp();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.retention_claim_feedback_batch(
  p_worker_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
  v_result jsonb;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_worker_id is null then
    raise exception 'worker id required' using errcode = '22023';
  end if;

  perform private.enqueue_expired_feedback_retention();
  with claimed as (
    select job.feedback_id
    from private.feedback_retention_jobs as job
    where job.status in ('pending', 'failed')
      and job.next_attempt_at <= clock_timestamp()
      and (job.locked_at is null or job.locked_at < clock_timestamp() - interval '15 minutes')
    order by job.next_attempt_at, job.created_at
    for update skip locked
    limit v_limit
  ), updated as (
    update private.feedback_retention_jobs as job
    set status = 'processing',
        attempts = job.attempts + 1,
        locked_by = p_worker_id,
        locked_at = clock_timestamp(),
        updated_at = clock_timestamp()
    from claimed
    where job.feedback_id = claimed.feedback_id
    returning job.feedback_id, job.image_paths, job.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', feedback_id,
    'imagePaths', image_paths,
    'attempt', attempts
  )), '[]'::jsonb)
  into v_result
  from updated;
  return v_result;
end;
$$;

create or replace function public.retention_finalize_feedback_batch(
  p_worker_id uuid,
  p_feedback_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested integer := cardinality(coalesce(p_feedback_ids, '{}'::uuid[]));
  v_deleted integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if v_requested > 100 then
    raise exception 'too many feedback rows requested' using errcode = '22023';
  end if;
  if v_requested = 0 then return jsonb_build_object('deleted', 0); end if;
  if (
    select count(*) from private.feedback_retention_jobs
    where feedback_id = any(p_feedback_ids)
      and status = 'processing'
      and locked_by = p_worker_id
  ) <> v_requested then
    raise exception 'retention claim mismatch' using errcode = '40001';
  end if;

  delete from public.feedback_reports as feedback
  where feedback.id = any(p_feedback_ids)
    and feedback.expires_at <= clock_timestamp();
  get diagnostics v_deleted = row_count;
  if v_deleted <> v_requested then
    raise exception 'expired feedback deletion mismatch' using errcode = '40001';
  end if;
  return jsonb_build_object('deleted', v_deleted);
end;
$$;

create or replace function public.retention_fail_feedback_batch(
  p_worker_id uuid,
  p_feedback_ids uuid[],
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  update private.feedback_retention_jobs
  set status = 'failed',
      next_attempt_at = clock_timestamp() + least(
        interval '24 hours',
        interval '15 minutes' * greatest(attempts, 1)
      ),
      locked_by = null,
      locked_at = null,
      last_error = left(coalesce(p_error, 'unknown error'), 500),
      updated_at = clock_timestamp()
  where feedback_id = any(coalesce(p_feedback_ids, '{}'::uuid[]))
    and status = 'processing'
    and locked_by = p_worker_id;
  get diagnostics v_updated = row_count;
  return jsonb_build_object('failed', v_updated);
end;
$$;

-- Announcement image and text provenance is stored as structured, bounded
-- metadata. A takedown immediately hides the announcement before public image
-- objects are removed, so deletion is not used as a substitute for provenance.
alter table public.announcements
  add column if not exists rights_metadata jsonb not null default '[]'::jsonb,
  add column if not exists content_provenance jsonb not null default '{}'::jsonb,
  add column if not exists rights_status text not null default 'verified',
  add column if not exists takedown_reason text,
  add column if not exists takedown_requested_at timestamptz,
  add column if not exists takedown_completed_at timestamptz;

alter table public.announcements drop constraint if exists announcements_rights_status_check;
alter table public.announcements add constraint announcements_rights_status_check
  check (rights_status in ('verified', 'takedown_pending', 'withdrawn'));
alter table public.announcements drop constraint if exists announcements_rights_metadata_check;
alter table public.announcements add constraint announcements_rights_metadata_check
  check (jsonb_typeof(rights_metadata) = 'array' and pg_column_size(rights_metadata) <= 32768);
alter table public.announcements drop constraint if exists announcements_content_provenance_check;
alter table public.announcements add constraint announcements_content_provenance_check
  check (jsonb_typeof(content_provenance) = 'object' and pg_column_size(content_provenance) <= 8192);

create policy "announcements_public_verified" on public.announcements
  for select to anon, authenticated
  using (rights_status = 'verified' and published_at <= clock_timestamp());
grant select (id, title, body, image_paths, is_pinned, published_at, created_at, rights_metadata, content_provenance)
  on public.announcements to anon, authenticated;

create or replace function public.load_public_announcements(p_limit integer default 100)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'authenticated', (select auth.uid()) is not null,
    'unreadCount', 0,
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', recent.id,
      'kind', 'announcement',
      'type', 'announcement',
      'title', recent.title,
      'body', recent.body,
      'feedbackId', null,
      'imagePaths', recent.image_paths,
      'isPinned', recent.is_pinned,
      'rightsMetadata', recent.rights_metadata,
      'contentProvenance', recent.content_provenance,
      'createdAt', recent.published_at,
      'readAt', null
    ) order by recent.is_pinned desc, recent.published_at desc, recent.id), '[]'::jsonb)
  )
  from (
    select * from public.announcements
    order by is_pinned desc, published_at desc, id
    limit least(200, greatest(1, coalesce(p_limit, 100)))
  ) as recent;
$$;

-- A separate migration section below replaces the authenticated notification
-- RPC and the admin announcement RPCs after their new columns are available.

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
  ) >= 10 then
    raise exception 'Too many feedback submissions; try again later' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.feedback_reports
    where user_id = v_user_id and created_at >= clock_timestamp() - interval '1 day'
  ) >= 30 then
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

create or replace function public.attach_feedback_images(
  p_feedback_id uuid,
  p_image_paths jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_paths jsonb := coalesce(p_image_paths, '[]'::jsonb);
  v_expected integer;
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_feedback_id is null or jsonb_typeof(v_paths) <> 'array'
    or jsonb_array_length(v_paths) > 4 then
    raise exception 'Invalid feedback images' using errcode = '22023';
  end if;
  if (
    select count(*) <> count(distinct image_path.path)
    from jsonb_array_elements_text(v_paths) as image_path(path)
  ) then
    raise exception 'Duplicate feedback image path' using errcode = '22023';
  end if;

  select expected_image_count into v_expected
  from public.feedback_reports
  where id = p_feedback_id
    and user_id = v_user_id
    and image_paths = '[]'::jsonb
    and attachment_rights_confirmed_at is not null
    and created_at >= clock_timestamp() - interval '1 hour'
  for update;
  if not found or v_expected <> jsonb_array_length(v_paths) then
    raise exception 'Feedback attachment count does not match consent receipt'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from jsonb_array_elements_text(v_paths) as image_path(path)
    where not public.can_upload_feedback_image(image_path.path)
      or not exists (
        select 1 from storage.objects as object
        where object.bucket_id = 'feedback-images' and object.name = image_path.path
      )
  ) then
    raise exception 'Invalid or missing feedback image' using errcode = '22023';
  end if;

  update public.feedback_reports
  set image_paths = v_paths, updated_at = clock_timestamp()
  where id = p_feedback_id and user_id = v_user_id and image_paths = '[]'::jsonb;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Feedback images were already attached' using errcode = '40001';
  end if;
  return jsonb_build_object('ok', true, 'id', p_feedback_id, 'imageCount', jsonb_array_length(v_paths));
end;
$$;

create or replace function public.load_my_notifications(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_limit integer := least(200, greatest(1, coalesce(p_limit, 100)));
begin
  if v_user_id is null then
    return public.load_public_announcements(v_limit);
  end if;
  return (
    with combined as (
      select announcement.id, 'announcement'::text as kind,
        'announcement'::text as notification_type, announcement.title,
        announcement.body, null::uuid as feedback_id,
        announcement.published_at as created_at, reads.read_at,
        announcement.image_paths, announcement.is_pinned,
        announcement.rights_metadata, announcement.content_provenance
      from public.announcements as announcement
      left join public.announcement_reads as reads
        on reads.announcement_id = announcement.id and reads.user_id = v_user_id
      where announcement.published_at <= clock_timestamp()
        and announcement.rights_status = 'verified'
      union all
      select notification.id, 'direct'::text, notification.notification_type,
        notification.title, notification.body, notification.feedback_id,
        notification.created_at, notification.read_at, '{}'::text[], false,
        '[]'::jsonb, '{}'::jsonb
      from public.user_notifications as notification
      where notification.user_id = v_user_id
    ), paged as (
      select * from combined order by is_pinned desc, created_at desc, id limit v_limit
    )
    select jsonb_build_object(
      'authenticated', true,
      'unreadCount', (select count(*) from combined where read_at is null),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'kind', kind, 'type', notification_type, 'title', title,
        'body', body, 'feedbackId', feedback_id, 'imagePaths', image_paths,
        'isPinned', is_pinned, 'rightsMetadata', rights_metadata,
        'contentProvenance', content_provenance, 'createdAt', created_at,
        'readAt', read_at
      ) order by is_pinned desc, created_at desc, id) from paged), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.admin_publish_announcement(
  p_title text,
  p_body text,
  p_announcement_id uuid,
  p_image_paths text[],
  p_rights_metadata jsonb,
  p_content_provenance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_paths text[] := coalesce(p_image_paths, '{}'::text[]);
  v_rights jsonb := coalesce(p_rights_metadata, '[]'::jsonb);
  v_content jsonb := coalesce(p_content_provenance, '{}'::jsonb);
  v_created boolean := false;
begin
  if v_user_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_announcement_id is null or char_length(v_title) not between 1 and 120
    or char_length(v_body) not between 1 and 4000 then
    raise exception 'Invalid announcement content' using errcode = '22023';
  end if;
  if cardinality(v_paths) > 4 or jsonb_typeof(v_rights) <> 'array'
    or jsonb_array_length(v_rights) <> cardinality(v_paths)
    or pg_column_size(v_rights) > 32768 then
    raise exception 'Every announcement image requires bounded rights metadata'
      using errcode = '22023';
  end if;
  if cardinality(v_paths) <> (select count(distinct path) from unnest(v_paths) as path) then
    raise exception 'Announcement image paths must be unique' using errcode = '22023';
  end if;
  if jsonb_typeof(v_content) <> 'object' or pg_column_size(v_content) > 8192
    or v_content ->> 'textOrigin' not in ('original', 'ai-assisted', 'ai-generated')
    or coalesce((v_content ->> 'humanReviewed')::boolean, false) is not true then
    raise exception 'Announcement text provenance and human review are required'
      using errcode = '22023';
  end if;
  if v_content ->> 'textOrigin' in ('ai-assisted', 'ai-generated') and (
    nullif(btrim(v_content ->> 'provider'), '') is null
    or nullif(btrim(v_content ->> 'model'), '') is null
    or nullif(btrim(v_content ->> 'promptHash'), '') is null
  ) then
    raise exception 'AI text provenance is incomplete' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_rights) as entry(value)
    where value ->> 'path' is null
      or value ->> 'rightsBasis' not in ('original', 'licensed', 'open-license', 'public-domain', 'ai-generated')
      or nullif(btrim(value ->> 'author'), '') is null
      or coalesce((value ->> 'humanReviewed')::boolean, false) is not true
      or (coalesce((value ->> 'containsIdentifiablePeople')::boolean, false)
        and nullif(btrim(value ->> 'personConsentBasis'), '') is null)
      or (value ->> 'rightsBasis' in ('licensed', 'open-license') and (
        nullif(btrim(value ->> 'license'), '') is null
        or nullif(btrim(value ->> 'sourceUrl'), '') is null))
      or (value ->> 'rightsBasis' = 'public-domain'
        and nullif(btrim(value ->> 'sourceUrl'), '') is null)
      or (value ->> 'rightsBasis' = 'ai-generated' and (
        nullif(btrim(value ->> 'provider'), '') is null
        or nullif(btrim(value ->> 'model'), '') is null
        or coalesce((value ->> 'disclosureLabel')::boolean, false) is not true))
  ) then
    raise exception 'Announcement image rights metadata is incomplete'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_paths) with ordinality as image(path, ord)
    where image.path <> v_rights -> (image.ord - 1) ->> 'path'
      or split_part(image.path, '/', 1) <> p_announcement_id::text
      or not public.can_upload_announcement_image(image.path)
      or not exists (
        select 1 from storage.objects as object
        where object.bucket_id = 'announcement-images' and object.name = image.path
      )
  ) then
    raise exception 'Invalid, missing, or mismatched announcement image'
      using errcode = '22023';
  end if;

  insert into public.announcements (
    id, title, body, image_paths, rights_metadata, content_provenance,
    rights_status, created_by
  ) values (
    p_announcement_id, v_title, v_body, v_paths, v_rights, v_content,
    'verified', v_user_id
  ) on conflict (id) do nothing returning true into v_created;
  if not coalesce(v_created, false) then
    raise exception 'Announcement id is already in use' using errcode = '23505';
  end if;
  insert into public.admin_audit_log (
    admin_user_id, action, target_type, target_id, metadata
  ) values (
    v_user_id, 'announcement.publish', 'announcement', p_announcement_id::text,
    jsonb_build_object('titleLength', char_length(v_title),
      'imageCount', cardinality(v_paths), 'textOrigin', v_content ->> 'textOrigin')
  );
  return jsonb_build_object('ok', true, 'id', p_announcement_id,
    'imagePaths', v_paths, 'publishedAt', clock_timestamp());
end;
$$;

create or replace function public.admin_announcement_list(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_limit integer := least(200, greatest(1, coalesce(p_limit, 100)));
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return (select jsonb_build_object('items', coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'title', title, 'body', body, 'imagePaths', image_paths,
    'isPinned', is_pinned, 'rightsMetadata', rights_metadata,
    'contentProvenance', content_provenance, 'rightsStatus', rights_status,
    'takedownReason', takedown_reason, 'publishedAt', published_at,
    'createdAt', created_at
  ) order by is_pinned desc, published_at desc, id), '[]'::jsonb))
  from (select * from public.announcements
    order by is_pinned desc, published_at desc, id limit v_limit) as recent);
end;
$$;

create or replace function public.admin_begin_announcement_takedown(
  p_announcement_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_paths text[];
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 3 and 1000 then
    raise exception 'A bounded takedown reason is required' using errcode = '22023';
  end if;
  update public.announcements
  set rights_status = 'takedown_pending', takedown_reason = v_reason,
      takedown_requested_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = p_announcement_id and rights_status <> 'withdrawn'
  returning image_paths into v_paths;
  if not found then raise exception 'Announcement not found or already withdrawn' using errcode = 'P0002'; end if;
  insert into public.admin_audit_log (admin_user_id, action, target_type, target_id, metadata)
  values (v_admin_id, 'announcement.takedown.begin', 'announcement', p_announcement_id::text,
    jsonb_build_object('reasonLength', char_length(v_reason), 'imageCount', cardinality(v_paths)));
  return jsonb_build_object('ok', true, 'id', p_announcement_id, 'imagePaths', v_paths);
end;
$$;

create or replace function public.admin_finalize_announcement_takedown(p_announcement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_admin_id uuid := (select auth.uid());
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  update public.announcements set rights_status = 'withdrawn', image_paths = '{}'::text[],
    takedown_completed_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = p_announcement_id and rights_status = 'takedown_pending';
  if not found then raise exception 'Announcement is not pending takedown' using errcode = 'P0002'; end if;
  insert into public.admin_audit_log (admin_user_id, action, target_type, target_id)
  values (v_admin_id, 'announcement.takedown.complete', 'announcement', p_announcement_id::text);
  return jsonb_build_object('ok', true, 'id', p_announcement_id, 'status', 'withdrawn');
end;
$$;

-- Hosted scheduling: the SQL job is installed now. It invokes the Edge
-- Function only after operators have placed project_url and
-- retention_secret_key in Vault; until then the skipped run is auditable.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function private.invoke_feedback_retention_edge()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'retention_secret_key' limit 1;
  if nullif(v_url, '') is null or nullif(v_key, '') is null then
    insert into private.feedback_retention_runs (status, detail)
    values ('skipped_missing_secret', 'Vault requires project_url and retention_secret_key');
    return null;
  end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/process-feedback-retention',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key),
    body := jsonb_build_object('source', 'pg_cron')
  ) into v_request_id;
  insert into private.feedback_retention_runs (status, request_id)
  values ('invoked', v_request_id);
  return v_request_id;
exception when others then
  insert into private.feedback_retention_runs (status, detail)
  values ('request_failed', left(sqlerrm, 500));
  raise;
end;
$$;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'sense-vocab-feedback-retention-daily';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'sense-vocab-feedback-retention-daily',
    '15 3 * * *',
    'select private.invoke_feedback_retention_edge()'
  );
end $$;

-- Opt-in Data API permissions. Revoke legacy/default EXECUTE first, then grant
-- only the exact RPC signatures used by the browser or retention worker.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature, p.prosecdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
    if fn.prosecdef then
      execute format('alter function %s set search_path = %L', fn.signature, '');
    end if;
  end loop;
end $$;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

grant execute on function public.validate_invitation_code(text) to anon, authenticated;
grant execute on function public.load_my_notifications(integer) to anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.load_my_legal_consents() to authenticated;
grant execute on function public.record_my_legal_consents(boolean, boolean, boolean) to authenticated;
grant execute on function public.registration_welcome(uuid) to authenticated;
grant execute on function public.load_my_account_profile() to authenticated;
grant execute on function public.mark_my_notification_read(text, uuid) to authenticated;
grant execute on function public.load_user_state() to authenticated;
grant execute on function public.save_user_state(jsonb, bigint, boolean) to authenticated;
grant execute on function public.load_my_feedback_image_paths() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_upload_feedback_image(text) to authenticated;
grant execute on function public.submit_feedback(uuid, text, jsonb, jsonb, integer, boolean, text) to authenticated;
grant execute on function public.attach_feedback_images(uuid, jsonb) to authenticated;
grant execute on function public.discard_empty_feedback(uuid) to authenticated;
grant execute on function public.can_upload_announcement_image(text) to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_user_list(text, integer, integer) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.admin_feedback_list(text, integer, integer) to authenticated;
grant execute on function public.admin_update_feedback_status(uuid, text) to authenticated;
grant execute on function public.admin_reply_feedback(uuid, text) to authenticated;
grant execute on function public.admin_expired_feedback(integer) to authenticated;
grant execute on function public.admin_delete_expired_feedback(uuid[]) to authenticated;
grant execute on function public.admin_record_access(text, text, text, jsonb) to authenticated;
grant execute on function public.admin_announcement_list(integer) to authenticated;
grant execute on function public.admin_publish_announcement(text, text, uuid, text[], jsonb, jsonb) to authenticated;
grant execute on function public.admin_set_announcement_pinned(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_announcement(uuid) to authenticated;
grant execute on function public.admin_begin_announcement_takedown(uuid, text) to authenticated;
grant execute on function public.admin_finalize_announcement_takedown(uuid) to authenticated;
grant execute on function public.admin_set_membership_days(uuid, integer) to authenticated;
grant execute on function public.admin_extend_all_memberships() to authenticated;

grant execute on function public.retention_claim_feedback_batch(uuid, integer) to service_role;
grant execute on function public.retention_finalize_feedback_batch(uuid, uuid[]) to service_role;
grant execute on function public.retention_fail_feedback_batch(uuid, uuid[], text) to service_role;

notify pgrst, 'reload schema';
commit;
