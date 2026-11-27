# 软件设计说明书（SDD）

版本2.0｜2026-11-27｜实现基线：workbench/server、workbench/src、miniprogram与workbenchGateway。

## 1 设计目标与结构

系统以共享后端保证手机与网页的任务、审核、工时和权限一致。原生小程序保留适合手机的蓝色卡片布局；网页提供集中管理与复杂报表。根server和cloudfunctions/api仅为历史代码，不是第二个运行后端。

~~~mermaid
flowchart LR
  W[React网页] -->|同源HTTPS与Cookie| A[云托管 Express API]
  M[原生小程序] --> G[固定上游薄网关]
  G -->|HTTPS与Bearer| A
  A --> D[领域服务与服务端授权]
  D --> C[快照与命令适配层]
  C -->|HTTPS PostgREST / RPC| P[(CloudBase PostgreSQL)]
  A --> F[私有对象存储]
~~~

## 2 模块职责及需求映射

| 模块 | 职责 | SRS需求 |
| --- | --- | --- |
| app.js / auth.js | HTTP路由、凭据、会话、来源检查和身份恢复 | REQ-01、13 |
| domain.js / approval.js | 推文源稿、安排、版本、分阶段审核与发布 | REQ-02、03、09 |
| annotations.js | 清洗预览、UTF-16选区和审核权限 | REQ-04 |
| jobs.js | 稿件逐行、预约、设计、部门需求及人工登记 | REQ-05、06、07 |
| rotation.js / flow-defaults.js | 默认人、部门队列和轮转指针 | REQ-08 |
| policy.js / reports.js | 规则版本、工时核定、视图、Excel与封存 | REQ-10、11 |
| notifications.js | 提醒、站内消息、outbox与重试 | REQ-12 |
| cloud-db.js / cloud-storage.js | 云端一致性、幂等、对象持久化 | REQ-09、13、14 |

完整分层、实体职责、状态机和数据库设计见[课程设计章](design/01-database-design.md)。分析对象是职责模型，实际代码使用函数模块，不假设存在同名类。

## 3 持久化设计

以迁移001–005为业务结构基准，38张业务表、214字段、79外键；[数据字典](database/data-dictionary.md)完整列出PK/FK/UNIQUE/CHECK及索引，[总览](diagrams/database/db-overview.svg)与分区ER图共同描述关系。生产schema为youth_workbench，额外_state、_requests、_uploads不计入业务表。

任务没有可随意改写的status列。当前状态从任务类型、承接、最新阶段版本、审核及归档推导。版本与审核不可混成单一“审核状态”；两位审校岗位和实际审核事件分别持久化。工时保存规则与费率快照，封存行保留当时JSON结果。

PGlite在本地用于测试和开发；云端作为一次性SQL计算工作区。wb_snapshot读取一致事实，wb_command以修订号CAS、请求ID和摘要在一个云端事务提交差异。生产数据不依赖实例磁盘，也不要求PG TCP端口。冲突不静默覆盖。

## 4 关键算法与事务

发布和验收先检查身份、当前版本、阶段及归档事实，再在事务中写完成事件、归档、合格贡献和通知意图。工时来源复合唯一键以及归档唯一约束阻止重复计时。强制关闭有原因但不走自动计酬分支。

自动承接先查目标部门和类型的默认人，若没有则按部门有序成员队列及last_user_id选择下一位；手工安排覆盖可改的既有安排，默认配置可清除。duty_slots未用于当前业务。

批注以清洗HTML得到的正文为基准，检查原文切片等于quote，再保存start_offset与end_offset；数字按JavaScript UTF-16代码单元解释。稿件新版本不复用旧坐标。

计时用整数单位避免浮点累计。政策追加版本，旧任务读取绑定版本。核定追加审计并更新实时有效值，封存复制当时的报表行。工作登记是独立记录来源，不套普通任务交付状态机。

## 5 接口契约

完整HTTP方法、路径、认证与上传约定见[接口契约清单](design/api-contracts.md)。该清单从app.js路由声明生成，避免将相对片段误写成独立接口。

实际输入校验以服务端schema为准。未登录401、无权403、未找到404、状态冲突409、字段错误422；内部错误不泄露密钥和堆栈。Web写请求有来源与X-Requested-With检查，小程序固定路径网关不接受任意上游地址。

## 6 安全与对象存储

密码使用加盐scrypt，服务端存令牌SHA256摘要，默认12小时会话；生产Cookie为HttpOnly、SameSite=Strict、Secure。PG业务schema禁止匿名及普通客户端直接访问，所有核心写入走可信业务服务。

附件元数据保留任务、所有者、长度与SHA256；云端字节在私有workbench-private中。下载先验权再检查哈希。外部只能下载本人材料。对象准备、完成与回收支持异常恢复，避免把实例临时磁盘当持久化。

## 7 部署、运行与演进

CloudBase云托管提供网页和API，云PG与私有对象存储提供独立持久化。小程序借旧环境的薄网关接入权威后端，需在2026-12-11试用到期前续期或迁移网关。配置与回退见[部署说明](../workbench/deployment/mini-unification.md)。

外部通知未配置时保留unconfigured状态。尚未验证的真实灾备恢复、容量扩展和真机大文件测试见STD，不将其作为已实现指标。旧文档库及旧api保持不动。
