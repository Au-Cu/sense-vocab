begin;

-- Extract each domain once and compare key sets. Repeated JSONB extraction
-- inside the old per-key loops copied megabytes thousands of times.
create or replace function public.state_has_undeclared_deletions_unexpanded(
  p_existing jsonb,
  p_incoming jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_existing_books jsonb := coalesce(p_existing -> 'bookStates', '{}'::jsonb);
  v_incoming_books jsonb := coalesce(p_incoming -> 'bookStates', '{}'::jsonb);
  v_existing_links jsonb := coalesce(p_existing -> 'confusionLinks', '{}'::jsonb);
  v_incoming_links jsonb := coalesce(p_incoming -> 'confusionLinks', '{}'::jsonb);
  v_existing_book jsonb;
  v_incoming_book jsonb;
  v_existing_domain jsonb;
  v_incoming_domain jsonb;
  v_book_id text;
  v_domain text;
  v_key text;
  v_has_data boolean;
begin
  if not public.state_confusion_links_are_valid(p_incoming) then
    raise exception 'State contains invalid confusionLinks' using errcode = '22023';
  end if;

  if v_existing_books = '{}'::jsonb
    and jsonb_typeof(v_existing_links) = 'object'
    and jsonb_typeof(v_incoming_links) = 'object' then
    for v_key in
      select jsonb_object_keys(v_existing_links)
      except
      select jsonb_object_keys(v_incoming_links)
    loop
      if not public.sync_record_declares_delete(p_incoming, 'confusionLinks', v_key) then
        return true;
      end if;
    end loop;
  end if;

  if jsonb_typeof(v_existing_books) <> 'object'
    or jsonb_typeof(v_incoming_books) <> 'object' then
    return false;
  end if;

  for v_book_id in select jsonb_object_keys(v_existing_books)
  loop
    v_existing_book := v_existing_books -> v_book_id;
    v_incoming_book := v_incoming_books -> v_book_id;
    v_has_data :=
      jsonb_array_length(coalesce(v_existing_book -> 'introducedWords', '[]'::jsonb)) > 0
      or (select count(*) from jsonb_object_keys(coalesce(v_existing_book -> 'progress', '{}'::jsonb))) > 0
      or (select count(*) from jsonb_object_keys(coalesce(v_existing_book -> 'activityLog', '{}'::jsonb))) > 0
      or (select count(*) from jsonb_object_keys(coalesce(v_existing_book -> 'confusionLinks', '{}'::jsonb))) > 0
      or jsonb_array_length(coalesce(v_existing_book -> 'studyWindows', '[]'::jsonb)) > 0;
    if v_incoming_book is null then
      if v_has_data then return true; end if;
      continue;
    end if;

    v_existing_domain := coalesce(v_existing_book -> 'introducedWords', '[]'::jsonb);
    v_incoming_domain := coalesce(v_incoming_book -> 'introducedWords', '[]'::jsonb);
    for v_key in
      select jsonb_array_elements_text(v_existing_domain)
      except
      select jsonb_array_elements_text(v_incoming_domain)
    loop
      if not public.sync_record_declares_delete(v_incoming_book, 'introducedWords', v_key) then
        return true;
      end if;
    end loop;

    foreach v_domain in array array['progress', 'activityLog', 'confusionLinks']
    loop
      v_existing_domain := coalesce(v_existing_book -> v_domain, '{}'::jsonb);
      v_incoming_domain := coalesce(v_incoming_book -> v_domain, '{}'::jsonb);
      for v_key in
        select jsonb_object_keys(v_existing_domain)
        except
        select jsonb_object_keys(v_incoming_domain)
      loop
        if not public.sync_record_declares_delete(v_incoming_book, v_domain, v_key) then
          return true;
        end if;
      end loop;
    end loop;

    v_existing_domain := coalesce(v_existing_book -> 'studyWindows', '[]'::jsonb);
    v_incoming_domain := coalesce(v_incoming_book -> 'studyWindows', '[]'::jsonb);
    for v_key in
      select coalesce(nullif(item.value ->> 'id', ''), item.ordinality::text)
      from jsonb_array_elements(v_existing_domain) with ordinality as item(value, ordinality)
      where jsonb_typeof(item.value) = 'object'
      except
      select coalesce(nullif(item.value ->> 'id', ''), item.ordinality::text)
      from jsonb_array_elements(v_incoming_domain) with ordinality as item(value, ordinality)
      where jsonb_typeof(item.value) = 'object'
    loop
      if not public.sync_record_declares_delete(v_incoming_book, 'studyWindows', v_key) then
        return true;
      end if;
    end loop;
  end loop;
  return false;
end;
$$;
revoke all on function public.state_has_undeclared_deletions_unexpanded(jsonb, jsonb)
  from public, anon, authenticated;

-- Byte offsets are constant-time; character substrings repeatedly walked the
-- same UTF-8 prefix. Boundaries are scanned once and never split a codepoint.
create or replace function public.split_user_state_transport(
  p_document text,
  p_max_bytes integer default 400000
)
returns table(chunk_index integer, chunk_count integer, chunk_data text, chunk_bytes bigint)
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_bytes bytea := convert_to(p_document, 'UTF8');
  v_size integer := octet_length(v_bytes);
  v_boundaries integer[] := array[0];
  v_offset integer := 0;
  v_end integer;
  v_index integer;
begin
  if p_max_bytes < 4 or p_max_bytes > 1250000 then
    raise exception 'Invalid transport chunk byte limit' using errcode = '22023';
  end if;
  while v_offset < v_size loop
    v_end := least(v_offset + p_max_bytes, v_size);
    while v_end < v_size and (get_byte(v_bytes, v_end) & 192) = 128 loop
      v_end := v_end - 1;
    end loop;
    v_boundaries := array_append(v_boundaries, v_end);
    v_offset := v_end;
  end loop;
  chunk_count := cardinality(v_boundaries) - 1;
  for v_index in 1 .. chunk_count loop
    chunk_index := v_index - 1;
    chunk_bytes := v_boundaries[v_index + 1] - v_boundaries[v_index];
    chunk_data := convert_from(substr(v_bytes, v_boundaries[v_index] + 1, chunk_bytes::integer), 'UTF8');
    return next;
  end loop;
end;
$$;
revoke all on function public.split_user_state_transport(text, integer)
  from public, anon, authenticated;

create or replace function public.sync_user_state_transport_chunks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document text;
  v_bytes bigint;
begin
  if new.transport_state is null then
    delete from public.user_state_transport_chunks where user_id = new.user_id;
    new.transport_chunk_count := 0;
    return new;
  end if;
  v_document := jsonb_build_object(
    'found', true, 'revision', new.revision,
    'updatedAt', new.updated_at, 'state', new.transport_state
  )::text;
  v_bytes := octet_length(v_document);
  if v_bytes > 67108864 then
    raise exception 'State exceeds the 64 MB transport safety limit' using errcode = '22023';
  end if;
  new.transport_bytes := v_bytes;
  delete from public.user_state_transport_chunks where user_id = new.user_id;
  if v_bytes <= 3500000 then
    new.transport_chunk_count := 0;
    return new;
  end if;
  insert into public.user_state_transport_chunks(
    user_id, revision, chunk_index, chunk_count, chunk_data, chunk_bytes
  )
  select new.user_id, new.revision, part.chunk_index, part.chunk_count,
         part.chunk_data, part.chunk_bytes
  from public.split_user_state_transport(v_document) as part;
  get diagnostics new.transport_chunk_count = row_count;
  return new;
end;
$$;
revoke all on function public.sync_user_state_transport_chunks()
  from public, anon, authenticated;

-- Normal reads never need to repair or lock metadata. Cold repair retains a
-- short write lock, rechecks the revision, and does not queue behind a save.
create or replace function public.ensure_user_state_transport_chunks(
  p_user_id uuid,
  p_revision bigint
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '120s'
as $$
declare
  v_revision bigint;
  v_count integer;
  v_state jsonb;
  v_valid boolean;
begin
  if p_user_id is null or p_revision is null or p_revision < 0 then
    raise exception 'Invalid state transport coordinates' using errcode = '22023';
  end if;
  select revision, transport_chunk_count into v_revision, v_count
  from public.user_state_meta where user_id = p_user_id;
  if not found or v_revision <> p_revision then return -1; end if;
  if coalesce(v_count, 0) > 0 then
    select count(*) = v_count
      and coalesce(min(chunk_index), -1) = 0
      and coalesce(max(chunk_index), -1) = v_count - 1
      and coalesce(bool_and(chunk_count = v_count and chunk_bytes = octet_length(chunk_data)), false)
    into v_valid from public.user_state_transport_chunks
    where user_id = p_user_id and revision = p_revision;
    if coalesce(v_valid, false) then return v_count; end if;
  end if;
  begin
    select revision, transport_state into v_revision, v_state
    from public.user_state_meta where user_id = p_user_id for update nowait;
  exception when lock_not_available then
    return -1;
  end;
  if not found or v_revision <> p_revision then return -1; end if;
  if v_state is null then
    v_state := public.compact_user_state_transport(public.user_state_document(p_user_id));
  end if;
  update public.user_state_meta set transport_state = v_state
  where user_id = p_user_id and revision = p_revision
  returning transport_chunk_count into v_count;
  return coalesce(v_count, 0);
end;
$$;
revoke all on function public.ensure_user_state_transport_chunks(uuid, bigint)
  from public, anon, authenticated;

create or replace function public.load_user_state_chunk(
  p_revision bigint,
  p_chunk_index integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '120s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_count integer;
  v_part_count integer;
  v_data text;
  v_bytes bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_revision is null or p_revision < 0 or p_chunk_index is null or p_chunk_index < 0 then
    raise exception 'Invalid state chunk coordinates' using errcode = '22023';
  end if;
  -- One MVCC statement observes the matching metadata and immutable chunk.
  select m.revision, m.transport_chunk_count, c.chunk_data, c.chunk_bytes, c.chunk_count
  into v_revision, v_count, v_data, v_bytes, v_part_count
  from public.user_state_meta m
  left join public.user_state_transport_chunks c
    on c.user_id = m.user_id and c.revision = p_revision
    and c.chunk_index = p_chunk_index and m.revision = p_revision
  where m.user_id = v_user_id;
  if not found or v_revision <> p_revision then
    return jsonb_build_object('found', false, 'revision', coalesce(v_revision, 0), 'stale', true);
  end if;
  if coalesce(v_count, 0) > 0 and p_chunk_index >= v_count then
    return jsonb_build_object('found', false, 'revision', v_revision, 'stale', true);
  end if;
  if v_data is null or v_part_count is distinct from v_count
    or v_bytes is distinct from octet_length(v_data) then
    v_count := public.ensure_user_state_transport_chunks(v_user_id, p_revision);
    if v_count <= 0 or p_chunk_index >= v_count then
      return jsonb_build_object('found', false, 'revision', v_revision,
        'chunkIndex', p_chunk_index, 'chunkCount', greatest(v_count, 0), 'stale', true);
    end if;
    select c.chunk_data, c.chunk_bytes, c.chunk_count into v_data, v_bytes, v_part_count
    from public.user_state_transport_chunks c
    where c.user_id = v_user_id and c.revision = p_revision and c.chunk_index = p_chunk_index;
  end if;
  if v_data is null or p_chunk_index >= v_count or v_part_count is distinct from v_count then
    return jsonb_build_object('found', false, 'revision', v_revision, 'stale', true);
  end if;
  return jsonb_build_object('found', true, 'revision', v_revision,
    'chunkIndex', p_chunk_index, 'chunkCount', v_count, 'data', v_data, 'bytes', v_bytes);
end;
$$;
revoke all on function public.load_user_state_chunk(bigint, integer) from public, anon;
grant execute on function public.load_user_state_chunk(bigint, integer) to authenticated;

-- Staging only preflights the revision. The existing authoritative CAS writer
-- takes the write lock and rechecks it at commit; removing these early locks
-- also removes the session/meta and profile/meta lock-order inversions.
do $writers$
declare
  v_signature text;
  v_source text;
  v_updated text;
  v_lock text := E'where user_id = v_user_id\n  for update;';
begin
  foreach v_signature in array array[
    'public.begin_user_state_upload(uuid,bigint,boolean,text,integer,bigint)',
    'public.finalize_user_state_upload(uuid)'
  ] loop
    v_source := pg_get_functiondef(v_signature::regprocedure);
    if (length(v_source) - length(replace(v_source, v_lock, ''))) / length(v_lock) <> 1 then
      raise exception 'Unexpected staged writer definition: %', v_signature;
    end if;
    v_updated := replace(v_source, v_lock, 'where user_id = v_user_id;');
    execute v_updated;
  end loop;
end;
$writers$;

-- The old doubled backslash matched a literal backslash rather than a digit.
-- New writes must populate normalized daily activity as well as JSON history.
-- This changes function definitions only; no existing user rows are rewritten.
do $activity_dates$
declare
  v_signature text;
  v_source text;
  v_updated text;
  v_field text;
  v_condition text;
  v_count integer;
begin
  foreach v_signature in array array[
    'public.save_user_state_legacy(jsonb,bigint,boolean)',
    'public.save_user_state_delta(jsonb,bigint,boolean)'
  ] loop
    v_source := pg_get_functiondef(v_signature::regprocedure);
    v_updated := v_source;
    v_count := 0;
    foreach v_field in array array['entry.key', 'incoming.activity_date', 'v_key'] loop
      v_condition := substring(v_source from replace(v_field, '.', '[.]') || ' ~ ''[^'']+''');
      if v_condition is not null then
        v_updated := replace(v_updated, v_condition,
          v_field || ' ~ ''^[0-9]{4}-[0-9]{2}-[0-9]{2}$''');
        v_count := v_count + 1;
      end if;
    end loop;
    if v_count <> (case when v_signature like '%_legacy(%' then 2 else 1 end) then
      raise exception 'Unexpected daily activity date guards: %', v_signature;
    end if;
    execute v_updated;
  end loop;
end;
$activity_dates$;

commit;
