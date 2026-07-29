begin;

create or replace function public.load_my_feedback_image_paths()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(image_path.path), '[]'::jsonb)
    from public.feedback_reports as feedback
    cross join lateral jsonb_array_elements_text(
      feedback.image_paths
    ) as image_path(path)
    where feedback.user_id = v_user_id
  );
end;
$$;

create or replace function public.delete_my_account()
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

  delete from auth.users where id = v_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.load_my_feedback_image_paths()
  from public, anon;
grant execute on function public.load_my_feedback_image_paths()
  to authenticated;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
