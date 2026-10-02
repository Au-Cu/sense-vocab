begin;

-- Do not serialize the whole account document for every chunk request.  A
-- complete immutable chunk set is already authoritative; only materialize
-- JSONB when the set is missing or inconsistent.
create or replace function public.ensure_user_state_transport_chunks(
  p_user_id uuid,
  p_revision bigint
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
set statement_timeout = '120s'
as $$
declare
  v_revision bigint;
  v_updated_at timestamptz;
  v_state jsonb;
  v_stored_bytes bigint;
  v_document text;
  v_document_bytes bigint;
  v_chunk_chars constant integer := 400000;
  v_chunk_count integer;
  v_index integer;
  v_start integer;
  v_chunk text;
  v_valid boolean;
  v_state_was_null boolean;
begin
  if p_user_id is null or p_revision is null or p_revision < 0 then
    raise exception 'Invalid state transport coordinates' using errcode = '22023';
  end if;

  select revision, updated_at, transport_state, transport_bytes,
         transport_chunk_count
  into v_revision, v_updated_at, v_state, v_stored_bytes, v_chunk_count
  from public.user_state_meta
  where user_id = p_user_id
  for update;

  if not found or v_revision <> p_revision then
    return -1;
  end if;

  if coalesce(v_chunk_count, 0) > 0 then
    select count(*) = v_chunk_count
      and coalesce(min(chunk_index), -1) = 0
      and coalesce(max(chunk_index), -1) = v_chunk_count - 1
      and coalesce(bool_and(chunk_count = v_chunk_count), true)
      and coalesce(bool_and(chunk_bytes = octet_length(chunk_data)), true)
    into v_valid
    from public.user_state_transport_chunks
    where user_id = p_user_id
      and revision = v_revision;
    if coalesce(v_valid, false) then
      return v_chunk_count;
    end if;
  end if;

  v_state_was_null := v_state is null;
  if v_state_was_null then
    v_state := public.compact_user_state_transport(
      public.user_state_document(p_user_id)
    );
  end if;

  v_document := jsonb_build_object(
    'found', true,
    'revision', v_revision,
    'updatedAt', v_updated_at,
    'state', v_state
  )::text;
  v_document_bytes := octet_length(v_document);
  if v_document_bytes > 67108864 then
    raise exception 'State exceeds the 64 MB transport safety limit'
      using errcode = '22023';
  end if;

  if v_state_was_null then
    update public.user_state_meta
    set transport_state = v_state,
        transport_bytes = v_document_bytes
    where user_id = p_user_id
      and revision = v_revision;
    v_stored_bytes := v_document_bytes;
  end if;

  if v_document_bytes <= 3500000 then
    delete from public.user_state_transport_chunks
    where user_id = p_user_id;
    if v_stored_bytes is distinct from v_document_bytes then
      update public.user_state_meta
      set transport_bytes = v_document_bytes
      where user_id = p_user_id
        and revision = v_revision;
    end if;
    update public.user_state_meta
    set transport_chunk_count = 0
    where user_id = p_user_id
      and revision = v_revision
      and transport_chunk_count is distinct from 0;
    return 0;
  end if;

  v_chunk_count := greatest(
    1,
    ceil(char_length(v_document)::numeric / v_chunk_chars)::integer
  );

  delete from public.user_state_transport_chunks
  where user_id = p_user_id;
  for v_index in 0 .. v_chunk_count - 1 loop
    v_start := v_index * v_chunk_chars + 1;
    v_chunk := substr(v_document, v_start, v_chunk_chars);
    insert into public.user_state_transport_chunks (
      user_id,
      revision,
      chunk_index,
      chunk_count,
      chunk_data,
      chunk_bytes
    ) values (
      p_user_id,
      v_revision,
      v_index,
      v_chunk_count,
      v_chunk,
      octet_length(v_chunk)
    );
  end loop;

  if v_stored_bytes is distinct from v_document_bytes then
    update public.user_state_meta
    set transport_bytes = v_document_bytes
    where user_id = p_user_id
      and revision = v_revision;
  end if;
  update public.user_state_meta
  set transport_chunk_count = v_chunk_count
  where user_id = p_user_id
    and revision = v_revision
    and transport_chunk_count is distinct from v_chunk_count;

  return v_chunk_count;
end;
$$;

revoke all on function public.ensure_user_state_transport_chunks(uuid, bigint)
  from public, anon, authenticated;

commit;
