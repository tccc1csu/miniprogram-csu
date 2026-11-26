# Tasks: 两端统一与原位重构

## Phase 1: Setup
- [x] T001 备份原 miniprogram/cloudfunctions/project 配置至 .data/backups/mini-before-unification-20261127，干净集成分支保留原历史。
- [x] T002 完成 specs/007-mini-unification 的规格、研究、规划和契约，记录 specs/decisions.md。

## Phase 2: Foundation
- [x] T003 实现 cloudfunctions/workbenchGateway/index.js 固定上游转发、文件分段及白名单，落实 data-model.md 的 GatewayRequest.path、GatewayRequest.file、GatewayRequest.offset。
- [x] T004 实现 miniprogram/utils/api.js 单一会话与错误处理，落实 data-model.md 的 MobileSession.token、MobileSession.user、MobileSession.scope。
- [x] T005 实现 miniprogram/utils/model.js 业务入口、状态权限展示及任务筛选，miniprogram/app.js/app.json 只注册新逻辑。

## Phase 3: US1 首页与原布局
独立验收：四类角色登录与退出，保留原三底栏和蓝色卡片。
- [x] T006 [US1] 原位替换 miniprogram/pages/login/login 与 index/index 为统一登录、欢迎卡、主待办。
- [x] T007 [US1] 原位替换 miniprogram/pages/collaboration/collaboration，保留纵向卡片、全部/本部门筛选，删除“新版工作台”。
- [x] T008 [US1] 原位替换 miniprogram/pages/profile/profile，删除旧注册、修复表、重置及重复入口。

## Phase 4: US2 移动办理
独立验收：六业务表单与外部推文跨端闭环。
- [x] T009 [US2] 实现 miniprogram/pages/records/records 统一待办、发起、归档、业务与搜索筛选。
- [x] T010 [US2] 实现 miniprogram/pages/create/create 六种业务表单、挂网关联推文及权限入口。
- [x] T011 [US2] 实现 miniprogram/pages/taskDetail/taskDetail 概况、版本、材料、审校、时间线。
- [x] T012 [US2] 在 miniprogram/pages/taskDetail/taskDetail 实现供稿、安排/可选默认、交付、审核、老师调整、发布、报名、备注与强制归档。

## Phase 5: US3 记录与工时
独立验收：部长仅见本人工时，教师和外部无工时入口。
- [x] T013 [US3] 实现 miniprogram/pages/taskNotifications/taskNotifications 本人站内消息，明确微信未接通。
- [x] T014 [US3] 实现 miniprogram/pages/statistics/statistics 本人工时及 miniprogram/pages/allowanceRules/allowanceRules 当前规则。
- [x] T015 [US3] 实现 miniprogram/utils/api.js 鉴权上传、分段下载与本地预览，失败保留补交路径。

## Phase 6: US4 统一交付
独立验收：同仓库运行、云联调、原生产数据零修改。
- [x] T016 [US4] 将允许的 Web/后端/规格/测试复制到 workbench/，根 README.md 与 .gitignore 指明单一运行逻辑。
- [x] T017 [US4] 创建 deployment/mini-unification.md、页面去留表与环境迁移/回退步骤。
- [x] T018 [US4] 执行 tests/mobile-unification.mjs、既有测试及构建，开发者工具编译截图并验证云网关、附件与跨端记录。
- [x] T019 [US4] 部署新增 workbenchGateway，更新 miniprogram/config.js，核实旧函数和旧文档库未被改动。
- [ ] T020 [US4] 扫描 Git 暂存内容，提交并推送 GitHub feat/unified-cloud-workbench；保存 specs/007-mini-unification/validation.md。

## Dependencies
T001→T003/T004→T005→US1→US2→US3→US4；部署前先本地验证，推送前检查秘密排除。
## Parallel opportunities
仅只读 API 与官方接入研究可并行（已执行研究代理）；共享页面与会话实现顺序执行。
## Implementation strategy
先可登录，再替换原导航，再完成六业务闭环和工时，最后云联调、仓库交付。任务勾选仅对应真实完成；微信正式版上传/审核不在此任务中。
