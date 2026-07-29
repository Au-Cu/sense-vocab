-- Email OTP account flows are configured in supabase/config.toml. This
-- migration keeps existing account and learning rows intact while rotating
-- one-time invitation codes and reporting membership changes as extensions.

do $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select user_id
    from public.profiles
    where invite_used_at is not null
    order by user_id
  loop
    update public.profiles
    set invite_code = public.generate_invite_code(),
        updated_at = clock_timestamp()
    where user_id = v_user_id;
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite_code text;
  v_inviter_id uuid;
begin
  insert into public.profiles (
    user_id,
    email,
    membership_expires_at,
    invite_code
  )
  values (
    new.id,
    new.email,
    clock_timestamp() + interval '21 days',
    public.generate_invite_code()
  )
  on conflict (user_id) do update
  set email = excluded.email,
      updated_at = now();

  if tg_op = 'INSERT' then
    v_invite_code := upper(btrim(coalesce(
      new.raw_user_meta_data ->> 'invitation_code',
      ''
    )));

    if v_invite_code ~ '^[A-Z0-9]{8,20}$' then
      update public.profiles as inviter
      set invite_code = public.generate_invite_code(),
          invite_used_at = clock_timestamp(),
          membership_expires_at =
            greatest(inviter.membership_expires_at, clock_timestamp())
              + interval '14 days',
          updated_at = clock_timestamp()
      where upper(inviter.invite_code) = v_invite_code
        and inviter.user_id <> new.id
      returning inviter.user_id into v_inviter_id;

      if v_inviter_id is not null then
        update public.profiles
        set invited_by = v_inviter_id,
            membership_expires_at =
              greatest(membership_expires_at, clock_timestamp())
                + interval '14 days',
            updated_at = clock_timestamp()
        where user_id = new.id;

        insert into public.user_notifications (
          user_id,
          notification_type,
          title,
          body
        )
        values
          (
            v_inviter_id,
            'invitation',
            '邀请码已使用',
            '一位新用户使用了你的邀请码。旧邀请码已失效，新邀请码已经生成；你的会员有效期已增加 14 天。'
          ),
          (
            new.id,
            'invitation',
            '邀请奖励已到账',
            '邀请码验证成功，你和邀请人均已获得 14 天会员。'
          );
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_invitation_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where upper(invite_code) = upper(btrim(coalesce(p_code, '')))
  );
$$;

create or replace function public.registration_welcome(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if p_user_id is null or auth.uid() is distinct from p_user_id then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_profile
  from public.profiles
  where user_id = p_user_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'registrationNumber', v_profile.registration_number,
    'referralApplied', v_profile.invited_by is not null,
    'membershipExpiresAt', v_profile.membership_expires_at
  );
end;
$$;

create or replace function public.load_my_account_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_profile
  from public.profiles
  where user_id = v_user_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'registrationNumber', v_profile.registration_number,
    'membershipExpiresAt', v_profile.membership_expires_at,
    'memberActive', v_profile.membership_expires_at > clock_timestamp(),
    'remainingDays', greatest(
      0,
      ceil(extract(epoch from (
        v_profile.membership_expires_at - clock_timestamp()
      )) / 86400.0)::integer
    ),
    'inviteCode', v_profile.invite_code,
    'inviteUsedAt', v_profile.invite_used_at,
    'referralApplied', v_profile.invited_by is not null
  );
end;
$$;

create or replace function public.admin_set_membership_days(
  p_user_id uuid,
  p_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_current_days integer;
  v_current_expires_at timestamptz;
  v_extension_days integer;
  v_expires_at timestamptz;
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or p_days is null or p_days < 0 or p_days > 36500 then
    raise exception 'Membership days must be between 0 and 36500'
      using errcode = '22023';
  end if;

  select
    membership_expires_at,
    greatest(
      0,
      ceil(extract(epoch from (
        membership_expires_at - clock_timestamp()
      )) / 86400.0)::integer
    )
  into v_current_expires_at, v_current_days
  from public.profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if p_days < v_current_days then
    raise exception 'Membership days cannot be shorter than the current remaining time'
      using errcode = '22023';
  end if;

  v_extension_days := p_days - v_current_days;
  v_expires_at := v_current_expires_at;

  if v_extension_days > 0 then
    v_expires_at :=
      greatest(v_current_expires_at, clock_timestamp())
        + make_interval(days => v_extension_days);

    update public.profiles
    set membership_expires_at = v_expires_at,
        updated_at = clock_timestamp()
    where user_id = p_user_id;

    insert into public.user_notifications (
      user_id,
      notification_type,
      title,
      body,
      created_by
    )
    values (
      p_user_id,
      'membership',
      '会员有效期已延长',
      format('管理员已将你的会员剩余时长延长 %s 天。', v_extension_days),
      v_admin_id
    );
  end if;

  insert into public.admin_audit_log (
    admin_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    v_admin_id,
    'membership.extend',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'previousRemainingDays', v_current_days,
      'newRemainingDays', p_days,
      'extendedDays', v_extension_days
    )
  );

  return jsonb_build_object(
    'ok', true,
    'userId', p_user_id,
    'remainingDays', p_days,
    'extendedDays', v_extension_days,
    'membershipExpiresAt', v_expires_at
  );
end;
$$;

revoke all on function public.validate_invitation_code(text)
  from public, anon, authenticated;
grant execute on function public.validate_invitation_code(text)
  to anon, authenticated;

revoke all on function public.registration_welcome(uuid)
  from public, anon, authenticated;
grant execute on function public.registration_welcome(uuid)
  to authenticated;

revoke all on function public.load_my_account_profile()
  from public, anon, authenticated;
grant execute on function public.load_my_account_profile()
  to authenticated;

revoke all on function public.admin_set_membership_days(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.admin_set_membership_days(uuid, integer)
  to authenticated;
