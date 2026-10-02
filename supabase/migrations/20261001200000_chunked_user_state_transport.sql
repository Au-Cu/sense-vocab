begin;

-- Large state documents are kept as one authoritative JSONB value for CAS
-- merges, but are exposed through small immutable-at-a-revision chunks.  The
-- chunk size is deliberately conservative because PostgREST adds JSON
-- framing and escaping around the text payload.
alter table public.user_state_meta
  add column if not exists transport_chunk_count integer not null default 0;

create table if not exists public.user_state_transport_chunks (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  chunk_index integer not null,
  chunk_count integer not null,
  chunk_data text not null,
  chunk_bytes bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, revision, chunk_index),
  check (revision >= 0),
  check (chunk_index >= 0),
  check (chunk_count > 0),
  check (chunk_index < chunk_count),
  check (chunk_bytes >= 0)
);

create index if not exists user_state_transport_chunks_lookup_idx
  on public.user_state_transport_chunks (user_id, revision, chunk_index);

alter table public.user_state_transport_chunks enable row level security;
revoke all on table public.user_state_transport_chunks from public, anon, authenticated;

-- A 64 MiB final document cap is a storage-abuse guard, not a transport
-- limit.  Normal documents remain a single response; larger ones use chunks.
create or replace function public.sync_user_state_transport_chunks()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document text;
  v_document_bytes bigint;
  v_chunk_chars constant integer := 400000;
  v_chunk_count integer;
  v_index integer;
  v_start integer;
  v_chunk text;
begin
  if new.transport_state is null then
    delete from public.user_state_transport_chunks
    where user_id = new.user_id;
    new.transport_chunk_count := 0;
    return new;
  end if;

  v_document := jsonb_build_object(
    'found', true,
    'revision', new.revision,
    'updatedAt', new.updated_at,
    'state', new.transport_state
  )::text;
  v_document_bytes := octet_length(v_document);
  if v_document_bytes > 67108864 then
    raise exception 'State exceeds the 64 MB transport safety limit'
      using errcode = '22023';
  end if;

  delete from public.user_state_transport_chunks
  where user_id = new.user_id;

  if v_document_bytes <= 3500000 then
    new.transport_chunk_count := 0;
    return new;
  end if;

  v_chunk_count := greatest(1, ceil(char_length(v_document)::numeric / v_chunk_chars)::integer);
  for v_index in 0 .. v_chunk_count - 1 loop
    v_start := v_index * v_chunk_chars + 1;
    v_chunk := substr(v_document, v_start, v_chunk_chars);
    insert into public.user_state_transport_chunks (
      user_id, revision, chunk_index, chunk_count, chunk_data, chunk_bytes
    ) values (
      new.user_id,
      new.revision,
      v_index,
      v_chunk_count,
      v_chunk,
      octet_length(v_chunk)
    );
  end loop;
  new.transport_chunk_count := v_chunk_count;
  return new;
end;
$$;

drop trigger if exists user_state_transport_chunks_sync
  on public.user_state_meta;
create trigger user_state_transport_chunks_sync
  before insert or update of transport_state, transport_bytes, revision, updated_at
  on public.user_state_meta
  for each row
  execute function public.sync_user_state_transport_chunks();

-- Existing materialized rows need the same chunk index.  Small rows only get
-- their metadata initialized; large rows are split once in this transaction.
update public.user_state_meta
set transport_chunk_count = 0
where transport_chunk_count is null;

update public.user_state_meta
set transport_state = transport_state
where transport_state is not null
  and coalesce(transport_chunk_count, 0) = 0
  and coalesce(transport_bytes, 0) > 3500000;

create or replace function public.load_user_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set statement_timeout = '60s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_updated_at timestamptz;
  v_state jsonb;
  v_chunk_count integer;
  v_bytes bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select revision, updated_at, transport_state, transport_chunk_count, transport_bytes
  into v_revision, v_updated_at, v_state, v_chunk_count, v_bytes
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

  if coalesce(v_chunk_count, 0) > 0 then
    return jsonb_build_object(
      'found', true,
      'revision', v_revision,
      'updatedAt', v_updated_at,
      'state', null,
      'chunked', true,
      'chunks', v_chunk_count,
      'bytes', coalesce(v_bytes, 0)
    );
  end if;

  -- This fallback is only expected for a small or partially materialized row.
  -- Normal large rows are always served through the chunk path above.
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

create or replace function public.load_user_state_manifest()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set statement_timeout = '30s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_updated_at timestamptz;
  v_state jsonb;
  v_bytes bigint;
  v_chunk_count integer;
  v_document jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select revision, updated_at, transport_state, transport_bytes, transport_chunk_count
  into v_revision, v_updated_at, v_state, v_bytes, v_chunk_count
  from public.user_state_meta
  where user_id = v_user_id;

  if not found then
    return jsonb_build_object(
      'found', false,
      'revision', 0,
      'updatedAt', null,
      'bytes', 0,
      'chunked', false,
      'chunks', 0
    );
  end if;

  if v_bytes is null then
    if v_state is null then
      v_state := public.compact_user_state_transport(
        public.user_state_document(v_user_id)
      );
    end if;
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
    'bytes', v_bytes,
    'chunked', coalesce(v_chunk_count, 0) > 0,
    'chunks', coalesce(v_chunk_count, 0)
  );
end;
$$;

create or replace function public.load_user_state_chunk(
  p_revision bigint,
  p_chunk_index integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set statement_timeout = '20s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_chunk_count integer;
  v_data text;
  v_bytes bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_revision is null or p_revision < 0 or p_chunk_index is null or p_chunk_index < 0 then
    raise exception 'Invalid state chunk coordinates' using errcode = '22023';
  end if;

  select revision, transport_chunk_count
  into v_revision, v_chunk_count
  from public.user_state_meta
  where user_id = v_user_id;
  if not found or v_revision <> p_revision or coalesce(v_chunk_count, 0) = 0 then
    return jsonb_build_object('found', false, 'revision', coalesce(v_revision, 0));
  end if;

  select chunk_data, chunk_bytes
  into v_data, v_bytes
  from public.user_state_transport_chunks
  where user_id = v_user_id
    and revision = p_revision
    and chunk_index = p_chunk_index;
  if not found then
    return jsonb_build_object(
      'found', false,
      'revision', v_revision,
      'chunkIndex', p_chunk_index,
      'chunkCount', v_chunk_count
    );
  end if;

  return jsonb_build_object(
    'found', true,
    'revision', v_revision,
    'chunkIndex', p_chunk_index,
    'chunkCount', v_chunk_count,
    'data', v_data,
    'bytes', v_bytes
  );
end;
$$;

-- The delta function already performs the authoritative CAS merge. Replace
-- only its historical 12 MiB final-document guard; the chunk trigger above
-- supplies the bounded transport path and keeps a 64 MiB storage guard.
do $replace$
declare
  v_source text;
  v_start integer;
  v_end integer;
  v_replacement text;
begin
  select pg_get_functiondef(
    'public.save_user_state_delta(jsonb,bigint,boolean)'::regprocedure
  ) into v_source;
  v_start := strpos(v_source, 'if octet_length(jsonb_build_object(');
  v_end := strpos(substr(v_source, greatest(v_start, 1)), E'\n  end if;');
  if v_start = 0 or v_end = 0 then
    raise exception 'Could not locate the delta transport guard';
  end if;
  v_end := v_start + v_end - 1;
  v_end := v_end + length(E'\n  end if;');
  v_replacement := $body$if octet_length(jsonb_build_object(
    'found', true,
    'revision', v_current_revision + 1,
    'updatedAt', v_updated_at,
    'state', v_transport
  )::text) > 67108864 then
    raise exception 'State exceeds the 64 MB transport safety limit'
      using errcode = '22023';
  end if;$body$;
  v_source := substr(v_source, 1, v_start - 1)
    || v_replacement
    || substr(v_source, v_end + 1);
  execute v_source;
end;
$replace$;

alter function public.save_user_state_delta(jsonb, bigint, boolean)
  set statement_timeout = '120s';

revoke all on function public.sync_user_state_transport_chunks()
  from public, anon, authenticated;
revoke all on function public.load_user_state_chunk(bigint, integer)
  from public, anon;
grant execute on function public.load_user_state_chunk(bigint, integer)
  to authenticated;
revoke all on function public.load_user_state()
  from public, anon;
grant execute on function public.load_user_state()
  to authenticated;
revoke all on function public.load_user_state_manifest()
  from public, anon;
grant execute on function public.load_user_state_manifest()
  to authenticated;

commit;
