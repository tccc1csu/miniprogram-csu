# Implementation Plan: 供稿发布与工时工作台

**Branch**: 目录独立，尚未创建Git分支 | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)
**Input**: 001规格；其他功能按002规格接续。

## Summary
先交付可运行的Web、共用API、小程序需求入口，跑通版本审校、发布原子归档和可核定报表。全量其他业务已建立独立规格，不以当前闭环代替全部系统。

## Technical Context
**Language/Version**: Node.js 24 ESM JavaScript，React JSX。
**Primary Dependencies**: Express、Zod、React、Vite、Lucide、ExcelJS、Multer、pg、PGlite。
**Storage**: 本地持久PGlite（真正PostgreSQL引擎）及附件目录；DATABASE_URL适配标准PostgreSQL，云环境暂不写入。
**Testing**: node:test + supertest数据库/API集成；Playwright桌面和手机验证。
**Target Platform**: Windows本地开发、后续Linux Node服务与微信小程序。
**Project Type**: Web + API + miniprogram adapter。
**Performance Goals**: 1000任务、5000工时本地页可操作；列表最多返回500条，后续按实测分页。
**Constraints**: 完成必须事务原子，整数计价，服务端权限；未接微信不得显示已发。
**Scale/Scope**: 六部门；本阶段5用户故事、18需求，后续002覆盖其余流程。

## Constitution Check
- 基准与会话新决定有覆盖表/决策记录：通过。
- 关系模型、FK和服务器权限：设计通过，实施后测试。
- 一次完成事务、归档与计发：采用唯一约束与任务锁，通过。
- 内部账与历史审计/封存：通过。
- 集成/浏览器和部署边界明确：通过。
设计后复核：无豁免。

## Project Structure
文档：本目录spec/plan/research/data-model/quickstart/contracts/tasks；002为下一期。
代码：server/{db,auth,domain,app,index}.js、server/migrations/001.sql、src/{App.jsx,style.css}、
miniprogram/、tests/{workflow.test.js,browser.mjs}、scripts/。
**Structure Decision**: 单仓库Node共享API，避免两端重复业务逻辑。

## Complexity Tracking
无章程豁免。PGlite解决本机没有Postgres/Docker问题，不声称其单实例测试等同真实多连接生产验收。
