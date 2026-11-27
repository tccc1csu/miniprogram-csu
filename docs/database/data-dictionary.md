# 当前PostgreSQL数据字典

版本2.0；从应用迁移001–005构建隔离空库后读取pg_catalog。无业务数据、账号密码或连接串。38张业务表、214字段、79外键；不含迁移记录和云适配辅助表。

| 表 | 职责 | 字段数 |
| --- | --- | --- |
| adjustments | 核定审计 | 7 |
| archives | 归档事实 | 5 |
| article_lines | 稿件站点行 | 6 |
| assignments | 承接安排 | 5 |
| bookings | 预约资料 | 3 |
| departments | 部门 | 2 |
| duty_rotation | 轮转指针 | 3 |
| duty_rotation_members | 轮转成员 | 3 |
| duty_slots | 历史时段表 | 6 |
| events | 任务审计 | 6 |
| file_payloads | 附件兼容载荷 | 2 |
| files | 附件元数据 | 8 |
| flow_defaults | 默认承接 | 5 |
| jobs | 部门任务扩展 | 7 |
| labor_rules | 工时规则 | 8 |
| outbox | 通知发件箱 | 10 |
| publication_defaults | 推文默认配置 | 6 |
| publication_routing | 推文教师路由 | 4 |
| publications | 发布事实 | 5 |
| registration_files | 报名附件 | 2 |
| registrations | 公开报名 | 5 |
| reminders | 提醒去重 | 2 |
| report_seals | 封存批次 | 6 |
| reviews | 审核事件 | 8 |
| rule_revisions | 规则修订 | 3 |
| saved_views | 个人报表视图 | 4 |
| seal_rows | 封存行快照 | 3 |
| sessions | 会话 | 3 |
| task_reviewers | 审校岗位安排 | 2 |
| tasks | 任务 | 16 |
| teacher_delivery | 教师通知路由 | 3 |
| users | 账号 | 8 |
| version_annotations | 选区批注 | 10 |
| version_files | 版本附件 | 2 |
| versions | 稿件版本 | 9 |
| work_entries | 人工登记 | 4 |
| workflow_policy | 政策版本 | 8 |
| worklogs | 工时贡献 | 15 |

## adjustments — 核定审计

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| log_id | text | 是 | — |
| old_units | integer | 是 | — |
| new_units | integer | 是 | — |
| reason | text | 是 | — |
| actor_id | text | 是 | — |
| created_at | timestamp with time zone | 是 | now() |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| adjustments_new_units_check | 检查 | CHECK ((new_units > 0)) |
| adjustments_reason_check | 检查 | CHECK ((length(TRIM(BOTH FROM reason)) > 0)) |
| adjustments_actor_id_fkey | 外键 | FOREIGN KEY (actor_id) REFERENCES users(id) |
| adjustments_log_id_fkey | 外键 | FOREIGN KEY (log_id) REFERENCES worklogs(id) |
| adjustments_actor_id_not_null | n | NOT NULL actor_id |
| adjustments_created_at_not_null | n | NOT NULL created_at |
| adjustments_id_not_null | n | NOT NULL id |
| adjustments_log_id_not_null | n | NOT NULL log_id |
| adjustments_new_units_not_null | n | NOT NULL new_units |
| adjustments_old_units_not_null | n | NOT NULL old_units |
| adjustments_reason_not_null | n | NOT NULL reason |
| adjustments_pkey | 主键 | PRIMARY KEY (id) |

| 索引 | 定义 |
| --- | --- |
| adjustments_pkey | CREATE UNIQUE INDEX adjustments_pkey ON public.adjustments USING btree (id) |
| idx_adjustments_log_latest | CREATE INDEX idx_adjustments_log_latest ON public.adjustments USING btree (log_id, created_at DESC, id DESC) |

## archives — 归档事实

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| task_id | text | 是 | — |
| version_id | text | 否 | — |
| created_at | timestamp with time zone | 是 | now() |
| reason | text | 否 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| archives_check | 检查 | CHECK ((((reason IS NULL) AND (version_id IS NOT NULL)) OR (length(TRIM(BOTH FROM reason)) > 0))) |
| archives_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| archives_task_id_version_id_fkey | 外键 | FOREIGN KEY (task_id, version_id) REFERENCES versions(task_id, id) |
| archives_created_at_not_null | n | NOT NULL created_at |
| archives_id_not_null | n | NOT NULL id |
| archives_task_id_not_null | n | NOT NULL task_id |
| archives_pkey | 主键 | PRIMARY KEY (id) |
| archives_task_id_key | 唯一 | UNIQUE (task_id) |

| 索引 | 定义 |
| --- | --- |
| archives_pkey | CREATE UNIQUE INDEX archives_pkey ON public.archives USING btree (id) |
| archives_task_id_key | CREATE UNIQUE INDEX archives_task_id_key ON public.archives USING btree (task_id) |

## article_lines — 稿件站点行

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| task_id | text | 是 | — |
| position | integer | 是 | — |
| title | text | 是 | — |
| site | text | 是 | — |
| original | boolean | 是 | — |
| author_id | text | 否 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| article_lines_check | 检查 | CHECK (((NOT original) OR (author_id IS NOT NULL))) |
| article_lines_position_check | 检查 | CHECK (("position" > 0)) |
| article_lines_author_id_fkey | 外键 | FOREIGN KEY (author_id) REFERENCES users(id) |
| article_lines_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| article_lines_original_not_null | n | NOT NULL original |
| article_lines_position_not_null | n | NOT NULL "position" |
| article_lines_site_not_null | n | NOT NULL site |
| article_lines_task_id_not_null | n | NOT NULL task_id |
| article_lines_title_not_null | n | NOT NULL title |
| article_lines_pkey | 主键 | PRIMARY KEY (task_id, "position") |

| 索引 | 定义 |
| --- | --- |
| article_lines_pkey | CREATE UNIQUE INDEX article_lines_pkey ON public.article_lines USING btree (task_id, "position") |

## assignments — 承接安排

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| task_id | text | 是 | — |
| assignee_id | text | 是 | — |
| actor_id | text | 是 | — |
| created_at | timestamp with time zone | 是 | now() |
| automatic | boolean | 是 | false |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| assignments_actor_id_fkey | 外键 | FOREIGN KEY (actor_id) REFERENCES users(id) |
| assignments_assignee_id_fkey | 外键 | FOREIGN KEY (assignee_id) REFERENCES users(id) |
| assignments_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| assignments_actor_id_not_null | n | NOT NULL actor_id |
| assignments_assignee_id_not_null | n | NOT NULL assignee_id |
| assignments_automatic_not_null | n | NOT NULL automatic |
| assignments_created_at_not_null | n | NOT NULL created_at |
| assignments_task_id_not_null | n | NOT NULL task_id |
| assignments_pkey | 主键 | PRIMARY KEY (task_id) |

| 索引 | 定义 |
| --- | --- |
| assignments_pkey | CREATE UNIQUE INDEX assignments_pkey ON public.assignments USING btree (task_id) |

## bookings — 预约资料

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| task_id | text | 是 | — |
| location | text | 是 | — |
| contact | text | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| bookings_contact_check | 检查 | CHECK ((length(TRIM(BOTH FROM contact)) > 0)) |
| bookings_location_check | 检查 | CHECK ((length(TRIM(BOTH FROM location)) > 0)) |
| bookings_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| bookings_contact_not_null | n | NOT NULL contact |
| bookings_location_not_null | n | NOT NULL location |
| bookings_task_id_not_null | n | NOT NULL task_id |
| bookings_pkey | 主键 | PRIMARY KEY (task_id) |

| 索引 | 定义 |
| --- | --- |
| bookings_pkey | CREATE UNIQUE INDEX bookings_pkey ON public.bookings USING btree (task_id) |

## departments — 部门

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| name | text | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| departments_id_not_null | n | NOT NULL id |
| departments_name_not_null | n | NOT NULL name |
| departments_pkey | 主键 | PRIMARY KEY (id) |
| departments_name_key | 唯一 | UNIQUE (name) |

| 索引 | 定义 |
| --- | --- |
| departments_name_key | CREATE UNIQUE INDEX departments_name_key ON public.departments USING btree (name) |
| departments_pkey | CREATE UNIQUE INDEX departments_pkey ON public.departments USING btree (id) |

## duty_rotation — 轮转指针

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| department_id | text | 是 | — |
| last_user_id | text | 否 | — |
| updated_by | text | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| duty_rotation_department_id_fkey | 外键 | FOREIGN KEY (department_id) REFERENCES departments(id) |
| duty_rotation_last_user_id_fkey | 外键 | FOREIGN KEY (last_user_id) REFERENCES users(id) |
| duty_rotation_updated_by_fkey | 外键 | FOREIGN KEY (updated_by) REFERENCES users(id) |
| duty_rotation_department_id_not_null | n | NOT NULL department_id |
| duty_rotation_updated_by_not_null | n | NOT NULL updated_by |
| duty_rotation_pkey | 主键 | PRIMARY KEY (department_id) |

| 索引 | 定义 |
| --- | --- |
| duty_rotation_pkey | CREATE UNIQUE INDEX duty_rotation_pkey ON public.duty_rotation USING btree (department_id) |

## duty_rotation_members — 轮转成员

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| department_id | text | 是 | — |
| user_id | text | 是 | — |
| position | integer | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| duty_rotation_members_position_check | 检查 | CHECK (("position" > 0)) |
| duty_rotation_members_department_id_fkey | 外键 | FOREIGN KEY (department_id) REFERENCES duty_rotation(department_id) ON DELETE CASCADE |
| duty_rotation_members_user_id_fkey | 外键 | FOREIGN KEY (user_id) REFERENCES users(id) |
| duty_rotation_members_department_id_not_null | n | NOT NULL department_id |
| duty_rotation_members_position_not_null | n | NOT NULL "position" |
| duty_rotation_members_user_id_not_null | n | NOT NULL user_id |
| duty_rotation_members_pkey | 主键 | PRIMARY KEY (department_id, user_id) |
| duty_rotation_members_department_id_position_key | 唯一 | UNIQUE (department_id, "position") |

| 索引 | 定义 |
| --- | --- |
| duty_rotation_members_department_id_position_key | CREATE UNIQUE INDEX duty_rotation_members_department_id_position_key ON public.duty_rotation_members USING btree (department_id, "position") |
| duty_rotation_members_pkey | CREATE UNIQUE INDEX duty_rotation_members_pkey ON public.duty_rotation_members USING btree (department_id, user_id) |

## duty_slots — 历史时段表

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| department_id | text | 否 | — |
| user_id | text | 是 | — |
| start_at | timestamp with time zone | 是 | — |
| end_at | timestamp with time zone | 是 | — |
| created_by | text | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| duty_slots_check | 检查 | CHECK ((start_at < end_at)) |
| duty_slots_created_by_fkey | 外键 | FOREIGN KEY (created_by) REFERENCES users(id) |
| duty_slots_department_id_fkey | 外键 | FOREIGN KEY (department_id) REFERENCES departments(id) |
| duty_slots_user_id_fkey | 外键 | FOREIGN KEY (user_id) REFERENCES users(id) |
| duty_slots_created_by_not_null | n | NOT NULL created_by |
| duty_slots_end_at_not_null | n | NOT NULL end_at |
| duty_slots_id_not_null | n | NOT NULL id |
| duty_slots_start_at_not_null | n | NOT NULL start_at |
| duty_slots_user_id_not_null | n | NOT NULL user_id |
| duty_slots_pkey | 主键 | PRIMARY KEY (id) |

| 索引 | 定义 |
| --- | --- |
| duty_slots_pkey | CREATE UNIQUE INDEX duty_slots_pkey ON public.duty_slots USING btree (id) |

## events — 任务审计

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| task_id | text | 是 | — |
| actor_id | text | 是 | — |
| action | text | 是 | — |
| detail | text | 是 | ''::text |
| created_at | timestamp with time zone | 是 | now() |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| events_actor_id_fkey | 外键 | FOREIGN KEY (actor_id) REFERENCES users(id) |
| events_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| events_action_not_null | n | NOT NULL action |
| events_actor_id_not_null | n | NOT NULL actor_id |
| events_created_at_not_null | n | NOT NULL created_at |
| events_detail_not_null | n | NOT NULL detail |
| events_id_not_null | n | NOT NULL id |
| events_task_id_not_null | n | NOT NULL task_id |
| events_pkey | 主键 | PRIMARY KEY (id) |

| 索引 | 定义 |
| --- | --- |
| events_pkey | CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id) |
| idx_events_task | CREATE INDEX idx_events_task ON public.events USING btree (task_id, created_at) |

## file_payloads — 附件兼容载荷

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| file_id | text | 是 | — |
| content | bytea | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| file_payloads_content_check | 检查 | CHECK (((octet_length(content) >= 1) AND (octet_length(content) <= 12582912))) |
| file_payloads_file_id_fkey | 外键 | FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE |
| file_payloads_content_not_null | n | NOT NULL content |
| file_payloads_file_id_not_null | n | NOT NULL file_id |
| file_payloads_pkey | 主键 | PRIMARY KEY (file_id) |

| 索引 | 定义 |
| --- | --- |
| file_payloads_pkey | CREATE UNIQUE INDEX file_payloads_pkey ON public.file_payloads USING btree (file_id) |

## files — 附件元数据

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| task_id | text | 是 | — |
| owner_id | text | 是 | — |
| storage_name | text | 是 | — |
| name | text | 是 | — |
| size | integer | 是 | — |
| sha256 | text | 是 | — |
| created_at | timestamp with time zone | 是 | now() |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| files_owner_id_fkey | 外键 | FOREIGN KEY (owner_id) REFERENCES users(id) |
| files_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| files_created_at_not_null | n | NOT NULL created_at |
| files_id_not_null | n | NOT NULL id |
| files_name_not_null | n | NOT NULL name |
| files_owner_id_not_null | n | NOT NULL owner_id |
| files_sha256_not_null | n | NOT NULL sha256 |
| files_size_not_null | n | NOT NULL size |
| files_storage_name_not_null | n | NOT NULL storage_name |
| files_task_id_not_null | n | NOT NULL task_id |
| files_pkey | 主键 | PRIMARY KEY (id) |

| 索引 | 定义 |
| --- | --- |
| files_pkey | CREATE UNIQUE INDEX files_pkey ON public.files USING btree (id) |

## flow_defaults — 默认承接

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| department_id | text | 是 | — |
| kind | text | 是 | — |
| assignee_id | text | 是 | — |
| updated_by | text | 是 | — |
| updated_at | timestamp with time zone | 是 | now() |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| flow_defaults_kind_check | 检查 | CHECK ((kind = ANY (ARRAY['publication'::text, 'web_article'::text, 'photo'::text, 'request'::text, 'design'::text]))) |
| flow_defaults_assignee_id_fkey | 外键 | FOREIGN KEY (assignee_id) REFERENCES users(id) |
| flow_defaults_department_id_fkey | 外键 | FOREIGN KEY (department_id) REFERENCES departments(id) |
| flow_defaults_updated_by_fkey | 外键 | FOREIGN KEY (updated_by) REFERENCES users(id) |
| flow_defaults_assignee_id_not_null | n | NOT NULL assignee_id |
| flow_defaults_department_id_not_null | n | NOT NULL department_id |
| flow_defaults_kind_not_null | n | NOT NULL kind |
| flow_defaults_updated_at_not_null | n | NOT NULL updated_at |
| flow_defaults_updated_by_not_null | n | NOT NULL updated_by |
| flow_defaults_pkey | 主键 | PRIMARY KEY (department_id, kind) |

| 索引 | 定义 |
| --- | --- |
| flow_defaults_pkey | CREATE UNIQUE INDEX flow_defaults_pkey ON public.flow_defaults USING btree (department_id, kind) |

## jobs — 部门任务扩展

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| task_id | text | 是 | — |
| review_mode | boolean | 是 | false |
| rule_id | integer | 否 | — |
| complexity | text | 否 | — |
| source_department | text | 否 | — |
| teacher_id | text | 否 | — |
| urgent_reason | text | 是 | ''::text |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| jobs_complexity_check | 检查 | CHECK ((complexity = ANY (ARRAY['basic'::text, 'complex'::text, 'large'::text]))) |
| jobs_rule_id_fkey | 外键 | FOREIGN KEY (rule_id) REFERENCES labor_rules(id) |
| jobs_source_department_fkey | 外键 | FOREIGN KEY (source_department) REFERENCES departments(id) |
| jobs_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| jobs_teacher_id_fkey | 外键 | FOREIGN KEY (teacher_id) REFERENCES users(id) |
| jobs_review_mode_not_null | n | NOT NULL review_mode |
| jobs_task_id_not_null | n | NOT NULL task_id |
| jobs_urgent_reason_not_null | n | NOT NULL urgent_reason |
| jobs_pkey | 主键 | PRIMARY KEY (task_id) |

| 索引 | 定义 |
| --- | --- |
| jobs_pkey | CREATE UNIQUE INDEX jobs_pkey ON public.jobs USING btree (task_id) |

## labor_rules — 工时规则

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | integer | 是 | — |
| department_id | text | 是 | — |
| name | text | 是 | — |
| participant | text | 是 | — |
| unit | text | 是 | — |
| units | integer | 是 | — |
| review | boolean | 是 | — |
| source | text | 是 | 'BIZ-RULES-FULL.md §4'::text |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| labor_rules_units_check | 检查 | CHECK ((units > 0)) |
| labor_rules_department_id_not_null | n | NOT NULL department_id |
| labor_rules_id_not_null | n | NOT NULL id |
| labor_rules_name_not_null | n | NOT NULL name |
| labor_rules_participant_not_null | n | NOT NULL participant |
| labor_rules_review_not_null | n | NOT NULL review |
| labor_rules_source_not_null | n | NOT NULL source |
| labor_rules_unit_not_null | n | NOT NULL unit |
| labor_rules_units_not_null | n | NOT NULL units |
| labor_rules_pkey | 主键 | PRIMARY KEY (id) |

| 索引 | 定义 |
| --- | --- |
| labor_rules_pkey | CREATE UNIQUE INDEX labor_rules_pkey ON public.labor_rules USING btree (id) |

## outbox — 通知发件箱

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| task_id | text | 是 | — |
| event | text | 是 | — |
| recipient_id | text | 是 | — |
| payload | jsonb | 是 | — |
| status | text | 是 | 'unconfigured'::text |
| created_at | timestamp with time zone | 是 | now() |
| attempts | integer | 是 | 0 |
| next_attempt | timestamp with time zone | 是 | now() |
| last_error | text | 否 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| outbox_recipient_id_fkey | 外键 | FOREIGN KEY (recipient_id) REFERENCES users(id) |
| outbox_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| outbox_attempts_not_null | n | NOT NULL attempts |
| outbox_created_at_not_null | n | NOT NULL created_at |
| outbox_event_not_null | n | NOT NULL event |
| outbox_id_not_null | n | NOT NULL id |
| outbox_next_attempt_not_null | n | NOT NULL next_attempt |
| outbox_payload_not_null | n | NOT NULL payload |
| outbox_recipient_id_not_null | n | NOT NULL recipient_id |
| outbox_status_not_null | n | NOT NULL status |
| outbox_task_id_not_null | n | NOT NULL task_id |
| outbox_pkey | 主键 | PRIMARY KEY (id) |
| outbox_task_id_event_recipient_id_key | 唯一 | UNIQUE (task_id, event, recipient_id) |

| 索引 | 定义 |
| --- | --- |
| idx_outbox_retry | CREATE INDEX idx_outbox_retry ON public.outbox USING btree (next_attempt) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text, 'unconfigured'::text])) |
| outbox_pkey | CREATE UNIQUE INDEX outbox_pkey ON public.outbox USING btree (id) |
| outbox_task_id_event_recipient_id_key | CREATE UNIQUE INDEX outbox_task_id_event_recipient_id_key ON public.outbox USING btree (task_id, event, recipient_id) |

## publication_defaults — 推文默认配置

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| singleton | boolean | 是 | true |
| initialized | boolean | 是 | false |
| teacher1_id | text | 否 | — |
| teacher2_id | text | 否 | — |
| reviewer1_id | text | 否 | — |
| reviewer2_id | text | 否 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| publication_defaults_check | 检查 | CHECK ((teacher1_id <> teacher2_id)) |
| publication_defaults_check1 | 检查 | CHECK ((reviewer1_id <> reviewer2_id)) |
| publication_defaults_singleton_check | 检查 | CHECK (singleton) |
| publication_defaults_reviewer1_id_fkey | 外键 | FOREIGN KEY (reviewer1_id) REFERENCES users(id) |
| publication_defaults_reviewer2_id_fkey | 外键 | FOREIGN KEY (reviewer2_id) REFERENCES users(id) |
| publication_defaults_teacher1_id_fkey | 外键 | FOREIGN KEY (teacher1_id) REFERENCES users(id) |
| publication_defaults_teacher2_id_fkey | 外键 | FOREIGN KEY (teacher2_id) REFERENCES users(id) |
| publication_defaults_initialized_not_null | n | NOT NULL initialized |
| publication_defaults_singleton_not_null | n | NOT NULL singleton |
| publication_defaults_pkey | 主键 | PRIMARY KEY (singleton) |

| 索引 | 定义 |
| --- | --- |
| publication_defaults_pkey | CREATE UNIQUE INDEX publication_defaults_pkey ON public.publication_defaults USING btree (singleton) |

## publication_routing — 推文教师路由

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| task_id | text | 是 | — |
| source_required | boolean | 是 | false |
| teacher1_id | text | 否 | — |
| teacher2_id | text | 否 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| publication_routing_check | 检查 | CHECK (((teacher1_id IS NULL) OR (teacher2_id IS NULL) OR (teacher1_id <> teacher2_id))) |
| publication_routing_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| publication_routing_teacher1_id_fkey | 外键 | FOREIGN KEY (teacher1_id) REFERENCES users(id) |
| publication_routing_teacher2_id_fkey | 外键 | FOREIGN KEY (teacher2_id) REFERENCES users(id) |
| publication_routing_source_required_not_null | n | NOT NULL source_required |
| publication_routing_task_id_not_null | n | NOT NULL task_id |
| publication_routing_pkey | 主键 | PRIMARY KEY (task_id) |

| 索引 | 定义 |
| --- | --- |
| publication_routing_pkey | CREATE UNIQUE INDEX publication_routing_pkey ON public.publication_routing USING btree (task_id) |

## publications — 发布事实

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| task_id | text | 是 | — |
| version_id | text | 是 | — |
| url | text | 是 | — |
| actor_id | text | 是 | — |
| created_at | timestamp with time zone | 是 | now() |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| publications_actor_id_fkey | 外键 | FOREIGN KEY (actor_id) REFERENCES users(id) |
| publications_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| publications_task_id_version_id_fkey | 外键 | FOREIGN KEY (task_id, version_id) REFERENCES versions(task_id, id) |
| publications_actor_id_not_null | n | NOT NULL actor_id |
| publications_created_at_not_null | n | NOT NULL created_at |
| publications_task_id_not_null | n | NOT NULL task_id |
| publications_url_not_null | n | NOT NULL url |
| publications_version_id_not_null | n | NOT NULL version_id |
| publications_pkey | 主键 | PRIMARY KEY (task_id) |

| 索引 | 定义 |
| --- | --- |
| publications_pkey | CREATE UNIQUE INDEX publications_pkey ON public.publications USING btree (task_id) |

## registration_files — 报名附件

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| registration_id | text | 是 | — |
| file_id | text | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| registration_files_file_id_fkey | 外键 | FOREIGN KEY (file_id) REFERENCES files(id) |
| registration_files_registration_id_fkey | 外键 | FOREIGN KEY (registration_id) REFERENCES registrations(id) |
| registration_files_file_id_not_null | n | NOT NULL file_id |
| registration_files_registration_id_not_null | n | NOT NULL registration_id |
| registration_files_pkey | 主键 | PRIMARY KEY (registration_id, file_id) |

| 索引 | 定义 |
| --- | --- |
| registration_files_pkey | CREATE UNIQUE INDEX registration_files_pkey ON public.registration_files USING btree (registration_id, file_id) |

## registrations — 公开报名

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| task_id | text | 是 | — |
| user_id | text | 是 | — |
| notes | text | 是 | ''::text |
| created_at | timestamp with time zone | 是 | now() |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| registrations_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| registrations_user_id_fkey | 外键 | FOREIGN KEY (user_id) REFERENCES users(id) |
| registrations_created_at_not_null | n | NOT NULL created_at |
| registrations_id_not_null | n | NOT NULL id |
| registrations_notes_not_null | n | NOT NULL notes |
| registrations_task_id_not_null | n | NOT NULL task_id |
| registrations_user_id_not_null | n | NOT NULL user_id |
| registrations_pkey | 主键 | PRIMARY KEY (id) |
| registrations_task_id_user_id_key | 唯一 | UNIQUE (task_id, user_id) |

| 索引 | 定义 |
| --- | --- |
| registrations_pkey | CREATE UNIQUE INDEX registrations_pkey ON public.registrations USING btree (id) |
| registrations_task_id_user_id_key | CREATE UNIQUE INDEX registrations_task_id_user_id_key ON public.registrations USING btree (task_id, user_id) |

## reminders — 提醒去重

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| task_id | text | 是 | — |
| kind | text | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| reminders_kind_check | 检查 | CHECK ((kind = ANY (ARRAY['due'::text, 'overdue'::text]))) |
| reminders_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| reminders_kind_not_null | n | NOT NULL kind |
| reminders_task_id_not_null | n | NOT NULL task_id |
| reminders_pkey | 主键 | PRIMARY KEY (task_id, kind) |

| 索引 | 定义 |
| --- | --- |
| reminders_pkey | CREATE UNIQUE INDEX reminders_pkey ON public.reminders USING btree (task_id, kind) |

## report_seals — 封存批次

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| name | text | 是 | — |
| created_by | text | 是 | — |
| start_date | date | 是 | — |
| end_date | date | 是 | — |
| created_at | timestamp with time zone | 是 | now() |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| report_seals_check | 检查 | CHECK ((end_date >= start_date)) |
| report_seals_created_by_fkey | 外键 | FOREIGN KEY (created_by) REFERENCES users(id) |
| report_seals_created_at_not_null | n | NOT NULL created_at |
| report_seals_created_by_not_null | n | NOT NULL created_by |
| report_seals_end_date_not_null | n | NOT NULL end_date |
| report_seals_id_not_null | n | NOT NULL id |
| report_seals_name_not_null | n | NOT NULL name |
| report_seals_start_date_not_null | n | NOT NULL start_date |
| report_seals_pkey | 主键 | PRIMARY KEY (id) |

| 索引 | 定义 |
| --- | --- |
| report_seals_pkey | CREATE UNIQUE INDEX report_seals_pkey ON public.report_seals USING btree (id) |

## reviews — 审核事件

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| task_id | text | 是 | — |
| version_id | text | 是 | — |
| stage | text | 是 | — |
| decision | text | 是 | — |
| reason | text | 是 | ''::text |
| actor_id | text | 是 | — |
| created_at | timestamp with time zone | 是 | now() |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| reviews_check | 检查 | CHECK (((decision <> 'reject'::text) OR (length(TRIM(BOTH FROM reason)) > 0))) |
| reviews_decision_check | 检查 | CHECK ((decision = ANY (ARRAY['approve'::text, 'reject'::text]))) |
| reviews_stage_check | 检查 | CHECK ((stage = ANY (ARRAY['internal'::text, 'teacher1'::text, 'teacher2'::text, 'content'::text, 'acceptance'::text, 'editorial'::text]))) |
| reviews_actor_id_fkey | 外键 | FOREIGN KEY (actor_id) REFERENCES users(id) |
| reviews_task_id_version_id_fkey | 外键 | FOREIGN KEY (task_id, version_id) REFERENCES versions(task_id, id) |
| reviews_actor_id_not_null | n | NOT NULL actor_id |
| reviews_created_at_not_null | n | NOT NULL created_at |
| reviews_decision_not_null | n | NOT NULL decision |
| reviews_id_not_null | n | NOT NULL id |
| reviews_reason_not_null | n | NOT NULL reason |
| reviews_stage_not_null | n | NOT NULL stage |
| reviews_task_id_not_null | n | NOT NULL task_id |
| reviews_version_id_not_null | n | NOT NULL version_id |
| reviews_pkey | 主键 | PRIMARY KEY (id) |
| reviews_version_id_stage_key | 唯一 | UNIQUE (version_id, stage) |

| 索引 | 定义 |
| --- | --- |
| reviews_pkey | CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id) |
| reviews_version_id_stage_key | CREATE UNIQUE INDEX reviews_version_id_stage_key ON public.reviews USING btree (version_id, stage) |

## rule_revisions — 规则修订

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| policy_version | integer | 是 | — |
| rule_id | integer | 是 | — |
| units | integer | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| rule_revisions_units_check | 检查 | CHECK ((units > 0)) |
| rule_revisions_policy_version_fkey | 外键 | FOREIGN KEY (policy_version) REFERENCES workflow_policy(version) |
| rule_revisions_rule_id_fkey | 外键 | FOREIGN KEY (rule_id) REFERENCES labor_rules(id) |
| rule_revisions_policy_version_not_null | n | NOT NULL policy_version |
| rule_revisions_rule_id_not_null | n | NOT NULL rule_id |
| rule_revisions_units_not_null | n | NOT NULL units |
| rule_revisions_pkey | 主键 | PRIMARY KEY (policy_version, rule_id) |

| 索引 | 定义 |
| --- | --- |
| rule_revisions_pkey | CREATE UNIQUE INDEX rule_revisions_pkey ON public.rule_revisions USING btree (policy_version, rule_id) |

## saved_views — 个人报表视图

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| user_id | text | 是 | — |
| name | text | 是 | — |
| config | jsonb | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| saved_views_user_id_fkey | 外键 | FOREIGN KEY (user_id) REFERENCES users(id) |
| saved_views_config_not_null | n | NOT NULL config |
| saved_views_id_not_null | n | NOT NULL id |
| saved_views_name_not_null | n | NOT NULL name |
| saved_views_user_id_not_null | n | NOT NULL user_id |
| saved_views_pkey | 主键 | PRIMARY KEY (id) |
| saved_views_user_id_name_key | 唯一 | UNIQUE (user_id, name) |

| 索引 | 定义 |
| --- | --- |
| saved_views_pkey | CREATE UNIQUE INDEX saved_views_pkey ON public.saved_views USING btree (id) |
| saved_views_user_id_name_key | CREATE UNIQUE INDEX saved_views_user_id_name_key ON public.saved_views USING btree (user_id, name) |

## seal_rows — 封存行快照

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| seal_id | text | 是 | — |
| source_id | text | 是 | — |
| data | jsonb | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| seal_rows_seal_id_fkey | 外键 | FOREIGN KEY (seal_id) REFERENCES report_seals(id) |
| seal_rows_source_id_fkey | 外键 | FOREIGN KEY (source_id) REFERENCES worklogs(id) |
| seal_rows_data_not_null | n | NOT NULL data |
| seal_rows_seal_id_not_null | n | NOT NULL seal_id |
| seal_rows_source_id_not_null | n | NOT NULL source_id |
| seal_rows_pkey | 主键 | PRIMARY KEY (seal_id, source_id) |

| 索引 | 定义 |
| --- | --- |
| seal_rows_pkey | CREATE UNIQUE INDEX seal_rows_pkey ON public.seal_rows USING btree (seal_id, source_id) |

## sessions — 会话

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| token_hash | text | 是 | — |
| user_id | text | 是 | — |
| expires_at | timestamp with time zone | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| sessions_user_id_fkey | 外键 | FOREIGN KEY (user_id) REFERENCES users(id) |
| sessions_expires_at_not_null | n | NOT NULL expires_at |
| sessions_token_hash_not_null | n | NOT NULL token_hash |
| sessions_user_id_not_null | n | NOT NULL user_id |
| sessions_pkey | 主键 | PRIMARY KEY (token_hash) |

| 索引 | 定义 |
| --- | --- |
| sessions_pkey | CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (token_hash) |

## task_reviewers — 审校岗位安排

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| task_id | text | 是 | — |
| user_id | text | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| task_reviewers_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| task_reviewers_user_id_fkey | 外键 | FOREIGN KEY (user_id) REFERENCES users(id) |
| task_reviewers_task_id_not_null | n | NOT NULL task_id |
| task_reviewers_user_id_not_null | n | NOT NULL user_id |
| task_reviewers_pkey | 主键 | PRIMARY KEY (task_id, user_id) |

| 索引 | 定义 |
| --- | --- |
| task_reviewers_pkey | CREATE UNIQUE INDEX task_reviewers_pkey ON public.task_reviewers USING btree (task_id, user_id) |

## tasks — 任务

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| number | text | 是 | — |
| title | text | 是 | — |
| creator_id | text | 是 | — |
| department_id | text | 是 | — |
| layout_type | text | 否 | — |
| deadline | timestamp with time zone | 否 | — |
| notes | text | 是 | ''::text |
| open_registration | boolean | 是 | false |
| urgent | boolean | 是 | false |
| created_at | timestamp with time zone | 是 | now() |
| kind | text | 是 | 'publication'::text |
| linked_task_id | text | 否 | — |
| config_version | integer | 是 | 1 |
| reminder_hours | numeric(8,2) | 否 | — |
| report_note | text | 是 | ''::text |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| tasks_kind_check | 检查 | CHECK ((kind = ANY (ARRAY['publication'::text, 'web_article'::text, 'photo'::text, 'request'::text, 'design'::text, 'work_entry'::text]))) |
| tasks_layout_type_check | 检查 | CHECK ((layout_type = ANY (ARRAY['basic'::text, 'photo'::text, 'repost'::text]))) |
| tasks_reminder_hours_check | 检查 | CHECK ((reminder_hours >= (0)::numeric)) |
| tasks_config_version_fkey | 外键 | FOREIGN KEY (config_version) REFERENCES workflow_policy(version) |
| tasks_creator_id_fkey | 外键 | FOREIGN KEY (creator_id) REFERENCES users(id) |
| tasks_department_id_fkey | 外键 | FOREIGN KEY (department_id) REFERENCES departments(id) |
| tasks_linked_task_id_fkey | 外键 | FOREIGN KEY (linked_task_id) REFERENCES tasks(id) |
| tasks_config_version_not_null | n | NOT NULL config_version |
| tasks_created_at_not_null | n | NOT NULL created_at |
| tasks_creator_id_not_null | n | NOT NULL creator_id |
| tasks_department_id_not_null | n | NOT NULL department_id |
| tasks_id_not_null | n | NOT NULL id |
| tasks_kind_not_null | n | NOT NULL kind |
| tasks_notes_not_null | n | NOT NULL notes |
| tasks_number_not_null | n | NOT NULL number |
| tasks_open_registration_not_null | n | NOT NULL open_registration |
| tasks_report_note_not_null | n | NOT NULL report_note |
| tasks_title_not_null | n | NOT NULL title |
| tasks_urgent_not_null | n | NOT NULL urgent |
| tasks_pkey | 主键 | PRIMARY KEY (id) |
| tasks_number_key | 唯一 | UNIQUE (number) |

| 索引 | 定义 |
| --- | --- |
| idx_reminder_deadline | CREATE INDEX idx_reminder_deadline ON public.tasks USING btree (deadline) WHERE (deadline IS NOT NULL) |
| tasks_number_key | CREATE UNIQUE INDEX tasks_number_key ON public.tasks USING btree (number) |
| tasks_pkey | CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id) |

## teacher_delivery — 教师通知路由

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| teacher_id | text | 是 | — |
| channel | text | 是 | — |
| mention | text | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| teacher_delivery_teacher_id_fkey | 外键 | FOREIGN KEY (teacher_id) REFERENCES users(id) |
| teacher_delivery_channel_not_null | n | NOT NULL channel |
| teacher_delivery_mention_not_null | n | NOT NULL mention |
| teacher_delivery_teacher_id_not_null | n | NOT NULL teacher_id |
| teacher_delivery_pkey | 主键 | PRIMARY KEY (teacher_id) |

| 索引 | 定义 |
| --- | --- |
| teacher_delivery_pkey | CREATE UNIQUE INDEX teacher_delivery_pkey ON public.teacher_delivery USING btree (teacher_id) |

## users — 账号

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| username | text | 是 | — |
| name | text | 是 | — |
| password_hash | text | 是 | — |
| role | text | 是 | — |
| department_id | text | 否 | — |
| payable | boolean | 是 | false |
| active | boolean | 是 | true |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| users_check | 检查 | CHECK (((NOT payable) OR ((role = ANY (ARRAY['member'::text, 'minister'::text])) AND (department_id IS NOT NULL)))) |
| users_role_check | 检查 | CHECK ((role = ANY (ARRAY['member'::text, 'minister'::text, 'teacher'::text, 'admin'::text, 'external'::text]))) |
| users_department_id_fkey | 外键 | FOREIGN KEY (department_id) REFERENCES departments(id) |
| users_active_not_null | n | NOT NULL active |
| users_id_not_null | n | NOT NULL id |
| users_name_not_null | n | NOT NULL name |
| users_password_hash_not_null | n | NOT NULL password_hash |
| users_payable_not_null | n | NOT NULL payable |
| users_role_not_null | n | NOT NULL role |
| users_username_not_null | n | NOT NULL username |
| users_pkey | 主键 | PRIMARY KEY (id) |
| users_username_key | 唯一 | UNIQUE (username) |

| 索引 | 定义 |
| --- | --- |
| users_pkey | CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id) |
| users_username_key | CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username) |

## version_annotations — 选区批注

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| task_id | text | 是 | — |
| version_id | text | 是 | — |
| stage | text | 是 | — |
| actor_id | text | 是 | — |
| start_offset | integer | 是 | — |
| end_offset | integer | 是 | — |
| quote | text | 是 | — |
| body | text | 是 | — |
| created_at | timestamp with time zone | 是 | now() |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| version_annotations_check | 检查 | CHECK (((start_offset >= 0) AND (end_offset > start_offset))) |
| version_annotations_stage_check | 检查 | CHECK ((stage = ANY (ARRAY['editorial'::text, 'internal'::text, 'teacher1'::text, 'teacher2'::text]))) |
| version_annotations_actor_id_fkey | 外键 | FOREIGN KEY (actor_id) REFERENCES users(id) |
| version_annotations_task_id_version_id_fkey | 外键 | FOREIGN KEY (task_id, version_id) REFERENCES versions(task_id, id) |
| version_annotations_actor_id_not_null | n | NOT NULL actor_id |
| version_annotations_body_not_null | n | NOT NULL body |
| version_annotations_created_at_not_null | n | NOT NULL created_at |
| version_annotations_end_offset_not_null | n | NOT NULL end_offset |
| version_annotations_id_not_null | n | NOT NULL id |
| version_annotations_quote_not_null | n | NOT NULL quote |
| version_annotations_stage_not_null | n | NOT NULL stage |
| version_annotations_start_offset_not_null | n | NOT NULL start_offset |
| version_annotations_task_id_not_null | n | NOT NULL task_id |
| version_annotations_version_id_not_null | n | NOT NULL version_id |
| version_annotations_pkey | 主键 | PRIMARY KEY (id) |

| 索引 | 定义 |
| --- | --- |
| version_annotations_pkey | CREATE UNIQUE INDEX version_annotations_pkey ON public.version_annotations USING btree (id) |
| version_annotations_version_idx | CREATE INDEX version_annotations_version_idx ON public.version_annotations USING btree (version_id, created_at) |

## version_files — 版本附件

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| version_id | text | 是 | — |
| file_id | text | 是 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| version_files_file_id_fkey | 外键 | FOREIGN KEY (file_id) REFERENCES files(id) |
| version_files_version_id_fkey | 外键 | FOREIGN KEY (version_id) REFERENCES versions(id) |
| version_files_file_id_not_null | n | NOT NULL file_id |
| version_files_version_id_not_null | n | NOT NULL version_id |
| version_files_pkey | 主键 | PRIMARY KEY (version_id, file_id) |

| 索引 | 定义 |
| --- | --- |
| version_files_pkey | CREATE UNIQUE INDEX version_files_pkey ON public.version_files USING btree (version_id, file_id) |

## versions — 稿件版本

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| task_id | text | 是 | — |
| number | integer | 是 | — |
| body | text | 是 | ''::text |
| preview_url | text | 是 | ''::text |
| author_id | text | 是 | — |
| created_at | timestamp with time zone | 是 | now() |
| phase | text | 是 | 'delivery'::text |
| preview_html | text | 是 | ''::text |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| versions_phase_check | 检查 | CHECK ((phase = ANY (ARRAY['content'::text, 'delivery'::text, 'source'::text]))) |
| versions_author_id_fkey | 外键 | FOREIGN KEY (author_id) REFERENCES users(id) |
| versions_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| versions_author_id_not_null | n | NOT NULL author_id |
| versions_body_not_null | n | NOT NULL body |
| versions_created_at_not_null | n | NOT NULL created_at |
| versions_id_not_null | n | NOT NULL id |
| versions_number_not_null | n | NOT NULL number |
| versions_phase_not_null | n | NOT NULL phase |
| versions_preview_html_not_null | n | NOT NULL preview_html |
| versions_preview_url_not_null | n | NOT NULL preview_url |
| versions_task_id_not_null | n | NOT NULL task_id |
| versions_pkey | 主键 | PRIMARY KEY (id) |
| versions_task_id_id_key | 唯一 | UNIQUE (task_id, id) |
| versions_task_id_number_key | 唯一 | UNIQUE (task_id, number) |

| 索引 | 定义 |
| --- | --- |
| idx_versions_task | CREATE INDEX idx_versions_task ON public.versions USING btree (task_id, number DESC) |
| versions_pkey | CREATE UNIQUE INDEX versions_pkey ON public.versions USING btree (id) |
| versions_task_id_id_key | CREATE UNIQUE INDEX versions_task_id_id_key ON public.versions USING btree (task_id, id) |
| versions_task_id_number_key | CREATE UNIQUE INDEX versions_task_id_number_key ON public.versions USING btree (task_id, number) |

## work_entries — 人工登记

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| task_id | text | 是 | — |
| person_id | text | 是 | — |
| week | integer | 是 | — |
| rule_id | integer | 否 | — |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| work_entries_week_check | 检查 | CHECK (((week >= 1) AND (week <= 53))) |
| work_entries_person_id_fkey | 外键 | FOREIGN KEY (person_id) REFERENCES users(id) |
| work_entries_rule_id_fkey | 外键 | FOREIGN KEY (rule_id) REFERENCES labor_rules(id) |
| work_entries_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| work_entries_person_id_not_null | n | NOT NULL person_id |
| work_entries_task_id_not_null | n | NOT NULL task_id |
| work_entries_week_not_null | n | NOT NULL week |
| work_entries_pkey | 主键 | PRIMARY KEY (task_id) |

| 索引 | 定义 |
| --- | --- |
| work_entries_pkey | CREATE UNIQUE INDEX work_entries_pkey ON public.work_entries USING btree (task_id) |

## workflow_policy — 政策版本

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| version | integer | 是 | — |
| rate_cents | integer | 是 | — |
| urgent_factor | integer | 是 | — |
| photo_window | integer | 是 | — |
| publication_window | integer | 是 | — |
| updated_by | text | 否 | — |
| reason | text | 是 | — |
| created_at | timestamp with time zone | 是 | now() |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| workflow_policy_photo_window_check | 检查 | CHECK ((photo_window > 0)) |
| workflow_policy_publication_window_check | 检查 | CHECK ((publication_window > 0)) |
| workflow_policy_rate_cents_check | 检查 | CHECK ((rate_cents > 0)) |
| workflow_policy_urgent_factor_check | 检查 | CHECK ((urgent_factor >= 10000)) |
| workflow_policy_updated_by_fkey | 外键 | FOREIGN KEY (updated_by) REFERENCES users(id) |
| workflow_policy_created_at_not_null | n | NOT NULL created_at |
| workflow_policy_photo_window_not_null | n | NOT NULL photo_window |
| workflow_policy_publication_window_not_null | n | NOT NULL publication_window |
| workflow_policy_rate_cents_not_null | n | NOT NULL rate_cents |
| workflow_policy_reason_not_null | n | NOT NULL reason |
| workflow_policy_urgent_factor_not_null | n | NOT NULL urgent_factor |
| workflow_policy_version_not_null | n | NOT NULL version |
| workflow_policy_pkey | 主键 | PRIMARY KEY (version) |

| 索引 | 定义 |
| --- | --- |
| workflow_policy_pkey | CREATE UNIQUE INDEX workflow_policy_pkey ON public.workflow_policy USING btree (version) |

## worklogs — 工时贡献

| 字段 | PostgreSQL类型 | 非空 | 默认表达式 |
| --- | --- | --- | --- |
| id | text | 是 | — |
| task_id | text | 是 | — |
| user_id | text | 是 | — |
| department_id | text | 是 | — |
| kind | text | 是 | — |
| rule_name | text | 是 | — |
| base_units | integer | 是 | — |
| effective_units | integer | 是 | — |
| rate_cents | integer | 是 | — |
| confirmed | boolean | 是 | false |
| created_at | timestamp with time zone | 是 | now() |
| source_key | text | 是 | ''::text |
| rule_id | integer | 否 | — |
| rule_version | integer | 是 | 1 |
| multiplier | integer | 是 | 10000 |

| 约束名 | 类型 | 定义 |
| --- | --- | --- |
| worklogs_base_units_check | 检查 | CHECK ((base_units > 0)) |
| worklogs_effective_units_check | 检查 | CHECK ((effective_units > 0)) |
| worklogs_multiplier_check | 检查 | CHECK ((multiplier > 0)) |
| worklogs_rate_cents_check | 检查 | CHECK ((rate_cents > 0)) |
| worklogs_department_id_fkey | 外键 | FOREIGN KEY (department_id) REFERENCES departments(id) |
| worklogs_rule_id_fkey | 外键 | FOREIGN KEY (rule_id) REFERENCES labor_rules(id) |
| worklogs_rule_version_fkey | 外键 | FOREIGN KEY (rule_version) REFERENCES workflow_policy(version) |
| worklogs_task_id_fkey | 外键 | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| worklogs_user_id_fkey | 外键 | FOREIGN KEY (user_id) REFERENCES users(id) |
| worklogs_base_units_not_null | n | NOT NULL base_units |
| worklogs_confirmed_not_null | n | NOT NULL confirmed |
| worklogs_created_at_not_null | n | NOT NULL created_at |
| worklogs_department_id_not_null | n | NOT NULL department_id |
| worklogs_effective_units_not_null | n | NOT NULL effective_units |
| worklogs_id_not_null | n | NOT NULL id |
| worklogs_kind_not_null | n | NOT NULL kind |
| worklogs_multiplier_not_null | n | NOT NULL multiplier |
| worklogs_rate_cents_not_null | n | NOT NULL rate_cents |
| worklogs_rule_name_not_null | n | NOT NULL rule_name |
| worklogs_rule_version_not_null | n | NOT NULL rule_version |
| worklogs_source_key_not_null | n | NOT NULL source_key |
| worklogs_task_id_not_null | n | NOT NULL task_id |
| worklogs_user_id_not_null | n | NOT NULL user_id |
| worklogs_pkey | 主键 | PRIMARY KEY (id) |
| worklogs_task_id_user_id_kind_source_key_key | 唯一 | UNIQUE (task_id, user_id, kind, source_key) |

| 索引 | 定义 |
| --- | --- |
| idx_worklogs_user | CREATE INDEX idx_worklogs_user ON public.worklogs USING btree (user_id, created_at) |
| worklogs_pkey | CREATE UNIQUE INDEX worklogs_pkey ON public.worklogs USING btree (id) |
| worklogs_task_id_user_id_kind_source_key_key | CREATE UNIQUE INDEX worklogs_task_id_user_id_kind_source_key_key ON public.worklogs USING btree (task_id, user_id, kind, source_key) |
