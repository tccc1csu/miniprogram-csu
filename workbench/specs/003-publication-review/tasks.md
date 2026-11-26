# 003 实施任务

## 基础
- [X] T001 在 server/migrations/003.sql 接入 data-model.md 中 PublicationReview.teacher1_id、PublicationReview.teacher2_id、PublicationReview.source_required、PublicationReview.source_version_id、Version.phase、Version.preview_html、Annotation.version_id、Annotation.start_offset、Annotation.end_offset、Annotation.stage、FlowDefault.department_id、FlowDefault.kind、FlowDefault.assignee_id、Assignment.automatic、PublicationDefaults 和 TeacherDelivery.teacher_id。
## 审校场景
- [X] T002 [US1] 在 server/annotations.js 和 src/ArticlePreview.jsx 实现版本预览与划选批注。
- [X] T003 [US2] 在 server/approval.js 和 src/Workflows.jsx 接入两审配置和机器人路由。
- [X] T004 [US3] 在 server/domain.js、src/App.jsx 和小程序加入采编前置审稿。
- [X] T005 [US4] 在 server/flow-defaults.js、server/jobs.js 和 src/Workflows.jsx 增加可选默认派发。
## 验证
- [X] T006 在 tests/workflow.test.js、tests/center.test.js 和 tests/browser.mjs 验证新场景、历史迁移与回归。

US1–US4 共用 T001，独立验收后汇入 T006。
