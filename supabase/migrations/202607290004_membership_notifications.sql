begin;

create sequence if not exists public.profile_registration_number_seq;

alter table public.profiles
  add column if not exists registration_number bigint,
  add column if not exists membership_expires_at timestamptz,
  add column if not exists invite_code text,
  add column if not exists invite_used_at timestamptz,
  add column if not exists invited_by uuid;

with ranked as (
  select
    user_id,
    row_number() over (order by created_at, user_id)::bigint as registration_number
  from public.profiles
)
update public.profiles as profile
set registration_number = ranked.registration_number
from ranked
where profile.user_id = ranked.user_id
  and profile.registration_number is null;

select setval(
  'public.profile_registration_number_seq',
  greatest(
    1,
    coalesce((select max(registration_number) from public.profiles), 0) + 1
  ),
  false
);

alter table public.profiles
  alter column registration_number
    set default nextval('public.profile_registration_number_seq'),
  alter column registration_number set not null,
  alter column membership_expires_at
    set default (clock_timestamp() + interval '21 days');

update public.profiles
set membership_expires_at = clock_timestamp() + interval '21 days'
where membership_expires_at is null;

alter table public.profiles
  alter column membership_expires_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_invited_by_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_invited_by_fkey
      foreign key (invited_by)
      references public.profiles(user_id)
      on delete set null;
  end if;
end;
$$;

create unique index if not exists profiles_registration_number_uidx
  on public.profiles (registration_number);
create unique index if not exists profiles_invite_code_uidx
  on public.profiles (upper(invite_code))
  where invite_code is not null;
create index if not exists profiles_membership_expires_idx
  on public.profiles (membership_expires_at);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_length
    check (char_length(title) between 1 and 120),
  constraint announcements_body_length
    check (char_length(body) between 1 and 4000)
);

create index if not exists announcements_published_at_idx
  on public.announcements (published_at desc);

create table if not exists public.announcement_reads (
  announcement_id uuid not null
    references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null default 'system',
  title text not null,
  body text not null,
  feedback_id uuid references public.feedback_reports(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_notifications_type_value
    check (notification_type in (
      'system',
      'feedback_reply',
      'membership',
      'invitation'
    )),
  constraint user_notifications_title_length
    check (char_length(title) between 1 and 120),
  constraint user_notifications_body_length
    check (char_length(body) between 1 and 4000)
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);
create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id, read_at)
  where read_at is null;

alter table public.feedback_reports
  add column if not exists admin_reply text,
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedback_reports_replied_by_fkey'
      and conrelid = 'public.feedback_reports'::regclass
  ) then
    alter table public.feedback_reports
      add constraint feedback_reports_replied_by_fkey
      foreign key (replied_by)
      references auth.users(id)
      on delete set null;
  end if;
end;
$$;

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.user_notifications enable row level security;

revoke all on table public.announcements from anon, authenticated;
revoke all on table public.announcement_reads from anon, authenticated;
revoke all on table public.user_notifications from anon, authenticated;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(encode(extensions.gen_random_bytes(6), 'hex'));
    exit when not exists (
      select 1
      from public.profiles
      where upper(invite_code) = v_code
    );
  end loop;
  return v_code;
end;
$$;

do $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select user_id
    from public.profiles
    where invite_code is null
    order by created_at, user_id
  loop
    update public.profiles
    set invite_code = public.generate_invite_code(),
        updated_at = now()
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
      set invite_used_at = clock_timestamp(),
          membership_expires_at =
            greatest(inviter.membership_expires_at, clock_timestamp())
              + interval '14 days',
          updated_at = clock_timestamp()
      where upper(inviter.invite_code) = v_invite_code
        and inviter.invite_used_at is null
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
            '一位新用户使用了你的邀请码，你的会员有效期已增加 14 天。'
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

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
      and invite_used_at is null
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
  if p_user_id is null then
    raise exception 'User id is required' using errcode = '22023';
  end if;

  select *
  into v_profile
  from public.profiles
  where user_id = p_user_id
    and (
      auth.uid() = p_user_id
      or created_at >= clock_timestamp() - interval '30 minutes'
    );

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
    'inviteCode', case
      when v_profile.invite_used_at is null then v_profile.invite_code
      else null
    end,
    'inviteUsedAt', v_profile.invite_used_at,
    'referralApplied', v_profile.invited_by is not null
  );
end;
$$;

create or replace function public.load_my_notifications(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(200, greatest(1, coalesce(p_limit, 100)));
begin
  return (
    with combined as (
      select
        announcement.id,
        'announcement'::text as kind,
        'announcement'::text as notification_type,
        announcement.title,
        announcement.body,
        null::uuid as feedback_id,
        announcement.published_at as created_at,
        reads.read_at
      from public.announcements as announcement
      left join public.announcement_reads as reads
        on reads.announcement_id = announcement.id
       and reads.user_id = v_user_id
      where announcement.published_at <= clock_timestamp()

      union all

      select
        notification.id,
        'direct'::text as kind,
        notification.notification_type,
        notification.title,
        notification.body,
        notification.feedback_id,
        notification.created_at,
        notification.read_at
      from public.user_notifications as notification
      where v_user_id is not null
        and notification.user_id = v_user_id
    ),
    paged as (
      select *
      from combined
      order by created_at desc, id
      limit v_limit
    )
    select jsonb_build_object(
      'authenticated', v_user_id is not null,
      'unreadCount', (
        select count(*)
        from combined
        where v_user_id is not null
          and read_at is null
      ),
      'items', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', id,
              'kind', kind,
              'type', notification_type,
              'title', title,
              'body', body,
              'feedbackId', feedback_id,
              'createdAt', created_at,
              'readAt', read_at
            )
            order by created_at desc, id
          )
          from paged
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

create or replace function public.mark_my_notification_read(
  p_kind text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_id is null or p_kind not in ('announcement', 'direct') then
    raise exception 'Invalid notification' using errcode = '22023';
  end if;

  if p_kind = 'announcement' then
    if not exists (
      select 1
      from public.announcements
      where id = p_id
        and published_at <= clock_timestamp()
    ) then
      raise exception 'Notification not found' using errcode = 'P0002';
    end if;
    insert into public.announcement_reads (
      announcement_id,
      user_id,
      read_at
    )
    values (p_id, v_user_id, clock_timestamp())
    on conflict (announcement_id, user_id) do update
    set read_at = excluded.read_at;
  else
    update public.user_notifications
    set read_at = coalesce(read_at, clock_timestamp())
    where id = p_id
      and user_id = v_user_id;
    if not found then
      raise exception 'Notification not found' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', p_id, 'kind', p_kind);
end;
$$;

create or replace function public.admin_publish_announcement(
  p_title text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_user_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Announcement title must contain 1 to 120 characters'
      using errcode = '22023';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Announcement body must contain 1 to 4000 characters'
      using errcode = '22023';
  end if;

  insert into public.announcements (title, body, created_by)
  values (v_title, v_body, v_user_id)
  returning id into v_id;

  insert into public.admin_audit_log (
    admin_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    v_user_id,
    'announcement.publish',
    'announcement',
    v_id::text,
    jsonb_build_object('titleLength', char_length(v_title))
  );

  return jsonb_build_object('ok', true, 'id', v_id, 'publishedAt', now());
end;
$$;

create or replace function public.admin_announcement_list(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(200, greatest(1, coalesce(p_limit, 100)));
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'items',
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'title', title,
            'body', body,
            'publishedAt', published_at,
            'createdAt', created_at
          )
          order by published_at desc
        ),
        '[]'::jsonb
      )
    )
    from (
      select *
      from public.announcements
      order by published_at desc
      limit v_limit
    ) as recent
  );
end;
$$;

create or replace function public.admin_reply_feedback(
  p_feedback_id uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_user_id uuid;
  v_message text := btrim(coalesce(p_message, ''));
  v_notification_id uuid;
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_feedback_id is null then
    raise exception 'Feedback id is required' using errcode = '22023';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 4000 then
    raise exception 'Reply must contain 1 to 4000 characters'
      using errcode = '22023';
  end if;

  update public.feedback_reports
  set admin_reply = v_message,
      replied_at = clock_timestamp(),
      replied_by = v_admin_id,
      status = 'resolved',
      updated_at = clock_timestamp()
  where id = p_feedback_id
  returning user_id into v_user_id;

  if v_user_id is null then
    raise exception 'Feedback not found' using errcode = 'P0002';
  end if;

  insert into public.user_notifications (
    user_id,
    notification_type,
    title,
    body,
    feedback_id,
    created_by
  )
  values (
    v_user_id,
    'feedback_reply',
    '你的反馈收到了答复',
    v_message,
    p_feedback_id,
    v_admin_id
  )
  returning id into v_notification_id;

  insert into public.admin_audit_log (
    admin_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    v_admin_id,
    'feedback.reply',
    'feedback',
    p_feedback_id::text,
    jsonb_build_object('notificationId', v_notification_id)
  );

  return jsonb_build_object(
    'ok', true,
    'feedbackId', p_feedback_id,
    'notificationId', v_notification_id,
    'repliedAt', now()
  );
end;
$$;

create or replace function public.admin_feedback_list(
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(200, greatest(1, coalesce(p_limit, 100)));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_status is not null
    and p_status not in ('new', 'in_progress', 'resolved') then
    raise exception 'Invalid feedback status' using errcode = '22023';
  end if;

  return (
    with filtered as (
      select
        feedback.id,
        feedback.user_id,
        profile.email,
        feedback.message,
        feedback.image_paths,
        feedback.context_data,
        feedback.status,
        feedback.admin_reply,
        feedback.replied_at,
        feedback.created_at,
        feedback.updated_at
      from public.feedback_reports as feedback
      left join public.profiles as profile
        on profile.user_id = feedback.user_id
      where p_status is null or feedback.status = p_status
    ),
    paged as (
      select *
      from filtered
      order by
        case status
          when 'new' then 0
          when 'in_progress' then 1
          else 2
        end,
        created_at desc
      limit v_limit
      offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'items', coalesce(
        (
          select jsonb_agg(jsonb_build_object(
            'id', id,
            'userId', user_id,
            'email', email,
            'message', message,
            'imagePaths', image_paths,
            'context', context_data,
            'status', status,
            'adminReply', admin_reply,
            'repliedAt', replied_at,
            'createdAt', created_at,
            'updatedAt', updated_at
          ))
          from paged
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'userId', profile.user_id,
    'email', profile.email,
    'registeredAt', profile.created_at,
    'registrationNumber', profile.registration_number,
    'lastSyncAt', meta.updated_at,
    'learningDayCounter', meta.learning_day_counter,
    'introducedWords', case
      when jsonb_typeof(meta.introduced_words) = 'array'
        then jsonb_array_length(meta.introduced_words)
      else 0
    end,
    'bookId', coalesce(nullif(meta.extra_state ->> 'activeBookId', ''), 'kaoyan'),
    'membershipExpiresAt', profile.membership_expires_at,
    'membershipRemainingDays', greatest(
      0,
      ceil(extract(epoch from (
        profile.membership_expires_at - clock_timestamp()
      )) / 86400.0)::integer
    ),
    'inviteCode', case
      when profile.invite_used_at is null then profile.invite_code
      else null
    end,
    'inviteUsedAt', profile.invite_used_at,
    'plan', plan.plan_data,
    'learning', public.user_learning_summary(profile.user_id),
    'senseStatus', (
      select jsonb_build_object(
        'new', count(*) filter (where progress_data ->> 'status' = 'new'),
        'reinforce', count(*) filter (
          where progress_data ->> 'status' = 'reinforce'
        ),
        'review', count(*) filter (where progress_data ->> 'status' = 'review'),
        'mastered', count(*) filter (
          where progress_data ->> 'status' = 'mastered'
        )
      )
      from public.sense_progress
      where user_id = profile.user_id
    ),
    'feedbackCount', (
      select count(*)
      from public.feedback_reports
      where user_id = profile.user_id
    )
  )
  into v_result
  from public.profiles as profile
  left join public.user_state_meta as meta
    on meta.user_id = profile.user_id
  left join public.plans as plan
    on plan.user_id = profile.user_id
  where profile.user_id = p_user_id;

  return v_result;
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
  v_expires_at timestamptz;
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or p_days is null or p_days < 0 or p_days > 36500 then
    raise exception 'Membership days must be between 0 and 36500'
      using errcode = '22023';
  end if;

  select greatest(
    0,
    ceil(extract(epoch from (
      membership_expires_at - clock_timestamp()
    )) / 86400.0)::integer
  )
  into v_current_days
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

  v_expires_at := clock_timestamp() + make_interval(days => p_days);
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
    '会员有效期已调整',
    format('管理员已将你的会员剩余时长设置为 %s 天。', p_days),
    v_admin_id
  );

  insert into public.admin_audit_log (
    admin_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    v_admin_id,
    'membership.set',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'previousRemainingDays', v_current_days,
      'newRemainingDays', p_days
    )
  );

  return jsonb_build_object(
    'ok', true,
    'userId', p_user_id,
    'remainingDays', p_days,
    'membershipExpiresAt', v_expires_at
  );
end;
$$;

create or replace function public.admin_extend_all_memberships()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_affected integer;
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  update public.profiles
  set membership_expires_at =
        greatest(membership_expires_at, clock_timestamp()) + interval '7 days',
      updated_at = clock_timestamp();
  get diagnostics v_affected = row_count;

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
  from public.profiles;

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

revoke all on function public.generate_invite_code()
  from public, anon, authenticated;
revoke all on function public.handle_new_user()
  from public, anon, authenticated;

revoke all on function public.validate_invitation_code(text)
  from public;
grant execute on function public.validate_invitation_code(text)
  to anon, authenticated;

revoke all on function public.registration_welcome(uuid)
  from public;
grant execute on function public.registration_welcome(uuid)
  to anon, authenticated;

revoke all on function public.load_my_account_profile()
  from public, anon;
grant execute on function public.load_my_account_profile()
  to authenticated;

revoke all on function public.load_my_notifications(integer)
  from public;
grant execute on function public.load_my_notifications(integer)
  to anon, authenticated;

revoke all on function public.mark_my_notification_read(text, uuid)
  from public, anon;
grant execute on function public.mark_my_notification_read(text, uuid)
  to authenticated;

revoke all on function public.admin_publish_announcement(text, text)
  from public, anon;
grant execute on function public.admin_publish_announcement(text, text)
  to authenticated;

revoke all on function public.admin_announcement_list(integer)
  from public, anon;
grant execute on function public.admin_announcement_list(integer)
  to authenticated;

revoke all on function public.admin_reply_feedback(uuid, text)
  from public, anon;
grant execute on function public.admin_reply_feedback(uuid, text)
  to authenticated;

revoke all on function public.admin_feedback_list(text, integer, integer)
  from public, anon;
grant execute on function public.admin_feedback_list(text, integer, integer)
  to authenticated;

revoke all on function public.admin_user_detail(uuid)
  from public, anon;
grant execute on function public.admin_user_detail(uuid)
  to authenticated;

revoke all on function public.admin_set_membership_days(uuid, integer)
  from public, anon;
grant execute on function public.admin_set_membership_days(uuid, integer)
  to authenticated;

revoke all on function public.admin_extend_all_memberships()
  from public, anon;
grant execute on function public.admin_extend_all_memberships()
  to authenticated;

commit;
