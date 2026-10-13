-- Course relational design; SQLite 3 reference DDL for local integrity validation.
-- Times: ISO 8601 local civil time in Asia/Shanghai, YYYY-MM-DD HH:MM:SS.
-- No live/cloud database is accessed by this file.
PRAGMA foreign_keys = ON;

CREATE TABLE organization (
  organization_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) > 0)
);
CREATE TABLE department (
  department_id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organization ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  UNIQUE(organization_id,name)
);
CREATE TABLE member (
  member_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  login_name TEXT NOT NULL UNIQUE CHECK(length(trim(login_name)) > 0),
  password_hash TEXT,
  account_role TEXT NOT NULL CHECK(account_role IN ('ADMIN','MINISTER','MEMBER')),
  department_id INTEGER REFERENCES department ON DELETE RESTRICT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  CHECK(account_role = 'ADMIN' OR department_id IS NOT NULL)
);
CREATE TABLE external_identity (
  identity_id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  app_scope TEXT NOT NULL,
  subject TEXT NOT NULL,
  UNIQUE(provider,app_scope,subject),
  UNIQUE(member_id,provider,app_scope)
);
CREATE TABLE login_session (
  session_id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL CHECK((datetime(issued_at) IS NOT NULL AND datetime(issued_at)=issued_at)),
  expires_at TEXT NOT NULL CHECK((datetime(expires_at) IS NOT NULL AND datetime(expires_at)=expires_at)),
  terminated_at TEXT CHECK(terminated_at IS NULL OR (datetime(terminated_at) IS NOT NULL AND datetime(terminated_at)=terminated_at)),
  CHECK(expires_at > issued_at),
  CHECK(terminated_at IS NULL OR terminated_at >= issued_at)
);
CREATE TABLE archive_preference (
  production_member_id INTEGER PRIMARY KEY REFERENCES member ON DELETE RESTRICT,
  office_member_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT
);
CREATE TABLE platform (
  platform_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) > 0)
);
CREATE TABLE work (
  work_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  origin_kind TEXT NOT NULL CHECK(origin_kind IN ('ORIGINAL','REPRINT'))
);
CREATE TABLE manuscript_version (
  version_id INTEGER PRIMARY KEY,
  work_id INTEGER NOT NULL REFERENCES work ON DELETE RESTRICT,
  revision_no INTEGER NOT NULL CHECK(revision_no >= 1),
  content TEXT NOT NULL CHECK(length(trim(content)) > 0),
  submitted_by INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  submitted_at TEXT NOT NULL CHECK((datetime(submitted_at) IS NOT NULL AND datetime(submitted_at)=submitted_at)),
  UNIQUE(work_id,revision_no)
);
CREATE TABLE editorial (
  editorial_id INTEGER PRIMARY KEY,
  initiator_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  submitted_at TEXT NOT NULL CHECK((datetime(submitted_at) IS NOT NULL AND datetime(submitted_at)=submitted_at)),
  deadline_at TEXT CHECK(deadline_at IS NULL OR (datetime(deadline_at) IS NOT NULL AND datetime(deadline_at)=deadline_at)),
  CHECK(deadline_at IS NULL OR deadline_at > submitted_at)
);
CREATE TABLE editorial_work (
  editorial_id INTEGER NOT NULL REFERENCES editorial ON DELETE RESTRICT,
  work_id INTEGER NOT NULL REFERENCES work ON DELETE RESTRICT,
  PRIMARY KEY(editorial_id,work_id)
);
CREATE TABLE editorial_target (
  editorial_id INTEGER NOT NULL,
  work_id INTEGER NOT NULL,
  platform_id INTEGER NOT NULL REFERENCES platform ON DELETE RESTRICT,
  PRIMARY KEY(editorial_id,work_id,platform_id),
  FOREIGN KEY(editorial_id,work_id) REFERENCES editorial_work ON DELETE RESTRICT
);
CREATE TABLE editorial_assignment (
  editorial_id INTEGER PRIMARY KEY REFERENCES editorial ON DELETE RESTRICT,
  assignee_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  assigned_by INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  assigned_at TEXT NOT NULL CHECK((datetime(assigned_at) IS NOT NULL AND datetime(assigned_at)=assigned_at))
);
CREATE TABLE production_schedule (
  schedule_id INTEGER PRIMARY KEY,
  department_id INTEGER NOT NULL UNIQUE REFERENCES department ON DELETE RESTRICT
);
CREATE TABLE booking_terms (
  terms_id INTEGER PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES production_schedule ON DELETE RESTRICT,
  version_no INTEGER NOT NULL CHECK(version_no >= 1),
  effective_from TEXT NOT NULL CHECK((datetime(effective_from) IS NOT NULL AND datetime(effective_from)=effective_from)),
  urgent_threshold_days INTEGER NOT NULL CHECK(urgent_threshold_days > 0),
  day_basis TEXT NOT NULL CHECK(day_basis IN ('HOURS_24','CALENDAR_DAY','UNCONFIRMED')),
  urgent_factor_bp INTEGER NOT NULL CHECK(urgent_factor_bp >= 10000 AND urgent_factor_bp <= 100000),
  conflict_scope_note TEXT NOT NULL,
  UNIQUE(schedule_id,version_no),
  UNIQUE(schedule_id,effective_from)
);
CREATE TABLE production_booking (
  booking_id INTEGER PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  terms_id INTEGER NOT NULL REFERENCES booking_terms ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  starts_at TEXT NOT NULL CHECK((datetime(starts_at) IS NOT NULL AND datetime(starts_at)=starts_at)),
  ends_at TEXT NOT NULL CHECK((datetime(ends_at) IS NOT NULL AND datetime(ends_at)=ends_at)),
  location TEXT NOT NULL CHECK(length(trim(location)) > 0),
  contact TEXT NOT NULL CHECK(length(trim(contact)) > 0),
  submitted_at TEXT NOT NULL CHECK((datetime(submitted_at) IS NOT NULL AND datetime(submitted_at)=submitted_at)),
  urgent_decision INTEGER NOT NULL CHECK(urgent_decision IN (0,1)),
  claim_open INTEGER NOT NULL DEFAULT 0 CHECK(claim_open IN (0,1)),
  CHECK(ends_at > starts_at),
  CHECK(starts_at > submitted_at)
);
CREATE TABLE production_assignment (
  booking_id INTEGER PRIMARY KEY REFERENCES production_booking ON DELETE RESTRICT,
  assignee_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  assigned_by INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK(method IN ('ASSIGN','CLAIM')),
  assigned_at TEXT NOT NULL CHECK((datetime(assigned_at) IS NOT NULL AND datetime(assigned_at)=assigned_at)),
  CHECK(method <> 'CLAIM' OR assigned_by = assignee_id)
);
CREATE TABLE production_archive_responsibility (
  booking_id INTEGER PRIMARY KEY REFERENCES production_booking ON DELETE RESTRICT,
  office_member_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  specified_by INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  specified_at TEXT NOT NULL CHECK((datetime(specified_at) IS NOT NULL AND datetime(specified_at)=specified_at))
);
CREATE TABLE workflow (
  workflow_id INTEGER PRIMARY KEY,
  initiator_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  request_origin TEXT NOT NULL CHECK(length(trim(request_origin)) > 0),
  objective TEXT NOT NULL CHECK(length(trim(objective)) > 0),
  created_at TEXT NOT NULL CHECK((datetime(created_at) IS NOT NULL AND datetime(created_at)=created_at))
);
CREATE TABLE task_stage (
  stage_id INTEGER PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflow ON DELETE RESTRICT,
  department_id INTEGER NOT NULL REFERENCES department ON DELETE RESTRICT,
  sequence_no INTEGER NOT NULL CHECK(sequence_no >= 1),
  result_requirement TEXT NOT NULL CHECK(length(trim(result_requirement)) > 0),
  review_policy TEXT NOT NULL CHECK(review_policy IN ('NONE','OPERATIONS_TWO_LEVEL','OTHER_CONFIRMED')),
  deadline_at TEXT CHECK(deadline_at IS NULL OR (datetime(deadline_at) IS NOT NULL AND datetime(deadline_at)=deadline_at)),
  UNIQUE(workflow_id,sequence_no)
);
CREATE TABLE stage_assignment (
  stage_id INTEGER PRIMARY KEY REFERENCES task_stage ON DELETE RESTRICT,
  assignee_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  assigned_by INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  assigned_at TEXT NOT NULL CHECK((datetime(assigned_at) IS NOT NULL AND datetime(assigned_at)=assigned_at)),
  roster_basis TEXT
);
-- Exactly one real FK owns a source: no (type,id) polymorphic reference.
CREATE TABLE business_source (
  source_id INTEGER PRIMARY KEY,
  editorial_id INTEGER UNIQUE REFERENCES editorial ON DELETE RESTRICT,
  booking_id INTEGER UNIQUE REFERENCES production_booking ON DELETE RESTRICT,
  stage_id INTEGER UNIQUE REFERENCES task_stage ON DELETE RESTRICT,
  CHECK((editorial_id IS NOT NULL)+(booking_id IS NOT NULL)+(stage_id IS NOT NULL)=1)
);
-- A stage can reuse an existing specialized source rather than create duplicate work.
CREATE TABLE stage_source (
  stage_id INTEGER PRIMARY KEY REFERENCES task_stage ON DELETE RESTRICT,
  source_id INTEGER NOT NULL REFERENCES business_source ON DELETE RESTRICT
);
CREATE TABLE outcome (
  outcome_id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES business_source ON DELETE RESTRICT,
  submission_no INTEGER NOT NULL CHECK(submission_no >= 1),
  submitted_by INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  completed_note TEXT NOT NULL CHECK(length(trim(completed_note)) > 0),
  submitted_at TEXT NOT NULL CHECK((datetime(submitted_at) IS NOT NULL AND datetime(submitted_at)=submitted_at)),
  UNIQUE(source_id,submission_no)
);
CREATE TABLE outcome_attachment (
  attachment_id INTEGER PRIMARY KEY,
  outcome_id INTEGER NOT NULL REFERENCES outcome ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  storage_ref TEXT NOT NULL,
  UNIQUE(outcome_id,storage_ref)
);
CREATE TABLE outcome_version (
  outcome_id INTEGER NOT NULL REFERENCES outcome ON DELETE RESTRICT,
  version_id INTEGER NOT NULL REFERENCES manuscript_version ON DELETE RESTRICT,
  PRIMARY KEY(outcome_id,version_id)
);
CREATE TABLE publication (
  publication_id INTEGER PRIMARY KEY,
  outcome_id INTEGER NOT NULL REFERENCES outcome ON DELETE RESTRICT,
  version_id INTEGER,
  platform_id INTEGER NOT NULL REFERENCES platform ON DELETE RESTRICT,
  result_url TEXT NOT NULL CHECK(length(trim(result_url)) > 0),
  FOREIGN KEY(outcome_id,version_id) REFERENCES outcome_version ON DELETE RESTRICT
);
CREATE UNIQUE INDEX publication_manuscript_unique ON publication(outcome_id,version_id,platform_id) WHERE version_id IS NOT NULL;
CREATE UNIQUE INDEX publication_other_unique ON publication(outcome_id,platform_id,result_url) WHERE version_id IS NULL;
CREATE TABLE stage_current_draft (
  stage_id INTEGER PRIMARY KEY REFERENCES task_stage ON DELETE RESTRICT,
  outcome_id INTEGER NOT NULL,
  version_id INTEGER NOT NULL,
  FOREIGN KEY(outcome_id,version_id) REFERENCES outcome_version ON DELETE RESTRICT
);
CREATE TABLE manuscript_review (
  review_id INTEGER PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES manuscript_version ON DELETE RESTRICT,
  level INTEGER NOT NULL CHECK(level IN (1,2)),
  round_no INTEGER NOT NULL CHECK(round_no >= 1),
  reviewer_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK(decision IN ('PASS','RETURN')),
  opinion TEXT NOT NULL CHECK(length(trim(opinion)) > 0),
  reviewed_at TEXT NOT NULL CHECK((datetime(reviewed_at) IS NOT NULL AND datetime(reviewed_at)=reviewed_at)),
  prior_review_id INTEGER REFERENCES manuscript_review ON DELETE RESTRICT,
  CHECK(level = 2 OR prior_review_id IS NULL),
  UNIQUE(version_id,level,round_no)
);
CREATE TABLE editorial_review (
  editorial_review_id INTEGER PRIMARY KEY,
  outcome_id INTEGER NOT NULL UNIQUE REFERENCES outcome ON DELETE RESTRICT,
  reviewer_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK(decision IN ('PASS','RETURN')),
  opinion TEXT NOT NULL CHECK(length(trim(opinion)) > 0),
  reviewed_at TEXT NOT NULL CHECK((datetime(reviewed_at) IS NOT NULL AND datetime(reviewed_at)=reviewed_at))
);
CREATE TABLE editorial_review_item (
  editorial_review_id INTEGER NOT NULL REFERENCES editorial_review ON DELETE RESTRICT,
  review_id INTEGER NOT NULL REFERENCES manuscript_review ON DELETE RESTRICT,
  PRIMARY KEY(editorial_review_id,review_id)
);
CREATE TABLE editorial_archive (
  editorial_id INTEGER PRIMARY KEY REFERENCES editorial ON DELETE RESTRICT,
  editorial_review_id INTEGER NOT NULL UNIQUE REFERENCES editorial_review ON DELETE RESTRICT,
  archived_at TEXT NOT NULL CHECK((datetime(archived_at) IS NOT NULL AND datetime(archived_at)=archived_at))
);
CREATE TABLE production_archive (
  booking_id INTEGER PRIMARY KEY REFERENCES production_booking ON DELETE RESTRICT,
  outcome_id INTEGER NOT NULL UNIQUE REFERENCES outcome ON DELETE RESTRICT,
  archived_by INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  archived_at TEXT NOT NULL CHECK((datetime(archived_at) IS NOT NULL AND datetime(archived_at)=archived_at))
);
CREATE TABLE stage_confirmation (
  confirmation_id INTEGER PRIMARY KEY,
  stage_id INTEGER NOT NULL REFERENCES task_stage ON DELETE RESTRICT,
  outcome_id INTEGER NOT NULL REFERENCES outcome ON DELETE RESTRICT,
  confirmed_by INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK(decision IN ('PASS','RETURN')),
  opinion TEXT NOT NULL CHECK(length(trim(opinion)) > 0),
  confirmed_at TEXT NOT NULL CHECK((datetime(confirmed_at) IS NOT NULL AND datetime(confirmed_at)=confirmed_at))
);
CREATE TABLE stage_completion (
  stage_id INTEGER PRIMARY KEY REFERENCES task_stage ON DELETE RESTRICT,
  confirmation_id INTEGER NOT NULL UNIQUE REFERENCES stage_confirmation ON DELETE RESTRICT,
  second_review_id INTEGER REFERENCES manuscript_review ON DELETE RESTRICT
);
CREATE TABLE workflow_completion (
  workflow_id INTEGER PRIMARY KEY REFERENCES workflow ON DELETE RESTRICT,
  completed_at TEXT NOT NULL CHECK((datetime(completed_at) IS NOT NULL AND datetime(completed_at)=completed_at))
);
CREATE TABLE contribution_type (
  type_id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE allowance_standard (
  standard_id INTEGER PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES department ON DELETE RESTRICT,
  version_no INTEGER NOT NULL CHECK(version_no >= 1),
  effective_from TEXT NOT NULL CHECK((datetime(effective_from) IS NOT NULL AND datetime(effective_from)=effective_from)),
  hourly_rate_cents INTEGER NOT NULL CHECK(hourly_rate_cents >= 0 AND hourly_rate_cents <= 10000000),
  UNIQUE(department_id,version_no),
  UNIQUE(department_id,effective_from)
);
CREATE TABLE contribution_policy (
  policy_id INTEGER PRIMARY KEY,
  standard_id INTEGER NOT NULL REFERENCES allowance_standard ON DELETE RESTRICT,
  type_id INTEGER NOT NULL REFERENCES contribution_type ON DELETE RESTRICT,
  basis_rule TEXT NOT NULL CHECK(length(trim(basis_rule)) > 0),
  urgent_applies INTEGER NOT NULL CHECK(urgent_applies IN (0,1)),
  UNIQUE(standard_id,type_id)
);
-- Historical department is a fact of the contribution, not the member's current department.
CREATE TABLE contribution_basis (
  basis_id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES business_source ON DELETE RESTRICT,
  type_id INTEGER NOT NULL REFERENCES contribution_type ON DELETE RESTRICT,
  member_id INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  department_id INTEGER NOT NULL REFERENCES department ON DELETE RESTRICT,
  occurred_at TEXT NOT NULL CHECK((datetime(occurred_at) IS NOT NULL AND datetime(occurred_at)=occurred_at)),
  evidence TEXT NOT NULL CHECK(length(trim(evidence)) > 0),
  UNIQUE(source_id,type_id,member_id)
);
CREATE TABLE stage_contribution (
  stage_id INTEGER NOT NULL REFERENCES task_stage ON DELETE RESTRICT,
  basis_id INTEGER NOT NULL REFERENCES contribution_basis ON DELETE RESTRICT,
  PRIMARY KEY(stage_id,basis_id)
);
-- Optional subtype: an unmeasured basis is pending verification, never zero hours.
-- hours are integer 1/10000 h; factor is integer 1/10000, money is integer cents.
CREATE TABLE contribution_measurement (
  basis_id INTEGER PRIMARY KEY REFERENCES contribution_basis ON DELETE RESTRICT,
  policy_id INTEGER NOT NULL REFERENCES contribution_policy ON DELETE RESTRICT,
  base_hours_u INTEGER NOT NULL CHECK(base_hours_u > 0 AND base_hours_u <= 1000000000),
  assessed_at TEXT NOT NULL CHECK((datetime(assessed_at) IS NOT NULL AND datetime(assessed_at)=assessed_at))
);
CREATE TABLE weekly_report (
  report_id INTEGER PRIMARY KEY,
  week_start TEXT NOT NULL CHECK(date(week_start) IS NOT NULL AND strftime('%w',week_start)='1' AND week_start=date(week_start)),
  generated_by INTEGER NOT NULL REFERENCES member ON DELETE RESTRICT,
  generated_at TEXT NOT NULL CHECK((datetime(generated_at) IS NOT NULL AND datetime(generated_at)=generated_at)),
  export_ref TEXT
);
CREATE TABLE report_department (
  report_id INTEGER NOT NULL REFERENCES weekly_report ON DELETE RESTRICT,
  department_id INTEGER NOT NULL REFERENCES department ON DELETE RESTRICT,
  PRIMARY KEY(report_id,department_id)
);
CREATE TABLE report_contribution (
  report_id INTEGER NOT NULL REFERENCES weekly_report ON DELETE RESTRICT,
  basis_id INTEGER NOT NULL REFERENCES contribution_measurement ON DELETE RESTRICT,
  PRIMARY KEY(report_id,basis_id)
);
CREATE TABLE report_pending (
  report_id INTEGER NOT NULL REFERENCES weekly_report ON DELETE RESTRICT,
  basis_id INTEGER NOT NULL REFERENCES contribution_basis ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
  PRIMARY KEY(report_id,basis_id)
);
CREATE TABLE report_seal (
  report_id INTEGER PRIMARY KEY REFERENCES weekly_report ON DELETE RESTRICT
);

CREATE INDEX member_department_idx ON member(department_id);
CREATE INDEX session_member_idx ON login_session(member_id,expires_at);
CREATE INDEX booking_interval_idx ON production_booking(starts_at,ends_at);
CREATE INDEX outcome_source_idx ON outcome(source_id,submitted_at);
CREATE INDEX contribution_member_time_idx ON contribution_basis(member_id,occurred_at);
CREATE INDEX contribution_department_time_idx ON contribution_basis(department_id,occurred_at);
CREATE INDEX review_version_time_idx ON manuscript_review(version_id,reviewed_at);

-- Current totals are views; no duplicated week total or allowance amount is writable.
CREATE VIEW v_contribution_detail AS
SELECT b.basis_id,b.source_id,b.type_id,b.member_id,b.department_id,b.occurred_at,
       date(b.occurred_at,'weekday 0','-6 days') AS week_start,
       m.base_hours_u,m.policy_id,p.standard_id,a.hourly_rate_cents,
       CASE WHEN p.urgent_applies=1 AND bk.urgent_decision=1 THEN t.urgent_factor_bp ELSE 10000 END AS factor_bp,
       CAST((m.base_hours_u * CASE WHEN p.urgent_applies=1 AND bk.urgent_decision=1 THEN t.urgent_factor_bp ELSE 10000 END + 5000)/10000 AS INTEGER) AS counted_hours_u
FROM contribution_basis b
JOIN contribution_measurement m ON m.basis_id=b.basis_id
JOIN contribution_policy p ON p.policy_id=m.policy_id
JOIN allowance_standard a ON a.standard_id=p.standard_id
JOIN business_source s ON s.source_id=b.source_id
LEFT JOIN production_booking bk ON bk.booking_id=s.booking_id
LEFT JOIN booking_terms t ON t.terms_id=bk.terms_id;
CREATE VIEW v_contribution_money AS
SELECT d.*,CAST((counted_hours_u*hourly_rate_cents+5000)/10000 AS INTEGER) AS allowance_cents
FROM v_contribution_detail d;
CREATE VIEW v_member_weekly_summary AS
SELECT member_id,week_start,COUNT(*) AS contribution_count,SUM(counted_hours_u) AS total_hours_u,SUM(allowance_cents) AS total_allowance_cents
FROM v_contribution_money GROUP BY member_id,week_start;
CREATE VIEW v_pending_contribution AS
SELECT b.* FROM contribution_basis b LEFT JOIN contribution_measurement m ON m.basis_id=b.basis_id WHERE m.basis_id IS NULL;
CREATE VIEW v_report_member_summary AS
SELECT r.report_id,d.member_id,COUNT(*) AS contribution_count,SUM(d.counted_hours_u) AS total_hours_u,SUM(d.allowance_cents) AS total_allowance_cents
FROM report_contribution r JOIN report_seal seal ON seal.report_id=r.report_id
JOIN v_contribution_money d ON d.basis_id=r.basis_id GROUP BY r.report_id,d.member_id;

-- Cross-row constraints. Workflow permissions and full state transition guards
-- additionally belong to the business transaction, as documented in chapter 6.
CREATE TRIGGER review_prior_guard BEFORE INSERT ON manuscript_review
WHEN NEW.prior_review_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM manuscript_review p WHERE p.review_id=NEW.prior_review_id AND p.version_id=NEW.version_id AND p.level=1 AND p.decision='PASS' AND p.reviewed_at<=NEW.reviewed_at
)
BEGIN SELECT RAISE(ABORT,'prior review must pass on the same manuscript version'); END;
CREATE TRIGGER stage_source_guard BEFORE INSERT ON stage_source
WHEN EXISTS(SELECT 1 FROM business_source s WHERE s.source_id=NEW.source_id AND s.stage_id IS NOT NULL AND s.stage_id<>NEW.stage_id)
BEGIN SELECT RAISE(ABORT,'stage cannot reuse a different stage as its canonical source'); END;
CREATE TRIGGER current_draft_guard BEFORE INSERT ON stage_current_draft
WHEN NOT EXISTS(SELECT 1 FROM stage_source ss JOIN outcome o ON o.source_id=ss.source_id WHERE ss.stage_id=NEW.stage_id AND o.outcome_id=NEW.outcome_id)
BEGIN SELECT RAISE(ABORT,'current draft outcome must belong to stage source'); END;
CREATE TRIGGER current_draft_update_guard BEFORE UPDATE ON stage_current_draft
WHEN NOT EXISTS(SELECT 1 FROM stage_source ss JOIN outcome o ON o.source_id=ss.source_id WHERE ss.stage_id=NEW.stage_id AND o.outcome_id=NEW.outcome_id)
BEGIN SELECT RAISE(ABORT,'current draft outcome must belong to stage source'); END;
CREATE TRIGGER editorial_review_guard BEFORE INSERT ON editorial_review
WHEN NOT EXISTS(SELECT 1 FROM outcome o JOIN business_source s ON s.source_id=o.source_id WHERE o.outcome_id=NEW.outcome_id AND s.editorial_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'editorial review must review an editorial outcome'); END;
CREATE TRIGGER editorial_review_item_guard BEFORE INSERT ON editorial_review_item
WHEN NOT EXISTS(
 SELECT 1 FROM editorial_review e JOIN outcome_version ov ON ov.outcome_id=e.outcome_id
 JOIN manuscript_review r ON r.version_id=ov.version_id
 WHERE e.editorial_review_id=NEW.editorial_review_id AND r.review_id=NEW.review_id AND r.level=2
   AND r.reviewer_id=e.reviewer_id AND r.decision=e.decision
)
BEGIN SELECT RAISE(ABORT,'editorial review item must match its outcome, teacher and decision'); END;
CREATE TRIGGER editorial_archive_guard BEFORE INSERT ON editorial_archive
WHEN NOT EXISTS(
 SELECT 1 FROM editorial_review r JOIN outcome o ON o.outcome_id=r.outcome_id JOIN business_source s ON s.source_id=o.source_id
 WHERE r.editorial_review_id=NEW.editorial_review_id AND s.editorial_id=NEW.editorial_id AND r.decision='PASS'
 AND EXISTS(SELECT 1 FROM outcome_version ov WHERE ov.outcome_id=o.outcome_id)
 AND NOT EXISTS(SELECT 1 FROM outcome_version ov WHERE ov.outcome_id=o.outcome_id AND NOT EXISTS(
   SELECT 1 FROM editorial_review_item ri JOIN manuscript_review mr ON mr.review_id=ri.review_id
   WHERE ri.editorial_review_id=r.editorial_review_id AND mr.version_id=ov.version_id AND mr.decision='PASS'))
)
BEGIN SELECT RAISE(ABORT,'editorial archive requires matching passed reviews for every submitted version'); END;
CREATE TRIGGER production_archive_guard BEFORE INSERT ON production_archive
WHEN NOT EXISTS(
 SELECT 1 FROM outcome o JOIN business_source s ON s.source_id=o.source_id
 JOIN production_archive_responsibility r ON r.booking_id=s.booking_id
 WHERE o.outcome_id=NEW.outcome_id AND s.booking_id=NEW.booking_id AND r.office_member_id=NEW.archived_by
)
BEGIN SELECT RAISE(ABORT,'production archive requires its own outcome and designated office member'); END;
CREATE TRIGGER stage_assignment_guard BEFORE INSERT ON stage_assignment
WHEN EXISTS(
 SELECT 1 FROM task_stage cur JOIN task_stage prev ON prev.workflow_id=cur.workflow_id AND prev.sequence_no<cur.sequence_no
 WHERE cur.stage_id=NEW.stage_id AND NOT EXISTS(SELECT 1 FROM stage_completion c WHERE c.stage_id=prev.stage_id)
)
BEGIN SELECT RAISE(ABORT,'predecessor stages must be completed before assignment'); END;
CREATE TRIGGER stage_confirmation_guard BEFORE INSERT ON stage_confirmation
WHEN NOT EXISTS(SELECT 1 FROM stage_source ss JOIN outcome o ON o.source_id=ss.source_id WHERE ss.stage_id=NEW.stage_id AND o.outcome_id=NEW.outcome_id)
BEGIN SELECT RAISE(ABORT,'confirmation outcome must belong to stage source'); END;
CREATE TRIGGER stage_completion_guard BEFORE INSERT ON stage_completion
WHEN NOT EXISTS(SELECT 1 FROM stage_confirmation c JOIN outcome o ON o.outcome_id=c.outcome_id
 WHERE c.confirmation_id=NEW.confirmation_id AND c.stage_id=NEW.stage_id AND c.decision='PASS'
 AND NOT EXISTS(SELECT 1 FROM outcome later WHERE later.source_id=o.source_id AND later.submission_no>o.submission_no))
BEGIN SELECT RAISE(ABORT,'stage completion requires matching passed confirmation'); END;
CREATE TRIGGER operations_review_guard BEFORE INSERT ON stage_completion
WHEN EXISTS(
 SELECT 1 FROM task_stage t JOIN stage_confirmation c ON c.confirmation_id=NEW.confirmation_id
 WHERE t.stage_id=NEW.stage_id AND t.review_policy='OPERATIONS_TWO_LEVEL' AND (
 NOT EXISTS(SELECT 1 FROM stage_current_draft d WHERE d.stage_id=t.stage_id) OR
 NOT EXISTS(SELECT 1 FROM stage_current_draft d JOIN manuscript_review r ON r.version_id=d.version_id
   WHERE d.stage_id=t.stage_id AND r.review_id=NEW.second_review_id AND r.level=2 AND r.decision='PASS' AND r.prior_review_id IS NOT NULL AND r.reviewed_at<=c.confirmed_at
   AND EXISTS(SELECT 1 FROM outcome_version ov WHERE ov.outcome_id=c.outcome_id AND ov.version_id=d.version_id)
   AND NOT EXISTS(SELECT 1 FROM manuscript_review later WHERE later.version_id=r.version_id AND later.level=2 AND later.round_no>r.round_no)
   AND NOT EXISTS(SELECT 1 FROM manuscript_review later WHERE later.version_id=r.version_id AND later.level=1 AND later.round_no>(SELECT round_no FROM manuscript_review first WHERE first.review_id=r.prior_review_id))))
)
BEGIN SELECT RAISE(ABORT,'operations stage requires current-version passed first and second reviews'); END;
CREATE TRIGGER design_stage_review_guard BEFORE INSERT ON stage_completion
WHEN NEW.second_review_id IS NOT NULL AND EXISTS(SELECT 1 FROM task_stage s WHERE s.stage_id=NEW.stage_id AND s.review_policy='NONE')
BEGIN SELECT RAISE(ABORT,'non-manuscript stage does not carry a manuscript second review'); END;
CREATE TRIGGER workflow_completion_guard BEFORE INSERT ON workflow_completion
WHEN NOT EXISTS(SELECT 1 FROM task_stage s WHERE s.workflow_id=NEW.workflow_id)
 OR EXISTS(SELECT 1 FROM task_stage s WHERE s.workflow_id=NEW.workflow_id AND NOT EXISTS(SELECT 1 FROM stage_completion c WHERE c.stage_id=s.stage_id))
BEGIN SELECT RAISE(ABORT,'workflow completion requires all stages completed'); END;
CREATE TRIGGER stage_after_start_guard BEFORE INSERT ON task_stage
WHEN EXISTS(SELECT 1 FROM workflow_completion c WHERE c.workflow_id=NEW.workflow_id)
 OR EXISTS(SELECT 1 FROM task_stage s JOIN stage_assignment a ON a.stage_id=s.stage_id WHERE s.workflow_id=NEW.workflow_id)
BEGIN SELECT RAISE(ABORT,'cannot append stages after execution has begun'); END;
CREATE TRIGGER stage_contribution_guard BEFORE INSERT ON stage_contribution
WHEN NOT EXISTS(SELECT 1 FROM stage_source ss JOIN contribution_basis b ON b.source_id=ss.source_id WHERE ss.stage_id=NEW.stage_id AND b.basis_id=NEW.basis_id)
BEGIN SELECT RAISE(ABORT,'stage must reuse contribution from its canonical source'); END;
CREATE TRIGGER measurement_policy_guard BEFORE INSERT ON contribution_measurement
WHEN NOT EXISTS(
 SELECT 1 FROM contribution_basis b JOIN contribution_policy p ON p.policy_id=NEW.policy_id JOIN allowance_standard s ON s.standard_id=p.standard_id
 WHERE b.basis_id=NEW.basis_id AND p.type_id=b.type_id AND s.department_id=b.department_id AND s.effective_from<=NEW.assessed_at
)
BEGIN SELECT RAISE(ABORT,'measurement policy must match contribution type and historical department'); END;
CREATE TRIGGER measurement_completion_guard BEFORE INSERT ON contribution_measurement
WHEN NOT EXISTS(
 SELECT 1 FROM contribution_basis b JOIN business_source s ON s.source_id=b.source_id
 WHERE b.basis_id=NEW.basis_id AND (
 EXISTS(SELECT 1 FROM editorial_archive a WHERE a.editorial_id=s.editorial_id) OR
 EXISTS(SELECT 1 FROM production_archive a WHERE a.booking_id=s.booking_id) OR
 EXISTS(SELECT 1 FROM task_stage t JOIN workflow_completion c ON c.workflow_id=t.workflow_id WHERE t.stage_id=s.stage_id))
)
BEGIN SELECT RAISE(ABORT,'measurement requires archived source or completed workflow'); END;
CREATE TRIGGER report_contribution_guard BEFORE INSERT ON report_contribution
WHEN NOT EXISTS(
 SELECT 1 FROM weekly_report r JOIN contribution_basis b ON b.basis_id=NEW.basis_id
 JOIN report_department d ON d.report_id=r.report_id AND d.department_id=b.department_id
 WHERE r.report_id=NEW.report_id AND r.week_start=date(b.occurred_at,'weekday 0','-6 days')
)
BEGIN SELECT RAISE(ABORT,'report contribution must be in its week and department scope'); END;
CREATE TRIGGER report_pending_guard BEFORE INSERT ON report_pending
WHEN EXISTS(SELECT 1 FROM contribution_measurement m WHERE m.basis_id=NEW.basis_id)
 OR NOT EXISTS(SELECT 1 FROM weekly_report r JOIN contribution_basis b ON b.basis_id=NEW.basis_id JOIN report_department d ON d.report_id=r.report_id AND d.department_id=b.department_id WHERE r.report_id=NEW.report_id AND r.week_start=date(b.occurred_at,'weekday 0','-6 days'))
BEGIN SELECT RAISE(ABORT,'pending item must be unmeasured and within report scope at capture time'); END;

-- Immutable history and rules are append-only. Generated by the maintenance tool.
CREATE TRIGGER work_update_immutable BEFORE UPDATE ON work
BEGIN SELECT RAISE(ABORT,'work is immutable history'); END;
CREATE TRIGGER work_delete_immutable BEFORE DELETE ON work
BEGIN SELECT RAISE(ABORT,'work is immutable history'); END;
CREATE TRIGGER manuscript_version_update_immutable BEFORE UPDATE ON manuscript_version
BEGIN SELECT RAISE(ABORT,'manuscript_version is immutable history'); END;
CREATE TRIGGER manuscript_version_delete_immutable BEFORE DELETE ON manuscript_version
BEGIN SELECT RAISE(ABORT,'manuscript_version is immutable history'); END;
CREATE TRIGGER booking_terms_update_immutable BEFORE UPDATE ON booking_terms
BEGIN SELECT RAISE(ABORT,'booking_terms is immutable history'); END;
CREATE TRIGGER booking_terms_delete_immutable BEFORE DELETE ON booking_terms
BEGIN SELECT RAISE(ABORT,'booking_terms is immutable history'); END;
CREATE TRIGGER editorial_assignment_update_immutable BEFORE UPDATE ON editorial_assignment
BEGIN SELECT RAISE(ABORT,'editorial_assignment is immutable history'); END;
CREATE TRIGGER editorial_assignment_delete_immutable BEFORE DELETE ON editorial_assignment
BEGIN SELECT RAISE(ABORT,'editorial_assignment is immutable history'); END;
CREATE TRIGGER production_assignment_update_immutable BEFORE UPDATE ON production_assignment
BEGIN SELECT RAISE(ABORT,'production_assignment is immutable history'); END;
CREATE TRIGGER production_assignment_delete_immutable BEFORE DELETE ON production_assignment
BEGIN SELECT RAISE(ABORT,'production_assignment is immutable history'); END;
CREATE TRIGGER production_archive_responsibility_update_immutable BEFORE UPDATE ON production_archive_responsibility
BEGIN SELECT RAISE(ABORT,'production_archive_responsibility is immutable history'); END;
CREATE TRIGGER production_archive_responsibility_delete_immutable BEFORE DELETE ON production_archive_responsibility
BEGIN SELECT RAISE(ABORT,'production_archive_responsibility is immutable history'); END;
CREATE TRIGGER business_source_update_immutable BEFORE UPDATE ON business_source
BEGIN SELECT RAISE(ABORT,'business_source is immutable history'); END;
CREATE TRIGGER business_source_delete_immutable BEFORE DELETE ON business_source
BEGIN SELECT RAISE(ABORT,'business_source is immutable history'); END;
CREATE TRIGGER stage_source_update_immutable BEFORE UPDATE ON stage_source
BEGIN SELECT RAISE(ABORT,'stage_source is immutable history'); END;
CREATE TRIGGER stage_source_delete_immutable BEFORE DELETE ON stage_source
BEGIN SELECT RAISE(ABORT,'stage_source is immutable history'); END;
CREATE TRIGGER outcome_update_immutable BEFORE UPDATE ON outcome
BEGIN SELECT RAISE(ABORT,'outcome is immutable history'); END;
CREATE TRIGGER outcome_delete_immutable BEFORE DELETE ON outcome
BEGIN SELECT RAISE(ABORT,'outcome is immutable history'); END;
CREATE TRIGGER outcome_attachment_update_immutable BEFORE UPDATE ON outcome_attachment
BEGIN SELECT RAISE(ABORT,'outcome_attachment is immutable history'); END;
CREATE TRIGGER outcome_attachment_delete_immutable BEFORE DELETE ON outcome_attachment
BEGIN SELECT RAISE(ABORT,'outcome_attachment is immutable history'); END;
CREATE TRIGGER outcome_version_update_immutable BEFORE UPDATE ON outcome_version
BEGIN SELECT RAISE(ABORT,'outcome_version is immutable history'); END;
CREATE TRIGGER outcome_version_delete_immutable BEFORE DELETE ON outcome_version
BEGIN SELECT RAISE(ABORT,'outcome_version is immutable history'); END;
CREATE TRIGGER publication_update_immutable BEFORE UPDATE ON publication
BEGIN SELECT RAISE(ABORT,'publication is immutable history'); END;
CREATE TRIGGER publication_delete_immutable BEFORE DELETE ON publication
BEGIN SELECT RAISE(ABORT,'publication is immutable history'); END;
CREATE TRIGGER manuscript_review_update_immutable BEFORE UPDATE ON manuscript_review
BEGIN SELECT RAISE(ABORT,'manuscript_review is immutable history'); END;
CREATE TRIGGER manuscript_review_delete_immutable BEFORE DELETE ON manuscript_review
BEGIN SELECT RAISE(ABORT,'manuscript_review is immutable history'); END;
CREATE TRIGGER editorial_review_update_immutable BEFORE UPDATE ON editorial_review
BEGIN SELECT RAISE(ABORT,'editorial_review is immutable history'); END;
CREATE TRIGGER editorial_review_delete_immutable BEFORE DELETE ON editorial_review
BEGIN SELECT RAISE(ABORT,'editorial_review is immutable history'); END;
CREATE TRIGGER editorial_review_item_update_immutable BEFORE UPDATE ON editorial_review_item
BEGIN SELECT RAISE(ABORT,'editorial_review_item is immutable history'); END;
CREATE TRIGGER editorial_review_item_delete_immutable BEFORE DELETE ON editorial_review_item
BEGIN SELECT RAISE(ABORT,'editorial_review_item is immutable history'); END;
CREATE TRIGGER editorial_archive_update_immutable BEFORE UPDATE ON editorial_archive
BEGIN SELECT RAISE(ABORT,'editorial_archive is immutable history'); END;
CREATE TRIGGER editorial_archive_delete_immutable BEFORE DELETE ON editorial_archive
BEGIN SELECT RAISE(ABORT,'editorial_archive is immutable history'); END;
CREATE TRIGGER production_archive_update_immutable BEFORE UPDATE ON production_archive
BEGIN SELECT RAISE(ABORT,'production_archive is immutable history'); END;
CREATE TRIGGER production_archive_delete_immutable BEFORE DELETE ON production_archive
BEGIN SELECT RAISE(ABORT,'production_archive is immutable history'); END;
CREATE TRIGGER stage_assignment_update_immutable BEFORE UPDATE ON stage_assignment
BEGIN SELECT RAISE(ABORT,'stage_assignment is immutable history'); END;
CREATE TRIGGER stage_assignment_delete_immutable BEFORE DELETE ON stage_assignment
BEGIN SELECT RAISE(ABORT,'stage_assignment is immutable history'); END;
CREATE TRIGGER stage_confirmation_update_immutable BEFORE UPDATE ON stage_confirmation
BEGIN SELECT RAISE(ABORT,'stage_confirmation is immutable history'); END;
CREATE TRIGGER stage_confirmation_delete_immutable BEFORE DELETE ON stage_confirmation
BEGIN SELECT RAISE(ABORT,'stage_confirmation is immutable history'); END;
CREATE TRIGGER stage_completion_update_immutable BEFORE UPDATE ON stage_completion
BEGIN SELECT RAISE(ABORT,'stage_completion is immutable history'); END;
CREATE TRIGGER stage_completion_delete_immutable BEFORE DELETE ON stage_completion
BEGIN SELECT RAISE(ABORT,'stage_completion is immutable history'); END;
CREATE TRIGGER workflow_completion_update_immutable BEFORE UPDATE ON workflow_completion
BEGIN SELECT RAISE(ABORT,'workflow_completion is immutable history'); END;
CREATE TRIGGER workflow_completion_delete_immutable BEFORE DELETE ON workflow_completion
BEGIN SELECT RAISE(ABORT,'workflow_completion is immutable history'); END;
CREATE TRIGGER allowance_standard_update_immutable BEFORE UPDATE ON allowance_standard
BEGIN SELECT RAISE(ABORT,'allowance_standard is immutable history'); END;
CREATE TRIGGER allowance_standard_delete_immutable BEFORE DELETE ON allowance_standard
BEGIN SELECT RAISE(ABORT,'allowance_standard is immutable history'); END;
CREATE TRIGGER contribution_policy_update_immutable BEFORE UPDATE ON contribution_policy
BEGIN SELECT RAISE(ABORT,'contribution_policy is immutable history'); END;
CREATE TRIGGER contribution_policy_delete_immutable BEFORE DELETE ON contribution_policy
BEGIN SELECT RAISE(ABORT,'contribution_policy is immutable history'); END;
CREATE TRIGGER contribution_basis_update_immutable BEFORE UPDATE ON contribution_basis
BEGIN SELECT RAISE(ABORT,'contribution_basis is immutable history'); END;
CREATE TRIGGER contribution_basis_delete_immutable BEFORE DELETE ON contribution_basis
BEGIN SELECT RAISE(ABORT,'contribution_basis is immutable history'); END;
CREATE TRIGGER stage_contribution_update_immutable BEFORE UPDATE ON stage_contribution
BEGIN SELECT RAISE(ABORT,'stage_contribution is immutable history'); END;
CREATE TRIGGER stage_contribution_delete_immutable BEFORE DELETE ON stage_contribution
BEGIN SELECT RAISE(ABORT,'stage_contribution is immutable history'); END;
CREATE TRIGGER contribution_measurement_update_immutable BEFORE UPDATE ON contribution_measurement
BEGIN SELECT RAISE(ABORT,'contribution_measurement is immutable history'); END;
CREATE TRIGGER contribution_measurement_delete_immutable BEFORE DELETE ON contribution_measurement
BEGIN SELECT RAISE(ABORT,'contribution_measurement is immutable history'); END;
CREATE TRIGGER weekly_report_update_immutable BEFORE UPDATE ON weekly_report
BEGIN SELECT RAISE(ABORT,'weekly_report is immutable history'); END;
CREATE TRIGGER weekly_report_delete_immutable BEFORE DELETE ON weekly_report
BEGIN SELECT RAISE(ABORT,'weekly_report is immutable history'); END;
CREATE TRIGGER report_department_update_immutable BEFORE UPDATE ON report_department
BEGIN SELECT RAISE(ABORT,'report_department is immutable history'); END;
CREATE TRIGGER report_department_delete_immutable BEFORE DELETE ON report_department
BEGIN SELECT RAISE(ABORT,'report_department is immutable history'); END;
CREATE TRIGGER report_contribution_update_immutable BEFORE UPDATE ON report_contribution
BEGIN SELECT RAISE(ABORT,'report_contribution is immutable history'); END;
CREATE TRIGGER report_contribution_delete_immutable BEFORE DELETE ON report_contribution
BEGIN SELECT RAISE(ABORT,'report_contribution is immutable history'); END;
CREATE TRIGGER report_pending_update_immutable BEFORE UPDATE ON report_pending
BEGIN SELECT RAISE(ABORT,'report_pending is immutable history'); END;
CREATE TRIGGER report_pending_delete_immutable BEFORE DELETE ON report_pending
BEGIN SELECT RAISE(ABORT,'report_pending is immutable history'); END;
CREATE TRIGGER report_seal_update_immutable BEFORE UPDATE ON report_seal
BEGIN SELECT RAISE(ABORT,'report_seal is immutable history'); END;
CREATE TRIGGER report_seal_delete_immutable BEFORE DELETE ON report_seal
BEGIN SELECT RAISE(ABORT,'report_seal is immutable history'); END;
CREATE TRIGGER booking_facts_immutable BEFORE UPDATE ON production_booking
WHEN NEW.booking_id<>OLD.booking_id OR NEW.requester_id<>OLD.requester_id OR NEW.terms_id<>OLD.terms_id
 OR NEW.title<>OLD.title OR NEW.starts_at<>OLD.starts_at OR NEW.ends_at<>OLD.ends_at
 OR NEW.location<>OLD.location OR NEW.contact<>OLD.contact OR NEW.submitted_at<>OLD.submitted_at
 OR NEW.urgent_decision<>OLD.urgent_decision
BEGIN SELECT RAISE(ABORT,'accepted booking facts are immutable; only claim_open may change'); END;
CREATE TRIGGER stage_draft_after_completion BEFORE UPDATE ON stage_current_draft
WHEN EXISTS(SELECT 1 FROM stage_completion c WHERE c.stage_id=OLD.stage_id)
BEGIN SELECT RAISE(ABORT,'completed stage draft cannot change'); END;
CREATE TRIGGER stage_draft_insert_after_completion BEFORE INSERT ON stage_current_draft
WHEN EXISTS(SELECT 1 FROM stage_completion c WHERE c.stage_id=NEW.stage_id)
BEGIN SELECT RAISE(ABORT,'completed stage cannot add a draft'); END;
CREATE TRIGGER stage_draft_delete_guard BEFORE DELETE ON stage_current_draft
WHEN EXISTS(SELECT 1 FROM stage_completion c WHERE c.stage_id=OLD.stage_id)
BEGIN SELECT RAISE(ABORT,'completed stage draft cannot be removed'); END;
CREATE TRIGGER stage_definition_update_guard BEFORE UPDATE ON task_stage
WHEN EXISTS(SELECT 1 FROM task_stage s JOIN stage_assignment a ON a.stage_id=s.stage_id WHERE s.workflow_id=OLD.workflow_id)
 OR EXISTS(SELECT 1 FROM workflow_completion c WHERE c.workflow_id=OLD.workflow_id)
BEGIN SELECT RAISE(ABORT,'started workflow stage definitions cannot change'); END;
CREATE TRIGGER stage_definition_delete_guard BEFORE DELETE ON task_stage
WHEN EXISTS(SELECT 1 FROM task_stage s JOIN stage_assignment a ON a.stage_id=s.stage_id WHERE s.workflow_id=OLD.workflow_id)
 OR EXISTS(SELECT 1 FROM workflow_completion c WHERE c.workflow_id=OLD.workflow_id)
BEGIN SELECT RAISE(ABORT,'started workflow stage definitions cannot be removed'); END;
CREATE TRIGGER report_department_sealed_guard BEFORE INSERT ON report_department
WHEN EXISTS(SELECT 1 FROM report_seal s WHERE s.report_id=NEW.report_id)
BEGIN SELECT RAISE(ABORT,'sealed report inputs cannot grow'); END;
CREATE TRIGGER report_contribution_sealed_guard BEFORE INSERT ON report_contribution
WHEN EXISTS(SELECT 1 FROM report_seal s WHERE s.report_id=NEW.report_id)
BEGIN SELECT RAISE(ABORT,'sealed report inputs cannot grow'); END;
CREATE TRIGGER report_pending_sealed_guard BEFORE INSERT ON report_pending
WHEN EXISTS(SELECT 1 FROM report_seal s WHERE s.report_id=NEW.report_id)
BEGIN SELECT RAISE(ABORT,'sealed report inputs cannot grow'); END;
CREATE TRIGGER report_seal_guard BEFORE INSERT ON report_seal
WHEN NOT EXISTS(SELECT 1 FROM report_department d WHERE d.report_id=NEW.report_id)
BEGIN SELECT RAISE(ABORT,'report requires an explicit department scope before sealing'); END;
CREATE TRIGGER report_seal_coverage_guard BEFORE INSERT ON report_seal
WHEN EXISTS(
 SELECT 1 FROM weekly_report r JOIN contribution_basis b
 JOIN report_department d ON d.report_id=r.report_id AND d.department_id=b.department_id
 WHERE r.report_id=NEW.report_id AND date(b.occurred_at,'weekday 0','-6 days')=r.week_start
 AND ((EXISTS(SELECT 1 FROM contribution_measurement m WHERE m.basis_id=b.basis_id)
       AND NOT EXISTS(SELECT 1 FROM report_contribution rc WHERE rc.report_id=r.report_id AND rc.basis_id=b.basis_id))
   OR (NOT EXISTS(SELECT 1 FROM contribution_measurement m WHERE m.basis_id=b.basis_id)
       AND NOT EXISTS(SELECT 1 FROM report_pending rp WHERE rp.report_id=r.report_id AND rp.basis_id=b.basis_id)))
)
BEGIN SELECT RAISE(ABORT,'report must capture every in-scope effective or pending contribution before sealing'); END;
