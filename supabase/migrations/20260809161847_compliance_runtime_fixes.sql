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
    select issue.id, issue.issue_key, issue.matrix_type, issue.category,
      issue.created_at as issue_created_at, latest.*,
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
        'id', current.id,
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
        'updatedAt', current.created_at
      ) order by
        case current.severity
          when 'BLOCKER' then 1 when 'HIGH' then 2 when 'MEDIUM' then 3
          when 'LOW' then 4 else 5
        end,
        current.created_at desc,
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

create or replace function public.admin_compliance_issue_detail(p_issue_id uuid)
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
  if p_issue_id is null then
    raise exception 'Compliance issue id is required' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'id', issue.id,
    'issueKey', issue.issue_key,
    'matrixType', issue.matrix_type,
    'category', issue.category,
    'createdAt', issue.created_at,
    'snapshots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'revision', snapshot.revision,
        'severity', snapshot.severity,
        'status', snapshot.lifecycle_status,
        'title', snapshot.title,
        'description', snapshot.problem_description,
        'verifiedFacts', snapshot.verified_facts,
        'evidenceBasis', snapshot.evidence_basis,
        'lcAnalysis', snapshot.lc_analysis,
        'releaseImpact', snapshot.release_impact,
        'remediationPlan', snapshot.remediation_plan,
        'nextStep', snapshot.next_step_solution,
        'acceptanceEvidence', snapshot.acceptance_evidence,
        'unresolvedQuestions', snapshot.unresolved_questions,
        'externalConfirmationRequired', snapshot.external_confirmation_required,
        'externalConfirmation', snapshot.external_confirmation,
        'owner', snapshot.owner_name,
        'reviewer', snapshot.reviewer_name,
        'reviewDueAt', snapshot.review_due_at,
        'affectedAssets', snapshot.affected_assets,
        'evidenceRefs', snapshot.evidence_refs,
        'applicableScope', snapshot.applicable_scope,
        'rightsClearance', snapshot.rights_clearance,
        'contentHashBefore', snapshot.content_hash_before,
        'contentHashAfter', snapshot.content_hash_after,
        'changeSummary', snapshot.change_summary,
        'updatedBy', snapshot.created_by,
        'updatedAt', snapshot.created_at
      ) order by snapshot.revision desc)
      from public.compliance_issue_snapshots as snapshot
      where snapshot.issue_id = issue.id
    ), '[]'::jsonb)
  ) into v_result
  from public.compliance_issues as issue
  where issue.id = p_issue_id;

  if v_result is null then
    raise exception 'Compliance issue not found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (
    admin_user_id, action, target_type, target_id, metadata
  ) values (
    v_admin_id, 'compliance.issue.view', 'compliance_issue', p_issue_id::text,
    jsonb_build_object('issueKey', v_result ->> 'issueKey')
  );

  return v_result;
end;
$$;

create or replace function public.admin_publish_announcement(
  p_title text,
  p_body text,
  p_announcement_id uuid,
  p_image_paths text[],
  p_rights_metadata jsonb,
  p_content_provenance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_paths text[] := coalesce(p_image_paths, '{}'::text[]);
  v_rights jsonb := coalesce(p_rights_metadata, '[]'::jsonb);
  v_content jsonb := coalesce(p_content_provenance, '{}'::jsonb);
  v_created boolean := false;
begin
  if v_user_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_announcement_id is null or char_length(v_title) not between 1 and 120
    or char_length(v_body) not between 1 and 4000 then
    raise exception 'Invalid announcement content' using errcode = '22023';
  end if;
  if cardinality(v_paths) > 4 or jsonb_typeof(v_rights) <> 'array'
    or jsonb_array_length(v_rights) <> cardinality(v_paths)
    or pg_column_size(v_rights) > 32768 then
    raise exception 'Every announcement image requires bounded rights metadata'
      using errcode = '22023';
  end if;
  if cardinality(v_paths) <> (select count(distinct path) from unnest(v_paths) as path) then
    raise exception 'Announcement image paths must be unique' using errcode = '22023';
  end if;
  if jsonb_typeof(v_content) <> 'object' or pg_column_size(v_content) > 8192
    or v_content ->> 'textOrigin' not in ('original', 'ai-assisted', 'ai-generated')
    or coalesce((v_content ->> 'humanReviewed')::boolean, false) is not true then
    raise exception 'Announcement text provenance and human review are required'
      using errcode = '22023';
  end if;
  if v_content ->> 'textOrigin' in ('ai-assisted', 'ai-generated') and (
    nullif(btrim(v_content ->> 'provider'), '') is null
    or nullif(btrim(v_content ->> 'model'), '') is null
    or nullif(btrim(v_content ->> 'promptHash'), '') is null
  ) then
    raise exception 'AI text provenance is incomplete' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_rights) as entry(value)
    where value ->> 'path' is null
      or value ->> 'rightsBasis' not in (
        'original', 'licensed', 'open-license', 'public-domain', 'ai-generated'
      )
      or nullif(btrim(value ->> 'author'), '') is null
      or coalesce((value ->> 'humanReviewed')::boolean, false) is not true
      or (coalesce((value ->> 'containsIdentifiablePeople')::boolean, false)
        and nullif(btrim(value ->> 'personConsentBasis'), '') is null)
      or (value ->> 'rightsBasis' in ('licensed', 'open-license') and (
        nullif(btrim(value ->> 'license'), '') is null
        or nullif(btrim(value ->> 'sourceUrl'), '') is null))
      or (value ->> 'rightsBasis' = 'public-domain'
        and nullif(btrim(value ->> 'sourceUrl'), '') is null)
      or (value ->> 'rightsBasis' = 'ai-generated' and (
        nullif(btrim(value ->> 'provider'), '') is null
        or nullif(btrim(value ->> 'model'), '') is null
        or coalesce((value ->> 'disclosureLabel')::boolean, false) is not true))
  ) then
    raise exception 'Announcement image rights metadata is incomplete'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_paths) with ordinality as image(path, ord)
    where image.path <> v_rights -> ((image.ord - 1)::integer) ->> 'path'
      or split_part(image.path, '/', 1) <> p_announcement_id::text
      or not public.can_upload_announcement_image(image.path)
      or not exists (
        select 1 from storage.objects as object
        where object.bucket_id = 'announcement-images' and object.name = image.path
      )
  ) then
    raise exception 'Invalid, missing, or mismatched announcement image'
      using errcode = '22023';
  end if;

  insert into public.announcements (
    id, title, body, image_paths, rights_metadata, content_provenance,
    rights_status, created_by
  ) values (
    p_announcement_id, v_title, v_body, v_paths, v_rights, v_content,
    'verified', v_user_id
  ) on conflict (id) do nothing returning true into v_created;
  if not coalesce(v_created, false) then
    raise exception 'Announcement id is already in use' using errcode = '23505';
  end if;
  insert into public.admin_audit_log (
    admin_user_id, action, target_type, target_id, metadata
  ) values (
    v_user_id, 'announcement.publish', 'announcement', p_announcement_id::text,
    jsonb_build_object('titleLength', char_length(v_title),
      'imageCount', cardinality(v_paths), 'textOrigin', v_content ->> 'textOrigin')
  );
  return jsonb_build_object('ok', true, 'id', p_announcement_id,
    'imagePaths', v_paths, 'publishedAt', clock_timestamp());
end;
$$;

revoke all on function public.admin_compliance_dashboard()
  from public, anon, authenticated;
revoke all on function public.admin_compliance_issue_detail(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_publish_announcement(
  text, text, uuid, text[], jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.admin_compliance_dashboard() to authenticated;
grant execute on function public.admin_compliance_issue_detail(uuid) to authenticated;
grant execute on function public.admin_publish_announcement(
  text, text, uuid, text[], jsonb, jsonb
) to authenticated;

notify pgrst, 'reload schema';

commit;
