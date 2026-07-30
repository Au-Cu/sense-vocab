begin;

create or replace function public.admin_delete_announcement(
  p_announcement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_title text;
  v_image_paths text[] := '{}'::text[];
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_announcement_id is null then
    raise exception 'Announcement id is required' using errcode = '22023';
  end if;

  delete from public.announcements
  where id = p_announcement_id
  returning title, image_paths
  into v_title, v_image_paths;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'deleted', false,
      'id', p_announcement_id,
      'imagePaths', '[]'::jsonb
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
    'announcement.delete',
    'announcement',
    p_announcement_id::text,
    jsonb_build_object(
      'titleLength', char_length(v_title),
      'imageCount', cardinality(v_image_paths)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'deleted', true,
    'id', p_announcement_id,
    'imagePaths', to_jsonb(v_image_paths)
  );
end;
$$;

revoke all on function public.admin_delete_announcement(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_delete_announcement(uuid)
  to authenticated;

commit;
