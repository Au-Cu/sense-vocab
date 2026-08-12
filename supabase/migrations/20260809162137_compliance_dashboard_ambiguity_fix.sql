begin;

create or replace function public.admin_compliance_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  with latest as (
    select distinct on (snapshot.issue_id) snapshot.*
    from public.compliance_issue_snapshots as snapshot
    order by snapshot.issue_id, snapshot.revision desc
  ), current_issues as (
    select
      issue.id as issue_id,
      issue.issue_key,
      issue.matrix_type,
      issue.category,
      latest.revision,
      latest.severity,
      latest.lifecycle_status,
      latest.title,
      latest.problem_description,
      latest.next_step_solution,
      latest.owner_name,
      latest.reviewer_name,
      latest.external_confirmation_required,
      latest.review_due_at,
      latest.affected_assets,
      latest.created_at as snapshot_created_at,
      (select count(*) from public.compliance_issue_snapshots as history
        where history.issue_id = issue.id) as history_count
    from public.compliance_issues as issue
    join latest on latest.issue_id = issue.id
  )
  select jsonb_build_object(
    'release', (
      select jsonb_build_object(
        'revision', release.revision,
        'conclusion', release.conclusion,
        'appVersion', release.app_version,
        'commitSha', release.commit_sha,
        'channels', release.channels,
        'businessModel', release.business_model,
        'jurisdictions', release.jurisdictions,
        'reviewDate', release.review_date,
        'evidenceGeneratedAt', release.evidence_generated_at,
        'scopeNotes', release.scope_notes,
        'basis', release.basis,
        'evidenceRefs', release.evidence_refs,
        'reviewer', release.reviewer_name,
        'changeSummary', release.change_summary,
        'updatedBy', release.created_by,
        'updatedAt', release.created_at
      )
      from public.compliance_release_snapshots as release
      order by release.revision desc
      limit 1
    ),
    'releaseHistoryCount', (
      select count(*) from public.compliance_release_snapshots
    ),
    'releaseHistory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'revision', release.revision,
        'conclusion', release.conclusion,
        'appVersion', release.app_version,
        'commitSha', release.commit_sha,
        'channels', release.channels,
        'businessModel', release.business_model,
        'jurisdictions', release.jurisdictions,
        'reviewDate', release.review_date,
        'evidenceGeneratedAt', release.evidence_generated_at,
        'scopeNotes', release.scope_notes,
        'basis', release.basis,
        'evidenceRefs', release.evidence_refs,
        'reviewer', release.reviewer_name,
        'changeSummary', release.change_summary,
        'updatedBy', release.created_by,
        'updatedAt', release.created_at
      ) order by release.revision desc)
      from public.compliance_release_snapshots as release
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'total', (select count(*) from current_issues),
      'BLOCKER', (select count(*) from current_issues where severity = 'BLOCKER'),
      'HIGH', (select count(*) from current_issues where severity = 'HIGH'),
      'MEDIUM', (select count(*) from current_issues where severity = 'MEDIUM'),
      'LOW', (select count(*) from current_issues where severity = 'LOW'),
      'CLEARED', (select count(*) from current_issues where severity = 'CLEARED'),
      'reviewDue', (select count(*) from current_issues
        where review_due_at is not null and review_due_at < current_date)
    ),
    'issues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', current.issue_id,
        'issueKey', current.issue_key,
        'matrixType', current.matrix_type,
        'category', current.category,
        'revision', current.revision,
        'severity', current.severity,
        'status', current.lifecycle_status,
        'title', current.title,
        'description', current.problem_description,
        'nextStep', current.next_step_solution,
        'owner', current.owner_name,
        'reviewer', current.reviewer_name,
        'externalConfirmationRequired', current.external_confirmation_required,
        'reviewDueAt', current.review_due_at,
        'isReviewDue', current.review_due_at is not null
          and current.review_due_at < current_date,
        'affectedAssets', current.affected_assets,
        'historyCount', current.history_count,
        'updatedAt', current.snapshot_created_at
      ) order by
        case current.severity
          when 'BLOCKER' then 1 when 'HIGH' then 2 when 'MEDIUM' then 3
          when 'LOW' then 4 else 5
        end,
        current.snapshot_created_at desc,
        current.issue_key)
      from current_issues as current
    ), '[]'::jsonb)
  ) into v_result;

  insert into public.admin_audit_log (
    admin_user_id, action, target_type, target_id, metadata
  ) values (
    v_admin_id, 'compliance.dashboard.view', 'compliance_dashboard', null,
    jsonb_build_object('issueCount', coalesce((v_result -> 'counts' ->> 'total')::integer, 0))
  );

  return v_result;
end;
$$;

revoke all on function public.admin_compliance_dashboard()
  from public, anon, authenticated;
grant execute on function public.admin_compliance_dashboard() to authenticated;

notify pgrst, 'reload schema';

commit;
