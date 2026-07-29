begin;

create or replace function public.admin_expired_feedback(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
begin
  if v_user_id is null or not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', expired.id,
          'imagePaths', expired.image_paths
        )
        order by expired.expires_at
      )
      from (
        select feedback.id, feedback.image_paths, feedback.expires_at
        from public.feedback_reports as feedback
        where feedback.expires_at <= now()
        order by feedback.expires_at
        limit v_limit
      ) as expired
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.admin_delete_expired_feedback(
  p_feedback_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_ids uuid[] := coalesce(p_feedback_ids, array[]::uuid[]);
  v_requested integer := cardinality(v_ids);
  v_eligible integer;
  v_deleted integer;
begin
  if v_user_id is null or not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if v_requested > 100 then
    raise exception 'too many feedback rows requested' using errcode = '22023';
  end if;
  if v_requested = 0 then
    return jsonb_build_object('deleted', 0);
  end if;

  select count(*)
  into v_eligible
  from public.feedback_reports as feedback
  where feedback.id = any(v_ids)
    and feedback.expires_at <= now();

  if v_eligible <> v_requested then
    raise exception 'feedback row is missing or not expired'
      using errcode = '22023';
  end if;

  delete from public.feedback_reports
  where id = any(v_ids)
    and expires_at <= now();
  get diagnostics v_deleted = row_count;

  insert into public.admin_audit_log (
    admin_user_id,
    action,
    target_type,
    metadata
  )
  values (
    v_user_id,
    'feedback.retention.purge',
    'feedback',
    jsonb_build_object('deleted', v_deleted)
  );

  return jsonb_build_object('deleted', v_deleted);
end;
$$;

revoke all on function public.admin_expired_feedback(integer)
  from public, anon;
revoke all on function public.admin_delete_expired_feedback(uuid[])
  from public, anon;
grant execute on function public.admin_expired_feedback(integer)
  to authenticated;
grant execute on function public.admin_delete_expired_feedback(uuid[])
  to authenticated;

commit;
