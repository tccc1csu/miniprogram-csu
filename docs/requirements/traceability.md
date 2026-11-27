# 需求、设计与验证追踪矩阵

SRS的14项需求映射到33个系统用例、实际模块与STD中的验证设计。一个用例可满足多项需求；映射不等于已执行，实测结果以008验证记录为准。

| SRS需求 | 系统用例 | 设计实现 | 验证编号 |
| --- | --- | --- | --- |
| REQ-01 | [UC-AUTH-001](system-use-case-specifications.md)、[UC-AUTH-002](system-use-case-specifications.md)、[UC-TASK-001](system-use-case-specifications.md) | [auth.js](../../workbench/server/auth.js)、[app.js](../../workbench/server/app.js) | [T-01](../STD.md)、[T-17](../STD.md)、[T-19](../STD.md) |
| REQ-02 | [UC-TASK-001](system-use-case-specifications.md)、[UC-OL-001](system-use-case-specifications.md)、[UC-OL-002](system-use-case-specifications.md)、[UC-OL-010](system-use-case-specifications.md)、[UC-VIEW-001](system-use-case-specifications.md)、[UC-NOTE-001](system-use-case-specifications.md) | [domain.js](../../workbench/server/domain.js) | [T-03](../STD.md)、[T-05](../STD.md)、[T-17](../STD.md) |
| REQ-03 | [UC-OL-003](system-use-case-specifications.md)、[UC-OL-004](system-use-case-specifications.md)、[UC-OL-005](system-use-case-specifications.md)、[UC-OL-006](system-use-case-specifications.md)、[UC-OL-007](system-use-case-specifications.md)、[UC-OL-008](system-use-case-specifications.md)、[UC-OL-009](system-use-case-specifications.md)、[UC-CFG-001](system-use-case-specifications.md) | [domain.js](../../workbench/server/domain.js)、[approval.js](../../workbench/server/approval.js) | [T-01](../STD.md)、[T-02](../STD.md)、[T-07](../STD.md)、[T-08](../STD.md) |
| REQ-04 | [UC-RV-001](system-use-case-specifications.md) | [annotations.js](../../workbench/server/annotations.js) | [T-07](../STD.md)、[T-08](../STD.md) |
| REQ-05 | [UC-ED-001](system-use-case-specifications.md)、[UC-JOB-003](system-use-case-specifications.md)、[UC-JOB-004](system-use-case-specifications.md)、[UC-JOB-005](system-use-case-specifications.md) | [jobs.js](../../workbench/server/jobs.js) | [T-10](../STD.md) |
| REQ-06 | [UC-PR-001](system-use-case-specifications.md)、[UC-JOB-002](system-use-case-specifications.md)、[UC-JOB-003](system-use-case-specifications.md)、[UC-JOB-005](system-use-case-specifications.md) | [jobs.js](../../workbench/server/jobs.js) | [T-11](../STD.md) |
| REQ-07 | [UC-ER-001](system-use-case-specifications.md)、[UC-DS-001](system-use-case-specifications.md)、[UC-REC-001](system-use-case-specifications.md)、[UC-JOB-001](system-use-case-specifications.md)、[UC-JOB-003](system-use-case-specifications.md)、[UC-JOB-005](system-use-case-specifications.md) | [jobs.js](../../workbench/server/jobs.js) | [T-12](../STD.md)、[T-13](../STD.md) |
| REQ-08 | [UC-OL-004](system-use-case-specifications.md)、[UC-JOB-001](system-use-case-specifications.md)、[UC-CFG-001](system-use-case-specifications.md) | [rotation.js](../../workbench/server/rotation.js)、[flow-defaults.js](../../workbench/server/flow-defaults.js) | [T-15](../STD.md)、[T-16](../STD.md) |
| REQ-09 | [UC-OL-009](system-use-case-specifications.md)、[UC-JOB-005](system-use-case-specifications.md)、[UC-JOB-006](system-use-case-specifications.md) | [domain.js](../../workbench/server/domain.js)、[jobs.js](../../workbench/server/jobs.js) | [T-02](../STD.md)、[T-04](../STD.md)、[T-10](../STD.md)、[T-14](../STD.md) |
| REQ-10 | [UC-REC-001](system-use-case-specifications.md)、[UC-REC-002](system-use-case-specifications.md)、[UC-CFG-002](system-use-case-specifications.md) | [reports.js](../../workbench/server/reports.js)、[policy.js](../../workbench/server/policy.js) | [T-02](../STD.md)、[T-03](../STD.md)、[T-05](../STD.md)、[T-11](../STD.md)、[T-13](../STD.md) |
| REQ-11 | [UC-STAT-001](system-use-case-specifications.md)、[UC-STAT-002](system-use-case-specifications.md)、[UC-VIEW-001](system-use-case-specifications.md)、[UC-NOTE-001](system-use-case-specifications.md) | [reports.js](../../workbench/server/reports.js) | [T-05](../STD.md)、[T-13](../STD.md) |
| REQ-12 | [UC-MSG-001](system-use-case-specifications.md) | [notifications.js](../../workbench/server/notifications.js) | [T-14](../STD.md) |
| REQ-13 | [UC-TASK-001](system-use-case-specifications.md)、[UC-OL-002](system-use-case-specifications.md)、[UC-OL-005](system-use-case-specifications.md)、[UC-OL-010](system-use-case-specifications.md)、[UC-RV-001](system-use-case-specifications.md) | [app.js](../../workbench/server/app.js)、[cloud-storage.js](../../workbench/server/cloud-storage.js) | [T-06](../STD.md)、[T-09](../STD.md)、[T-17](../STD.md)、[T-19](../STD.md) |
| REQ-14 | [UC-AUTH-001](system-use-case-specifications.md)、[UC-TASK-001](system-use-case-specifications.md) | [cloud-db.js](../../workbench/server/cloud-db.js)、[cloud-storage.js](../../workbench/server/cloud-storage.js)、[index.js](../../workbench/server/index.js) | [T-09](../STD.md)、[T-19](../STD.md) |


模型对应关系：每个UC均对应同名分析序列；状态机与领域类图表达跨用例规则；实际表及约束见[数据字典](../database/data-dictionary.md)。[接口契约](../design/api-contracts.md)关联调用入口。

T-01至T-08：[workflow.test.js](../../workbench/tests/workflow.test.js)；T-09至T-16：[center.test.js](../../workbench/tests/center.test.js)；T-17：[mobile-unification.mjs](../../workbench/tests/mobile-unification.mjs)；T-18：[文档检查器](../tools/check_current_documents.py)；T-19：[007既有云端验证](../../workbench/specs/007-mini-unification/validation.md)。

本轮执行及未验证项见[008验证](../../workbench/specs/008-course-documentation/validation.md)。文档FR-001至014由T-18与本轮人工审查共同核对。
