begin;

create or replace function public.confusion_links_are_valid(p_links jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_link jsonb;
  v_left text;
  v_right text;
begin
  if p_links is null or p_links = 'null'::jsonb then
    return true;
  end if;
  if jsonb_typeof(p_links) <> 'object' then
    return false;
  end if;
  if (
    select count(*)
    from jsonb_object_keys(p_links)
  ) > 20000 then
    return false;
  end if;

  for v_key, v_link in
    select entry.key, entry.value
    from jsonb_each(p_links) as entry
  loop
    if length(v_key) < 1
      or length(v_key) > 512
      or jsonb_typeof(v_link) <> 'object' then
      return false;
    end if;

    v_left := btrim(coalesce(v_link ->> 'left', ''));
    v_right := btrim(coalesce(v_link ->> 'right', ''));
    if length(v_left) < 1
      or length(v_left) > 160
      or length(v_right) < 1
      or length(v_right) > 160
      or v_left = v_right then
      return false;
    end if;
    if v_link ? 'createdAt'
      and jsonb_typeof(v_link -> 'createdAt') not in ('string', 'null') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function public.state_confusion_links_are_valid(p_state jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_books jsonb;
  v_book jsonb;
begin
  if p_state is null or p_state = 'null'::jsonb then
    return true;
  end if;
  if jsonb_typeof(p_state) <> 'object'
    or not public.confusion_links_are_valid(p_state -> 'confusionLinks') then
    return false;
  end if;

  v_books := p_state -> 'bookStates';
  if v_books is null or v_books = 'null'::jsonb then
    return true;
  end if;
  if jsonb_typeof(v_books) <> 'object' then
    return false;
  end if;

  for v_book in
    select entry.value
    from jsonb_each(v_books) as entry
  loop
    if jsonb_typeof(v_book) <> 'object'
      or not public.confusion_links_are_valid(v_book -> 'confusionLinks') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function public.enforce_state_confusion_links()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not public.state_confusion_links_are_valid(new.extra_state) then
    raise exception 'State contains invalid confusionLinks'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists user_state_meta_confusion_links_guard
  on public.user_state_meta;
create trigger user_state_meta_confusion_links_guard
  before insert or update of extra_state on public.user_state_meta
  for each row execute function public.enforce_state_confusion_links();

create or replace function public.state_has_undeclared_deletions(
  p_existing jsonb,
  p_incoming jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_existing_books jsonb := coalesce(p_existing -> 'bookStates', '{}'::jsonb);
  v_incoming_books jsonb := coalesce(p_incoming -> 'bookStates', '{}'::jsonb);
  v_existing_links jsonb := coalesce(p_existing -> 'confusionLinks', '{}'::jsonb);
  v_incoming_links jsonb := coalesce(p_incoming -> 'confusionLinks', '{}'::jsonb);
  v_existing_book jsonb;
  v_incoming_book jsonb;
  v_book_id text;
  v_domain text;
  v_key text;
  v_has_data boolean;
begin
  if not public.state_confusion_links_are_valid(p_incoming) then
    raise exception 'State contains invalid confusionLinks'
      using errcode = '22023';
  end if;

  -- Only legacy snapshots use the top-level scope as their authority. Current
  -- multi-book snapshots mirror whichever book is active at save time, so
  -- comparing those mirrors across a book switch would be a false deletion.
  if v_existing_books = '{}'::jsonb
    and jsonb_typeof(v_existing_links) = 'object'
    and jsonb_typeof(v_incoming_links) = 'object' then
    for v_key in
      select jsonb_object_keys(v_existing_links)
    loop
      if not v_incoming_links ? v_key
        and not public.sync_record_declares_delete(
          p_incoming,
          'confusionLinks',
          v_key
        ) then
        return true;
      end if;
    end loop;
  end if;

  if jsonb_typeof(v_existing_books) <> 'object'
    or jsonb_typeof(v_incoming_books) <> 'object' then
    return false;
  end if;

  for v_book_id in
    select jsonb_object_keys(v_existing_books)
  loop
    v_existing_book := v_existing_books -> v_book_id;
    v_incoming_book := v_incoming_books -> v_book_id;
    v_has_data :=
      jsonb_array_length(
        coalesce(v_existing_book -> 'introducedWords', '[]'::jsonb)
      ) > 0
      or (
        select count(*)
        from jsonb_object_keys(
          coalesce(v_existing_book -> 'progress', '{}'::jsonb)
        )
      ) > 0
      or (
        select count(*)
        from jsonb_object_keys(
          coalesce(v_existing_book -> 'activityLog', '{}'::jsonb)
        )
      ) > 0
      or (
        select count(*)
        from jsonb_object_keys(
          coalesce(v_existing_book -> 'confusionLinks', '{}'::jsonb)
        )
      ) > 0
      or jsonb_array_length(
        coalesce(v_existing_book -> 'studyWindows', '[]'::jsonb)
      ) > 0;

    if v_incoming_book is null then
      if v_has_data then
        return true;
      end if;
      continue;
    end if;

    for v_key in
      select value
      from jsonb_array_elements_text(
        coalesce(v_existing_book -> 'introducedWords', '[]'::jsonb)
      )
    loop
      if not coalesce(
        v_incoming_book -> 'introducedWords',
        '[]'::jsonb
      ) @> jsonb_build_array(v_key)
        and not public.sync_record_declares_delete(
          v_incoming_book,
          'introducedWords',
          v_key
        ) then
        return true;
      end if;
    end loop;

    foreach v_domain in array array['progress', 'activityLog', 'confusionLinks']
    loop
      for v_key in
        select jsonb_object_keys(
          coalesce(v_existing_book -> v_domain, '{}'::jsonb)
        )
      loop
        if not coalesce(
          v_incoming_book -> v_domain,
          '{}'::jsonb
        ) ? v_key
          and not public.sync_record_declares_delete(
            v_incoming_book,
            v_domain,
            v_key
          ) then
          return true;
        end if;
      end loop;
    end loop;

    for v_key in
      select coalesce(
        nullif(item.value ->> 'id', ''),
        item.ordinality::text
      )
      from jsonb_array_elements(
        coalesce(v_existing_book -> 'studyWindows', '[]'::jsonb)
      ) with ordinality as item(value, ordinality)
      where jsonb_typeof(item.value) = 'object'
    loop
      if not exists (
        select 1
        from jsonb_array_elements(
          coalesce(v_incoming_book -> 'studyWindows', '[]'::jsonb)
        ) with ordinality as item(value, ordinality)
        where jsonb_typeof(item.value) = 'object'
          and coalesce(
            nullif(item.value ->> 'id', ''),
            item.ordinality::text
          ) = v_key
      )
        and not public.sync_record_declares_delete(
          v_incoming_book,
          'studyWindows',
          v_key
        ) then
        return true;
      end if;
    end loop;
  end loop;

  return false;
end;
$$;

revoke all on function public.confusion_links_are_valid(jsonb)
  from public, anon, authenticated;
revoke all on function public.state_confusion_links_are_valid(jsonb)
  from public, anon, authenticated;
revoke all on function public.enforce_state_confusion_links()
  from public, anon, authenticated;
revoke all on function public.state_has_undeclared_deletions(jsonb, jsonb)
  from public, anon, authenticated;

commit;
