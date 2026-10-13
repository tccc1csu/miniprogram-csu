# 软件设计描述（SDD）框架

版本：0.1-draft  
系统：青年传媒中心工作统计与协作小程序

## 1 设计目标

在不改变现有业务边界的前提下，把小程序、云函数、云数据库和通知服务组织成易于学习、实现、测试和演进的系统。设计文档采用 KADA SDD 的架构理由、架构视图、数据设计、界面设计和追踪结构。

## 2 设计原则

1. 权限集中：客户端只负责交互，鉴权、角色校验和状态迁移由云函数执行。
2. 业务可追踪：协同需求、工作记录和通知保留创建人、更新时间、责任人和状态。
3. 配置可演进：部门、时薪、加急倍率、流程关联和消息模板尽量数据化；工时规则来源于会议，由开发者发布并带版本。
4. 小步迭代：先保证任务明细、周汇总和两个核心协同流程稳定，再增加 OPMS 风格的办公能力。
5. 可验证：每个模块都能从需求编号追踪到接口、实体和测试用例。

## 3 架构理由

### 3.1 架构风格

采用微信小程序前端 + 云函数 API + 云数据库的轻量分层架构：

```text
微信小程序页面/组件
        │ utils/db.js 调用统一 API
        ▼
云函数 api：会话、权限、业务规则、统计、状态迁移、通知触发
        │
        ├── 云数据库集合
        ├── 云存储（如后续上传附件）
        └── 微信订阅消息
```

选择原因：符合现有实现、免维护服务器、适合移动端课程案例；代价是云函数耦合微信平台，需要为测试和未来迁移保留接口边界。

### 3.2 部署视图

| 节点 | 部署内容 | 责任 |
| --- | --- | --- |
| 用户设备 | 微信小程序 | 页面、表单、展示、临时状态 |
| 微信云环境 | `cloudfunctions/api` | API、鉴权、规则和数据访问 |
| 云数据库 | users、members、departments 等集合 | 持久化业务数据 |
| 微信消息服务 | 订阅消息 | DDL 和任务流转提醒 |

## 4 架构视图

### 4.1 用例视图

待绘制：系统总用例图、认证用例图、工作量用例图、协同流转用例图、信息工具用例图。

参与者：`ACT-ADMIN`、`ACT-MINISTER`、`ACT-MEMBER`、`ACT-SYSTEM`。

### 4.2 逻辑视图

建议逻辑分层：

- 表现层：`pages/*`、WXML、WXSS、页面状态和表单校验。
- 客户端服务层：`miniprogram/utils/db.js`、会话缓存、统一错误提示。
- 应用服务层：云函数 action 分发、角色权限、状态机和统计服务。
- 领域层：工作记录、协同流转、投票、通知、规则计算。
- 持久化层：云数据库集合、索引和数据初始化。

### 4.3 交互/过程视图

重点绘制以下时序图：

1. 微信授权登录和账号密码登录。
2. 部长批量保存周工作量。
3. 采编办公协同从采编报备到管理员审核、自动归档和生成任务明细。
4. 摄制预约从创建到指定办公部成员归档，并为摄制干事和归档成员生成任务明细。
5. DDL 前提醒与站内通知兜底。

状态机初稿：

```text
采编协同：draft -> submitted -> assigned -> feedback -> reviewing -> archived
摄制预约：draft -> submitted -> assigned -> executing -> completed -> archived
通用异常：任一可编辑状态 -> rejected/returned -> submitted
```

### 4.4 开发视图

```text
miniprogram/
├── pages/                 页面模块
├── components/            可复用组件
├── utils/db.js            API 访问边界
├── utils/constants.js     角色、集合和业务常量
└── utils/taskSubscription.js 订阅消息能力
cloudfunctions/api/
└── index.js               统一云函数入口与业务 action
```

页面模块与需求映射：

| 页面模块 | 主要职责 | 需求 |
| --- | --- | --- |
| index/profile | 首页仪表盘、个人入口 | FR-AUTH、FR-STAT |
| upload/records/weeklyTable | 工作量、记录、周报 | FR-REC、FR-STAT |
| statistics/memberDetail | 统计与成员历史 | FR-STAT |
| manage | 组织、成员、账号管理 | FR-ORG |
| collaboration/handoffs/production | 协作流程 | FR-COL |
| contacts/suggestions | 通讯录、建议投票 | FR-INFO |
| allowanceRules/responsibilities/taskNotifications | 规则、职责和提醒配置 | FR-COL、FR-INFO |

### 4.5 物理视图

待补充：云环境 ID、集合权限、索引配置、云函数部署拓扑、备份恢复流程和正式/测试环境隔离图。

## 5 数据设计

### 5.1 核心实体目录

| 编号 | 集合 | 关键职责 |
| --- | --- | --- |
| ENT-USER | users | 账号、角色、部门、openid、token 会话 |
| ENT-DEPT | departments | 部门字典和启用状态 |
| ENT-MEMBER | members | 成员资料及账号关联 |
| ENT-WORK-DETAIL | work_details | 单项任务来源、成员、工时、规则版本和归档信息 |
| ENT-WEEKLY-RECORD | weekly_records | 成员某周任务明细汇总、总工时和津贴依据 |
| ENT-CONTACT | contacts | 通讯录扩展资料 |
| ENT-SUGGESTION | suggestions | 活动建议与审核状态 |
| ENT-VOTE | votes / vote_records | 投票主题、选项和投票记录 |
| ENT-NOTIFICATION | notifications | 活动和系统通知 |
| ENT-HANDOFF | handoffs | 协同需求、派发、反馈和归档 |
| ENT-RULE | allowance_rules | 工时、时薪、加急和自动记工时规则 |
| ENT-RESPONSIBILITY | workflow_responsibilities | 流程与部门职责关联 |
| ENT-SUBSCRIPTION | notification_subscriptions/settings | 订阅消息授权与模板配置 |

### 5.2 数据设计待补充模板

每个实体按以下字段描述：实体编号、集合名、用途、主标识、必填字段、状态字段、创建/更新时间、关联实体、索引、权限边界、删除策略和示例 JSON。

### 5.3 一致性与索引原则

- `users.name` 唯一；`users.token` 和 `users.openid` 建索引。
- `work_details` 按 `sourceType + sourceId + memberId` 防止同一任务重复计入。
- `weekly_records` 按 `memberName + department + week` 保证每成员每周一条汇总记录。
- `handoffs` 按状态、更新时间、来源部门、目标部门建立查询索引。
- 投票记录按 `voteId + voterOpenid` 唯一，防止重复投票。
- 演示数据使用 `seedTag`，正式数据不得误删演示记录。

## 6 接口设计

统一入口：`miniprogram/utils/db.js` -> `cloudfunctions/api`。

动作分组：`login`、`wechatLogin`、`register`、`checkSession`、`addRecord`、`getRecords`、`getStatistics`、`manageData`、`manageContacts`、`manageSuggestions`、`manageVotes`、`manageNotifications`、`manageHandoffs`、`manageAllowanceRules`、`manageResponsibilities`。

每个动作的接口说明需补充：请求字段、响应字段、错误码、鉴权要求、幂等策略、分页/排序、审计字段和测试样例。

## 7 界面设计

待补充页面级设计表：页面目标、进入条件、角色可见性、主要组件、空状态、加载状态、错误状态、成功反馈和返回路径。优先绘制：首页、上传、协同详情、管理员审核、周报和规则配置。

## 8 设计风险

- 单一统一云函数入口在功能继续增多后可能难以维护，应按领域拆分内部 service。
- 任务明细与周汇总必须分层维护，避免重复归档、人工补录和自动记工时叠加。
- 订阅消息受微信授权和模板限制，必须保留站内通知作为可靠兜底。
- 工时规则由会议确定、开发者维护；规则发布要有版本和生效时间，不能在业务流程中由管理员随意修改。
- 管理员“重置测试数据”具有高风险，正式环境必须通过配置关闭并增加二次确认。

## 9 变更记录

| 版本 | 日期 | 内容 |
| --- | --- | --- |
| 0.1 | 2026-09-21 | 建立分层架构、视图、实体和接口设计框架 |



