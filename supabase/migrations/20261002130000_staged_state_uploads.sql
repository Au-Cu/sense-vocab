begin;

-- Large account uploads must not invoke the full state writer once per client
-- chunk.  These tables are only a private, resumable transport buffer; the
-- authoritative normalized tables and user_state_meta change once, at finalize.
create table if not exists public.user_state_upload_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  upload_id uuid not null,
  expected_revision bigint not null,
  force boolean not null default false,
  manifest text not null,
  chunk_count integer not null,
  total_bytes bigint not null,
  received_chunks integer not null default 0,
  received_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, upload_id),
  check (expected_revision >= 0),
  check (manifest ~ '^[A-Za-z0-9._:-]{1,128}$'),
  check (chunk_count between 1 and 512),
  check (total_bytes between 1 and 67108864),
  check (received_chunks between 0 and chunk_count),
  check (received_bytes between 0 and total_bytes)
);

create table if not exists public.user_state_upload_parts (
  user_id uuid not null,
  upload_id uuid not null,
  chunk_index integer not null,
  chunk_count integer not null,
  chunk_data text not null,
  chunk_bytes bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, upload_id, chunk_index),
  foreign key (user_id, upload_id)
    references public.user_state_upload_sessions(user_id, upload_id)
    on delete cascade,
  check (chunk_count between 1 and 512),
  check (chunk_index >= 0),
  check (chunk_index < chunk_count),
  check (chunk_bytes between 1 and 500000),
  check (chunk_bytes = octet_length(chunk_data))
);

create index if not exists user_state_upload_sessions_updated_idx
  on public.user_state_upload_sessions (user_id, updated_at);

alter table public.user_state_upload_sessions enable row level security;
alter table public.user_state_upload_parts enable row level security;
revoke all on table public.user_state_upload_sessions from public, anon, authenticated;
revoke all on table public.user_state_upload_parts from public, anon, authenticated;

create or replace function public.user_state_upload_progress(
  p_user_id uuid,
  p_upload_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chunk_count integer;
  v_received_chunks integer;
  v_received_bytes bigint;
  v_indexes jsonb;
begin
  select
    s.chunk_count,
    count(p.chunk_index)::integer,
    coalesce(sum(p.chunk_bytes), 0)::bigint,
    coalesce(
      jsonb_agg(to_jsonb(p.chunk_index) order by p.chunk_index),
      '[]'::jsonb
    )
  into v_chunk_count, v_received_chunks, v_received_bytes, v_indexes
  from public.user_state_upload_sessions as s
  left join public.user_state_upload_parts as p
    on p.user_id = s.user_id
   and p.upload_id = s.upload_id
  where s.user_id = p_user_id
    and s.upload_id = p_upload_id
  group by s.chunk_count;

  return jsonb_build_object(
    'receivedChunks', coalesce(v_received_chunks, 0),
    'receivedBytes', coalesce(v_received_bytes, 0),
    'receivedIndexes', coalesce(v_indexes, '[]'::jsonb),
    'chunkCount', coalesce(v_chunk_count, 0)
  );
end;
$$;

revoke all on function public.user_state_upload_progress(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.begin_user_state_upload(
  p_upload_id uuid,
  p_expected_revision bigint,
  p_force boolean,
  p_manifest text,
  p_chunk_count integer,
  p_total_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '15s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_session public.user_state_upload_sessions%rowtype;
  v_progress jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_upload_id is null
    or p_expected_revision is null
    or p_expected_revision < 0
    or p_manifest is null
    or p_manifest !~ '^[A-Za-z0-9._:-]{1,128}$'
    or p_chunk_count is null
    or p_chunk_count not between 1 and 512
    or p_total_bytes is null
    or p_total_bytes not between 1 and 67108864 then
    raise exception 'Invalid staged upload manifest' using errcode = '22023';
  end if;

  -- Keep abandoned sessions bounded without touching the authoritative state.
  delete from public.user_state_upload_sessions
  where user_id = v_user_id
    and upload_id <> p_upload_id
    and updated_at < clock_timestamp() - interval '2 days';

  insert into public.user_state_meta (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select revision
  into v_revision
  from public.user_state_meta
  where user_id = v_user_id
  for update;

  if v_revision <> p_expected_revision then
    return jsonb_build_object(
      'ok', false,
      'conflict', true,
      'revision', v_revision,
      'reason', 'revision_mismatch'
    );
  end if;

  select *
  into v_session
  from public.user_state_upload_sessions
  where user_id = v_user_id
    and upload_id = p_upload_id
  for update;

  if found then
    if v_session.expected_revision <> p_expected_revision
      or v_session.force is distinct from coalesce(p_force, false)
      or v_session.manifest <> p_manifest
      or v_session.chunk_count <> p_chunk_count
      or v_session.total_bytes <> p_total_bytes then
      raise exception 'Staged upload manifest does not match its existing session'
        using errcode = '22023';
    end if;
  else
    insert into public.user_state_upload_sessions (
      user_id,
      upload_id,
      expected_revision,
      force,
      manifest,
      chunk_count,
      total_bytes
    ) values (
      v_user_id,
      p_upload_id,
      p_expected_revision,
      coalesce(p_force, false),
      p_manifest,
      p_chunk_count,
      p_total_bytes
    )
    returning * into v_session;
  end if;

  v_progress := public.user_state_upload_progress(v_user_id, p_upload_id);
  update public.user_state_upload_sessions
  set received_chunks = coalesce((v_progress ->> 'receivedChunks')::integer, 0),
      received_bytes = coalesce((v_progress ->> 'receivedBytes')::bigint, 0),
      updated_at = clock_timestamp()
  where user_id = v_user_id
    and upload_id = p_upload_id;

  return jsonb_build_object(
    'ok', true,
    'conflict', false,
    'uploadId', p_upload_id,
    'revision', v_revision,
    'chunkCount', p_chunk_count,
    'totalBytes', p_total_bytes
  ) || v_progress;
end;
$$;

revoke all on function public.begin_user_state_upload(uuid, bigint, boolean, text, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.begin_user_state_upload(uuid, bigint, boolean, text, integer, bigint)
  to authenticated;

create or replace function public.put_user_state_upload_part(
  p_upload_id uuid,
  p_chunk_index integer,
  p_chunk_count integer,
  p_chunk_data text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '15s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.user_state_upload_sessions%rowtype;
  v_revision bigint;
  v_bytes bigint;
  v_existing public.user_state_upload_parts%rowtype;
  v_progress jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_upload_id is null
    or p_chunk_index is null
    or p_chunk_count is null
    or p_chunk_data is null then
    raise exception 'Invalid staged upload part' using errcode = '22023';
  end if;

  select *
  into v_session
  from public.user_state_upload_sessions
  where user_id = v_user_id
    and upload_id = p_upload_id
  for update;
  if not found then
    raise exception 'Staged upload session not found' using errcode = '22023';
  end if;
  if p_chunk_count <> v_session.chunk_count
    or p_chunk_index < 0
    or p_chunk_index >= v_session.chunk_count then
    raise exception 'Invalid staged upload coordinates' using errcode = '22023';
  end if;

  v_bytes := octet_length(p_chunk_data);
  if v_bytes < 1 or v_bytes > 500000 then
    raise exception 'Staged upload part exceeds the 500 KB limit'
      using errcode = '22023';
  end if;

  select revision
  into v_revision
  from public.user_state_meta
  where user_id = v_user_id;
  if coalesce(v_revision, 0) <> v_session.expected_revision then
    delete from public.user_state_upload_sessions
    where user_id = v_user_id
      and upload_id = p_upload_id;
    return jsonb_build_object(
      'ok', false,
      'conflict', true,
      'revision', coalesce(v_revision, 0),
      'reason', 'revision_mismatch'
    );
  end if;

  select *
  into v_existing
  from public.user_state_upload_parts
  where user_id = v_user_id
    and upload_id = p_upload_id
    and chunk_index = p_chunk_index;
  if found then
    if v_existing.chunk_count <> p_chunk_count
      or v_existing.chunk_bytes <> v_bytes
      or v_existing.chunk_data <> p_chunk_data then
      raise exception 'Staged upload part changed during resume'
        using errcode = '22023';
    end if;
  else
    insert into public.user_state_upload_parts (
      user_id,
      upload_id,
      chunk_index,
      chunk_count,
      chunk_data,
      chunk_bytes,
      updated_at
    ) values (
      v_user_id,
      p_upload_id,
      p_chunk_index,
      p_chunk_count,
      p_chunk_data,
      v_bytes,
      clock_timestamp()
    );
  end if;

  v_progress := public.user_state_upload_progress(v_user_id, p_upload_id);
  update public.user_state_upload_sessions
  set received_chunks = coalesce((v_progress ->> 'receivedChunks')::integer, 0),
      received_bytes = coalesce((v_progress ->> 'receivedBytes')::bigint, 0),
      updated_at = clock_timestamp()
  where user_id = v_user_id
    and upload_id = p_upload_id;

  return jsonb_build_object(
    'ok', true,
    'conflict', false,
    'uploadId', p_upload_id,
    'revision', v_session.expected_revision,
    'chunkCount', v_session.chunk_count,
    'totalBytes', v_session.total_bytes
  ) || v_progress;
end;
$$;

revoke all on function public.put_user_state_upload_part(uuid, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.put_user_state_upload_part(uuid, integer, integer, text)
  to authenticated;

create or replace function public.finalize_user_state_upload(
  p_upload_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '120s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.user_state_upload_sessions%rowtype;
  v_revision bigint;
  v_count integer;
  v_bytes bigint;
  v_min_index integer;
  v_max_index integer;
  v_valid boolean;
  v_payload_text text;
  v_payload jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_session
  from public.user_state_upload_sessions
  where user_id = v_user_id
    and upload_id = p_upload_id
  for update;
  if not found then
    raise exception 'Staged upload session not found' using errcode = '22023';
  end if;

  select revision
  into v_revision
  from public.user_state_meta
  where user_id = v_user_id
  for update;
  if coalesce(v_revision, 0) <> v_session.expected_revision then
    delete from public.user_state_upload_sessions
    where user_id = v_user_id
      and upload_id = p_upload_id;
    return jsonb_build_object(
      'ok', false,
      'conflict', true,
      'revision', coalesce(v_revision, 0),
      'reason', 'revision_mismatch'
    );
  end if;

  select
    count(*)::integer,
    coalesce(sum(chunk_bytes), 0)::bigint,
    min(chunk_index),
    max(chunk_index),
    coalesce(bool_and(
      chunk_count = v_session.chunk_count
      and chunk_bytes = octet_length(chunk_data)
    ), true)
  into v_count, v_bytes, v_min_index, v_max_index, v_valid
  from public.user_state_upload_parts
  where user_id = v_user_id
    and upload_id = p_upload_id;

  if not coalesce(v_valid, false)
    or v_count <> v_session.chunk_count
    or coalesce(v_min_index, -1) <> 0
    or coalesce(v_max_index, -1) <> v_session.chunk_count - 1
    or v_bytes <> v_session.total_bytes then
    update public.user_state_upload_sessions
    set received_chunks = v_count,
        received_bytes = v_bytes,
        updated_at = clock_timestamp()
    where user_id = v_user_id
      and upload_id = p_upload_id;
    return jsonb_build_object(
      'ok', false,
      'conflict', false,
      'incomplete', true,
      'revision', v_revision,
      'receivedChunks', v_count,
      'receivedBytes', v_bytes,
      'chunkCount', v_session.chunk_count,
      'totalBytes', v_session.total_bytes
    );
  end if;

  select string_agg(chunk_data, '' order by chunk_index)
  into v_payload_text
  from public.user_state_upload_parts
  where user_id = v_user_id
    and upload_id = p_upload_id;
  begin
    v_payload := v_payload_text::jsonb;
  exception when others then
    raise exception 'Staged upload payload is not valid JSON' using errcode = '22023';
  end;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Staged upload payload must be a JSON object'
      using errcode = '22023';
  end if;

  -- This is the only point that rewrites normalized learning data and the
  -- materialized transport.  A failure rolls back the final write while the
  -- staged parts remain available for a later retry.
  v_result := public.save_user_state(
    v_payload,
    v_session.expected_revision,
    v_session.force
  );

  if coalesce((v_result ->> 'ok')::boolean, false)
    or coalesce((v_result ->> 'conflict')::boolean, false) then
    delete from public.user_state_upload_sessions
    where user_id = v_user_id
      and upload_id = p_upload_id;
  end if;

  return v_result || jsonb_build_object(
    'staged', true,
    'uploadId', p_upload_id,
    'receivedChunks', v_count,
    'receivedBytes', v_bytes,
    'chunkCount', v_session.chunk_count,
    'totalBytes', v_session.total_bytes
  );
end;
$$;

revoke all on function public.finalize_user_state_upload(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_user_state_upload(uuid)
  to authenticated;

commit;
