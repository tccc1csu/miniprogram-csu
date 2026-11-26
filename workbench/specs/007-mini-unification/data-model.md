# Data Model

不增加核心业务表，复用用户、会话、任务、版本、审校、文件、事件、归档、工时和消息。

## MobileSession
- `MobileSession.token`：服务端签发的 64 位十六进制会话；不得把旧 token、角色、openid 当新后端身份。
- `MobileSession.user`：/auth/me 返回的用户；角色和 departmentId 仅供展示与入口控制。
- `MobileSession.scope`：API 源及转发环境构成的配置指纹；配置切换时旧会话失效。

## GatewayRequest
- `GatewayRequest.path`：仅允许 /api/v1 已知业务路径，禁止任意 URL/host/重定向。
- `GatewayRequest.file`：只允许任务附件上传，base64 原始数据 <= 3 MiB，文件名 <= 180 字。
- `GatewayRequest.offset`：非负整数且按 192 KiB 分段下载，文件仍受后端鉴权。

## Task / Worklog
任务、老师分工、源稿、当前版本、备注及所有审核约束沿用后端，不在网关复制状态机。Worklog 使用本人 member 筛选；老师/外部不能请求工时。
