# Tasks: 供稿发布与工时工作台
**Input**: spec.md、plan.md、research.md、data-model.md、contracts/api.md。
**Organization**: 按故事实现，全部顺序执行；关键业务集成测试先于实现。
## Phase 1: Setup
- [x] T001 初始化Node/React依赖、运行脚本和忽略规则于 package.json、vite.config.js、.gitignore。
## Phase 2: Foundational
- [x] T002 建关系迁移与PGlite/pg适配于 server/migrations/001.sql、server/db.js。
- [x] T003 建真实数据库业务集成测试于 tests/workflow.test.js，先运行失败，再实现。
- [x] T004 实现会话、角色/部门检查、开发账号于 server/auth.js、server/seed.js。
## Phase 3: User Story 1 — 供稿协作
- [x] T005 [US1] 实现需求、指派、文件、不可变版本及范围控制于 server/domain.js、server/app.js（FR001–004、013、017）。
## Phase 4: User Story 2 — 审核
- [x] T006 [US2] 实现固定二部长、教师两审、退回重审与时间线于 server/domain.js（FR005）。
## Phase 5: User Story 3 — 自动归档
- [x] T007 [US3] 实现发布/档案/精确工时/出站单事务与重试约束于 server/domain.js（FR006–008、012、015）。
## Phase 6: User Story 4 — 报表
- [x] T008 [US4] 实现核定审计、视图、筛选汇总、Excel及封存于 server/reports.js、server/app.js（FR009–011）。
## Phase 7: User Story 5 — 移动与报名
- [x] T009 [US5] 实现开放报名及独立加急于 server/domain.js，轻量小程序入口于 miniprogram/（FR014、016）。小程序脚本语法通过；未验证真机。
## Phase 8: Web and Validation
- [x] T010 实现角色首页、任务创建/详情/操作、档案、报表和视图于 src/App.jsx、src/style.css（FR018及US1–5操作入口）。
- [x] T011 运行 npm test；6项集成测试通过（SC001–004）。
- [x] T012 构建并运行桌面/移动浏览器检查于 tests/browser.mjs；浏览器闭环与手机布局通过（SC005）。
- [x] T013 完善 README.md、.env.example，启动 http://127.0.0.1:3001 并验证网页与健康接口可访问。
## Dependencies & Execution Order
T001→T002→T003→T004→T005→T006→T007→T008→T009→T010→T011→T012→T013。
## Implementation Strategy
完整闭环逐步验收；002覆盖表独立记录后续业务。真实群发送和云部署未验证时不能声称已上线。
