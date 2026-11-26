# 002 任务清单

## 准备与基础
- [X] T001 校验 spec.md、plan.md、data-model.md、contracts/api.md 对应 FR-201–212。
- [X] T002 在 server/migrations/002.sql 和 server/db.js 实现 data-model.md 的 Task.kind、Task.deadline、Task.linked_task_id、Task.config_version、ArticleLine.position、ArticleLine.site、ArticleLine.author_id、Booking.location、Booking.contact、Job.review_mode、Job.rule_id、Assignment.task_id、Archive.version_id、Archive.reason、Worklog.source_key、Worklog.base_units、Worklog.effective_units、Worklog.rate_cents、Worklog.rule_version、WorkEntry.week、WorkEntry.person_id、Rule.id、Rule.units、Policy.version、Policy.rate_cents、Policy.urgent_factor、DutySlot.department_id、DutySlot.start_at、DutySlot.end_at、Reminder.task_id、Reminder.kind。
## US1
- [X] T003 [US1] 在 server/jobs.js、src/Workflows.jsx 和 server/migrations/002.sql 按 data-model.md 的 Version.phase 实现逐稿、审校、交付、验收与关联排版。
## US2
- [X] T004 [US2] 在 server/jobs.js、src/Workflows.jsx 实现预约、原子抢单、派发、退回和加急。
## US3
- [X] T005 [US3] 在 server/jobs.js、src/Workflows.jsx 实现六部门、美编和原创。
## US4
- [X] T006 [US4] 在 server/policy.js、server/reports.js、src/Workflows.jsx 实现价目、登记、核定与来源查询。
## US5
- [X] T007 [US5] 在 server/notifications.js、server/index.js、src/Workflows.jsx 实现轮值提醒、重试、强制归档。
## 联调
- [X] T008 在 miniprogram/pages/home/ 接入新需求入口。
- [X] T009 在 tests/center.test.js 和 tests/browser.mjs 实测业务与回归，更新 README.md、validation.md 和本机服务。

T001 → T002 → 各场景 → T008/T009。基础完成后，独立的测试脚本、前端与后端可以按接口并行开发。优先验收挂网，再验收摄制，其余各用独立任务测试。
