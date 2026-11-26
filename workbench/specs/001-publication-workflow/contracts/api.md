# API Contract v1
JSON请求/响应；错误 {error,code}；401身份、403范围、409当前环节/重复、422字段。浏览器带会话cookie，
写请求X-Requested-With: workbench且同源；小程序可用Bearer会话token。生产HTTPS。
- POST /api/v1/auth/login {username,password} -> {user,token}; GET /auth/me; POST /auth/logout。
- GET /people -> 可指派/审校成员，不暴露摘要；GET /tasks -> 私有范围任务及开放任务最小元数据。
- POST /tasks {title,layoutType,deadline,notes,reviewerIds[2],openRegistration}；外部发起可不选部长，接单时补齐。
- GET /tasks/:id -> 当前状态、所有版本、审校、事件、档案和本人可见贡献。
- POST /tasks/:id/assign {assigneeId,reviewerIds[2]}。
- POST /tasks/:id/files multipart file -> file；GET /files/:id 受权限下载。
- POST /tasks/:id/versions {body,previewUrl,fileIds[]}；至少正文或文件一项。
- POST /tasks/:id/reviews {stage,decision,reason,versionId}；服务器校验当前版本与环节。
- POST /tasks/:id/publish {url,versionId} -> 档案及最新任务；重复同链接版本幂等，不同结果409。
- POST /tasks/:id/register {notes,fileIds[]} -> 报名（文件需本任务且本人上传）。
- GET /worklogs?member=&status=&search=&from=&to= -> 明细和可见成员；
  PATCH /worklogs/:id {hours,reason} -> 核定；GET /worklogs/:id/adjustments。
- GET/POST /views {name,config}；GET /reports/export 沿用筛选；POST /reports/seals {from,to,name}；
  GET /reports/seals；GET /reports/seals/:id/export。
- GET /outbox（部长/办公/管理员可查，本部可见，状态pending/unconfigured而非sent）。
- GET /health -> 本地DB状态、未接渠道；生产不返回私密信息。
