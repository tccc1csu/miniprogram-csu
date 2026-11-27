# 青年传媒中心工作台

**在线网站：[打开工作台](https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com)**

微信扫码进入小程序（访问资格以小程序成员配置为准）：

<img src="docs/assets/experience-qrcode.png" alt="青年传媒中心小程序码" width="180" />

网页集中管理，手机随手办理。两端共用账号、任务、版本、审校、附件、自动归档和工时；本机关闭后，云端仍独立运行。

## 测试账户

网页与小程序使用同一组云端测试账户。**云端测试密码沿用已交付的私有验收资料，不存入公开仓库。** 以下账户覆盖六部门与主要审核身份，测试数据不用于真实结算。

| 部门 | 部长账户 | 干事账户 |
| --- | --- | --- |
| 运营部 | `minister`、`minister2` | `member`、`member2` |
| 办公部 | `office` | `office2` |
| 采编部 | `editor`、`editor2` | `writer` |
| 摄制部 | `photo` | `photo2`、`photo3` |
| 美编部 | `art` | `art2` |
| 原创部 | `original` | `original2` |

| 其他身份 | 账户 |
| --- | --- |
| 一审／二审指导老师 | `teacher`／`teacher2` |
| 外部组织 | `external`、`external2` |
| 验收管理员 | `demo-admin` |

具体任务与验收路径见[云端验收指南](workbench/deployment/acceptance-guide.md)。本地开发执行 `npm run db:seed` 后，默认演示密码为 `Youth2026!`（可由 `DEMO_PASSWORD` 覆盖），本地管理员名为 `admin`；**该密码不适用于云端**。

## 功能

- 六部门协作：推文、采编办公、摄影预约、设计、部门需求及例外工作登记。
- 分阶段审校：外部源稿先采编审核，排版后运营内部审校，两位不同老师依次一二审；网页支持按稿件版本选区批注。
- 自动归档：正常完成同事务归档并只计一次工时；强制关闭留原因且不自动计时，教师与外部只留业务记录。
- 灵活分配：可选默认承接、按任务先后轮转和手动调整。
- 工时结算：规则版本、核定原因与审计、任务备注、可配置列和视图、Excel导出及不可变封存快照。
- 手机布局：保留蓝色卡片和首页／协作广场／我的三底栏，按身份直接办理同一业务。

## 文档

| 阅读目的 | 入口 |
| --- | --- |
| 课程完整稿（业务→需求→分析→设计） | [课程作业合并稿](docs/course-assignment.md) |
| 软件需求／设计／测试 | [SRS](docs/SRS.md) · [SDD](docs/SDD.md) · [STD](docs/STD.md) |
| 用例及需求追踪 | [33个用例规约](docs/requirements/system-use-case-specifications.md) · [追踪矩阵](docs/requirements/traceability.md) |
| 当前数据库与接口 | [38表字段字典](docs/database/data-dictionary.md) · [完整外键](docs/database/foreign-key-relations.md) · [HTTP接口](docs/design/api-contracts.md) |
| 长期业务依据与确认决定 | [BIZ-RULES-FULL](workbench/背景文件/BIZ-RULES-FULL.md) · [decisions](workbench/specs/decisions.md) |
| Spec Kit与本轮验证 | [008文档更新](workbench/specs/008-course-documentation/) · [007两端统一](workbench/specs/007-mini-unification/) |
| 部署、环境迁移与回退 | [两端部署说明](workbench/deployment/mini-unification.md) |
| 全部文档 | [文档导航](docs/README.md) |

## 开发

需要 Node.js 24 和 npm。网页与API位于 `workbench/`：

```powershell
cd workbench
npm ci
npm run db:seed
npm run dev
```

本地测试使用隔离PGlite关系库：

```powershell
npm test
npm run build
```

小程序在微信开发者工具中导入仓库根目录。`miniprogram/config.js` 管理接入配置；仅部署 `cloudfunctions/workbenchGateway` 作为固定上游转发网关。详细编译、预览及云端配置见部署说明，勿运行历史初始化或重置工具。

## 架构与目录

```text
miniprogram/                         原生微信页面与会话
cloudfunctions/workbenchGateway/      无业务状态的转发网关
workbench/src/                       React网页
workbench/server/                    唯一业务API与关系型迁移
workbench/deployment/                云端部署与验收工具
docs/                               当前课程、SRS/SDD/STD、UML与数据字典
```

CloudBase云托管运行网页与API，通过HTTPS/PostgREST及受控RPC访问CloudBase PostgreSQL，附件使用私有对象存储。核心表只能由可信后端写入，手机与网页都不能自行指定权限或角色。

## 运行边界

微信机器人和订阅消息尚未接通，当前提供站内消息与真实发送状态；小程序正式版未提交审核／发布，真机完整闭环和云端大文件专项验证仍待完成。

小程序当前借用旧关联环境的薄网关；该环境试用期 **2026-12-11 到期**，需在此前续期或迁移网关。权威数据位于环境 `tccc-qncmzx-d0gxalbv77f0dae9f`，本次文档更新未改动云端数据。

旧文档数据库、旧附件和线上旧 `api` 云函数保持原状。根 `server/`、`cloudfunctions/api/` 与 [docs/history](docs/history/) 是历史资料；当前运行逻辑以 `workbench/server` 为准，当前文档以本页链接为准。不要将 `.env`、`.data`、私有密码或开发者配置提交到Git。
