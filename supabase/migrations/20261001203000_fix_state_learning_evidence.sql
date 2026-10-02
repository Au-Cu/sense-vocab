begin;

create or replace function public.state_has_learning_evidence(p_state jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_scope jsonb;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    return false;
  end if;
  for v_scope in
    select p_state
    union all
    select item.value
    from jsonb_each(coalesce(p_state -> 'bookStates', '{}'::jsonb)) as item(key, value)
  loop
    if jsonb_typeof(v_scope -> 'introducedWords') = 'array'
      and jsonb_array_length(v_scope -> 'introducedWords') > 0 then
      return true;
    end if;
    if jsonb_typeof(v_scope -> 'progress') = 'object'
      and exists (
        select 1 from jsonb_object_keys(v_scope -> 'progress') limit 1
      ) then
      return true;
    end if;
    if jsonb_typeof(v_scope -> 'activityLog') = 'object'
      and exists (
        select 1 from jsonb_object_keys(v_scope -> 'activityLog') limit 1
      ) then
      return true;
    end if;
    if jsonb_typeof(v_scope -> 'studyWindows') = 'array'
      and jsonb_array_length(v_scope -> 'studyWindows') > 0 then
      return true;
    end if;
    if jsonb_typeof(v_scope -> 'session') = 'object'
      and (
        (
          jsonb_typeof(v_scope -> 'session' -> 'currentIndex') = 'number'
          and (v_scope -> 'session' ->> 'currentIndex')::integer > 0
        )
        or (v_scope -> 'session' ->> 'revealed') = 'true'
        or exists (
          select 1
          from jsonb_array_elements(
            case
              when jsonb_typeof(v_scope -> 'session' -> 'queue') = 'array'
                then v_scope -> 'session' -> 'queue'
              else '[]'::jsonb
            end
          ) as queue_item(value)
          where jsonb_typeof(queue_item.value -> 'confirmedKeys') = 'array'
            and jsonb_array_length(queue_item.value -> 'confirmedKeys') > 0
        )
      ) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

revoke all on function public.state_has_learning_evidence(jsonb)
  from public, anon, authenticated;

commit;
