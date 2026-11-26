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
