begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self" on public.admin_users
  for select
  using ((select auth.uid()) = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('2069264161@qq.com')
on conflict (user_id) do nothing;

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  image_paths jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_message_length
    check (char_length(message) between 3 and 4000),
  constraint feedback_image_paths_array
    check (
      jsonb_typeof(image_paths) = 'array'
      and jsonb_array_length(image_paths) <= 4
    ),
  constraint feedback_status_value
    check (status in ('new', 'in_progress', 'resolved'))
);

create index if not exists feedback_reports_user_created_idx
  on public.feedback_reports (user_id, created_at desc);
create index if not exists feedback_reports_status_created_idx
  on public.feedback_reports (status, created_at desc);

alter table public.feedback_reports enable row level security;

drop policy if exists "feedback_select_own_or_admin" on public.feedback_reports;
create policy "feedback_select_own_or_admin" on public.feedback_reports
  for select
  using ((select auth.uid()) = user_id or public.is_admin());

drop policy if exists "feedback_update_admin" on public.feedback_reports;
create policy "feedback_update_admin" on public.feedback_reports
  for update
  using (public.is_admin())
  with check (public.is_admin());

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'feedback-images',
  'feedback-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "feedback_images_insert_own" on storage.objects;
create policy "feedback_images_insert_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'feedback-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "feedback_images_select_own_or_admin" on storage.objects;
create policy "feedback_images_select_own_or_admin" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'feedback-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

drop policy if exists "feedback_images_delete_own_or_admin" on storage.objects;
create policy "feedback_images_delete_own_or_admin" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'feedback-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

create or replace function public.submit_feedback(
  p_feedback_id uuid,
  p_message text,
  p_image_paths jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_message text := btrim(coalesce(p_message, ''));
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_feedback_id is null then
    raise exception 'Feedback id is required' using errcode = '22023';
  end if;
  if char_length(v_message) < 3 or char_length(v_message) > 4000 then
    raise exception 'Feedback must contain between 3 and 4000 characters'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_image_paths) <> 'array'
    or jsonb_array_length(p_image_paths) > 4 then
    raise exception 'Feedback may contain at most four images'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_image_paths) as image_path(path)
    where image_path.path not like
      v_user_id::text || '/' || p_feedback_id::text || '/%'
  ) then
    raise exception 'Invalid feedback image path' using errcode = '22023';
  end if;

  insert into public.feedback_reports (
    id,
    user_id,
    message,
    image_paths
  )
  values (
    p_feedback_id,
    v_user_id,
    v_message,
    p_image_paths
  );

  return jsonb_build_object(
    'ok', true,
    'id', p_feedback_id,
    'createdAt', now()
  );
end;
$$;

create or replace function public.activity_word_count(p_data jsonb)
returns integer
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select
    greatest(
      case
        when coalesce(p_data ->> 'newCount', '') ~ '^\d+$'
          then (p_data ->> 'newCount')::integer
        else 0
      end,
      case
        when jsonb_typeof(p_data -> 'newWords') = 'array'
          then jsonb_array_length(p_data -> 'newWords')
        else 0
      end
    )
    +
    greatest(
      case
        when coalesce(p_data ->> 'reviewCount', '') ~ '^\d+$'
          then (p_data ->> 'reviewCount')::integer
        else 0
      end,
      case
        when jsonb_typeof(p_data -> 'reviewWords') = 'array'
          then jsonb_array_length(p_data -> 'reviewWords')
        else 0
      end
    );
$$;

create or replace function public.admin_retention_rate(p_days integer)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eligible as (
    select
      profile.user_id,
      timezone('Asia/Hong_Kong', profile.created_at)::date as cohort_date
    from public.profiles as profile
    where timezone('Asia/Hong_Kong', profile.created_at)::date
      <= timezone('Asia/Hong_Kong', now())::date - p_days
  ),
  retained as (
    select distinct eligible.user_id
    from eligible
    join public.daily_activity as activity
      on activity.user_id = eligible.user_id
      and activity.activity_date = eligible.cohort_date + p_days
    where public.activity_word_count(activity.activity_data) > 0
  )
  select case
    when count(*) = 0 then null
    else round(
      100.0 * (select count(*) from retained) / count(*),
      1
    )
  end
  from eligible;
$$;

create or replace function public.user_learning_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active_dates as (
    select distinct activity_date
    from public.daily_activity
    where user_id = p_user_id
      and public.activity_word_count(activity_data) > 0
  ),
  numbered as (
    select
      activity_date,
      activity_date
        + (row_number() over (order by activity_date desc))::integer
        as streak_group
    from active_dates
  ),
  summary as (
    select
      max(activity_date) as last_study_date,
      count(*)::integer as study_days
    from active_dates
  )
  select jsonb_build_object(
    'lastStudyDate', summary.last_study_date,
    'studyDays', summary.study_days,
    'currentStreak',
      case
        when summary.last_study_date is null
          or summary.last_study_date
            < timezone('Asia/Hong_Kong', now())::date - 1
          then 0
        else (
          select count(*)::integer
          from numbered
          where streak_group = summary.last_study_date + 1
        )
      end
  )
  from summary;
$$;

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
    with active as (
      select user_id, activity_date
      from public.daily_activity
      where public.activity_word_count(activity_data) > 0
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
      'd1Retention', public.admin_retention_rate(1),
      'd7Retention', public.admin_retention_rate(7),
      'd30Retention', public.admin_retention_rate(30),
      'newFeedback', (
        select count(*)
        from public.feedback_reports
        where status = 'new'
      )
    )
  );
end;
$$;

create or replace function public.admin_user_list(
  p_search text default '',
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
  v_search text := btrim(coalesce(p_search, ''));
  v_limit integer := least(200, greatest(1, coalesce(p_limit, 100)));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return (
    with filtered as (
      select profile.*
      from public.profiles as profile
      where v_search = ''
        or coalesce(profile.email, '') ilike '%' || v_search || '%'
    ),
    paged as (
      select *
      from filtered
      order by created_at desc
      limit v_limit
      offset v_offset
    ),
    items as (
      select jsonb_build_object(
        'userId', profile.user_id,
        'email', profile.email,
        'registeredAt', profile.created_at,
        'lastStudyDate', summary.data -> 'lastStudyDate',
        'studyDays', coalesce((summary.data ->> 'studyDays')::integer, 0),
        'currentStreak', coalesce((summary.data ->> 'currentStreak')::integer, 0),
        'lastSyncAt', meta.updated_at,
        'dailyTarget', case
          when coalesce(plan.plan_data ->> 'dailyTarget', '') ~ '^\d+$'
            then (plan.plan_data ->> 'dailyTarget')::integer
          else null
        end,
        'introducedWords', case
          when jsonb_typeof(meta.introduced_words) = 'array'
            then jsonb_array_length(meta.introduced_words)
          else 0
        end,
        'pendingReinforceSenses', coalesce(senses.reinforce_count, 0),
        'pendingReviewSenses', coalesce(senses.review_count, 0),
        'masteredSenses', coalesce(senses.mastered_count, 0)
      ) as item,
      profile.created_at
      from paged as profile
      cross join lateral (
        select public.user_learning_summary(profile.user_id) as data
      ) as summary
      left join public.user_state_meta as meta
        on meta.user_id = profile.user_id
      left join public.plans as plan
        on plan.user_id = profile.user_id
      left join lateral (
        select
          count(*) filter (
            where progress_data ->> 'status' = 'reinforce'
          )::integer as reinforce_count,
          count(*) filter (
            where progress_data ->> 'status' = 'review'
          )::integer as review_count,
          count(*) filter (
            where progress_data ->> 'status' = 'mastered'
          )::integer as mastered_count
        from public.sense_progress
        where user_id = profile.user_id
      ) as senses on true
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'items', coalesce(
        (select jsonb_agg(item order by created_at desc) from items),
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
    'lastSyncAt', meta.updated_at,
    'revision', meta.revision,
    'learningDayCounter', meta.learning_day_counter,
    'introducedWords', case
      when jsonb_typeof(meta.introduced_words) = 'array'
        then jsonb_array_length(meta.introduced_words)
      else 0
    end,
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
    'activity', (
      select coalesce(
        jsonb_object_agg(activity_date::text, activity_data),
        '{}'::jsonb
      )
      from public.daily_activity
      where user_id = profile.user_id
        and activity_date >= timezone('Asia/Hong_Kong', now())::date - 364
    ),
    'studyWindowCount', (
      select count(*)
      from public.study_windows
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
        feedback.status,
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
            'status', status,
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

create or replace function public.admin_update_feedback_status(
  p_feedback_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('new', 'in_progress', 'resolved') then
    raise exception 'Invalid feedback status' using errcode = '22023';
  end if;

  update public.feedback_reports
  set status = p_status,
      updated_at = now()
  where id = p_feedback_id;

  if not found then
    raise exception 'Feedback not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', p_feedback_id,
    'status', p_status,
    'updatedAt', now()
  );
end;
$$;

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from storage.objects
  where bucket_id = 'feedback-images'
    and (storage.foldername(name))[1] = v_user_id::text;

  delete from auth.users where id = v_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;
revoke all on table public.feedback_reports from anon, authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.submit_feedback(uuid, text, jsonb) from public, anon;
grant execute on function public.submit_feedback(uuid, text, jsonb) to authenticated;

revoke all on function public.activity_word_count(jsonb) from public, anon, authenticated;
revoke all on function public.admin_retention_rate(integer) from public, anon, authenticated;
revoke all on function public.user_learning_summary(uuid) from public, anon, authenticated;

revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
revoke all on function public.admin_user_list(text, integer, integer)
  from public, anon;
grant execute on function public.admin_user_list(text, integer, integer)
  to authenticated;
revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;
revoke all on function public.admin_feedback_list(text, integer, integer)
  from public, anon;
grant execute on function public.admin_feedback_list(text, integer, integer)
  to authenticated;
revoke all on function public.admin_update_feedback_status(uuid, text)
  from public, anon;
grant execute on function public.admin_update_feedback_status(uuid, text)
  to authenticated;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
