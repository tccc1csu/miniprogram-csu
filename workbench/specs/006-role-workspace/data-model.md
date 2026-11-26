# 工作区展示模型

无需数据库迁移，不持久化可推导工作状态。

## TaskViewer（服务端输出）
- `TaskViewer.createdByMe`: required boolean，仅任务 creator 等于当前会话用户。
- `TaskViewer.action`: nullable enum `source|assign|submit|review|publish`，仅当前主要责任人收到；替代操作权限不自动成为个人待办。
- `TaskViewer.reviewedByMe`: required boolean，实际 reviews 中存在当前用户记录，跨版本；外部始终 false。
- `TaskViewer.nextLabel`: required string，由当前环节生成下一步说明。
- `TaskViewer.ownerLabel`: required string，当前责任人/角色；外部只输出角色描述，不新增内部个人信息。

## WorkspaceView（URL 查询）
- `WorkspaceView.kind`: optional enum `publication|web_article|photo|request|design|work_entry`，非法值回全部。
- `WorkspaceView.view`: enum `list|board`，默认 list。
- `WorkspaceView.tab`: optional `pending|reviewed`（审核工作台）或 `active|archived`（发起/部门视图）。

## DashboardSummary
任务数量来自相同可见列表，业务和环节筛选不绕过权限。工时单位沿用整数万分之一小时，汇总后显示小时；老师/外部不加载台账。请求失败与零不同。
