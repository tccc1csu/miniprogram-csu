# 共用 API

保留 /api/v1/tasks 的排版接口。带 kind 的创建请求增加挂网、摄制、通用、设计和工作登记。普通版本仍包含 body、fileIds。其他任务动作统一为 POST /tasks/:id/actions/:action，按动作接收 assigneeId、versionId、decision 或 reason。所有冲突返回 409，字段校验 422，越权 403。

GET /workflow/options 返回允许的任务类型、可用人员、基础规则和报价参数。PATCH /workflow/policy 仅管理员可用。GET、POST /workflow/duty 查询或配置轮值。GET /inbox 返回当前用户通知。工作登记在账本中显示周次和来源。
