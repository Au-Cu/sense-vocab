begin;

alter table public.announcements
  add column if not exists image_paths text[] not null default '{}'::text[];

alter table public.announcements
  drop constraint if exists announcements_image_count;
alter table public.announcements
  add constraint announcements_image_count
  check (cardinality(image_paths) between 0 and 4);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'announcement-images',
  'announcement-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_upload_announcement_image(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and public.is_admin()
    and array_length(string_to_array(p_name, '/'), 1) = 2
    and split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and split_part(p_name, '/', 2) ~ '^[1-4]\.(jpg|jpeg|png|webp)$';
$$;

revoke all on function public.can_upload_announcement_image(text)
  from public, anon;
grant execute on function public.can_upload_announcement_image(text)
  to authenticated;

drop policy if exists "announcement_images_insert_admin" on storage.objects;
create policy "announcement_images_insert_admin" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'announcement-images'
    and public.can_upload_announcement_image(name)
  );

drop policy if exists "announcement_images_select_admin" on storage.objects;
create policy "announcement_images_select_admin" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'announcement-images'
    and public.is_admin()
  );

drop policy if exists "announcement_images_delete_admin" on storage.objects;
create policy "announcement_images_delete_admin" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'announcement-images'
    and public.is_admin()
  );

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
        announcement.image_paths
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
        '{}'::text[] as image_paths
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
              'imagePaths', image_paths,
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

drop function if exists public.admin_publish_announcement(text, text);

create or replace function public.admin_publish_announcement(
  p_title text,
  p_body text,
  p_announcement_id uuid default gen_random_uuid(),
  p_image_paths text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_image_paths text[] := coalesce(p_image_paths, '{}'::text[]);
  v_created boolean := false;
begin
  if v_user_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_announcement_id is null then
    raise exception 'Announcement id is required' using errcode = '22023';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Announcement title must contain 1 to 120 characters'
      using errcode = '22023';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Announcement body must contain 1 to 4000 characters'
      using errcode = '22023';
  end if;
  if cardinality(v_image_paths) > 4 then
    raise exception 'An announcement can contain at most four images'
      using errcode = '22023';
  end if;
  if cardinality(v_image_paths) <> (
    select count(distinct image_path)
    from unnest(v_image_paths) as image_path
  ) then
    raise exception 'Announcement image paths must be unique'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(v_image_paths) as image_path
    where split_part(image_path, '/', 1) <> p_announcement_id::text
      or not public.can_upload_announcement_image(image_path)
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = 'announcement-images'
          and object.name = image_path
      )
  ) then
    raise exception 'Invalid or missing announcement image'
      using errcode = '22023';
  end if;

  insert into public.announcements (
    id,
    title,
    body,
    image_paths,
    created_by
  )
  values (
    p_announcement_id,
    v_title,
    v_body,
    v_image_paths,
    v_user_id
  )
  on conflict (id) do nothing
  returning true into v_created;

  if not coalesce(v_created, false) then
    perform 1
    from public.announcements
    where id = p_announcement_id
      and title = v_title
      and body = v_body
      and image_paths = v_image_paths
      and created_by = v_user_id;
    if not found then
      raise exception 'Announcement id is already in use'
        using errcode = '23505';
    end if;
  else
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
      p_announcement_id::text,
      jsonb_build_object(
        'titleLength', char_length(v_title),
        'imageCount', cardinality(v_image_paths)
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', p_announcement_id,
    'imagePaths', v_image_paths,
    'publishedAt', (
      select published_at
      from public.announcements
      where id = p_announcement_id
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
            'imagePaths', image_paths,
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

revoke all on function public.load_my_notifications(integer)
  from public;
grant execute on function public.load_my_notifications(integer)
  to anon, authenticated;

revoke all on function public.admin_publish_announcement(text, text, uuid, text[])
  from public, anon;
grant execute on function public.admin_publish_announcement(text, text, uuid, text[])
  to authenticated;

revoke all on function public.admin_announcement_list(integer)
  from public, anon;
grant execute on function public.admin_announcement_list(integer)
  to authenticated;

commit;
