# Implementation Plan: 角色工作台

**Branch**: 006-role-workspace（非 Git checkout） | **Date**: 2026-11-26 | **Spec**: [spec.md](spec.md)

## Summary
沿用现有任务和关系型后端，添加服务端生成的本人工作上下文；前端重组导航、角色首页及任务视图，复用已有详情和操作。

## Technical Context
**Language/Version**: JavaScript ES modules, React 19, Node 24
**Primary Dependencies**: Vite 7, Express 5, lucide-react, Playwright
**Storage**: PostgreSQL / 本地 PGlite；无迁移
**Testing**: 隔离内存数据库、真实 API 与 Edge 浏览器；既有 workflow/center/browser 回归
**Target Platform**: 桌面与移动浏览器，320—1440px
**Project Type**: web application
**Performance Goals**: 单次任务列表请求复用各视图，无逐卡请求；首页额外工时/快照请求仅合适角色
**Constraints**: 保留原有路由、接口权限及归档事务；失败不显示为零；500 项上限说明
**Scale/Scope**: 六类业务，五类使用场景；管理员沿用全中心管理

## Constitution Check
- I：业务基准已读；会话确认记录 decisions.md 第15条。PASS。
- II：工作上下文由服务端按会话计算，不信任客户端身份；写接口继续独立鉴权。PASS。
- III：不变更归档和计发事务。PASS。
- IV：老师和外部不请求工时，工时与快照按现有权限。PASS。
- V：本目录规格、设计、任务、分析先行；集成验证隔离真实业务。PASS。
设计后复核：全部通过，无需章程修改。

## Project Structure
- specs/006-role-workspace/：spec/plan/research/data-model/contracts/ui/quickstart/tasks/validation
- server/workspace.js：工作上下文纯函数；domain.js：可见列表增加 viewer 元数据
- src/Workspace.jsx：分组导航定义、角色首页、任务列表/看板和任务关系视图
- src/workspace.css：角色首页及导航响应式样式
- src/App.jsx：壳与路由集成、报表参数；src/Workflows.jsx：新建预选业务
- tests/workspace.mjs：真实跨角色浏览器验收与截图

**Structure Decision**: 增量模块，使用已有 React/API，不引入路由库和新数据存储。

## Complexity Tracking
无章程例外。上下文只为展示与筛选提示，任何操作仍调用原接口校验。
