begin;

-- Return only the metadata needed to make the subsequent state download
-- determinate. The byte count is calculated from the same compact JSON
-- document used by load_user_state, so compressed HTTP transfer does not make
-- the browser guess at a percentage.
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
  v_document jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select revision, updated_at
  into v_revision, v_updated_at
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

  v_state := public.compact_user_state_transport(
    public.user_state_document(v_user_id)
  );
  v_document := jsonb_build_object(
    'found', true,
    'revision', v_revision,
    'updatedAt', v_updated_at,
    'state', v_state
  );

  return jsonb_build_object(
    'found', true,
    'revision', v_revision,
    'updatedAt', v_updated_at,
    'bytes', octet_length(v_document::text)
  );
end;
$$;

revoke all on function public.load_user_state_manifest() from public, anon;
grant execute on function public.load_user_state_manifest() to authenticated;

commit;
