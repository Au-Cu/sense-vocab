begin;

-- The chunk metadata and rows are two physical representations of one
-- document.  Keep the row set self-healing at read time so an interrupted
-- materialization cannot permanently make an account unreadable.
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
  v_document text;
  v_document_bytes bigint;
  v_chunk_chars constant integer := 400000;
  v_chunk_count integer;
  v_index integer;
  v_start integer;
  v_chunk text;
  v_valid boolean;
begin
  if p_user_id is null or p_revision is null or p_revision < 0 then
    raise exception 'Invalid state transport coordinates' using errcode = '22023';
  end if;

  select revision, updated_at, transport_state
  into v_revision, v_updated_at, v_state
  from public.user_state_meta
  where user_id = p_user_id
  for update;

  if not found or v_revision <> p_revision then
    return -1;
  end if;

  if v_state is null then
    v_state := public.compact_user_state_transport(
      public.user_state_document(p_user_id)
    );
    update public.user_state_meta
    set transport_state = v_state,
        transport_bytes = octet_length(jsonb_build_object(
          'found', true,
          'revision', v_revision,
          'updatedAt', v_updated_at,
          'state', v_state
        )::text)
    where user_id = p_user_id
      and revision = v_revision;
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

  if v_document_bytes <= 3500000 then
    delete from public.user_state_transport_chunks
    where user_id = p_user_id;
    update public.user_state_meta
    set transport_chunk_count = 0,
        transport_bytes = v_document_bytes
    where user_id = p_user_id
      and revision = v_revision;
    return 0;
  end if;

  v_chunk_count := greatest(
    1,
    ceil(char_length(v_document)::numeric / v_chunk_chars)::integer
  );

  select count(*) = v_chunk_count
    and coalesce(min(chunk_index), -1) = 0
    and coalesce(max(chunk_index), -1) = v_chunk_count - 1
    and coalesce(bool_and(chunk_count = v_chunk_count), true)
  into v_valid
  from public.user_state_transport_chunks
  where user_id = p_user_id
    and revision = v_revision;

  if not coalesce(v_valid, false) then
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
  end if;

  -- This column is intentionally updated separately from transport_state and
  -- transport_bytes; the sync trigger does not fire for this column alone.
  update public.user_state_meta
  set transport_chunk_count = v_chunk_count,
      transport_bytes = v_document_bytes
  where user_id = p_user_id
    and revision = v_revision;

  return v_chunk_count;
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
set search_path = public, pg_temp
set statement_timeout = '120s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_chunk_count integer;
  v_data text;
  v_bytes bigint;
  v_ensured_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_revision is null or p_revision < 0
    or p_chunk_index is null or p_chunk_index < 0 then
    raise exception 'Invalid state chunk coordinates' using errcode = '22023';
  end if;

  select revision, transport_chunk_count
  into v_revision, v_chunk_count
  from public.user_state_meta
  where user_id = v_user_id
  for update;

  if not found or v_revision <> p_revision then
    return jsonb_build_object(
      'found', false,
      'revision', coalesce(v_revision, 0),
      'stale', true
    );
  end if;

  v_ensured_count := public.ensure_user_state_transport_chunks(
    v_user_id,
    p_revision
  );
  if v_ensured_count <= 0 or p_chunk_index >= v_ensured_count then
    return jsonb_build_object(
      'found', false,
      'revision', v_revision,
      'chunkIndex', p_chunk_index,
      'chunkCount', greatest(v_ensured_count, 0),
      'stale', true
    );
  end if;
  v_chunk_count := v_ensured_count;

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
      'chunkCount', v_chunk_count,
      'stale', true
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

revoke all on function public.load_user_state_chunk(bigint, integer)
  from public, anon;
grant execute on function public.load_user_state_chunk(bigint, integer)
  to authenticated;

-- Repair rows created by the first chunk migration before the client reads
-- them.  The transport_state JSONB column remains the authoritative source.
do $repair$
declare
  v_row record;
begin
  for v_row in
    select user_id, revision
    from public.user_state_meta
    where coalesce(transport_chunk_count, 0) > 0
  loop
    perform public.ensure_user_state_transport_chunks(
      v_row.user_id,
      v_row.revision
    );
  end loop;
end;
$repair$;

-- The 12 MiB check predates chunk transport.  Keep the 64 MiB storage guard
-- consistent across the legacy writer and the current wrapper; deltas already
-- use the same guard.
do $guards$
declare
  v_source text;
  v_replaced text;
begin
  select pg_get_functiondef(
    'public.save_user_state_legacy(jsonb,bigint,boolean)'::regprocedure
  ) into v_source;
  v_replaced := replace(v_source, '12582912', '67108864');
  v_replaced := replace(
    v_replaced,
    'State exceeds the 12 MB limit',
    'State exceeds the 64 MB transport safety limit'
  );
  v_replaced := replace(
    v_replaced,
    'State exceeds the 12 MB transport safety limit',
    'State exceeds the 64 MB transport safety limit'
  );
  if v_replaced = v_source then
    raise exception 'Could not update legacy state size guard';
  end if;
  execute v_replaced;

  select pg_get_functiondef(
    'public.save_user_state(jsonb,bigint,boolean)'::regprocedure
  ) into v_source;
  v_replaced := replace(v_source, '12582912', '67108864');
  v_replaced := replace(
    v_replaced,
    'State exceeds the 12 MB transport safety limit',
    'State exceeds the 64 MB transport safety limit'
  );
  if v_replaced = v_source then
    raise exception 'Could not update state size guard';
  end if;
  execute v_replaced;
end;
$guards$;

-- Compute the four activity/retention values from one materialized activity
-- expansion.  The old dashboard called internal_user_activity_rows four
-- times, repeatedly expanding every account's nested history JSON.
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := timezone('Asia/Hong_Kong', now())::date;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return (
    with activity as materialized (
      select
        activity_row.user_id,
        activity_row.activity_date,
        public.activity_word_count(activity_row.activity_data) as word_count
      from public.internal_user_activity_rows() as activity_row
    ),
    active as (
      select user_id, activity_date
      from activity
      where word_count > 0
    ),
    cohorts as (
      select
        profile.user_id,
        timezone('Asia/Hong_Kong', profile.created_at)::date as cohort_date
      from public.profiles as profile
    ),
    retention as (
      select
        days.value as days,
        case
          when count(distinct cohorts.user_id) = 0 then null
          else round(
            100.0 * count(distinct cohorts.user_id)
              filter (where activity.word_count > 0)
              / count(distinct cohorts.user_id),
            1
          )
        end as rate
      from (values (1), (7), (30)) as days(value)
      left join cohorts
        on cohorts.cohort_date <= v_today - days.value
      left join activity
        on activity.user_id = cohorts.user_id
        and activity.activity_date = cohorts.cohort_date + days.value
      group by days.value
    )
    select jsonb_build_object(
      'registeredUsers', (select count(*) from public.profiles),
      'todayNewUsers', (
        select count(*)
        from public.profiles
        where timezone('Asia/Hong_Kong', created_at)::date = v_today
      ),
      'dau', (
        select count(distinct user_id)
        from active
        where activity_date = v_today
      ),
      'wau', (
        select count(distinct user_id)
        from active
        where activity_date between v_today - 6 and v_today
      ),
      'mau', (
        select count(distinct user_id)
        from active
        where activity_date between v_today - 29 and v_today
      ),
      'd1Retention', (select rate from retention where days = 1),
      'd7Retention', (select rate from retention where days = 7),
      'd30Retention', (select rate from retention where days = 30),
      'newFeedback', (
        select count(*)
        from public.feedback_reports
        where status = 'new'
      )
    )
  );
end;
$$;

revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

create index if not exists daily_activity_date_user_idx
  on public.daily_activity (activity_date, user_id);

commit;
