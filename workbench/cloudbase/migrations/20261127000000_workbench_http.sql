-- Canonical relational data lives here; container copies are disposable transaction workspaces.
CREATE SCHEMA IF NOT EXISTS youth_workbench;
REVOKE ALL ON SCHEMA youth_workbench FROM PUBLIC,anon,authenticated;
SET search_path TO youth_workbench,pg_catalog;
CREATE TABLE IF NOT EXISTS departments(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS users(
 id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN('member','minister','teacher','admin','external')),
 department_id TEXT REFERENCES departments(id),payable BOOLEAN NOT NULL DEFAULT false,active BOOLEAN NOT NULL DEFAULT true,
 CHECK (NOT payable OR (role IN('member','minister') AND department_id IS NOT NULL)));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS tasks(
 id TEXT PRIMARY KEY,number TEXT UNIQUE NOT NULL,title TEXT NOT NULL,creator_id TEXT NOT NULL REFERENCES users(id),
 department_id TEXT NOT NULL REFERENCES departments(id),layout_type TEXT NOT NULL CHECK(layout_type IN('basic','photo','repost')),
 deadline TIMESTAMPTZ NOT NULL,notes TEXT NOT NULL DEFAULT '',open_registration BOOLEAN NOT NULL DEFAULT false,urgent BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS task_reviewers(task_id TEXT REFERENCES tasks(id),user_id TEXT REFERENCES users(id),PRIMARY KEY(task_id,user_id));
CREATE TABLE IF NOT EXISTS assignments(task_id TEXT PRIMARY KEY REFERENCES tasks(id),assignee_id TEXT NOT NULL REFERENCES users(id),actor_id TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),owner_id TEXT NOT NULL REFERENCES users(id),storage_name TEXT NOT NULL,name TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),number INTEGER NOT NULL,body TEXT NOT NULL DEFAULT '',preview_url TEXT NOT NULL DEFAULT '',author_id TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(task_id,number),UNIQUE(task_id,id));
CREATE TABLE IF NOT EXISTS version_files(version_id TEXT REFERENCES versions(id),file_id TEXT REFERENCES files(id),PRIMARY KEY(version_id,file_id));
CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,task_id TEXT NOT NULL,version_id TEXT NOT NULL,stage TEXT NOT NULL CHECK(stage IN('internal','teacher1','teacher2')),decision TEXT NOT NULL CHECK(decision IN('approve','reject')),reason TEXT NOT NULL DEFAULT '',actor_id TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),FOREIGN KEY(task_id,version_id) REFERENCES versions(task_id,id),UNIQUE(version_id,stage),CHECK(decision != 'reject' OR length(trim(reason))>0));
CREATE TABLE IF NOT EXISTS registrations(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),user_id TEXT NOT NULL REFERENCES users(id),notes TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(task_id,user_id));
CREATE TABLE IF NOT EXISTS registration_files(registration_id TEXT REFERENCES registrations(id),file_id TEXT REFERENCES files(id),PRIMARY KEY(registration_id,file_id));
CREATE TABLE IF NOT EXISTS publications(task_id TEXT PRIMARY KEY REFERENCES tasks(id),version_id TEXT NOT NULL,url TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),FOREIGN KEY(task_id,version_id) REFERENCES versions(task_id,id));
CREATE TABLE IF NOT EXISTS archives(id TEXT PRIMARY KEY,task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id),version_id TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),FOREIGN KEY(task_id,version_id) REFERENCES versions(task_id,id));
CREATE TABLE IF NOT EXISTS worklogs(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),user_id TEXT NOT NULL REFERENCES users(id),department_id TEXT NOT NULL REFERENCES departments(id),kind TEXT NOT NULL,rule_name TEXT NOT NULL,base_units INTEGER NOT NULL CHECK(base_units>0),effective_units INTEGER NOT NULL CHECK(effective_units>0),rate_cents INTEGER NOT NULL CHECK(rate_cents>0),confirmed BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(task_id,user_id,kind));
CREATE TABLE IF NOT EXISTS adjustments(id TEXT PRIMARY KEY,log_id TEXT NOT NULL REFERENCES worklogs(id),old_units INTEGER NOT NULL,new_units INTEGER NOT NULL CHECK(new_units>0),reason TEXT NOT NULL CHECK(length(trim(reason))>0),actor_id TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS saved_views(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,config JSONB NOT NULL,UNIQUE(user_id,name));
CREATE TABLE IF NOT EXISTS report_seals(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),start_date DATE NOT NULL,end_date DATE NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),CHECK(end_date>=start_date));
CREATE TABLE IF NOT EXISTS seal_rows(seal_id TEXT REFERENCES report_seals(id),source_id TEXT NOT NULL REFERENCES worklogs(id),data JSONB NOT NULL,PRIMARY KEY(seal_id,source_id));
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),event TEXT NOT NULL,recipient_id TEXT NOT NULL REFERENCES users(id),payload JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'unconfigured',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(task_id,event,recipient_id));
CREATE INDEX IF NOT EXISTS idx_versions_task ON versions(task_id,number DESC);
CREATE INDEX IF NOT EXISTS idx_worklogs_user ON worklogs(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id,created_at);

CREATE TABLE workflow_policy (
 version INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
 rate_cents INTEGER NOT NULL CHECK(rate_cents>0),
 urgent_factor INTEGER NOT NULL CHECK(urgent_factor>=10000),
 photo_window INTEGER NOT NULL CHECK(photo_window>0),
 publication_window INTEGER NOT NULL CHECK(publication_window>0),
 updated_by TEXT REFERENCES users(id), reason TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO workflow_policy(rate_cents,urgent_factor,photo_window,publication_window,reason)
VALUES(1000,15000,48,48,'业务基准 §5');
CREATE TABLE labor_rules(
 id INTEGER PRIMARY KEY, department_id TEXT NOT NULL, name TEXT NOT NULL,
 participant TEXT NOT NULL, unit TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0),
 review BOOLEAN NOT NULL, source TEXT NOT NULL DEFAULT 'BIZ-RULES-FULL.md §4'
);
INSERT INTO labor_rules(id,department_id,name,participant,unit,units,review) VALUES
(1,'editorial','新闻稿创作','创作者','篇',50000,false),
(2,'editorial','新闻稿审核','审核','任务（平分）',20000,true),
(3,'editorial','书推创作','创作者','篇',40000,false),
(4,'editorial','书推审核','审核','任务（平分）',20000,true),
(5,'editorial','人物专访审核','审核','任务（平分）',20000,true),
(6,'editorial','视频制作','创作者','篇',40000,false),
(7,'editorial','纪录时刻创作','创作者','篇',40000,false),
(8,'editorial','纪录时刻审核','审核','任务（平分）',20000,true),
(9,'art','美编基础设计','创作者','篇',30000,false),
(10,'art','美编复杂设计','创作者','篇',60000,false),
(11,'art','美编大型设计','创作者','篇',90000,false),
(12,'art','美编基础审核','审核','任务（平分）',20000,true),
(13,'art','美编大型审核','审核','任务（平分）',20000,true),
(14,'office','大型活动策划','策划负责人','次',40000,false),
(15,'office','大型活动组织','组织者','次',35000,false),
(16,'office','常规审核或归档','审核人员','任务（平分）',20000,true),
(17,'office','采编办公对接','对接干事','人次',40000,false),
(18,'photography','摄制任务完成','摄制干事','次',40000,false),
(19,'photography','摄制任务归档','摄制部审核部长','任务',20000,true),
(20,'operations','运营稿件审核','审核','任务（平分）',20000,true),
(21,'operations','基础排版','排版干事','篇',40000,false),
(22,'operations','影像志排版','排版干事','篇',20000,false),
(23,'operations','内容转载排版','排版干事','篇',10000,false),
(24,'operations','排版审核','审核','任务（平分）',20000,true);
CREATE TABLE rule_revisions(
 policy_version INTEGER REFERENCES workflow_policy(version),
 rule_id INTEGER REFERENCES labor_rules(id), units INTEGER NOT NULL CHECK(units>0),
 PRIMARY KEY(policy_version,rule_id)
);
ALTER TABLE tasks ADD COLUMN kind TEXT NOT NULL DEFAULT 'publication'
 CHECK(kind IN('publication','web_article','photo','request','design','work_entry'));
ALTER TABLE tasks ALTER COLUMN layout_type DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN deadline DROP NOT NULL;
ALTER TABLE tasks ADD COLUMN linked_task_id TEXT REFERENCES tasks(id);
ALTER TABLE tasks ADD COLUMN config_version INTEGER NOT NULL DEFAULT 1 REFERENCES workflow_policy(version);
ALTER TABLE tasks ADD COLUMN reminder_hours NUMERIC(8,2) CHECK(reminder_hours>=0);
CREATE TABLE jobs(
 task_id TEXT PRIMARY KEY REFERENCES tasks(id), review_mode BOOLEAN NOT NULL DEFAULT false,
 rule_id INTEGER REFERENCES labor_rules(id), complexity TEXT CHECK(complexity IN('basic','complex','large')),
 source_department TEXT REFERENCES departments(id), teacher_id TEXT REFERENCES users(id),
 urgent_reason TEXT NOT NULL DEFAULT ''
);
CREATE TABLE bookings(
 task_id TEXT PRIMARY KEY REFERENCES tasks(id),
 location TEXT NOT NULL CHECK(length(trim(location))>0), contact TEXT NOT NULL CHECK(length(trim(contact))>0)
);
CREATE TABLE article_lines(
 task_id TEXT REFERENCES tasks(id), position INTEGER CHECK(position>0),
 title TEXT NOT NULL, site TEXT NOT NULL, original BOOLEAN NOT NULL,
 author_id TEXT REFERENCES users(id), CHECK(NOT original OR author_id IS NOT NULL),
 PRIMARY KEY(task_id,position)
);
ALTER TABLE versions ADD COLUMN phase TEXT NOT NULL DEFAULT 'delivery' CHECK(phase IN('content','delivery'));
ALTER TABLE reviews DROP CONSTRAINT reviews_stage_check;
ALTER TABLE reviews ADD CONSTRAINT reviews_stage_check CHECK(stage IN('internal','teacher1','teacher2','content','acceptance'));
ALTER TABLE archives ALTER COLUMN version_id DROP NOT NULL;
ALTER TABLE archives ADD COLUMN reason TEXT;
ALTER TABLE archives ADD CHECK((reason IS NULL AND version_id IS NOT NULL) OR length(trim(reason))>0);
ALTER TABLE worklogs DROP CONSTRAINT worklogs_task_id_user_id_kind_key;
ALTER TABLE worklogs ADD COLUMN source_key TEXT NOT NULL DEFAULT '';
ALTER TABLE worklogs ADD COLUMN rule_id INTEGER REFERENCES labor_rules(id);
ALTER TABLE worklogs ADD COLUMN rule_version INTEGER NOT NULL DEFAULT 1 REFERENCES workflow_policy(version);
ALTER TABLE worklogs ADD COLUMN multiplier INTEGER NOT NULL DEFAULT 10000 CHECK(multiplier>0);
ALTER TABLE worklogs ADD UNIQUE(task_id,user_id,kind,source_key);
CREATE TABLE work_entries(
 task_id TEXT PRIMARY KEY REFERENCES tasks(id), person_id TEXT NOT NULL REFERENCES users(id),
 week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 53), rule_id INTEGER REFERENCES labor_rules(id)
);
CREATE TABLE duty_slots(
 id TEXT PRIMARY KEY, department_id TEXT REFERENCES departments(id),
 user_id TEXT NOT NULL REFERENCES users(id), start_at TIMESTAMPTZ NOT NULL,
 end_at TIMESTAMPTZ NOT NULL, created_by TEXT NOT NULL REFERENCES users(id),
 CHECK(start_at<end_at)
);
CREATE TABLE reminders(
 task_id TEXT REFERENCES tasks(id), kind TEXT CHECK(kind IN('due','overdue')),
 PRIMARY KEY(task_id,kind)
);
ALTER TABLE outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outbox ADD COLUMN next_attempt TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE outbox ADD COLUMN last_error TEXT;
CREATE INDEX idx_reminder_deadline ON tasks(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX idx_outbox_retry ON outbox(next_attempt) WHERE status IN('pending','failed','unconfigured');

CREATE TABLE publication_routing (
 task_id TEXT PRIMARY KEY REFERENCES tasks(id),
 source_required BOOLEAN NOT NULL DEFAULT false,
 teacher1_id TEXT REFERENCES users(id),
 teacher2_id TEXT REFERENCES users(id),
 CHECK (teacher1_id IS NULL OR teacher2_id IS NULL OR teacher1_id<>teacher2_id)
);
CREATE TABLE publication_defaults (
 singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK(singleton),
 initialized BOOLEAN NOT NULL DEFAULT false,
 teacher1_id TEXT REFERENCES users(id),
 teacher2_id TEXT REFERENCES users(id),
 reviewer1_id TEXT REFERENCES users(id),
 reviewer2_id TEXT REFERENCES users(id),
 CHECK(teacher1_id<>teacher2_id), CHECK(reviewer1_id<>reviewer2_id)
);
INSERT INTO publication_defaults DEFAULT VALUES;
CREATE TABLE teacher_delivery (
 teacher_id TEXT PRIMARY KEY REFERENCES users(id),
 channel TEXT NOT NULL, mention TEXT NOT NULL
);
ALTER TABLE versions DROP CONSTRAINT versions_phase_check;
ALTER TABLE versions ADD CHECK(phase IN('content','delivery','source'));
ALTER TABLE versions ADD COLUMN preview_html TEXT NOT NULL DEFAULT '';
ALTER TABLE reviews DROP CONSTRAINT reviews_stage_check;
ALTER TABLE reviews ADD CHECK(stage IN('internal','teacher1','teacher2','content','acceptance','editorial'));
CREATE TABLE version_annotations (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL, version_id TEXT NOT NULL,
 stage TEXT NOT NULL CHECK(stage IN('editorial','internal','teacher1','teacher2')),
 actor_id TEXT NOT NULL REFERENCES users(id), start_offset INTEGER NOT NULL,
 end_offset INTEGER NOT NULL, quote TEXT NOT NULL, body TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(task_id,version_id) REFERENCES versions(task_id,id),
 CHECK(start_offset>=0 AND end_offset>start_offset)
);
CREATE INDEX version_annotations_version_idx ON version_annotations(version_id,created_at);
CREATE TABLE flow_defaults (
 department_id TEXT REFERENCES departments(id), kind TEXT NOT NULL
  CHECK(kind IN('publication','web_article','photo','request','design')),
 assignee_id TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(department_id,kind)
);
ALTER TABLE assignments ADD COLUMN automatic BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE tasks ADD COLUMN report_note TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_adjustments_log_latest ON adjustments(log_id,created_at DESC,id DESC);

CREATE TABLE duty_rotation (
 department_id TEXT PRIMARY KEY REFERENCES departments(id),
 last_user_id TEXT REFERENCES users(id),
 updated_by TEXT NOT NULL REFERENCES users(id)
);
CREATE TABLE duty_rotation_members (
 department_id TEXT NOT NULL REFERENCES duty_rotation(department_id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id),
 position INTEGER NOT NULL CHECK(position>0),
 PRIMARY KEY(department_id,user_id),
 UNIQUE(department_id,position)
);

CREATE TABLE file_payloads (
 file_id TEXT PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
 content BYTEA NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 12582912)
);

CREATE TABLE _state(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),revision bigint NOT NULL DEFAULT 0);
INSERT INTO _state DEFAULT VALUES;
CREATE TABLE _requests(id text PRIMARY KEY,digest text NOT NULL,result jsonb,revision bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON _requests(created_at);
CREATE TABLE _uploads(id text PRIMARY KEY,object_key text NOT NULL UNIQUE,sha256 text NOT NULL,size integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON ALL TABLES IN SCHEMA youth_workbench FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA youth_workbench FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA youth_workbench REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.wb_snapshot(p_since bigint DEFAULT -1) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,youth_workbench AS $fn$
DECLARE rev bigint; tab text; data jsonb='{}'; rows jsonb;
BEGIN
 SELECT revision INTO rev FROM youth_workbench._state WHERE singleton;
 IF rev=p_since THEN RETURN jsonb_build_object('revision',rev); END IF;
 FOREACH tab IN ARRAY ARRAY['adjustments','archives','article_lines','assignments','bookings','departments','duty_rotation','duty_rotation_members','duty_slots','events','file_payloads','files','flow_defaults','jobs','labor_rules','outbox','publication_defaults','publication_routing','publications','registration_files','registrations','reminders','report_seals','reviews','rule_revisions','saved_views','seal_rows','sessions','task_reviewers','tasks','teacher_delivery','users','version_annotations','version_files','versions','work_entries','workflow_policy','worklogs']::text[] LOOP
  -- File bytes use private object storage; never copy them into a transaction workspace.
  IF tab='file_payloads' THEN rows='[]'; ELSE
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) FROM youth_workbench.%I t',tab) INTO rows;
  END IF;
  data=data||jsonb_build_object(tab,rows);
 END LOOP;
 RETURN jsonb_build_object('revision',rev,'tables',data);
END $fn$;

CREATE FUNCTION public.wb_command(p_request_id text,p_digest text,p_revision bigint,p_changes jsonb,p_result jsonb,p_auth jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,youth_workbench AS $fn$
DECLARE rev bigint; previous youth_workbench._requests; change jsonb; tab text; op text; cols text; assignments text; predicate text; affected bigint; row_data jsonb; actor youth_workbench.users;
BEGIN
 IF length(p_request_id)>180 OR length(p_request_id)<1 OR p_digest !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_changes)!='array' OR jsonb_array_length(p_changes)>20000 THEN
  RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023'; END IF;
 SELECT revision INTO rev FROM youth_workbench._state WHERE singleton FOR UPDATE;
 -- Repeat authorization inside the same transaction as the writes.
 IF p_auth IS NOT NULL THEN
  SELECT u.* INTO actor FROM youth_workbench.sessions s JOIN youth_workbench.users u ON u.id=s.user_id
   WHERE s.token_hash=p_auth->>'session' AND s.expires_at>now() AND u.active AND u.id=p_auth->>'id';
  IF actor.id IS NULL OR actor.role IS DISTINCT FROM p_auth->>'role' OR actor.department_id IS DISTINCT FROM p_auth->>'department_id'
   OR actor.payable IS DISTINCT FROM (p_auth->>'payable')::boolean THEN
   RAISE EXCEPTION 'Session changed' USING ERRCODE='28000'; END IF;
 END IF;
 SELECT * INTO previous FROM youth_workbench._requests WHERE id=p_request_id;
 IF FOUND THEN
  IF previous.digest!=p_digest THEN RAISE EXCEPTION 'Request key reused' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('revision',previous.revision,'result',previous.result,'duplicate',true);
 END IF;
 IF rev!=p_revision THEN RETURN jsonb_build_object('conflict',true,'revision',rev); END IF;
 FOR change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
  tab=change->>'table'; op=change->>'op';
  -- Only fixed application tables are writable. No SQL, schema, column expressions or function names are accepted.
  IF NOT tab=ANY(ARRAY['adjustments','archives','article_lines','assignments','bookings','departments','duty_rotation','duty_rotation_members','duty_slots','events','file_payloads','files','flow_defaults','jobs','labor_rules','outbox','publication_defaults','publication_routing','publications','registration_files','registrations','reminders','report_seals','reviews','rule_revisions','saved_views','seal_rows','sessions','task_reviewers','tasks','teacher_delivery','users','version_annotations','version_files','versions','work_entries','workflow_policy','worklogs']::text[]) OR tab='file_payloads' OR op NOT IN('INSERT','UPDATE','DELETE') THEN
   RAISE EXCEPTION 'Unknown mutation target' USING ERRCODE='22023'; END IF;
  SELECT string_agg(format('%I',a.attname),',' ORDER BY a.attnum),
   string_agg(format('%I=r.%I',a.attname,a.attname),',' ORDER BY a.attnum)
   INTO cols,assignments FROM pg_attribute a WHERE a.attrelid=format('youth_workbench.%I',tab)::regclass AND a.attnum>0 AND NOT a.attisdropped;
  SELECT string_agg(format('t.%I IS NOT DISTINCT FROM k.%I',a.attname,a.attname),' AND ' ORDER BY a.attnum)
   INTO predicate FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey)
   WHERE i.indrelid=format('youth_workbench.%I',tab)::regclass AND i.indisprimary;
  IF predicate IS NULL THEN RAISE EXCEPTION 'Missing primary key'; END IF;
  row_data=change->'new';
  IF op='INSERT' THEN
   EXECUTE format('INSERT INTO youth_workbench.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::youth_workbench.%I,$1) r',tab,cols,cols,tab) USING row_data;
  ELSIF op='UPDATE' THEN
   EXECUTE format('UPDATE youth_workbench.%I t SET %s FROM jsonb_populate_record(NULL::youth_workbench.%I,$1) r,jsonb_populate_record(NULL::youth_workbench.%I,$2) k WHERE %s',tab,assignments,tab,tab,predicate) USING row_data,change->'old';
  ELSE
   EXECUTE format('DELETE FROM youth_workbench.%I t USING jsonb_populate_record(NULL::youth_workbench.%I,$1) k WHERE %s',tab,tab,predicate) USING change->'old';
  END IF;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected!=1 THEN RAISE EXCEPTION 'Mutation lost its row' USING ERRCODE='40001'; END IF;
 END LOOP;
 UPDATE youth_workbench._state SET revision=revision+1 WHERE singleton RETURNING revision INTO rev;
 INSERT INTO youth_workbench._requests(id,digest,result,revision) VALUES(p_request_id,p_digest,p_result,rev);
 RETURN jsonb_build_object('revision',rev,'result',p_result,'duplicate',false);
END $fn$;

CREATE FUNCTION public.wb_upload(p_id text,p_key text DEFAULT NULL,p_sha256 text DEFAULT NULL,p_size integer DEFAULT NULL,p_action text DEFAULT 'prepare') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,youth_workbench AS $fn$
BEGIN
 IF p_action='prepare' THEN
  IF p_key !~ '^attachments/[a-f0-9-]+$' OR p_sha256 !~ '^[a-f0-9]{64}$' OR p_size NOT BETWEEN 1 AND 12582912 THEN RAISE EXCEPTION 'Invalid upload'; END IF;
  INSERT INTO youth_workbench._uploads(id,object_key,sha256,size) VALUES(p_id,p_key,p_sha256,p_size) ON CONFLICT DO NOTHING;
 ELSIF p_action='complete' THEN
  DELETE FROM youth_workbench._uploads u WHERE u.id=p_id AND EXISTS(SELECT 1 FROM youth_workbench.files f WHERE f.id=u.id AND f.storage_name=u.object_key AND f.sha256=u.sha256);
 ELSIF p_action='cancel' THEN
  DELETE FROM youth_workbench._uploads u WHERE u.id=p_id AND NOT EXISTS(SELECT 1 FROM youth_workbench.files f WHERE f.id=u.id);
 ELSE RAISE EXCEPTION 'Invalid upload action'; END IF;
 RETURN jsonb_build_object('ok',true);
END $fn$;
CREATE FUNCTION public.wb_upload_orphans() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,youth_workbench AS $fn$
 SELECT coalesce(jsonb_agg(to_jsonb(u)),'[]'::jsonb) FROM youth_workbench._uploads u WHERE created_at<now()-interval '1 hour'
 AND NOT EXISTS(SELECT 1 FROM youth_workbench.files f WHERE f.id=u.id)
$fn$;
REVOKE ALL ON FUNCTION public.wb_snapshot(bigint),public.wb_command(text,text,bigint,jsonb,jsonb,jsonb),public.wb_upload(text,text,text,integer,text),public.wb_upload_orphans() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wb_snapshot(bigint),public.wb_command(text,text,bigint,jsonb,jsonb,jsonb),public.wb_upload(text,text,text,integer,text),public.wb_upload_orphans() TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('workbench-private','workbench-private',false,12582912) ON CONFLICT(id) DO NOTHING;
-- No anonymous/authenticated storage policy: only the API backend accesses this bucket.
RESET search_path;
NOTIFY pgrst,'reload schema';
