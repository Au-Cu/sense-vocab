begin;

create or replace function public.internal_user_activity_rows()
returns table (
  user_id uuid,
  activity_date date,
  activity_data jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with metadata as (
    select
      meta.user_id,
      case
        when jsonb_typeof(meta.extra_state -> 'bookStates') = 'object'
          then meta.extra_state -> 'bookStates'
        else '{}'::jsonb
      end as book_states
    from public.user_state_meta as meta
  ),
  book_activity as (
    select
      metadata.user_id,
      activity.key::date as activity_date,
      activity.value as activity_data
    from metadata
    cross join lateral jsonb_each(metadata.book_states) as book
    cross join lateral jsonb_each(
      case
        when jsonb_typeof(book.value -> 'activityLog') = 'object'
          then book.value -> 'activityLog'
        else '{}'::jsonb
      end
    ) as activity
    where activity.key ~ '^\d{4}-\d{2}-\d{2}$'
  ),
  legacy_users as (
    select metadata.user_id
    from metadata
    where not exists (
      select 1
      from jsonb_object_keys(metadata.book_states)
    )
  )
  select
    book_activity.user_id,
    book_activity.activity_date,
    book_activity.activity_data
  from book_activity
  union all
  select
    activity.user_id,
    activity.activity_date,
    activity.activity_data
  from public.daily_activity as activity
  join legacy_users on legacy_users.user_id = activity.user_id
$$;

revoke all on function public.internal_user_activity_rows()
  from public, anon, authenticated;

create or replace function public.internal_user_book_stats(p_user_id uuid)
returns table (
  book_id text,
  introduced_words integer,
  reinforce_senses integer,
  review_senses integer,
  mastered_senses integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with books as (
    select book.key as book_id, book.value as book_state
    from public.user_state_meta as meta
    cross join lateral jsonb_each(
      case
        when jsonb_typeof(meta.extra_state -> 'bookStates') = 'object'
          then meta.extra_state -> 'bookStates'
        else '{}'::jsonb
      end
    ) as book
    where meta.user_id = p_user_id
  )
  select
    books.book_id,
    case
      when jsonb_typeof(books.book_state -> 'introducedWords') = 'array'
        then jsonb_array_length(books.book_state -> 'introducedWords')
      else 0
    end::integer as introduced_words,
    count(*) filter (
      where progress.value ->> 'status' = 'reinforce'
    )::integer as reinforce_senses,
    count(*) filter (
      where progress.value ->> 'status' = 'review'
    )::integer as review_senses,
    count(*) filter (
      where progress.value ->> 'status' = 'mastered'
    )::integer as mastered_senses
  from books
  left join lateral jsonb_each(
    case
      when jsonb_typeof(books.book_state -> 'progress') = 'object'
        then books.book_state -> 'progress'
      else '{}'::jsonb
    end
  ) as progress on true
  group by books.book_id, books.book_state
$$;

revoke all on function public.internal_user_book_stats(uuid)
  from public, anon, authenticated;

create or replace function public.user_learning_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active_dates as (
    select distinct activity_date
    from public.internal_user_activity_rows()
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
  from summary
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
    join public.internal_user_activity_rows() as activity
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
  from eligible
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
      from public.internal_user_activity_rows()
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
        'introducedWords', coalesce(
          book_stats.introduced_words,
          case
            when jsonb_typeof(meta.introduced_words) = 'array'
              then jsonb_array_length(meta.introduced_words)
            else 0
          end
        ),
        'pendingReinforceSenses', coalesce(
          book_stats.reinforce_senses,
          normalized_senses.reinforce_count,
          0
        ),
        'pendingReviewSenses', coalesce(
          book_stats.review_senses,
          normalized_senses.review_count,
          0
        ),
        'masteredSenses', coalesce(
          book_stats.mastered_senses,
          normalized_senses.mastered_count,
          0
        )
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
          sum(stats.introduced_words)::integer as introduced_words,
          sum(stats.reinforce_senses)::integer as reinforce_senses,
          sum(stats.review_senses)::integer as review_senses,
          sum(stats.mastered_senses)::integer as mastered_senses
        from public.internal_user_book_stats(profile.user_id) as stats
      ) as book_stats on true
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
      ) as normalized_senses on true
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
    'registrationNumber', profile.registration_number,
    'lastSyncAt', meta.updated_at,
    'learningDayCounter', meta.learning_day_counter,
    'introducedWords', coalesce(
      book_stats.introduced_words,
      case
        when jsonb_typeof(meta.introduced_words) = 'array'
          then jsonb_array_length(meta.introduced_words)
        else 0
      end
    ),
    'bookId', coalesce(nullif(meta.extra_state ->> 'activeBookId', ''), 'kaoyan'),
    'bookStats', coalesce(book_stats.items, '[]'::jsonb),
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
    'senseStatus', jsonb_build_object(
      'new', 0,
      'reinforce', coalesce(
        book_stats.reinforce_senses,
        normalized_senses.reinforce_count,
        0
      ),
      'review', coalesce(
        book_stats.review_senses,
        normalized_senses.review_count,
        0
      ),
      'mastered', coalesce(
        book_stats.mastered_senses,
        normalized_senses.mastered_count,
        0
      )
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
  left join lateral (
    select
      sum(stats.introduced_words)::integer as introduced_words,
      sum(stats.reinforce_senses)::integer as reinforce_senses,
      sum(stats.review_senses)::integer as review_senses,
      sum(stats.mastered_senses)::integer as mastered_senses,
      jsonb_agg(
        jsonb_build_object(
          'bookId', stats.book_id,
          'introducedWords', stats.introduced_words,
          'reinforce', stats.reinforce_senses,
          'review', stats.review_senses,
          'mastered', stats.mastered_senses
        )
        order by stats.book_id
      ) as items
    from public.internal_user_book_stats(profile.user_id) as stats
  ) as book_stats on true
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
  ) as normalized_senses on true
  where profile.user_id = p_user_id;

  return v_result;
end;
$$;

revoke all on function public.user_learning_summary(uuid)
  from public, anon;
revoke all on function public.admin_retention_rate(integer)
  from public, anon, authenticated;
revoke all on function public.admin_dashboard()
  from public, anon, authenticated;
revoke all on function public.admin_user_list(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.admin_user_detail(uuid)
  from public, anon, authenticated;

grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_user_list(text, integer, integer)
  to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;

commit;
