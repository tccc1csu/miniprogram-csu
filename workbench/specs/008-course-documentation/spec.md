# Feature Specification: Course Documentation Alignment

**Feature Branch**: `feat/unified-cloud-workbench`
**Created**: 2026-11-27
**Status**: Complete
**Input**: User description: "补全文档，统一课程合并稿、UML图、数据库设计、SRS/SDD/STD和README，并与当前网页和小程序实现一致。"

## User Scenarios & Testing

### User Story 1 - Read one coherent course assignment (Priority: P1)

作为课程作业评阅者，我可以从一份合并稿读完 A 业务建模、B 需求、C 分析和 D 设计，并且每个图、用例编号和业务规则都能追溯到当前工作台。

**Independent Test**: 打开 `docs/course-assignment.md`，检查 A-D 四阶段、图链接、用例编号、当前角色和六部门业务均能从目录进入。

### User Story 2 - Inspect UML models without ambiguous responsibility (Priority: P1)

作为 UML 课程评阅者，我可以在业务用例图、系统用例图、序列图、类图和状态机图中识别主要责任角色、目标软件边界和消息接收者。

**Independent Test**: PlantUML 源文件可渲染，系统用例图中外部角色在软件边界外，内部自动动作不作为外部参与者，图中编号与规约一一对应。

### User Story 3 - Verify the actual relational design (Priority: P1)

作为设计评阅者，我可以按照当前 `workbench/server/migrations/001.sql` 至 `005.sql` 查看表、主外键、约束和业务审计结构，而不会把旧文档型数据库或过时的课程目标误认为生产模型。

**Independent Test**: 数据库数据字典和关系图能列出当前 38 张业务表及其关键外键，并明确 CloudBase HTTP/RPC 适配层与关系库的边界。

### User Story 4 - Use SRS, SDD and STD for implementation and acceptance (Priority: P2)

作为开发或验收人员，我可以从 SRS 找到需求，从 SDD 找到结构和设计理由，从 STD 找到可重复的测试场景、实测结果和未完成项。

**Independent Test**: 三份文档含版本、范围、角色、业务规则、追踪矩阵、测试环境和限制，并引用当前代码入口和 `workbench/specs/007-mini-unification/validation.md` 的真实证据。

### User Story 5 - Find the public entry and safe test access quickly (Priority: P2)

作为第一次使用者，我打开 README 就能先看到云端网站、原有小程序二维码和测试账号说明，再看到安装、开发和部署信息。

**Independent Test**: README 顶部包含可访问网页链接、`docs/assets/experience-qrcode.png`、按身份列出的测试账号和不公开密码的提示；README 不包含 `.data`、token 或密钥。

### Edge Cases

- 旧课程稿、旧文档数据库和旧云函数仍存在时，文档必须标记它们为历史参考，不得把它们作为当前运行基线。
- 当前消息机器人和微信订阅消息未配置时，文档必须写成站内 outbox 记录，不得宣称已发送群消息。
- 教师和外部用户参与业务但不计工时时，SRS、数据库和测试文档必须保持一致。
- 强制归档时没有自动工时，导出报表仍要能显示任务备注、规则工时、核定工时和调整原因。

## Requirements

### Functional Requirements

- **FR-001**: 系统必须以当前网页、原位统一小程序和唯一关系型后端作为实现基线。
- **FR-002**: 课程合并稿必须覆盖愿景、业务用例、现状/改进业务序列、系统用例规约、分析模型、数据库设计、业务层和表示层。
- **FR-003**: UML 图必须使用明确的系统边界、主要责任和动宾式用例名；允许真实共享责任，但不得为减少连线删除必要角色。
- **FR-004**: 推文流程文档必须表达采编内容审核、运营部长内审、不同指导老师一审和二审、发布、自动归档和一次计时。
- **FR-005**: 文档必须表达所有六部门业务：办公、采编、运营、摄制、美编、原创，以及跨部门外部需求和工作登记。
- **FR-006**: 数据库设计必须以 `workbench/server/migrations` 和云端 HTTP/RPC 迁移为准，包含版本、审核、批注、附件、备注、默认承接、轮值和封存事实。
- **FR-007**: 教师和外部用户不得进入工时统计；特殊工时调整必须保留原值、核定值、原因、操作者和时间；封存快照不可变。
- **FR-008**: SRS、SDD、STD 必须替换旧的“小程序+文档数据库”口径，并分别提供需求、设计和测试追踪。
- **FR-009**: README 必须把网站链接和原二维码置于首屏信息区域，并列出可用测试账号的身份和测试路线，不公开密码或运行凭据。
- **FR-010**: 所有“根据 PPT 第几页”等过程性表述必须从交付稿中删除；课程依据只保留为参考说明。

### Key Entities

- **CourseAssignment**: A-D 课程合并稿及其维护分文件、图和引用。
- **UseCase**: 主要执行者、前后置条件、路径、字段和规则组成的系统责任。
- **Task**: 统一任务事实，包含业务类型、版本、状态推导、备注和归档事实。
- **Review**: 绑定任务版本和审核阶段的事件；审核岗位安排与实际审核事件分开。
- **Worklog**: 内部成员的规则工时、核定工时、倍率、来源和调整审计。
- **ReportSeal**: 周报封存及其不可变行快照。

## Success Criteria

- **SC-001**: `docs/course-assignment.md` 的本地链接、图编号和用例编号检查全部通过。
- **SC-002**: 所有课程图源可用 UTF-8 渲染，PNG/SVG 无语法错误和替换字符。
- **SC-003**: SRS、SDD、STD 中的当前角色、六部门、推文流程、教师/外部工时排除和自动归档规则一致。
- **SC-004**: README 首屏能在一次滚动内找到云端网页、二维码和测试账号入口。
- **SC-005**: 既有 `workbench/npm test`、`npm run build` 和文档模型检查保持通过。

## Assumptions

- 当前关系库的业务表以迁移脚本为准；文档中“38 张业务表”按当前迁移的业务表统计，不把 CloudBase `_state`、`_requests`、`_uploads` 适配表算作业务表。
- 历史账号用于验收而非真实结算迁移；公开 README 只列用户名、角色和测试路线，密码通过部署资料提供。
- 用户要求直接提交更新到既有 GitHub 分支，旧生产文档数据库和旧函数不删除。

## Delivery Evidence

实施和验证见[validation.md](validation.md)；用例、图、数据库字典、工程文档与README已统一，现有测试和构建通过。交付到既有功能分支，不合并默认分支、不部署或改动生产数据。

## Revision: PlantUML notation and complete ERD

用户复核要求：业务工人、业务实体采用课程UML图形符号，整理系统序列，并按所提供的单页大图补齐完整数据库设计。

- **FR-011**: 六张业务序列必须使用业务工人和业务实体图形符号；任务档案、稿件清单、结算台账是业务实体，软件整体不冒充业务实体。所有图保留可重复渲染的PlantUML源文件。
- **FR-012**: 区分黑盒系统序列与白盒分析序列；前者只表达参与者与软件整体的系统事件，后者使用边界、控制、实体图形、生命线、激活条与返回，成功和失败路径明确。
- **FR-013**: 增加单画布完整物理ERD，包含实际38表、214字段和全部79项外键（含复合外键及跨分区外键）；字段标记主键、外键、非空和类型，按业务分区着色。额外保留便于阅读的分区图。
- **FR-014**: 完整ERD交付PlantUML、SVG、PNG与可缩放单页PDF，课程合并稿、设计稿和SDD链接一致；校验字段与关系覆盖，人工检查渲染版式与中文。

验收：图源可由PlantUML无错误生成；业务序列无普通方框伪装的业务工人；黑盒序列不包含内部对象；完整ERD无缺表、缺字段或缺外键，PDF为单页且可放大阅读。
