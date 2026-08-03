begin;

alter table public.announcements
  add column if not exists is_pinned boolean not null default false;

create index if not exists announcements_pinned_published_idx
  on public.announcements (is_pinned desc, published_at desc, id);

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
        reads.read_at,
        announcement.image_paths,
        announcement.is_pinned
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
        notification.read_at,
        '{}'::text[] as image_paths,
        false as is_pinned
      from public.user_notifications as notification
      where v_user_id is not null
        and notification.user_id = v_user_id
    ),
    paged as (
      select *
      from combined
      order by is_pinned desc, created_at desc, id
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
              'imagePaths', image_paths,
              'isPinned', is_pinned,
              'createdAt', created_at,
              'readAt', read_at
            )
            order by is_pinned desc, created_at desc, id
          )
          from paged
        ),
        '[]'::jsonb
      )
    )
  );
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
  if auth.uid() is null or not public.is_admin() then
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
            'imagePaths', image_paths,
            'isPinned', is_pinned,
            'publishedAt', published_at,
            'createdAt', created_at
          )
          order by is_pinned desc, published_at desc, id
        ),
        '[]'::jsonb
      )
    )
    from (
      select *
      from public.announcements
      order by is_pinned desc, published_at desc, id
      limit v_limit
    ) as recent
  );
end;
$$;

create or replace function public.admin_set_announcement_pinned(
  p_announcement_id uuid,
  p_pinned boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_previous boolean;
  v_title text;
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_announcement_id is null or p_pinned is null then
    raise exception 'Announcement id and pinned state are required'
      using errcode = '22023';
  end if;

  select announcement.is_pinned, announcement.title
  into v_previous, v_title
  from public.announcements as announcement
  where announcement.id = p_announcement_id
  for update;

  if not found then
    raise exception 'Announcement not found' using errcode = 'P0002';
  end if;

  if v_previous is distinct from p_pinned then
    update public.announcements
    set
      is_pinned = p_pinned,
      updated_at = clock_timestamp()
    where id = p_announcement_id;

    insert into public.admin_audit_log (
      admin_user_id,
      action,
      target_type,
      target_id,
      metadata
    )
    values (
      v_admin_id,
      case when p_pinned then 'announcement.pin' else 'announcement.unpin' end,
      'announcement',
      p_announcement_id::text,
      jsonb_build_object(
        'title', v_title,
        'previousPinned', v_previous,
        'isPinned', p_pinned
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', p_announcement_id,
    'isPinned', p_pinned,
    'changed', v_previous is distinct from p_pinned
  );
end;
$$;

revoke all on function public.load_my_notifications(integer)
  from public;
grant execute on function public.load_my_notifications(integer)
  to anon, authenticated;

revoke all on function public.admin_announcement_list(integer)
  from public, anon;
grant execute on function public.admin_announcement_list(integer)
  to authenticated;

revoke all on function public.admin_set_announcement_pinned(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_set_announcement_pinned(uuid, boolean)
  to authenticated;

commit;
