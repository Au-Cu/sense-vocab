begin;

-- The one-time backfill reads the largest existing account document. Give it
-- enough room to finish without changing the per-request RPC limits below.
set local statement_timeout = '120s';

alter table public.user_state_meta
  add column if not exists transport_state jsonb,
  add column if not exists transport_bytes bigint;

-- Backfill the compact document once. Normal reads no longer need to rebuild
-- progress, activity, and study-window JSON from their normalized tables.
with source as (
  select
    meta.user_id,
    meta.revision,
    meta.updated_at,
    public.compact_user_state_transport(
      public.user_state_document(meta.user_id)
    ) as state
  from public.user_state_meta as meta
), documents as (
  select
    source.*,
    jsonb_build_object(
      'found', true,
      'revision', source.revision,
      'updatedAt', source.updated_at,
      'state', source.state
    ) as document
  from source
)
update public.user_state_meta as meta
set transport_state = documents.state,
    transport_bytes = octet_length(documents.document::text)
from documents
where meta.user_id = documents.user_id
  and (meta.transport_state is null or meta.transport_bytes is null);

create or replace function public.materialize_user_state_transport(p_state jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_active_book_id text;
  v_active_book jsonb := '{}'::jsonb;
  v_state jsonb;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    return p_state;
  end if;

  v_active_book_id := nullif(p_state ->> 'activeBookId', '');
  if v_active_book_id is not null
    and jsonb_typeof(p_state -> 'bookStates') = 'object'
    and jsonb_typeof(p_state -> 'bookStates' -> v_active_book_id) = 'object' then
    v_active_book := p_state -> 'bookStates' -> v_active_book_id;
  end if;

  -- Match the server-side normalization used by the existing save function;
  -- this keeps the materialized copy correct for older clients too.
  v_state := p_state || jsonb_build_object(
    'plan', coalesce(p_state -> 'plan', v_active_book -> 'plan'),
    'session', coalesce(p_state -> 'session', v_active_book -> 'session', 'null'::jsonb),
    'introducedWords', coalesce(
      p_state -> 'introducedWords',
      v_active_book -> 'introducedWords',
      '[]'::jsonb
    ),
    'progress', coalesce(
      p_state -> 'progress',
      v_active_book -> 'progress',
      '{}'::jsonb
    ),
    'activityLog', coalesce(
      p_state -> 'activityLog',
      v_active_book -> 'activityLog',
      '{}'::jsonb
    ),
    'studyWindows', coalesce(
      p_state -> 'studyWindows',
      v_active_book -> 'studyWindows',
      '[]'::jsonb
    ),
    'learningDayCounter', coalesce(
      p_state -> 'learningDayCounter',
      v_active_book -> 'learningDayCounter',
      '0'::jsonb
    ),
    'wordListSort', coalesce(
      p_state -> 'wordListSort',
      v_active_book -> 'wordListSort',
      '"mastery"'::jsonb
    ),
    'dataVersion', coalesce(
      p_state -> 'dataVersion',
      v_active_book -> 'dataVersion',
      '0'::jsonb
    )
  );

  return public.compact_user_state_transport(v_state);
end;
$$;

revoke all on function public.materialize_user_state_transport(jsonb)
  from public, anon, authenticated;

create or replace function public.load_user_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set statement_timeout = '12s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_updated_at timestamptz;
  v_state jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select revision, updated_at, transport_state
  into v_revision, v_updated_at, v_state
  from public.user_state_meta
  where user_id = v_user_id;

  if not found then
    return jsonb_build_object(
      'found', false,
      'revision', 0,
      'updatedAt', null,
      'state', null
    );
  end if;

  -- Safety fallback for a partially applied migration or an interrupted
  -- materialization. It is intentionally not the normal path.
  if v_state is null then
    v_state := public.compact_user_state_transport(
      public.user_state_document(v_user_id)
    );
  end if;

  return jsonb_build_object(
    'found', true,
    'revision', v_revision,
    'updatedAt', v_updated_at,
    'state', v_state
  );
end;
$$;

revoke all on function public.load_user_state() from public, anon;
grant execute on function public.load_user_state() to authenticated;

create or replace function public.load_user_state_manifest()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set statement_timeout = '12s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_updated_at timestamptz;
  v_state jsonb;
  v_bytes bigint;
  v_document jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select revision, updated_at, transport_state, transport_bytes
  into v_revision, v_updated_at, v_state, v_bytes
  from public.user_state_meta
  where user_id = v_user_id;

  if not found then
    return jsonb_build_object(
      'found', false,
      'revision', 0,
      'updatedAt', null,
      'bytes', 0
    );
  end if;

  if v_state is null then
    v_state := public.compact_user_state_transport(
      public.user_state_document(v_user_id)
    );
  end if;
  if v_bytes is null then
    v_document := jsonb_build_object(
      'found', true,
      'revision', v_revision,
      'updatedAt', v_updated_at,
      'state', v_state
    );
    v_bytes := octet_length(v_document::text);
  end if;

  return jsonb_build_object(
    'found', true,
    'revision', v_revision,
    'updatedAt', v_updated_at,
    'bytes', v_bytes
  );
end;
$$;

revoke all on function public.load_user_state_manifest() from public, anon;
grant execute on function public.load_user_state_manifest() to authenticated;

-- Preserve the already audited write path and add only the cheap materialized
-- transport update after a successful CAS write. This avoids rebuilding the
-- full normalized document on every study interaction.
alter function public.save_user_state(jsonb, bigint, boolean)
  rename to save_user_state_legacy;

revoke all on function public.save_user_state_legacy(jsonb, bigint, boolean)
  from public, anon, authenticated;

create or replace function public.save_user_state(
  p_state jsonb,
  p_expected_revision bigint default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '35s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_state jsonb;
  v_document jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_result := public.save_user_state_legacy(
    p_state,
    p_expected_revision,
    p_force
  );

  if coalesce((v_result ->> 'ok')::boolean, false) then
    v_state := public.materialize_user_state_transport(p_state);
    v_document := jsonb_build_object(
      'found', true,
      'revision', (v_result ->> 'revision')::bigint,
      'updatedAt', v_result -> 'updatedAt',
      'state', v_state
    );
    update public.user_state_meta
    set transport_state = v_state,
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

commit;
