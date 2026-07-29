begin;

create table if not exists public.user_legal_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (
    consent_type in ('terms_privacy', 'cross_border', 'age_14_or_over')
  ),
  document_version text not null check (
    char_length(document_version) between 1 and 80
  ),
  consented_at timestamptz not null default now(),
  primary key (user_id, consent_type)
);

alter table public.user_legal_consents enable row level security;
revoke all on table public.user_legal_consents from anon, authenticated;

create or replace function public.load_my_legal_consents()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_terms boolean;
  v_cross_border boolean;
  v_age boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select exists (
    select 1
    from public.user_legal_consents
    where user_id = v_user_id
      and consent_type = 'terms_privacy'
      and document_version = '2026-07-29-v1'
  ) into v_terms;

  select exists (
    select 1
    from public.user_legal_consents
    where user_id = v_user_id
      and consent_type = 'cross_border'
      and document_version = '2026-07-29-v1'
  ) into v_cross_border;

  select exists (
    select 1
    from public.user_legal_consents
    where user_id = v_user_id
      and consent_type = 'age_14_or_over'
      and document_version = '2026-07-29-v1'
  ) into v_age;

  return jsonb_build_object(
    'complete', v_terms and v_cross_border and v_age,
    'termsPrivacy', v_terms,
    'crossBorder', v_cross_border,
    'age14OrOver', v_age,
    'termsVersion', '2026-07-29-v1',
    'privacyVersion', '2026-07-29-v1',
    'crossBorderVersion', '2026-07-29-v1'
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
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
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

  insert into public.user_legal_consents (
    user_id,
    consent_type,
    document_version,
    consented_at
  )
  values
    (v_user_id, 'terms_privacy', '2026-07-29-v1', now()),
    (v_user_id, 'cross_border', '2026-07-29-v1', now()),
    (v_user_id, 'age_14_or_over', '2026-07-29-v1', now())
  on conflict (user_id, consent_type)
  do update set
    document_version = excluded.document_version,
    consented_at = excluded.consented_at;

  return public.load_my_legal_consents();
end;
$$;

revoke all on function public.load_my_legal_consents() from public, anon;
revoke all on function public.record_my_legal_consents(boolean, boolean, boolean)
  from public, anon;
grant execute on function public.load_my_legal_consents() to authenticated;
grant execute on function public.record_my_legal_consents(boolean, boolean, boolean)
  to authenticated;

alter table public.feedback_reports
  add column if not exists expires_at timestamptz;

update public.feedback_reports
set expires_at = coalesce(created_at, now()) + interval '365 days'
where expires_at is null;

alter table public.feedback_reports
  alter column expires_at set default (now() + interval '365 days'),
  alter column expires_at set not null;

create index if not exists feedback_reports_expires_at_idx
  on public.feedback_reports (expires_at);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 80),
  target_type text check (
    target_type is null or char_length(target_type) between 1 and 80
  ),
  target_id text check (
    target_id is null or char_length(target_id) between 1 and 200
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 16384
  ),
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_admin_idx
  on public.admin_audit_log (admin_user_id, created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;

create or replace function public.admin_record_access(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_action text := trim(coalesce(p_action, ''));
  v_target_type text := nullif(trim(coalesce(p_target_type, '')), '');
  v_target_id text := nullif(trim(coalesce(p_target_id, '')), '');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if v_user_id is null or not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if char_length(v_action) not between 1 and 80 then
    raise exception 'invalid audit action' using errcode = '22023';
  end if;
  if v_target_type is not null and char_length(v_target_type) > 80 then
    raise exception 'invalid audit target type' using errcode = '22023';
  end if;
  if v_target_id is not null and char_length(v_target_id) > 200 then
    raise exception 'invalid audit target id' using errcode = '22023';
  end if;
  if jsonb_typeof(v_metadata) <> 'object' or pg_column_size(v_metadata) > 16384 then
    raise exception 'invalid audit metadata' using errcode = '22023';
  end if;

  insert into public.admin_audit_log (
    admin_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    v_user_id,
    v_action,
    v_target_type,
    v_target_id,
    v_metadata
  );
end;
$$;

revoke all on function public.admin_record_access(text, text, text, jsonb)
  from public, anon;
grant execute on function public.admin_record_access(text, text, text, jsonb)
  to authenticated;

commit;
