begin;

create table if not exists public.compliance_issues (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null unique check (
    issue_key ~ '^LC-[A-Z0-9-]{4,60}$'
  ),
  matrix_type text not null check (
    matrix_type in ('legal_risk', 'rights_chain')
  ),
  category text not null check (char_length(category) between 1 and 120),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.compliance_issue_snapshots (
  id bigint generated always as identity primary key,
  issue_id uuid not null references public.compliance_issues(id) on delete restrict,
  revision bigint not null check (revision > 0),
  severity text not null check (
    severity in ('BLOCKER', 'HIGH', 'MEDIUM', 'LOW', 'CLEARED')
  ),
  lifecycle_status text not null check (
    lifecycle_status in (
      'open',
      'remediation_in_progress',
      'evidence_pending',
      'external_confirmation_pending',
      'ready_for_review',
      'closed'
    )
  ),
  title text not null check (char_length(title) between 1 and 200),
  problem_description text not null check (
    char_length(problem_description) between 1 and 12000
  ),
  verified_facts text not null default '' check (
    char_length(verified_facts) <= 16000
  ),
  evidence_basis text not null default '' check (
    char_length(evidence_basis) <= 16000
  ),
  lc_analysis text not null default '' check (
    char_length(lc_analysis) <= 16000
  ),
  release_impact text not null default '' check (
    char_length(release_impact) <= 12000
  ),
  remediation_plan text not null default '' check (
    char_length(remediation_plan) <= 16000
  ),
  next_step_solution text not null check (
    char_length(next_step_solution) between 1 and 12000
  ),
  acceptance_evidence text not null default '' check (
    char_length(acceptance_evidence) <= 16000
  ),
  unresolved_questions text not null default '' check (
    char_length(unresolved_questions) <= 12000
  ),
  external_confirmation_required boolean not null default false,
  external_confirmation text not null default '' check (
    char_length(external_confirmation) <= 12000
  ),
  owner_name text not null default '' check (char_length(owner_name) <= 200),
  reviewer_name text not null default '' check (
    char_length(reviewer_name) <= 200
  ),
  review_due_at date,
  affected_assets jsonb not null default '[]'::jsonb check (
    jsonb_typeof(affected_assets) = 'array'
    and pg_column_size(affected_assets) <= 65536
  ),
  evidence_refs jsonb not null default '[]'::jsonb check (
    jsonb_typeof(evidence_refs) = 'array'
    and pg_column_size(evidence_refs) <= 65536
  ),
  applicable_scope jsonb not null default '{}'::jsonb check (
    jsonb_typeof(applicable_scope) = 'object'
    and pg_column_size(applicable_scope) <= 32768
  ),
  rights_clearance jsonb not null default '{}'::jsonb check (
    jsonb_typeof(rights_clearance) = 'object'
    and pg_column_size(rights_clearance) <= 32768
  ),
  content_hash_before text check (
    content_hash_before is null or content_hash_before ~ '^[0-9a-f]{64}$'
  ),
  content_hash_after text check (
    content_hash_after is null or content_hash_after ~ '^[0-9a-f]{64}$'
  ),
  change_summary text not null check (
    char_length(change_summary) between 1 and 2000
  ),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique (issue_id, revision),
  check (severity <> 'CLEARED' or lifecycle_status = 'closed')
);

create index if not exists compliance_issue_snapshots_current_idx
  on public.compliance_issue_snapshots (issue_id, revision desc);
create index if not exists compliance_issue_snapshots_severity_idx
  on public.compliance_issue_snapshots (severity, created_at desc);
create index if not exists compliance_issue_snapshots_status_idx
  on public.compliance_issue_snapshots (lifecycle_status, created_at desc);

create table if not exists public.compliance_release_snapshots (
  id bigint generated always as identity primary key,
  revision bigint not null unique check (revision > 0),
  conclusion text not null check (
    conclusion in ('releasable', 'conditionally_releasable', 'not_releasable')
  ),
  app_version text,
  commit_sha text check (commit_sha is null or commit_sha ~ '^[0-9a-f]{40}$'),
  channels jsonb not null default '[]'::jsonb check (
    jsonb_typeof(channels) = 'array' and pg_column_size(channels) <= 8192
  ),
  business_model text not null default '' check (
    char_length(business_model) <= 1000
  ),
  jurisdictions jsonb not null default '[]'::jsonb check (
    jsonb_typeof(jurisdictions) = 'array'
    and pg_column_size(jurisdictions) <= 8192
  ),
  review_date date,
  evidence_generated_at timestamptz,
  scope_notes text not null default '' check (char_length(scope_notes) <= 8000),
  basis text not null check (char_length(basis) between 1 and 16000),
  evidence_refs jsonb not null default '[]'::jsonb check (
    jsonb_typeof(evidence_refs) = 'array'
    and pg_column_size(evidence_refs) <= 65536
  ),
  reviewer_name text not null check (
    char_length(reviewer_name) between 1 and 200
  ),
  change_summary text not null check (
    char_length(change_summary) between 1 and 2000
  ),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.compliance_issues enable row level security;
alter table public.compliance_issue_snapshots enable row level security;
alter table public.compliance_release_snapshots enable row level security;

revoke all on table public.compliance_issues from public, anon, authenticated;
revoke all on table public.compliance_issue_snapshots from public, anon, authenticated;
revoke all on table public.compliance_release_snapshots from public, anon, authenticated;

create or replace function private.validate_compliance_issue_snapshot(
  p_matrix_type text,
  p_snapshot jsonb,
  p_previous_severity text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_severity text := upper(btrim(coalesce(p_snapshot ->> 'severity', '')));
  v_status text := btrim(coalesce(p_snapshot ->> 'status', ''));
  v_title text := btrim(coalesce(p_snapshot ->> 'title', ''));
  v_description text := btrim(coalesce(p_snapshot ->> 'description', ''));
  v_next_step text := btrim(coalesce(p_snapshot ->> 'nextStep', ''));
  v_change_summary text := btrim(coalesce(p_snapshot ->> 'changeSummary', ''));
  v_reviewer text := btrim(coalesce(p_snapshot ->> 'reviewer', ''));
  v_evidence_basis text := btrim(coalesce(p_snapshot ->> 'evidenceBasis', ''));
  v_acceptance_evidence text := btrim(coalesce(p_snapshot ->> 'acceptanceEvidence', ''));
  v_evidence_refs jsonb := coalesce(p_snapshot -> 'evidenceRefs', '[]'::jsonb);
  v_assets jsonb := coalesce(p_snapshot -> 'affectedAssets', '[]'::jsonb);
  v_scope jsonb := coalesce(p_snapshot -> 'applicableScope', '{}'::jsonb);
  v_rights jsonb := coalesce(p_snapshot -> 'rightsClearance', '{}'::jsonb);
  v_before text := nullif(lower(btrim(coalesce(p_snapshot ->> 'contentHashBefore', ''))), '');
  v_after text := nullif(lower(btrim(coalesce(p_snapshot ->> 'contentHashAfter', ''))), '');
begin
  if jsonb_typeof(p_snapshot) <> 'object' or pg_column_size(p_snapshot) > 131072 then
    raise exception 'Invalid compliance snapshot payload' using errcode = '22023';
  end if;
  if p_matrix_type not in ('legal_risk', 'rights_chain') then
    raise exception 'Invalid compliance matrix type' using errcode = '22023';
  end if;
  if v_severity not in ('BLOCKER', 'HIGH', 'MEDIUM', 'LOW', 'CLEARED') then
    raise exception 'Invalid compliance severity' using errcode = '22023';
  end if;
  if v_status not in (
    'open', 'remediation_in_progress', 'evidence_pending',
    'external_confirmation_pending', 'ready_for_review', 'closed'
  ) then
    raise exception 'Invalid compliance lifecycle status' using errcode = '22023';
  end if;
  if char_length(v_title) not between 1 and 200
    or char_length(v_description) not between 1 and 12000
    or char_length(v_next_step) not between 1 and 12000
    or char_length(v_change_summary) not between 1 and 2000 then
    raise exception 'Compliance title, description, next step, and change summary are required'
      using errcode = '22023';
  end if;
  if jsonb_typeof(v_evidence_refs) <> 'array'
    or jsonb_typeof(v_assets) <> 'array'
    or jsonb_typeof(v_scope) <> 'object'
    or jsonb_typeof(v_rights) <> 'object'
    or pg_column_size(v_evidence_refs) > 65536
    or pg_column_size(v_assets) > 65536
    or pg_column_size(v_scope) > 32768
    or pg_column_size(v_rights) > 32768 then
    raise exception 'Invalid compliance evidence, asset, scope, or rights metadata'
      using errcode = '22023';
  end if;
  if v_before is not null and v_before !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid before hash' using errcode = '22023';
  end if;
  if v_after is not null and v_after !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid after hash' using errcode = '22023';
  end if;
  if v_severity = 'CLEARED' and v_status <> 'closed' then
    raise exception 'CLEARED issues must be closed' using errcode = '22023';
  end if;

  if p_previous_severity is distinct from v_severity then
    if v_reviewer = '' or v_evidence_basis = ''
      or jsonb_array_length(v_evidence_refs) = 0
      or v_scope = '{}'::jsonb then
      raise exception 'Severity changes require reviewer, basis, evidence, and scope'
        using errcode = '22023';
    end if;
  end if;

  if v_severity = 'CLEARED' then
    if v_reviewer = '' or v_evidence_basis = '' or v_acceptance_evidence = ''
      or jsonb_array_length(v_evidence_refs) = 0 or v_scope = '{}'::jsonb then
      raise exception 'CLEARED requires reviewer, basis, acceptance evidence, evidence links, and scope'
        using errcode = '22023';
    end if;
    if p_matrix_type = 'rights_chain' and (
      nullif(btrim(v_rights ->> 'authorOrRightsholder'), '') is null
      or nullif(btrim(v_rights ->> 'licenseOrPermission'), '') is null
      or nullif(btrim(v_rights ->> 'sourceUrl'), '') is null
      or nullif(btrim(v_rights ->> 'versionOrDate'), '') is null
      or nullif(btrim(v_rights ->> 'commercialScope'), '') is null
      or coalesce(v_rights ->> 'sha256', '') !~ '^[0-9a-f]{64}$'
    ) then
      raise exception 'Rights-chain clearance requires author, licence, source, version/date, commercial scope, and SHA-256'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

revoke all on function private.validate_compliance_issue_snapshot(text, jsonb, text)
  from public, anon, authenticated;

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
        'updatedBy', release.updated_by,
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
        'updatedBy', release.updated_by,
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
        'updatedBy', snapshot.updated_by,
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

create or replace function public.admin_create_compliance_issue(
  p_matrix_type text,
  p_category text,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := (select auth.uid());
  v_issue_id uuid := gen_random_uuid();
  v_issue_key text;
  v_matrix_type text := btrim(coalesce(p_matrix_type, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_severity text := upper(btrim(coalesce(p_snapshot ->> 'severity', '')));
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if v_matrix_type not in ('legal_risk', 'rights_chain')
    or char_length(v_category) not between 1 and 120 then
    raise exception 'Invalid compliance issue category' using errcode = '22023';
  end if;

  perform private.validate_compliance_issue_snapshot(v_matrix_type, p_snapshot, null);
  v_issue_key := 'LC-' || upper(left(replace(v_issue_id::text, '-', ''), 8));

  insert into public.compliance_issues (
    id, issue_key, matrix_type, category, created_by
  ) values (
    v_issue_id, v_issue_key, v_matrix_type, v_category, v_admin_id
  );

  insert into public.compliance_issue_snapshots (
    issue_id, revision, severity, lifecycle_status, title,
    problem_description, verified_facts, evidence_basis, lc_analysis,
    release_impact, remediation_plan, next_step_solution,
    acceptance_evidence, unresolved_questions,
    external_confirmation_required, external_confirmation,
    owner_name, reviewer_name, review_due_at, affected_assets,
    evidence_refs, applicable_scope, rights_clearance,
    content_hash_before, content_hash_after, change_summary, created_by
  ) values (
    v_issue_id,
    1,
    v_severity,
    btrim(p_snapshot ->> 'status'),
    btrim(p_snapshot ->> 'title'),
    btrim(p_snapshot ->> 'description'),
    btrim(coalesce(p_snapshot ->> 'verifiedFacts', '')),
    btrim(coalesce(p_snapshot ->> 'evidenceBasis', '')),
    btrim(coalesce(p_snapshot ->> 'lcAnalysis', '')),
    btrim(coalesce(p_snapshot ->> 'releaseImpact', '')),
    btrim(coalesce(p_snapshot ->> 'remediationPlan', '')),
    btrim(p_snapshot ->> 'nextStep'),
    btrim(coalesce(p_snapshot ->> 'acceptanceEvidence', '')),
    btrim(coalesce(p_snapshot ->> 'unresolvedQuestions', '')),
    coalesce((p_snapshot ->> 'externalConfirmationRequired')::boolean, false),
    btrim(coalesce(p_snapshot ->> 'externalConfirmation', '')),
    btrim(coalesce(p_snapshot ->> 'owner', '')),
    btrim(coalesce(p_snapshot ->> 'reviewer', '')),
    nullif(p_snapshot ->> 'reviewDueAt', '')::date,
    coalesce(p_snapshot -> 'affectedAssets', '[]'::jsonb),
    coalesce(p_snapshot -> 'evidenceRefs', '[]'::jsonb),
    coalesce(p_snapshot -> 'applicableScope', '{}'::jsonb),
    coalesce(p_snapshot -> 'rightsClearance', '{}'::jsonb),
    nullif(lower(btrim(coalesce(p_snapshot ->> 'contentHashBefore', ''))), ''),
    nullif(lower(btrim(coalesce(p_snapshot ->> 'contentHashAfter', ''))), ''),
    btrim(p_snapshot ->> 'changeSummary'),
    v_admin_id
  );

  insert into public.admin_audit_log (
    admin_user_id, action, target_type, target_id, metadata
  ) values (
    v_admin_id, 'compliance.issue.create', 'compliance_issue', v_issue_id::text,
    jsonb_build_object(
      'issueKey', v_issue_key,
      'matrixType', v_matrix_type,
      'category', v_category,
      'severity', v_severity,
      'status', p_snapshot ->> 'status',
      'revision', 1
    )
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_issue_id,
    'issueKey', v_issue_key,
    'revision', 1,
    'updatedAt', clock_timestamp()
  );
end;
$$;

create or replace function public.admin_append_compliance_issue_snapshot(
  p_issue_id uuid,
  p_expected_revision bigint,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := (select auth.uid());
  v_matrix_type text;
  v_issue_key text;
  v_current_revision bigint;
  v_previous_severity text;
  v_previous_status text;
  v_next_revision bigint;
  v_severity text := upper(btrim(coalesce(p_snapshot ->> 'severity', '')));
  v_updated_at timestamptz := clock_timestamp();
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_issue_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Issue id and expected revision are required' using errcode = '22023';
  end if;

  select issue.matrix_type, issue.issue_key
  into v_matrix_type, v_issue_key
  from public.compliance_issues as issue
  where issue.id = p_issue_id
  for update;
  if not found then
    raise exception 'Compliance issue not found' using errcode = 'P0002';
  end if;

  select snapshot.revision, snapshot.severity, snapshot.lifecycle_status
  into v_current_revision, v_previous_severity, v_previous_status
  from public.compliance_issue_snapshots as snapshot
  where snapshot.issue_id = p_issue_id
  order by snapshot.revision desc
  limit 1;

  if v_current_revision is null or p_expected_revision <> v_current_revision then
    raise exception 'Compliance issue revision conflict'
      using errcode = '40001',
        detail = jsonb_build_object(
          'expectedRevision', p_expected_revision,
          'currentRevision', v_current_revision
        )::text;
  end if;

  perform private.validate_compliance_issue_snapshot(
    v_matrix_type, p_snapshot, v_previous_severity
  );
  v_next_revision := v_current_revision + 1;

  insert into public.compliance_issue_snapshots (
    issue_id, revision, severity, lifecycle_status, title,
    problem_description, verified_facts, evidence_basis, lc_analysis,
    release_impact, remediation_plan, next_step_solution,
    acceptance_evidence, unresolved_questions,
    external_confirmation_required, external_confirmation,
    owner_name, reviewer_name, review_due_at, affected_assets,
    evidence_refs, applicable_scope, rights_clearance,
    content_hash_before, content_hash_after, change_summary,
    created_by, created_at
  ) values (
    p_issue_id,
    v_next_revision,
    v_severity,
    btrim(p_snapshot ->> 'status'),
    btrim(p_snapshot ->> 'title'),
    btrim(p_snapshot ->> 'description'),
    btrim(coalesce(p_snapshot ->> 'verifiedFacts', '')),
    btrim(coalesce(p_snapshot ->> 'evidenceBasis', '')),
    btrim(coalesce(p_snapshot ->> 'lcAnalysis', '')),
    btrim(coalesce(p_snapshot ->> 'releaseImpact', '')),
    btrim(coalesce(p_snapshot ->> 'remediationPlan', '')),
    btrim(p_snapshot ->> 'nextStep'),
    btrim(coalesce(p_snapshot ->> 'acceptanceEvidence', '')),
    btrim(coalesce(p_snapshot ->> 'unresolvedQuestions', '')),
    coalesce((p_snapshot ->> 'externalConfirmationRequired')::boolean, false),
    btrim(coalesce(p_snapshot ->> 'externalConfirmation', '')),
    btrim(coalesce(p_snapshot ->> 'owner', '')),
    btrim(coalesce(p_snapshot ->> 'reviewer', '')),
    nullif(p_snapshot ->> 'reviewDueAt', '')::date,
    coalesce(p_snapshot -> 'affectedAssets', '[]'::jsonb),
    coalesce(p_snapshot -> 'evidenceRefs', '[]'::jsonb),
    coalesce(p_snapshot -> 'applicableScope', '{}'::jsonb),
    coalesce(p_snapshot -> 'rightsClearance', '{}'::jsonb),
    nullif(lower(btrim(coalesce(p_snapshot ->> 'contentHashBefore', ''))), ''),
    nullif(lower(btrim(coalesce(p_snapshot ->> 'contentHashAfter', ''))), ''),
    btrim(p_snapshot ->> 'changeSummary'),
    v_admin_id,
    v_updated_at
  );

  insert into public.admin_audit_log (
    admin_user_id, action, target_type, target_id, metadata
  ) values (
    v_admin_id, 'compliance.issue.snapshot.append', 'compliance_issue',
    p_issue_id::text,
    jsonb_build_object(
      'issueKey', v_issue_key,
      'fromRevision', v_current_revision,
      'toRevision', v_next_revision,
      'fromSeverity', v_previous_severity,
      'toSeverity', v_severity,
      'fromStatus', v_previous_status,
      'toStatus', p_snapshot ->> 'status',
      'changeSummary', left(btrim(p_snapshot ->> 'changeSummary'), 500)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'id', p_issue_id,
    'issueKey', v_issue_key,
    'revision', v_next_revision,
    'updatedAt', v_updated_at
  );
end;
$$;

create or replace function public.admin_append_compliance_release_snapshot(
  p_expected_revision bigint,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := (select auth.uid());
  v_current_revision bigint;
  v_previous_conclusion text;
  v_next_revision bigint;
  v_conclusion text := btrim(coalesce(p_snapshot ->> 'conclusion', ''));
  v_commit text := nullif(lower(btrim(coalesce(p_snapshot ->> 'commitSha', ''))), '');
  v_channels jsonb := coalesce(p_snapshot -> 'channels', '[]'::jsonb);
  v_jurisdictions jsonb := coalesce(p_snapshot -> 'jurisdictions', '[]'::jsonb);
  v_scope jsonb := coalesce(p_snapshot -> 'applicableScope', '{}'::jsonb);
  v_evidence_refs jsonb := coalesce(p_snapshot -> 'evidenceRefs', '[]'::jsonb);
  v_basis text := btrim(coalesce(p_snapshot ->> 'basis', ''));
  v_reviewer text := btrim(coalesce(p_snapshot ->> 'reviewer', ''));
  v_change_summary text := btrim(coalesce(p_snapshot ->> 'changeSummary', ''));
  v_updated_at timestamptz := clock_timestamp();
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
    or jsonb_typeof(p_snapshot) <> 'object' or pg_column_size(p_snapshot) > 131072 then
    raise exception 'Invalid release snapshot payload' using errcode = '22023';
  end if;
  if v_conclusion not in ('releasable', 'conditionally_releasable', 'not_releasable')
    or char_length(v_basis) not between 1 and 16000
    or char_length(v_reviewer) not between 1 and 200
    or char_length(v_change_summary) not between 1 and 2000
    or jsonb_typeof(v_channels) <> 'array'
    or jsonb_typeof(v_jurisdictions) <> 'array'
    or jsonb_typeof(v_scope) <> 'object'
    or jsonb_typeof(v_evidence_refs) <> 'array'
    or jsonb_array_length(v_evidence_refs) = 0
    or v_scope = '{}'::jsonb then
    raise exception 'Release conclusion requires valid scope, basis, evidence, reviewer, and change summary'
      using errcode = '22023';
  end if;
  if v_commit is not null and v_commit !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid release commit SHA' using errcode = '22023';
  end if;
  if v_conclusion <> 'not_releasable' and (
    nullif(btrim(p_snapshot ->> 'appVersion'), '') is null
    or v_commit is null
    or jsonb_array_length(v_channels) = 0
    or nullif(btrim(p_snapshot ->> 'businessModel'), '') is null
    or jsonb_array_length(v_jurisdictions) = 0
    or nullif(p_snapshot ->> 'reviewDate', '') is null
    or nullif(p_snapshot ->> 'evidenceGeneratedAt', '') is null
  ) then
    raise exception 'A releasable conclusion requires complete version, commit, channel, business, jurisdiction, and date scope'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('sense-vocab-compliance-release'));
  select release.revision, release.conclusion
  into v_current_revision, v_previous_conclusion
  from public.compliance_release_snapshots as release
  order by release.revision desc
  limit 1;
  v_current_revision := coalesce(v_current_revision, 0);
  if p_expected_revision <> v_current_revision then
    raise exception 'Compliance release revision conflict'
      using errcode = '40001',
        detail = jsonb_build_object(
          'expectedRevision', p_expected_revision,
          'currentRevision', v_current_revision
        )::text;
  end if;
  v_next_revision := v_current_revision + 1;

  insert into public.compliance_release_snapshots (
    revision, conclusion, app_version, commit_sha, channels, business_model,
    jurisdictions, review_date, evidence_generated_at, scope_notes, basis,
    evidence_refs, reviewer_name, change_summary, created_by, created_at
  ) values (
    v_next_revision,
    v_conclusion,
    nullif(btrim(coalesce(p_snapshot ->> 'appVersion', '')), ''),
    v_commit,
    v_channels,
    btrim(coalesce(p_snapshot ->> 'businessModel', '')),
    v_jurisdictions,
    nullif(p_snapshot ->> 'reviewDate', '')::date,
    nullif(p_snapshot ->> 'evidenceGeneratedAt', '')::timestamptz,
    btrim(coalesce(p_snapshot ->> 'scopeNotes', '')),
    v_basis,
    v_evidence_refs,
    v_reviewer,
    v_change_summary,
    v_admin_id,
    v_updated_at
  );

  insert into public.admin_audit_log (
    admin_user_id, action, target_type, target_id, metadata
  ) values (
    v_admin_id, 'compliance.release.snapshot.append', 'compliance_release',
    v_next_revision::text,
    jsonb_build_object(
      'fromRevision', v_current_revision,
      'toRevision', v_next_revision,
      'fromConclusion', v_previous_conclusion,
      'toConclusion', v_conclusion,
      'changeSummary', left(v_change_summary, 500)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'revision', v_next_revision,
    'conclusion', v_conclusion,
    'updatedAt', v_updated_at
  );
end;
$$;

insert into public.compliance_release_snapshots (
  revision, conclusion, app_version, commit_sha, channels, business_model,
  jurisdictions, review_date, evidence_generated_at, scope_notes, basis,
  evidence_refs, reviewer_name, change_summary, created_by,
  created_at
) values (
  1,
  'not_releasable',
  '1.4.0',
  null,
  '["Web"]'::jsonb,
  '收费、自动续费或大规模商业推广',
  '[]'::jsonb,
  date '2026-08-09',
  timestamptz '2026-08-09T10:19:36.112Z',
  'LC 合规材料仍处于未提交工作树，适用 commit 与具体司法辖区尚未确认。',
  '内容权利、运营主体、监管路径、供应商合同和生产部署证据尚未全部闭合。',
  jsonb_build_array(
    jsonb_build_object(
      'label', '商业发布门禁与人工办理清单',
      'repoPath', 'COMMERCIAL_RELEASE_CHECKLIST.md',
      'accessDate', '2026-08-09'
    ),
    jsonb_build_object(
      'label', '当前状态',
      'repoPath', 'docs/CURRENT.md',
      'accessDate', '2026-08-09'
    )
  ),
  'LC（初始化）',
  '导入 2026-08-09 LC 最新商业发行结论。',
  null,
  timestamptz '2026-08-09T18:00:00+08:00'
) on conflict (revision) do nothing;

do $$
declare
  v_entry jsonb;
  v_issue_id uuid;
  v_default_scope jsonb := jsonb_build_object(
    'appVersion', '1.4.0',
    'commitSha', null,
    'channels', jsonb_build_array('Web'),
    'businessModel', '收费、自动续费或大规模商业推广',
    'jurisdictions', jsonb_build_array(),
    'reviewDate', '2026-08-09'
  );
begin
  for v_entry in
    select value
    from jsonb_array_elements($seed$
    [
      {
        "id": "f0000000-0000-4000-8000-000000000001",
        "issueKey": "LC-RISK-001",
        "matrixType": "legal_risk",
        "category": "内容与版权",
        "severity": "BLOCKER",
        "status": "open",
        "title": "逐义项内容权利链尚未闭合",
        "description": "当前商业发行范围内，10,224 个义项仍因字段级作者、许可证、来源或证据不完整而保持 BLOCKER。",
        "verifiedFacts": "权利台账包含 10,224 个义项，当前 CLEARED 为 0，BLOCKER 为 10,224。",
        "evidenceBasis": "data/content-rights-ledger.jsonl 与 data/content-rights-ledger-summary.json 的 2026-08-09 生成结果。",
        "lcAnalysis": "机器台账只能证明当前证据完整度；缺证据时按默认拒绝处理，不能推定已经获得商业授权。",
        "releaseImpact": "收费、自动续费或大规模商业推广范围不可发行。",
        "remediationPlan": "逐字段取得授权、补齐署名和许可证，或在保持 wordId/senseId 兼容的前提下原创重写或合法替换。",
        "nextStep": "按 quotation、semantic、翻译和来源不明字段分批整改，并在每批完成后重建台账、保存前后哈希。",
        "acceptanceEvidence": "",
        "unresolvedQuestions": "各字段最终采用授权、原创重写还是合法替代，仍需逐批确认。",
        "externalConfirmationRequired": true,
        "externalConfirmation": "涉及第三方原文时，必要情况下取得权利人或适格专业意见的书面确认。",
        "owner": "待指定",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["data/content-rights-ledger.jsonl", "data/vocabulary-bundle.json", "10,224 个义项"],
        "evidenceRefs": [{"repoPath":"data/content-rights-ledger-summary.json","accessDate":"2026-08-09","sha256":"65738bdb5195b10a0c5311f3ad8fbd929966bbf5afc952044e07af65b2952550"},{"repoPath":"CONTENT_PROVENANCE.md","accessDate":"2026-08-09"}],
        "contentHashAfter": "dbca6667539a4edd822bbcad805c1d0b95d3a1a3783d11e9192c568883c1e832",
        "changeSummary": "导入 2026-08-09 LC 最新审查结论。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000002",
        "issueKey": "LC-RISK-002",
        "matrixType": "legal_risk",
        "category": "隐私与数据库安全",
        "severity": "HIGH",
        "status": "evidence_pending",
        "title": "生产合规控制尚未部署并完成端到端验证",
        "description": "v3 重新同意、180 天反馈保留、Edge Function、Vault、cron、函数 ACL、RLS 和删除链路当前仅存在于本地工作树。",
        "verifiedFacts": "本地静态安全审计无错误，但生产数据库迁移、权限矩阵、定时任务与失败重试尚无可重复验证证据。",
        "evidenceBasis": "SECURITY.md、PRIVACY_AND_RETENTION.md、data/supabase-security-audit.json 与追加迁移。",
        "lcAnalysis": "本地脚本通过不能替代生产环境的权限、保留和删除验证。",
        "releaseImpact": "生产合规控制缺少验证时，不应据此放行商业发行。",
        "remediationPlan": "先 dry run，再部署迁移和 Edge Function，配置 Vault，执行匿名、普通用户、管理员和服务角色权限矩阵。",
        "nextStep": "在隔离测试记录上验证附件先删、数据库后删、失败重试和审计记录，再核对生产函数 ACL。",
        "acceptanceEvidence": "生产查询结果、定时任务运行记录、隔离数据端到端测试与回滚证据。",
        "unresolvedQuestions": "生产项目当前 Postgres 版本、扩展与 Vault 配置仍需核对。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "R&D / OP",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["supabase/migrations/20260809060413_compliance_release_controls.sql", "supabase/functions/process-feedback-retention/index.ts", "data/supabase-security-audit.json"],
        "evidenceRefs": [{"repoPath":"SECURITY.md","accessDate":"2026-08-09"},{"repoPath":"PRIVACY_AND_RETENTION.md","accessDate":"2026-08-09"},{"repoPath":"data/supabase-security-audit.json","accessDate":"2026-08-09"}],
        "contentHashAfter": "b0345a8dcf82ccf9d74aece644161b0b1d6ae204091c7e21dc4ef0f42dfb6ce5",
        "changeSummary": "导入 2026-08-09 LC 最新审查结论。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000003",
        "issueKey": "LC-RISK-003",
        "matrixType": "legal_risk",
        "category": "运营主体与监管",
        "severity": "BLOCKER",
        "status": "external_confirmation_pending",
        "title": "运营主体、司法辖区与收费规则尚未闭合",
        "description": "运营主体、目标司法辖区、收费和退款规则、备案或许可、自动续费及投诉机制尚未形成适用范围明确的书面结论。",
        "verifiedFacts": "当前仓库把上述事项列为商业发行前必须完成人工办理的项目。",
        "evidenceBasis": "COMMERCIAL_RELEASE_CHECKLIST.md 第 5、6 节。",
        "lcAnalysis": "缺少主体和发行范围时，无法判断具体适用义务，也不能将用户接受风险视为替代。",
        "releaseImpact": "阻断收费、自动续费或大规模商业推广。",
        "remediationPlan": "明确主体、渠道、用户所在地、服务器与供应商位置、价格周期、取消退款和投诉流程，并逐辖区确认。",
        "nextStep": "先确定首发主体、首发渠道、收费模式和目标司法辖区，再形成逐项办理清单。",
        "acceptanceEvidence": "登记信息、渠道与定价方案、备案或许可记录、适用范围明确的复核结论。",
        "unresolvedQuestions": "首发主体、地区、渠道和商业模式尚未最终确定。",
        "externalConfirmationRequired": true,
        "externalConfirmation": "必要的主管部门、渠道、律师或运营主体书面确认。",
        "owner": "待指定",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["商业发行范围", "收费与退款流程", "备案与许可"],
        "evidenceRefs": [{"repoPath":"COMMERCIAL_RELEASE_CHECKLIST.md","accessDate":"2026-08-09"}],
        "changeSummary": "导入 2026-08-09 LC 最新审查结论。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000004",
        "issueKey": "LC-RISK-004",
        "matrixType": "legal_risk",
        "category": "供应商与跨境",
        "severity": "HIGH",
        "status": "external_confirmation_pending",
        "title": "供应商 DPA、数据位置与跨境机制待书面确认",
        "description": "Cloudflare、Supabase、邮件等供应商的适用 DPA、子处理者、数据位置、跨境、删除和事件通知条款尚未全部闭合。",
        "verifiedFacts": "仓库列出了供应商和数据流，但缺少与实际商业范围一致的完整书面证据。",
        "evidenceBasis": "PRIVACY_AND_RETENTION.md 与 COMMERCIAL_RELEASE_CHECKLIST.md。",
        "lcAnalysis": "供应商公开条款或本地技术控制不能自动证明当前主体和渠道下的跨境与合同义务已经满足。",
        "releaseImpact": "在相关数据处理范围内维持高风险并影响商业发行。",
        "remediationPlan": "建立供应商数据流清单，保存适用条款版本、DPA、子处理者和数据位置证据。",
        "nextStep": "先按账户、学习记录、反馈附件、日志和邮件绘制数据流，再逐供应商核对合同和删除链路。",
        "acceptanceEvidence": "适用版本、签署或接受记录、数据位置和删除/事件通知验证。",
        "unresolvedQuestions": "实际运营主体和目标司法辖区尚未确定。",
        "externalConfirmationRequired": true,
        "externalConfirmation": "供应商或适格专业人员对适用范围的书面确认。",
        "owner": "待指定",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["Cloudflare", "Supabase", "邮件服务", "账户与反馈数据流"],
        "evidenceRefs": [{"repoPath":"PRIVACY_AND_RETENTION.md","accessDate":"2026-08-09"},{"repoPath":"COMMERCIAL_RELEASE_CHECKLIST.md","accessDate":"2026-08-09"}],
        "changeSummary": "导入 2026-08-09 LC 最新审查结论。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000005",
        "issueKey": "LC-RIGHTS-001",
        "matrixType": "rights_chain",
        "category": "SemCor 例句",
        "severity": "BLOCKER",
        "status": "open",
        "title": "SemCor 例句商业再分发权利未验证",
        "description": "2,845 条 SemCor 例句不能由 WordNet 3.0 许可自动覆盖，作者和商业再分发许可仍未知。",
        "verifiedFacts": "台账以 semcor-commercial-rights-unverified 单独标记这些例句。",
        "evidenceBasis": "CONTENT_PROVENANCE.md 与 THIRD_PARTY_NOTICES.md 的 SemCor 分层说明。",
        "lcAnalysis": "数据集或相邻项目的许可证不能替代句子原文的逐项权利链。",
        "releaseImpact": "相关例句阻断拟发行范围的商业放行。",
        "remediationPlan": "取得适用商业再分发授权，或保持 senseId 兼容地原创重写/合法替换并保存前后哈希。",
        "nextStep": "生成 2,845 条整改清单，按批次替换并在每批次运行内容身份和权利审计。",
        "acceptanceEvidence": "逐句作者、许可或原创记录、来源、版本、商业范围、哈希和 LC 复核。",
        "unresolvedQuestions": "可获得授权的范围与原创替换批次尚未确定。",
        "externalConfirmationRequired": true,
        "externalConfirmation": "如继续使用原文，需要权利人或适格书面意见确认。",
        "owner": "CD",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["2,845 条 exampleSource=semcor 例句", "data/content-rights-ledger.jsonl"],
        "evidenceRefs": [{"repoPath":"CONTENT_PROVENANCE.md","accessDate":"2026-08-09"},{"repoPath":"THIRD_PARTY_NOTICES.md","accessDate":"2026-08-09"}],
        "changeSummary": "导入 2026-08-09 LC 最新审查结论。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000006",
        "issueKey": "LC-RIGHTS-002",
        "matrixType": "rights_chain",
        "category": "翻译与外部服务",
        "severity": "BLOCKER",
        "status": "remediation_in_progress",
        "title": "翻译来源商业复核及历史外部服务仍未闭合",
        "description": "当前审计有 8,929 条翻译来源商业复核记录及 2 个历史外部服务阻断。",
        "verifiedFacts": "data/content-rights-summary.json 记录 translationSourcesRequiringCommercialReview=8929、legacyExternalServicesRequiringReplacement=2。",
        "evidenceBasis": "2026-08-09 内容权利审计生成结果。",
        "lcAnalysis": "模型许可证不能自动覆盖训练数据、输入或生成输出；非正式服务端点也不能视为生产商业合同。",
        "releaseImpact": "相关翻译与维护来源阻断商业发行。",
        "remediationPlan": "逐条补充原创/模型生成记录和人工复核，替换非正式外部服务并保留批次与哈希。",
        "nextStep": "先隔离 2 个历史外部服务，再按翻译来源批次补齐作者、模型、版本、输入权限和输出复核。",
        "acceptanceEvidence": "逐字段来源、作者、模型批次、复核人、许可证或授权、商业范围与哈希。",
        "unresolvedQuestions": "历史翻译批次的可追溯作者和输入来源仍需整理。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "CD / R&D",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["8,929 条翻译记录", "2 个历史外部服务", "data/content-rights-summary.json"],
        "evidenceRefs": [{"repoPath":"data/content-rights-summary.json","accessDate":"2026-08-09","sha256":"ed2bd8f5644dfa8de10d7e1f04bd9a00828d922b8f44e12f3bdd7c443f2f9c43"},{"repoPath":"THIRD_PARTY_NOTICES.md","accessDate":"2026-08-09"}],
        "contentHashAfter": "ed2bd8f5644dfa8de10d7e1f04bd9a00828d922b8f44e12f3bdd7c443f2f9c43",
        "changeSummary": "导入 2026-08-09 LC 最新审查结论。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000007",
        "issueKey": "LC-MODEL-ARCH-001",
        "matrixType": "rights_chain",
        "category": "模型架构",
        "severity": "HIGH",
        "status": "evidence_pending",
        "title": "模型架构许可适用范围待逐项留证",
        "description": "当前材料尚未把每个实际使用模型的架构许可与商业发行范围逐项关联。",
        "verifiedFacts": "仓库要求模型架构与权重、训练数据、输入和输出分层记录。",
        "evidenceBasis": "CONTENT_PROVENANCE.md 与 COMMERCIAL_RELEASE_CHECKLIST.md。",
        "lcAnalysis": "架构开放不代表权重、训练数据或输出同时获得商业授权。",
        "releaseImpact": "缺少适用范围时保持高风险。",
        "remediationPlan": "逐模型记录架构名称、版本、作者、许可证、官方来源和商业适用范围。",
        "nextStep": "先建立当前实际使用模型架构清单并附官方许可证快照或哈希。",
        "acceptanceEvidence": "逐模型架构版本、作者、许可证、官方链接、访问日期、商业范围和哈希。",
        "unresolvedQuestions": "生产与维护阶段实际启用的模型清单待确认。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "R&D / CD",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["模型架构"],
        "evidenceRefs": [{"repoPath":"CONTENT_PROVENANCE.md","accessDate":"2026-08-09"}],
        "changeSummary": "按 LC 分层要求建立独立模型架构卡片。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000008",
        "issueKey": "LC-MODEL-WEIGHTS-001",
        "matrixType": "rights_chain",
        "category": "模型权重",
        "severity": "HIGH",
        "status": "evidence_pending",
        "title": "模型权重来源与商业许可待逐项留证",
        "description": "模型权重的准确版本、来源、权利人和商业使用条件尚未形成独立完整台账。",
        "verifiedFacts": "Argos/OPUS-MT English-Chinese 1.9 已有基础记录，但不能覆盖其他层或未来模型。",
        "evidenceBasis": "THIRD_PARTY_NOTICES.md 的模型分层说明。",
        "lcAnalysis": "架构许可证不能自动覆盖权重文件。",
        "releaseImpact": "缺失权重证据的模型不得用于商业内容生产或发行判断。",
        "remediationPlan": "记录权重文件版本、下载来源、作者、许可、哈希和允许的商业用途。",
        "nextStep": "盘点本地和线上实际使用的全部权重文件并计算 SHA-256。",
        "acceptanceEvidence": "权重逐文件来源、作者、许可证、版本、商业范围和哈希。",
        "unresolvedQuestions": "是否存在未记录的维护或历史权重文件。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "R&D / CD",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["模型权重"],
        "evidenceRefs": [{"repoPath":"THIRD_PARTY_NOTICES.md","accessDate":"2026-08-09"}],
        "changeSummary": "按 LC 分层要求建立独立模型权重卡片。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000009",
        "issueKey": "LC-MODEL-TRAINING-001",
        "matrixType": "rights_chain",
        "category": "训练数据",
        "severity": "HIGH",
        "status": "evidence_pending",
        "title": "模型训练数据权利与适用范围待确认",
        "description": "现有模型记录未完整证明训练数据层在拟定商业范围内的适用条件。",
        "verifiedFacts": "当前政策明确要求训练数据与模型架构、权重分开审查。",
        "evidenceBasis": "CONTENT_PROVENANCE.md 与 THIRD_PARTY_NOTICES.md。",
        "lcAnalysis": "模型或权重可用不等于训练数据及其生成输出不受额外限制。",
        "releaseImpact": "训练数据证据不足时维持高风险。",
        "remediationPlan": "记录训练数据集、版本、许可、来源、限制和供应商声明。",
        "nextStep": "为每个实际模型补齐官方模型卡和训练数据声明，无法确认时保持未清除。",
        "acceptanceEvidence": "官方模型卡、数据集版本、许可证、来源、访问日期和适用商业范围。",
        "unresolvedQuestions": "部分供应商是否完整披露训练数据仍未知。",
        "externalConfirmationRequired": true,
        "externalConfirmation": "必要时由模型供应商确认训练数据与商用范围。",
        "owner": "R&D / LC",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["模型训练数据"],
        "evidenceRefs": [{"repoPath":"CONTENT_PROVENANCE.md","accessDate":"2026-08-09"}],
        "changeSummary": "按 LC 分层要求建立独立训练数据卡片。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000010",
        "issueKey": "LC-MODEL-INPUT-001",
        "matrixType": "rights_chain",
        "category": "模型输入",
        "severity": "HIGH",
        "status": "evidence_pending",
        "title": "模型输入内容的使用权与敏感信息边界待闭合",
        "description": "输入模型的第三方文本、用户数据或其他材料尚未形成统一的权利与隐私检查记录。",
        "verifiedFacts": "当前规则禁止将无权使用的第三方内容输入模型，但历史批次仍需逐项核对。",
        "evidenceBasis": "CONTENT_PROVENANCE.md 的 AI 辅助内容要求。",
        "lcAnalysis": "输出可用与否不能消除输入材料本身的版权、合同或个人信息义务。",
        "releaseImpact": "无法确认输入权利的批次不得被标记为已清除。",
        "remediationPlan": "记录输入类别、来源、权利基础、是否含个人信息、最小化和删除安排。",
        "nextStep": "从现有内容生产脚本和历史批次盘点实际输入来源。",
        "acceptanceEvidence": "输入来源、权利基础、隐私判断、批次和哈希。",
        "unresolvedQuestions": "历史维护输入是否全部可追溯。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "CD / R&D",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["模型输入", "内容维护批次"],
        "evidenceRefs": [{"repoPath":"CONTENT_PROVENANCE.md","accessDate":"2026-08-09"}],
        "changeSummary": "按 LC 分层要求建立独立模型输入卡片。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000011",
        "issueKey": "LC-MODEL-OUTPUT-001",
        "matrixType": "rights_chain",
        "category": "模型输出",
        "severity": "HIGH",
        "status": "evidence_pending",
        "title": "模型输出的来源记录与人工复核待完善",
        "description": "模型生成或辅助生成的释义、翻译和公告内容尚未全部具备批次、模型、复核人和输出哈希记录。",
        "verifiedFacts": "公告已增加 AI 来源和人工复核字段；历史词汇内容仍有大量来源商业复核记录。",
        "evidenceBasis": "CONTENT_PROVENANCE.md、THIRD_PARTY_NOTICES.md 与当前内容权利审计。",
        "lcAnalysis": "模型供应商条款或生成行为本身不能证明输出适合商业再分发。",
        "releaseImpact": "未完成记录和人工复核的输出保持高风险。",
        "remediationPlan": "按内容批次记录模型、版本、提示词哈希、生成时间、人工复核和输出哈希。",
        "nextStep": "先覆盖未来新增/修改字段，再逐步补齐历史输出记录。",
        "acceptanceEvidence": "批次记录、模型版本、输出哈希、人工复核与字段级权利台账。",
        "unresolvedQuestions": "历史内容中哪些字段属于模型输出仍需盘点。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "CD / R&D",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["释义译文", "例句译文", "公告 AI 内容"],
        "evidenceRefs": [{"repoPath":"CONTENT_PROVENANCE.md","accessDate":"2026-08-09"},{"repoPath":"THIRD_PARTY_NOTICES.md","accessDate":"2026-08-09"}],
        "changeSummary": "按 LC 分层要求建立独立模型输出卡片。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000012",
        "issueKey": "LC-VOICE-001",
        "matrixType": "rights_chain",
        "category": "声线与人格权",
        "severity": "HIGH",
        "status": "evidence_pending",
        "title": "浏览器语音、在线发音与声线人格权待分层确认",
        "description": "浏览器本地 TTS、在线音频和可能的声线服务具有不同条款，当前尚未形成统一的商业适用清单。",
        "verifiedFacts": "Wikimedia 音频逐文件证据已补齐；有道发音回退和浏览器/操作系统声线条款仍需单独评估。",
        "evidenceBasis": "THIRD_PARTY_NOTICES.md 的 Wikimedia、外部发音和声线说明。",
        "lcAnalysis": "音频文件许可证不能替代 TTS 服务条款、声线授权或人格权判断。",
        "releaseImpact": "未确认的发音路径维持高风险并可能限制商业渠道。",
        "remediationPlan": "逐路径记录供应商、声线、条款版本、商业用途、地区限制和回退行为。",
        "nextStep": "先移除或隔离无商业合同的外部回退，再核对目标浏览器和操作系统 TTS 条款。",
        "acceptanceEvidence": "逐声线/服务条款、版本、地区、商业范围、必要的人格权依据和运行时验证。",
        "unresolvedQuestions": "目标设备和浏览器范围尚未确定。",
        "externalConfirmationRequired": true,
        "externalConfirmation": "必要时由服务供应商或权利人确认商业使用范围。",
        "owner": "R&D / LC",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["Wikimedia 音频", "外部发音回退", "浏览器与操作系统 TTS"],
        "evidenceRefs": [{"repoPath":"THIRD_PARTY_NOTICES.md","accessDate":"2026-08-09"}],
        "changeSummary": "按 LC 分层要求建立独立声线与人格权卡片。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000013",
        "issueKey": "LC-RIGHTS-003",
        "matrixType": "rights_chain",
        "category": "Wikimedia 音频",
        "severity": "CLEARED",
        "status": "closed",
        "title": "1,617 条 Wikimedia 音频权利元数据已补齐",
        "description": "当前台账范围内 1,617 条 Wikimedia 音频的作者、许可证、来源页和证据哈希缺口已清零。",
        "verifiedFacts": "2026-08-09 审计结果 remoteAudioWithoutCompleteAttribution=0。",
        "evidenceBasis": "逐文件 Wikimedia API 元数据、文件说明或历史证据及本地缓存哈希。",
        "lcAnalysis": "本次清除仅适用于台账列明的 1,617 个文件和当前证据版本，不代表未来新增音频自动清除。",
        "releaseImpact": "该批音频不再因缺少逐文件权利元数据构成当前阻断。",
        "remediationPlan": "未来新增或替换音频继续运行逐文件 enrichment 与审计。",
        "nextStep": "保持缓存和台账随音频变更更新；许可证义务仍须在实际发布渠道履行。",
        "acceptanceEvidence": "逐文件作者、许可证、来源页、获取时间和证据 SHA-256 均已记录。",
        "unresolvedQuestions": "无；仅保留持续维护义务。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "CD",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["data/wikimedia-audio-rights-cache.json", "1,617 个 Wikimedia 音频文件"],
        "evidenceRefs": [{"repoPath":"data/wikimedia-audio-rights-cache.json","accessDate":"2026-08-09","sha256":"007642d1fccbb9edcc2a89295e0673ed2777b304c29f0b162c6ecdfa07a7a48e"},{"url":"https://commons.wikimedia.org/wiki/Commons:Credit_line","accessDate":"2026-08-09"}],
        "rightsClearance": {"authorOrRightsholder":"逐文件作者或权利人见缓存","licenseOrPermission":"逐文件许可证见缓存","sourceUrl":"https://commons.wikimedia.org/","versionOrDate":"2026-08-09 逐文件抓取记录","commercialScope":"仅适用于当前台账列明的 1,617 个文件并持续履行各自许可证条件","sha256":"007642d1fccbb9edcc2a89295e0673ed2777b304c29f0b162c6ecdfa07a7a48e"},
        "contentHashAfter": "007642d1fccbb9edcc2a89295e0673ed2777b304c29f0b162c6ecdfa07a7a48e",
        "changeSummary": "导入已完成的 Wikimedia 音频权利元数据整改结论。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000014",
        "issueKey": "LC-RIGHTS-004",
        "matrixType": "rights_chain",
        "category": "Tatoeba 例句",
        "severity": "CLEARED",
        "status": "closed",
        "title": "944 条 Tatoeba 记录已与官方文本和归因核对",
        "description": "当前范围内 944 条 Tatoeba 记录与官方文本一致，逐句作者状态、许可证、来源页和证据哈希已经记录。",
        "verifiedFacts": "原 12 条差异仅为冗余句末句点，保留前后哈希后已按官方文本规范化。",
        "evidenceBasis": "Tatoeba API v1、周度导出及 data/tatoeba-rights-cache.json。",
        "lcAnalysis": "本次清除只适用于台账中已核验的 944 条记录，不把历史默认许可证套用于未来句子。",
        "releaseImpact": "该批记录不再因文本或归因元数据不一致构成当前阻断。",
        "remediationPlan": "未来变更继续按句子 ID 核对官方文本和当前许可证。",
        "nextStep": "保持逐句缓存、修改说明和哈希随内容变更更新。",
        "acceptanceEvidence": "官方文本、作者或 unowned 状态、句子许可证、来源页、获取时间和证据哈希已保存。",
        "unresolvedQuestions": "无；仅保留持续维护义务。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "CD",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["data/tatoeba-rights-cache.json", "944 条 Tatoeba 记录"],
        "evidenceRefs": [{"repoPath":"data/tatoeba-rights-cache.json","accessDate":"2026-08-09","sha256":"a796f654f73af199fceac13f09067948185d7b48e65cb4b93b4bf9085508af5e"},{"url":"https://tatoeba.org/en/terms_of_use","accessDate":"2026-08-09"}],
        "rightsClearance": {"authorOrRightsholder":"逐句作者或 unowned 状态见缓存","licenseOrPermission":"逐句 API 返回许可证见缓存","sourceUrl":"https://tatoeba.org/","versionOrDate":"2026-08-09 API 与周度导出核对","commercialScope":"仅适用于当前台账中已核验的 944 条记录并持续履行逐句许可证条件","sha256":"a796f654f73af199fceac13f09067948185d7b48e65cb4b93b4bf9085508af5e"},
        "contentHashAfter": "a796f654f73af199fceac13f09067948185d7b48e65cb4b93b4bf9085508af5e",
        "changeSummary": "导入已完成的 Tatoeba 文本与归因核对结论。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000015",
        "issueKey": "LC-RIGHTS-005",
        "matrixType": "rights_chain",
        "category": "代码依赖",
        "severity": "CLEARED",
        "status": "closed",
        "title": "直接软件依赖许可证声明证据已核验",
        "description": "当前直接依赖未验证许可证证据数为 0，精确安装版本、上游引用和文件哈希已记录。",
        "verifiedFacts": "SBOM 包含 58 个组件；supabase@2.110.0 与 wordnet@2.0.0 的特殊许可证声明证据已保存。",
        "evidenceBasis": "SBOM.cdx.json、THIRD_PARTY_LICENSE_EVIDENCE.json 与生成的许可证包。",
        "lcAnalysis": "本次结论只覆盖当前锁文件和生成证据；代码许可证不能替代数据、内容或模型权利。",
        "releaseImpact": "当前直接代码依赖不再因缺少许可证声明证据构成阻断。",
        "remediationPlan": "依赖升级后重新生成 SBOM 和许可证证据并复核随包义务。",
        "nextStep": "保持 package-lock、SBOM、许可证文本和直接依赖证据同步。",
        "acceptanceEvidence": "精确版本、包哈希、上游引用、许可证声明和本地证据哈希均已记录。",
        "unresolvedQuestions": "无；上游未附独立 LICENSE 的客观事实继续披露。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "R&D",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["SBOM.cdx.json", "THIRD_PARTY_LICENSE_EVIDENCE.json", "package-lock.json"],
        "evidenceRefs": [{"repoPath":"SBOM.cdx.json","accessDate":"2026-08-09","sha256":"532593a1ba59e5125c90805bdec9abfd5d40d9c76ba1ba8939df23bc217c1e9f"},{"repoPath":"THIRD_PARTY_LICENSE_EVIDENCE.json","accessDate":"2026-08-09","sha256":"7b1f3b88cdde4fb31dc6478c1fd866c3f6719b73ca069ab8bb43a4b2327b52fe"}],
        "rightsClearance": {"authorOrRightsholder":"逐依赖作者与权利人见 SBOM 和许可证包","licenseOrPermission":"逐依赖许可证见 SBOM 和许可证包","sourceUrl":"https://www.npmjs.com/","versionOrDate":"2026-08-09，package-lock 精确版本","commercialScope":"仅适用于当前 package-lock 与 SBOM 列明的软件依赖；不覆盖数据、内容或模型权利","sha256":"532593a1ba59e5125c90805bdec9abfd5d40d9c76ba1ba8939df23bc217c1e9f"},
        "contentHashAfter": "532593a1ba59e5125c90805bdec9abfd5d40d9c76ba1ba8939df23bc217c1e9f",
        "changeSummary": "导入已完成的直接软件依赖许可证证据核验结论。"
      },
      {
        "id": "f0000000-0000-4000-8000-000000000016",
        "issueKey": "LC-RIGHTS-006",
        "matrixType": "rights_chain",
        "category": "图片、图标与品牌素材",
        "severity": "MEDIUM",
        "status": "remediation_in_progress",
        "title": "图片、图标、字体与品牌素材台账仍需持续补齐",
        "description": "公告图片已增加来源、授权、AI 和下架字段，但全项目图片、图标、字体及品牌素材尚未形成统一逐项台账。",
        "verifiedFacts": "当前工作树已经实现公告图片权利元数据和下架审计；其他静态资产仍需盘点。",
        "evidenceBasis": "THIRD_PARTY_NOTICES.md、admin.html、admin.js 与公告受控 RPC。",
        "lcAnalysis": "单一公告工作流不能替代全项目资产清单，也不能自动清除未来新增素材。",
        "releaseImpact": "未登记资产保持待复核，并可能影响特定渠道发布。",
        "remediationPlan": "按资产记录用途、作者或权利人、直接来源、许可或授权、版本、哈希、商业范围和下架方式。",
        "nextStep": "先盘点 dist 与源目录中的字体、图标、图片和品牌素材，再把公告权利记录纳入同一索引。",
        "acceptanceEvidence": "完整资产清单、逐项证据、构建产物核对和抽取后哈希。",
        "unresolvedQuestions": "是否存在未纳入构建脚本的外部品牌素材。",
        "externalConfirmationRequired": false,
        "externalConfirmation": "",
        "owner": "R&D / LC",
        "reviewer": "LC（初始化）",
        "affectedAssets": ["公告图片", "图标", "字体", "品牌素材", "dist 构建产物"],
        "evidenceRefs": [{"repoPath":"THIRD_PARTY_NOTICES.md","accessDate":"2026-08-09"},{"repoPath":"admin.html","accessDate":"2026-08-09"},{"repoPath":"admin.js","accessDate":"2026-08-09"}],
        "changeSummary": "导入当前公告素材整改状态并建立全项目资产后续卡片。"
      }
    ]
    $seed$::jsonb)
  loop
    v_issue_id := (v_entry ->> 'id')::uuid;
    insert into public.compliance_issues (
      id, issue_key, matrix_type, category, created_by,
      created_at
    ) values (
      v_issue_id,
      v_entry ->> 'issueKey',
      v_entry ->> 'matrixType',
      v_entry ->> 'category',
      null,
      timestamptz '2026-08-09T18:00:00+08:00'
    ) on conflict (issue_key) do nothing;

    insert into public.compliance_issue_snapshots (
      issue_id, revision, severity, lifecycle_status, title,
      problem_description, verified_facts, evidence_basis, lc_analysis,
      release_impact, remediation_plan, next_step_solution,
      acceptance_evidence, unresolved_questions,
      external_confirmation_required, external_confirmation,
      owner_name, reviewer_name, review_due_at, affected_assets,
      evidence_refs, applicable_scope, rights_clearance,
      content_hash_before, content_hash_after, change_summary,
      created_by, created_at
    ) values (
      v_issue_id,
      1,
      v_entry ->> 'severity',
      v_entry ->> 'status',
      v_entry ->> 'title',
      v_entry ->> 'description',
      coalesce(v_entry ->> 'verifiedFacts', ''),
      coalesce(v_entry ->> 'evidenceBasis', ''),
      coalesce(v_entry ->> 'lcAnalysis', ''),
      coalesce(v_entry ->> 'releaseImpact', ''),
      coalesce(v_entry ->> 'remediationPlan', ''),
      v_entry ->> 'nextStep',
      coalesce(v_entry ->> 'acceptanceEvidence', ''),
      coalesce(v_entry ->> 'unresolvedQuestions', ''),
      coalesce((v_entry ->> 'externalConfirmationRequired')::boolean, false),
      coalesce(v_entry ->> 'externalConfirmation', ''),
      coalesce(v_entry ->> 'owner', ''),
      coalesce(v_entry ->> 'reviewer', ''),
      nullif(v_entry ->> 'reviewDueAt', '')::date,
      coalesce(v_entry -> 'affectedAssets', '[]'::jsonb),
      coalesce(v_entry -> 'evidenceRefs', '[]'::jsonb),
      coalesce(v_entry -> 'applicableScope', v_default_scope),
      coalesce(v_entry -> 'rightsClearance', '{}'::jsonb),
      nullif(v_entry ->> 'contentHashBefore', ''),
      nullif(v_entry ->> 'contentHashAfter', ''),
      v_entry ->> 'changeSummary',
      null,
      timestamptz '2026-08-09T18:00:00+08:00'
    ) on conflict (issue_id, revision) do nothing;
  end loop;
end;
$$;

revoke all on function public.admin_compliance_dashboard()
  from public, anon, authenticated;
revoke all on function public.admin_compliance_issue_detail(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_create_compliance_issue(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_append_compliance_issue_snapshot(uuid, bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_append_compliance_release_snapshot(bigint, jsonb)
  from public, anon, authenticated;

grant execute on function public.admin_compliance_dashboard() to authenticated;
grant execute on function public.admin_compliance_issue_detail(uuid) to authenticated;
grant execute on function public.admin_create_compliance_issue(text, text, jsonb)
  to authenticated;
grant execute on function public.admin_append_compliance_issue_snapshot(uuid, bigint, jsonb)
  to authenticated;
grant execute on function public.admin_append_compliance_release_snapshot(bigint, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
commit;
