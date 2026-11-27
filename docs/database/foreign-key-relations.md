# 当前外键关系

以下79项来自实际迁移后的pg_constraint。复合外键保持列顺序，不能拆成无约束的普通关联。

| 来源表 | 目标表 | 完整约束 |
| --- | --- | --- |
| adjustments | users | FOREIGN KEY (actor_id) REFERENCES users(id) |
| adjustments | worklogs | FOREIGN KEY (log_id) REFERENCES worklogs(id) |
| archives | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| archives | versions | FOREIGN KEY (task_id, version_id) REFERENCES versions(task_id, id) |
| article_lines | users | FOREIGN KEY (author_id) REFERENCES users(id) |
| article_lines | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| assignments | users | FOREIGN KEY (actor_id) REFERENCES users(id) |
| assignments | users | FOREIGN KEY (assignee_id) REFERENCES users(id) |
| assignments | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| bookings | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| duty_rotation | departments | FOREIGN KEY (department_id) REFERENCES departments(id) |
| duty_rotation | users | FOREIGN KEY (last_user_id) REFERENCES users(id) |
| duty_rotation | users | FOREIGN KEY (updated_by) REFERENCES users(id) |
| duty_rotation_members | duty_rotation | FOREIGN KEY (department_id) REFERENCES duty_rotation(department_id) ON DELETE CASCADE |
| duty_rotation_members | users | FOREIGN KEY (user_id) REFERENCES users(id) |
| duty_slots | users | FOREIGN KEY (created_by) REFERENCES users(id) |
| duty_slots | departments | FOREIGN KEY (department_id) REFERENCES departments(id) |
| duty_slots | users | FOREIGN KEY (user_id) REFERENCES users(id) |
| events | users | FOREIGN KEY (actor_id) REFERENCES users(id) |
| events | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| file_payloads | files | FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE |
| files | users | FOREIGN KEY (owner_id) REFERENCES users(id) |
| files | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| flow_defaults | users | FOREIGN KEY (assignee_id) REFERENCES users(id) |
| flow_defaults | departments | FOREIGN KEY (department_id) REFERENCES departments(id) |
| flow_defaults | users | FOREIGN KEY (updated_by) REFERENCES users(id) |
| jobs | labor_rules | FOREIGN KEY (rule_id) REFERENCES labor_rules(id) |
| jobs | departments | FOREIGN KEY (source_department) REFERENCES departments(id) |
| jobs | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| jobs | users | FOREIGN KEY (teacher_id) REFERENCES users(id) |
| outbox | users | FOREIGN KEY (recipient_id) REFERENCES users(id) |
| outbox | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| publication_defaults | users | FOREIGN KEY (reviewer1_id) REFERENCES users(id) |
| publication_defaults | users | FOREIGN KEY (reviewer2_id) REFERENCES users(id) |
| publication_defaults | users | FOREIGN KEY (teacher1_id) REFERENCES users(id) |
| publication_defaults | users | FOREIGN KEY (teacher2_id) REFERENCES users(id) |
| publication_routing | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| publication_routing | users | FOREIGN KEY (teacher1_id) REFERENCES users(id) |
| publication_routing | users | FOREIGN KEY (teacher2_id) REFERENCES users(id) |
| publications | users | FOREIGN KEY (actor_id) REFERENCES users(id) |
| publications | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| publications | versions | FOREIGN KEY (task_id, version_id) REFERENCES versions(task_id, id) |
| registration_files | files | FOREIGN KEY (file_id) REFERENCES files(id) |
| registration_files | registrations | FOREIGN KEY (registration_id) REFERENCES registrations(id) |
| registrations | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| registrations | users | FOREIGN KEY (user_id) REFERENCES users(id) |
| reminders | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| report_seals | users | FOREIGN KEY (created_by) REFERENCES users(id) |
| reviews | users | FOREIGN KEY (actor_id) REFERENCES users(id) |
| reviews | versions | FOREIGN KEY (task_id, version_id) REFERENCES versions(task_id, id) |
| rule_revisions | workflow_policy | FOREIGN KEY (policy_version) REFERENCES workflow_policy(version) |
| rule_revisions | labor_rules | FOREIGN KEY (rule_id) REFERENCES labor_rules(id) |
| saved_views | users | FOREIGN KEY (user_id) REFERENCES users(id) |
| seal_rows | report_seals | FOREIGN KEY (seal_id) REFERENCES report_seals(id) |
| seal_rows | worklogs | FOREIGN KEY (source_id) REFERENCES worklogs(id) |
| sessions | users | FOREIGN KEY (user_id) REFERENCES users(id) |
| task_reviewers | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| task_reviewers | users | FOREIGN KEY (user_id) REFERENCES users(id) |
| tasks | workflow_policy | FOREIGN KEY (config_version) REFERENCES workflow_policy(version) |
| tasks | users | FOREIGN KEY (creator_id) REFERENCES users(id) |
| tasks | departments | FOREIGN KEY (department_id) REFERENCES departments(id) |
| tasks | tasks | FOREIGN KEY (linked_task_id) REFERENCES tasks(id) |
| teacher_delivery | users | FOREIGN KEY (teacher_id) REFERENCES users(id) |
| users | departments | FOREIGN KEY (department_id) REFERENCES departments(id) |
| version_annotations | users | FOREIGN KEY (actor_id) REFERENCES users(id) |
| version_annotations | versions | FOREIGN KEY (task_id, version_id) REFERENCES versions(task_id, id) |
| version_files | files | FOREIGN KEY (file_id) REFERENCES files(id) |
| version_files | versions | FOREIGN KEY (version_id) REFERENCES versions(id) |
| versions | users | FOREIGN KEY (author_id) REFERENCES users(id) |
| versions | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| work_entries | users | FOREIGN KEY (person_id) REFERENCES users(id) |
| work_entries | labor_rules | FOREIGN KEY (rule_id) REFERENCES labor_rules(id) |
| work_entries | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| workflow_policy | users | FOREIGN KEY (updated_by) REFERENCES users(id) |
| worklogs | departments | FOREIGN KEY (department_id) REFERENCES departments(id) |
| worklogs | labor_rules | FOREIGN KEY (rule_id) REFERENCES labor_rules(id) |
| worklogs | workflow_policy | FOREIGN KEY (rule_version) REFERENCES workflow_policy(version) |
| worklogs | tasks | FOREIGN KEY (task_id) REFERENCES tasks(id) |
| worklogs | users | FOREIGN KEY (user_id) REFERENCES users(id) |
