begin;

-- Normal reads use the materialized transport and finish quickly.  This is a
-- bounded compatibility window for a partially materialized account or a
-- very slow response path; it is not a substitute for the materialized read.
alter function public.load_user_state()
  set statement_timeout = '300s';

alter function public.load_user_state_manifest()
  set statement_timeout = '300s';

commit;
