# Tasks: 角色工作台

**Input**: 本目录 spec.md、plan.md、research.md、data-model.md、contracts/ui.md。

## Phase 1: Setup
- [x] T001 完成规格和设计一致性分析，核实忽略规则，记录于 specs/006-role-workspace/analysis.md。

## Phase 2: Foundational
- [x] T002 在 server/workspace.js、server/domain.js 实现 TaskViewer，遵循 data-model.md 的 TaskViewer.createdByMe、TaskViewer.action、TaskViewer.reviewedByMe、TaskViewer.nextLabel、TaskViewer.ownerLabel；可见范围不变。

## Phase 3: US1 角色工作区 (P1 / MVP)
**Goal**: 分组导航与五类角色首页。
**Independent Test**: 五类账号登录，核对入口、真实首页数据与主要工作跳转。
- [x] T003 [US1] 在 src/Workspace.jsx、src/App.jsx 实现分组导航、访问限制和真实数据角色首页，工时请求按角色执行。
- [x] T004 [US1] 在 src/workspace.css 实现桌面与手机布局，src/App.jsx 菜单 Escape 关闭与焦点恢复。

## Phase 4: US2 责任工作视图 (P1)
**Goal**: 本人待办、发起、部门与审核视图。
**Independent Test**: 跨角色流转验证审核分离、无关成员隔离、已审记录和错误/空状态。
- [x] T005 [US2] 在 src/Workspace.jsx 实现任务关系视图、实际下一步和历史已审筛选，引用 data-model.md WorkspaceView.tab。
- [x] T006 [US2] 在 src/App.jsx 为 Reports 接入核定入口查询参数，保留已有报表行为与服务端范围。

## Phase 5: US3 业务快捷入口 (P2)
**Goal**: 六类业务快捷筛选、列表/看板及新建预选。
**Independent Test**: 六类业务筛选与刷新保留、看板打开相同详情、创建受权限限制。
- [x] T007 [US3] 在 src/Workspace.jsx 实现业务入口与列表/看板，遵循 data-model.md WorkspaceView.kind、WorkspaceView.view；在 src/Workflows.jsx 增加合法新建业务预选。

## Phase 6: Polish & Verification
- [x] T008 在 tests/workspace.mjs 编写并运行真实 API/浏览器验收，覆盖 FR-001—FR-010 和 SC-001—SC-005；必要时更新 tests/browser.mjs 的新导航文案。
- [x] T009 运行构建、既有业务与介绍页回归，截图检查桌面/手机，记录 specs/006-role-workspace/validation.md，刷新并打开本地实际页面。

## Dependencies & Execution Order
T001 → T002 → US1 → US2 → US3 → T008 → T009。组件共享文件，顺序集成。
独立验证可并行：US1 五类角色独立会话；US2 一审二审使用独立会话；US3 六业务筛选独立验证。当前单代理顺序实施，不启动其他代理。

## Implementation Strategy
先完成角色导航及真实首页（MVP），再责任视图、业务入口和看板，最后跨角色与全流程回归。所有完成项按实际结果勾选。
