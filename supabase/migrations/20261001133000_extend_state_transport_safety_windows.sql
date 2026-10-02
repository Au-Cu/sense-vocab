begin;

-- Materialized transport and delta writes are the normal path.  These wider
-- bounded settings protect slow networks and compatibility fallbacks without
-- allowing a request to wait indefinitely.
alter function public.load_user_state()
  set statement_timeout = '60s';

alter function public.load_user_state_manifest()
  set statement_timeout = '60s';

alter function public.save_user_state(jsonb, bigint, boolean)
  set statement_timeout = '60s';

alter function public.save_user_state_delta(jsonb, bigint, boolean)
  set statement_timeout = '60s';

alter function public.save_user_state_legacy(jsonb, bigint, boolean)
  set statement_timeout = '60s';

commit;
