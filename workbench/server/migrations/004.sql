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
