// Generates a reviewable migration. Never overwrite an already applied version.
import {openDatabase} from '../server/db.js';
import {readFile,writeFile} from 'node:fs/promises';
const db=await openDatabase({memory:true,url:null});
const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename!='schema_migrations' ORDER BY tablename")).rows.map(r=>r.tablename);
await db.close();
const ddl=(await Promise.all(['001','002','003','004','005'].map(v=>readFile(new URL('../server/migrations/'+v+'.sql',import.meta.url),'utf8')))).join('\n');
const tableArray='ARRAY['+tables.map(t=>"'"+t+"'").join(',')+']::text[]';
const sql=`-- Canonical relational data lives here; container copies are disposable transaction workspaces.
CREATE SCHEMA IF NOT EXISTS youth_workbench;
REVOKE ALL ON SCHEMA youth_workbench FROM PUBLIC,anon,authenticated;
SET search_path TO youth_workbench,pg_catalog;
${ddl}
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
 FOREACH tab IN ARRAY ${tableArray} LOOP
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
  IF NOT tab=ANY(${tableArray}) OR tab='file_payloads' OR op NOT IN('INSERT','UPDATE','DELETE') THEN
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
`;
const target=new URL('../cloudbase/migrations/20261127000000_workbench_http.sql',import.meta.url);
await writeFile(target,sql,{flag:'wx'});
console.log('Created immutable migration with '+tables.length+' relational tables');
