# 青年传媒中心 · 两端统一工作台

保留原小程序的蓝色卡片、**首页／协作广场／我的**三底栏和全部/本部门筛选；直接替换旧内容，不再提供独立“新版工作台”或第二套登录。网页与手机共用账号、任务、版本、审校、归档、附件和工时。

云端网页：[打开工作台](https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com)。关闭本机后仍能运行。验收账号沿用现有私有验收资料，密码不存 Git。

## 使用与开发

- **小程序**：在微信开发者工具导入仓库根目录。前端在 `miniprogram/`，用与网页相同的账号登录。`miniprogram/config.js` 集中配置接入；仅新增 `cloudfunctions/workbenchGateway` 转发到既有云托管 API。
- **网页/API**：进入 `workbench/`，运行 `npm ci`、`npm test`、`npm run build`。本地开发用 `npm run dev`，生产使用 CloudBase 云托管及 PG HTTPS/RPC，不依赖本机数据库或 PG TCP 端口。
- **业务**：协作广场提供推文、采编办公、摄制、设计、部门需求、工作登记。详情按身份办理、看版本和材料；复杂报表、规则维护、封存、精细文中批注在网页操作。
- **自动归档**：正常完成自动归档并只计发一次。教师和外部组织只留记录、不计工时；强制归档不自动造工时；特殊核定保留规则值、核定值、原因和审计。

```powershell
cd workbench
npm ci
npm test
npm run build
npm run dev
```

## 当前源码导航

| 内容 | 位置 |
| --- | --- |
| 原生手机页面、会话与业务入口 | [miniprogram](miniprogram/) |
| 新增无业务状态的转发网关 | [workbenchGateway](cloudfunctions/workbenchGateway/) |
| React 网页与唯一业务 API | [workbench/src](workbench/src/) · [workbench/server](workbench/server/) |
| 长期业务基准与确认决定 | [BIZ-RULES-FULL](workbench/背景文件/BIZ-RULES-FULL.md) · [decisions](workbench/specs/decisions.md) |
| 本次 Spec Kit 规格、计划、任务与验证 | [007-mini-unification](workbench/specs/007-mini-unification/) |
| 页面去留、部署、环境迁移和回退 | [mini-unification.md](workbench/deployment/mini-unification.md) |
| 云端验收路径 | [acceptance-guide.md](workbench/deployment/acceptance-guide.md) |

旧文档数据库、旧附件和线上 `api` 云函数**未删除、未改动**。根目录 `cloudfunctions/api`、`server`、`docs`、课程 PDF 和旧功能说明保留为历史参考；新版不调用它们，也不运行旧初始化、修复或重置工具。业务规则以 `workbench/背景文件` 和会话决定为准，旧课程文档不代表当前线上行为。

当前小程序借用旧关联环境 `cloud1-d2gd4994t925d1435` 的薄网关；权威数据在 `tccc-qncmzx-d0gxalbv77f0dae9f`。旧环境试用期 **2026-12-11 到期**，需在此之前续期或关联新环境并迁移网关，步骤见部署文档。

微信机器人和订阅消息尚未接通，当前显示站内消息。本次完成代码、编译与云端接口联调，**未提交微信正式版审核/发布**；真机验证也需单独完成。
