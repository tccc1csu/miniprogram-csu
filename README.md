# 青年传媒中心工作统计与协作小程序

面向青年传媒中心的工作协作、任务归档、工时记录和津贴统计系统。采用微信小程序与 CloudBase 云开发，同时作为《系统分析与设计》课程案例维护业务、需求、分析和设计文档。

维护原则：以可用小程序为实现基线，业务规则变更同时检查课程 A–D 工件；规范化数据库设计通过兼容演进落地。本文按 2026-10-19 当前工作区代码整理，线上部署版本需在发布时核对。

## 阅读入口

| 目的 | 入口 |
| --- | --- |
| 阅读完整课程作业 | [课程作业合并稿](docs/course-assignment.md) |
| 按 A–D 查阅模型、图源和设计 | [课程文档导航](docs/README.md) |
| 放大数据库总图 | [SVG 总图](docs/diagrams/database/db-overview.svg) · [PNG](docs/diagrams/database/db-overview.png) |
| 核对当前功能与规范目标的差异 | [数据库与三层设计](docs/design/01-database-design.md) · [现行审核、附件与计量说明](docs/implementation/06-one-click-review-and-documents.md) |
| 了解兼容改造、发布与回退 | [实现对照历史](docs/implementation/01-course-runtime-alignment.md) · [发布与回退](docs/implementation/02-rollout-and-rollback.md) |
| 接手开发环境 | [交接说明](HANDOVER.md)（历史配置说明需结合当前代码核对） |

## 体验入口

<img src="./docs/assets/experience-qrcode.png" width="240" alt="季录商驿体验版小程序码">

微信扫码进入「季录商驿体验版」，体验路径 `pages/index/index`。该体验码有效期至 2026-10-26，过期后需在微信开发者工具中重新生成。

课程文档：[《系统开发与设计课程分析》](./docs/系统开发与设计课程分析.docx)（Word 格式，含系统分析与数据库设计说明）。

课程作业 PDF：[1602240111唐成.pdf](./1602240111唐成.pdf)（A4 排版，含封面、58 张图与页码，由 [docs/course-assignment.md](./docs/course-assignment.md) 生成）。

## 角色与组织

系统账号角色统一为 **管理员、部长、普通成员**。中心包括办公、采编、美编、摄制、运营、原创六个部门；“兄弟部门”为外部协作账号的部门标识，不新增第四类角色。具体权限还受所属部门、当前承接人和指定审核岗位限制。

办公部部长负责生成、导出中心周报，其他部长核对本部门记录。指导老师是组织的业务负责人和课程稿件审核责任人；维护管理员与指导老师的业务职责应分别理解，实际接口权限以云函数校验为准。

## 现有功能与业务流程

| 模块 | 当前代码支持的流程 |
| --- | --- |
| 身份与组织 | 微信绑定登录、账号密码登录、注册、14 天会话；部门、成员和账号角色维护，自助注销 |
| 工作记录与周报 | 成员周上报、部长批量维护、依据附件、个人记录、部门统计；办公部部长／管理员查看中心范围周报，支持复制文本与 CSV |
| 采编办公协同 | 采编提交需求 → 办公部长派发 → 承接成员提交同步成果 → 相关部长或管理员审核归档；原创写作、办公同步和审核分别按规则计量 |
| 摄制预约 | 成员预约 → 摄制部长派发 → 摄制成员提交成果并指定办公归档成员 → 指定成员归档；制作贡献使用任务保存的加急倍率，归档审核不再重复乘倍率 |
| 外部需求 | 兄弟部门成员／管理员选择六个承接部门之一，提交说明、附件及可选截止日期 → 目标部长接单派发 → 承接人提交成果 → 目标部长／管理员审核归档；归档时承接干事按承接部门规则计工时，审核部长固定 2 小时，外部发起人不计稿费 |
| 公众号排版 | 兄弟部门发布需求，或运营部长建立排班 → 运营部长接单派发并指定干事、一审、二审 → 干事提交成果 → 一审 → 二审 → 自动归档结算；两岗同人时一审通过即归档 |
| 部门项目 | 多阶段、多部门任务，部门成果与附件提交、阶段流转和历史记录；通用阶段完成暂不自动新增工时 |
| 附件与文件库 | 业务材料、成果及工作记录附件；公共文件库独立管理。通用附件组件保留上传状态和业务引用，外部需求页保留自身上传入口 |
| 其他工具 | 通讯录、活动建议、一键审核、投票、通知、订阅消息授权、截止提醒、工时规则、部门职责、修复数据表 |

审核通过不要求另填意见，服务端记录实际操作人、时间与通过结论；退回可提交修改意见。排版由当前指定的一审／二审部长或管理员审核；旧排版任务保留一次归档的兼容路径。

工时类型为稿件写作、视频制作、美编设计、日常办公。排版及其他已配置的审核贡献按规则合计 2 小时，由不重复的贡献成员分摊；规则和部门时薪由管理员维护。公众号排版的加急报名用于提醒，不自动套用摄制的 1.5 倍倍率。

## 实现与课程目标的边界

当前小程序使用 **20 个 CloudBase 集合**；课程数据层设计为 **55 张关系基表、5 个派生视图**。两者通过业务事实和字段映射对应，课程 DDL 是本地约束验证模型，不能直接作为云数据库迁移脚本。

- 自动归档、贡献依据、规则快照与周汇总采用事务结算；同一来源、贡献类型、成员去重，失败整体回滚。
- `weekly_records` 仍是兼容的可调整周汇总。当前导出是实时统计，尚未实现课程中的封存周报，不能按新规则重算旧记录冒充历史事实。
- 摄制资源／起止时段冲突、开放任务抢单、稿件版本审查及部分阶段责任仍有课程目标与代码差异，详见对照文档；不将作业图当作已实现功能清单。
- 本地检查可验证代码和模型；部署版本、真实云事务、索引和订阅消息仍须在目标云环境验证。

## 项目结构

```text
miniprogram/                 微信小程序前端（app.json 注册 22 个页面）
  pages/                    统计、协作、审核及管理页面
  components/               documentAttachments 等公共组件
  utils/db.js               api 云函数调用与会话封装
cloudfunctions/api/         统一业务云函数
  index.js                  鉴权、业务处理和统计
  workload-ledger.js        贡献去重、规则快照与事务计量
  business-documents.js     业务附件登记与引用校验
  schema-audit.js           只读结构审计
  tests/                    云函数与前端契约测试
docs/                       课程作业、图源、数据字典及生成／检查工具
server/                     历史 Node/SQLite 实现，非当前运行后端
```

前端通过 `miniprogram/utils/db.js` 调用统一 `api` 云函数；数据库权限在服务端校验。日常运行无需启动 `server/`。

## 本地运行与部署

1. 用微信开发者工具导入项目根目录；在 `project.config.json` 核对 AppID，在 `miniprogram/app.js` 核对目标 CloudBase 环境。
2. 右键 `cloudfunctions/api`，选择“上传并部署：云端安装依赖”。前端与云函数需使用相匹配的版本。
3. 编译后登录，维护部门、成员、角色和工时规则。业务初始化会补齐缺失集合；管理员也可使用“我的 → 工具 → 修复数据表”。该操作不等于创建控制台索引或迁移历史数据。
4. 配置云数据库仅由云函数读写的权限；索引按实际查询和 [发布与回退](docs/implementation/02-rollout-and-rollback.md) 核对。旧数据创建唯一索引前先检查重复记录。
5. 如需微信提醒，在“任务提醒”中配置模板 ID 与实际字段，成员授权订阅；核对云函数 `config.json` 的 `deadlineChecker` 定时触发器和订阅消息权限。

代码保留测试账号与演示数据开关 `ENABLE_TEST_ACCOUNTS`、`ENABLE_DEMO_DATA`。测试环境可用 `测试管理员 / 123456`；其他演示账号以 `index.js` 的 `TEST_ACCOUNTS` 为准。“重置测试数据”会清空当前环境数据，属于测试工具；正式环境应关闭测试开关，回退采用版本恢复及数据备份方案。

## 云数据库集合

| 分组 | 集合与职责 |
| --- | --- |
| 身份与组织 | `users` 账号与会话；`departments` 部门；`members` 成员 |
| 周统计 | `weekly_records` 兼容周记录与汇总 |
| 业务协作 | `handoffs` 采编、摄制、外部需求和排版文档，通过 `workflowType` 区分；`project_tasks` 多阶段项目 |
| 计量依据 | `contribution_basis` 来源和贡献依据；`contribution_measurement` 基础工时计量 |
| 规则与快照 | `allowance_rules` 当前配置；`contribution_policy` 计量快照；`allowance_standard` 时薪快照；`workflow_responsibilities` 部门职责 |
| 附件 | `files` 公共文件与业务附件登记，使用场景区分 |
| 活动与通讯录 | `contacts`、`suggestions`、`votes`、`vote_records`、`notifications` |
| 订阅提醒 | `notification_settings`、`notification_subscriptions` |

新规范计量字段采用 `snake_case`；旧页面和 API 的 `camelCase` 字段保留兼容映射。成员 ID 用于稳定关联，姓名只用于展示，不通过重命名或批量删集合强行统一。

## 验证与文档维护

在项目根目录运行：

```powershell
npm --prefix cloudfunctions/api test
python -X utf8 docs/tools/check_analysis_models.py
python -X utf8 docs/tools/check_database_design.py
python -X utf8 docs/tools/build_course_assignment.py
python -X utf8 docs/tools/render_course_diagrams.py --audit-only --scope all
git diff --check
```

当前基线为 46 项云函数测试、28 份用例规约、44 张分析图和 122 项数据库设计检查。模型检查不代替真机业务验证；统计数量随功能扩展同步维护。

图源为 UTF-8，重新生成 PNG/SVG 使用统一出图脚本，明确指定编码：

```powershell
python -X utf8 docs/tools/render_course_diagrams.py --jar ../tmp/plantuml.jar
```

`--jar` 可替换为本机 PlantUML JAR 的路径；Java 和可显示中文的字体需可用。数据库总图采用独立紧凑布局，生成步骤见 [课程文档导航](docs/README.md)，不要用默认 PlantUML 排版覆盖总图。

每次业务变更沿“愿景／业务 → 用例 → 分析对象与状态 → 数据／业务／表示层 → 实现与测试”检查影响范围；改分文件后重建合并稿。发布前先 fetch 并查看 Git 差异、建立可追溯检查点和数据备份，代码回退与云数据恢复分别处理。
