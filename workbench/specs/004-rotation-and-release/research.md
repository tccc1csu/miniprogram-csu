# 研究记录

- 利用现有核定记录和任务加急参数解释差值，报告保留独立的任务备注。
- 以部门为轮值范围，事务内前进名单游标。默认承接与审核前置条件延用工作台逻辑。
- 云端部署与小程序历史字段另行记录实测入口和结论。

## HTTPS/RPC 可行性（2026-11-26）

- 决策：现有 PG 共享环境走官方 HTTPS/RPC，保留云托管和业务 API。Setup Skill 插件已安装，CLI 登录和环境已实测，新 MCP 本会话尚未加载。
- 实查：env detail 返回 PG、SHARED、上海，SQL 为 PostgreSQL 17.11。云托管 002 能返回网页，/api/v1/health 为 503（原生连接超时），业务表尚未建立。
- 正式文档：https://docs.cloudbase.net/database/postgresql/http/rpc 发布 POST /v1/rdb/rest/rpc/:function_name，无须猜测路径。
- 实测：认证 HTTPS、两张表主动报错整笔回滚、并发行锁、同 request_id 去重、无凭据拒绝，共 5 项通过。使用版本化创建/清理迁移，临时 Key 撤销、schema 和函数删除后复查。证据 artifacts/cloudbase/http-probe.json。
- 排除：把 DATABASE_URL 换成 HTTPS、把回调事务拆成多次请求、把 CLI 管理 SQL 作生产驱动。方案不以采购独占实例或 CVM 为前提。
- 设计：命名查询/业务函数、后端会话校验、私有 schema、文件补偿和定时 outbox。平台探针不等于六部门业务云验收；正式导入、小程序真机和机器人尚未执行。

## 实施结果（同日后续，替代前述未实施状态）

用户要求电脑关闭后全功能继续运行并授权改代码。采用云端权威关系库 + 服务端内存 SQL 事务工作副本 + 单次 revision 比较提交，详见 contracts/cloud-http.md。已部署私有 38 表、固定受限 RPC、PG 私有存储、每日云备份和每分钟事件函数。云托管 004 全流量健康 200，16 项原测试、11 项真实云数据测试与 5 项公开域名/浏览器测试通过。备份恢复校验 79 条外键，测试账号/任务/待确认上传均清理。

物理零副本唤醒计时、旧数据映射导入、小程序合法域名真机和机器人真实发送保持未完成。集中日志查询返回 LOG_SERVICE_NOT_ENABLED，未将日志审计标为通过。证据见 artifacts/cloudbase/deployment.json、business-http.json、public-release.json。
