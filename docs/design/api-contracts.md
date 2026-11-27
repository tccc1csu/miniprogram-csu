# HTTP接口契约

基线：workbench/server/app.js；所有路径含统一前缀/api/v1。下表从当前路由声明生成，动态参数以冒号表示。

## 认证、载荷及失败

- POST登录接收JSON：username与password。Web返回user并设置HttpOnly会话Cookie；请求头X-Client: miniprogram时返回token与user。
- 除健康检查和登录外，业务请求携带有效会话。Web写请求带X-Requested-With: workbench且通过来源检查；手机通过固定上游网关传递Authorization: Bearer令牌。/internal/jobs使用独立调度密钥，不接受普通用户会话替代。
- 常规业务载荷为JSON，由对应领域模块的schema校验；单次JSON上限1MiB。动作、版本、阶段和可见范围以服务端事实为准。
- 上传为multipart/form-data，字段file，单文件非空且不超过12MiB；成功返回id、name、size、sha256。下载返回授权附件字节。Excel返回OpenXML工作簿。
- 创建通常返回201，其他成功通常200。失败返回JSON的error与code；常见401未登录、403无权限、404不存在、409状态或唯一性冲突、422字段错误、429登录限流、503依赖不可用。失败不能在客户端显示为业务完成。
- 会话默认12小时，退出后令牌失效。接口没有统一响应data包装；调用方须按具体端点读取对象、列表或字节。

## 完整方法与路径

| 方法 | 完整路径 |
| --- | --- |
| GET | /api/v1/health |
| POST | /api/v1/internal/jobs |
| POST | /api/v1/auth/login |
| GET | /api/v1/auth/me |
| POST | /api/v1/auth/logout |
| GET | /api/v1/people |
| GET | /api/v1/workflow/publication |
| PUT | /api/v1/workflow/publication |
| PUT | /api/v1/workflow/publication/teachers/:id |
| GET | /api/v1/workflow/defaults |
| DELETE | /api/v1/workflow/defaults/:department/:kind |
| GET | /api/v1/workflow/options |
| PATCH | /api/v1/workflow/policy |
| GET | /api/v1/workflow/duty |
| PUT | /api/v1/workflow/duty |
| GET | /api/v1/inbox |
| GET | /api/v1/tasks |
| POST | /api/v1/tasks |
| GET | /api/v1/tasks/:id |
| PATCH | /api/v1/tasks/:id/report-note |
| POST | /api/v1/tasks/:id/actions/:action |
| POST | /api/v1/tasks/:id/assign |
| POST | /api/v1/tasks/:id/source |
| PUT | /api/v1/tasks/:id/teachers |
| POST | /api/v1/tasks/:id/annotations |
| POST | /api/v1/tasks/:id/versions |
| POST | /api/v1/tasks/:id/reviews |
| POST | /api/v1/tasks/:id/publish |
| POST | /api/v1/tasks/:id/register |
| POST | /api/v1/tasks/:id/files |
| GET | /api/v1/files/:id |
| GET | /api/v1/worklogs |
| PATCH | /api/v1/worklogs/:id |
| GET | /api/v1/worklogs/:id/adjustments |
| GET | /api/v1/views |
| POST | /api/v1/views |
| GET | /api/v1/reports/export |
| GET | /api/v1/reports/seals |
| POST | /api/v1/reports/seals |
| GET | /api/v1/reports/seals/:id/export |
| GET | /api/v1/outbox |


## 领域字段与示例依据

创建、交付、审校、批注、核定和封存的字段语义见[用例规约](../requirements/system-use-case-specifications.md)。精确schema和返回结构以[路由](../../workbench/server/app.js)及其调用模块为准；可重复输入示例见[推文测试](../../workbench/tests/workflow.test.js)、[部门测试](../../workbench/tests/center.test.js)与[手机协议测试](../../workbench/tests/mobile-unification.mjs)。本清单是当前实现接口索引，不把未来机器人API列作可用端点。
