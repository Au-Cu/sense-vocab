begin;

-- save_user_state_legacy advances revision first, then the public wrapper
-- materializes transport_state in the same transaction. Firing on the first
-- update rebuilt every download chunk from the old transport, only to delete
-- and rebuild them again moments later. All supported revision writers assign
-- transport_state/transport_bytes when the new document is ready.
drop trigger if exists user_state_transport_chunks_sync
  on public.user_state_meta;
create trigger user_state_transport_chunks_sync
  before insert or update of transport_state, transport_bytes
  on public.user_state_meta
  for each row
  execute function public.sync_user_state_transport_chunks();

do $regression$
declare
  v_definition text;
begin
  select pg_get_triggerdef(oid)
  into v_definition
  from pg_trigger
  where tgrelid = 'public.user_state_meta'::regclass
    and tgname = 'user_state_transport_chunks_sync'
    and not tgisinternal;

  if v_definition is null
    or v_definition not ilike '%UPDATE OF transport_state, transport_bytes%'
    or v_definition ilike '%revision%'
    or v_definition ilike '%updated_at%' then
    raise exception 'Transport chunk trigger still rebuilds on metadata-only updates';
  end if;
end;
$regression$;

commit;
