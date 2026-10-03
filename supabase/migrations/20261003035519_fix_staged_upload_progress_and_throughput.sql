begin;

-- A LEFT JOIN with no parts produces one NULL row. Without the aggregate
-- filter that row became receivedIndexes=[null], and JavaScript Number(null)
-- made a fresh upload incorrectly skip chunk zero.
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
      jsonb_agg(to_jsonb(p.chunk_index) order by p.chunk_index)
        filter (where p.chunk_index is not null),
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

-- The prior 320 KB client parts required about 45 sequential mobile requests
-- for a 14 MB state. One-megabyte parts stay well below the staged 64 MB
-- envelope while cutting round trips by roughly two thirds.
alter table public.user_state_upload_parts
  drop constraint if exists user_state_upload_parts_chunk_bytes_check;
alter table public.user_state_upload_parts
  add constraint user_state_upload_parts_chunk_bytes_check
  check (chunk_bytes between 1 and 1250000) not valid;
alter table public.user_state_upload_parts
  validate constraint user_state_upload_parts_chunk_bytes_check;

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
  if v_bytes < 1 or v_bytes > 1250000 then
    raise exception 'Staged upload part exceeds the 1.25 MB limit'
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

commit;
