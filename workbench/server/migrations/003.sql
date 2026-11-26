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
