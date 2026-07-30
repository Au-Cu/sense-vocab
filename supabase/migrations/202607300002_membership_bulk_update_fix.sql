-- Keep bulk membership extension compatible with pg-safeupdate while ensuring
-- notifications are created only for profiles updated by this transaction.

create or replace function public.admin_extend_all_memberships()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_affected integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  with updated_profiles as (
    update public.profiles
    set membership_expires_at =
          greatest(
            coalesce(membership_expires_at, v_now),
            v_now
          ) + interval '7 days',
        updated_at = v_now
    where user_id is not null
    returning user_id
  ),
  inserted_notifications as (
    insert into public.user_notifications (
      user_id,
      notification_type,
      title,
      body,
      created_by
    )
    select
      user_id,
      'membership',
      '全员会员福利',
      '你的会员有效期已增加 7 天。',
      v_admin_id
    from updated_profiles
    returning user_id
  )
  select count(*)::integer
  into v_affected
  from inserted_notifications;

  insert into public.admin_audit_log (
    admin_user_id,
    action,
    target_type,
    metadata
  )
  values (
    v_admin_id,
    'membership.extend_all',
    'user',
    jsonb_build_object('days', 7, 'affectedUsers', v_affected)
  );

  return jsonb_build_object(
    'ok', true,
    'days', 7,
    'affectedUsers', v_affected
  );
end;
$$;

revoke all on function public.admin_extend_all_memberships()
  from public, anon, authenticated;
grant execute on function public.admin_extend_all_memberships()
  to authenticated;
