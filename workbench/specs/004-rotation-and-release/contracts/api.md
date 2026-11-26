# 变更接口

- PATCH /api/v1/tasks/:id/report-note 保存 reportNote。详情 task.report_note 为现值。
- GET /api/v1/workflow/duty?department= 返回 members、nextId。PUT 同一路径，传 departmentId 和 personIds，名单顺序即轮值顺序。
- GET /api/v1/worklogs 包含 taskNote 和 adjustmentNote。两者保存进封存，并进入 Excel 明细。
- 小程序继续使用 /api/v1/auth/login 与任务、附件接口。
