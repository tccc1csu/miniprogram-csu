# 青年传媒中心系统分析与设计文档

本目录用于把“青年传媒中心工作统计与协作小程序”逐步规范为一套系统分析与设计课程案例。文档参考 KADA 项目的 SRS、SDD、STD 组织方式，但不复制其业务名称、角色安排或数据库设计。

## 作业阅读入口

[数据库设计](./design/01-database-design.md)已加入合并稿第 6 节。主图为[一张完整数据库总图（SVG，可放大）](./diagrams/database/db-overview.svg)，含七个分区、全部表、原分析实体名称及字段旁外键目标；表外仅绘制关键关系。[高清 PNG](./diagrams/database/db-overview.png)与[完整关系 PlantUML 图源](./diagrams/database/db-overview.puml)一并保存。20 个分析实体逐项对应 47 张规范化基表及 5 个派生视图；表的拆分理由见第 6.3 节。

[分析部分（图为主）](./analysis/05-analysis-models.md)已补充分析类图、20 个用例对应的分析序列图和核心对象状态机图，并同步至下方合并稿第 5 节。课程依据、假设与核对记录见[分析评审记录](./analysis/06-analysis-review.md)。

[课程作业合并稿](./course-assignment.md)包含愿景、业务建模图、系统用例图、用例规约、分析模型与数据库设计。业务决定、待确认事项与框架计划保留在本 README；合并稿由以下分文件内容整理，分文件变更后需同步合并稿。

## 当前课程工件

1. [愿景](./analysis/01-vision.md)：按照课程表格写系统、目标组织、老大、目标、度量指标、对比时间和改进值。
2. [业务建模](./analysis/02-business-modeling.md)：业务用例、现状业务序列图和改进业务序列图。
3. [课程工件评审清单](./analysis/03-course-checklist.md)。
4. [业务用例图源文件](./diagrams/business-use-case.puml) 与 [渲染图](./diagrams/business-use-case.png)。
5. [现状业务序列图源文件](./diagrams/current-business-sequence-editorial-office.puml) 与 [渲染图](./diagrams/current-business-sequence-editorial-office.png)。
6. [改进业务序列图：采编办公协同](./diagrams/improved-business-sequence-editorial-office.puml)。
7. [改进业务序列图：摄制预约](./diagrams/improved-business-sequence-production-booking.puml)。
8. [系统用例图说明](./diagrams/system-use-case-notes.md) 与 [系统用例图源文件](./diagrams/system-use-case.puml)。
9. [系统用例规约](./requirements/system-use-case-specifications.md)。
10. [本轮业务总结与审阅记录](./analysis/04-business-review.md)。
11. [通用流转改进图](./diagrams/improved-business-sequence-general-workflow.puml)、[人工周统计图](./diagrams/current-business-sequence-weekly-statistics.puml)、[改进周统计图](./diagrams/improved-business-sequence-weekly-statistics.puml)。
12. 系统用例补充视图：[部门流转](./diagrams/system-use-case-workflow.puml)、[统计与组织支撑](./diagrams/system-use-case-statistics.puml)。

## 项目口径（放在 README，不放在愿景作业表中）

- 首要价值是自动形成任务明细、成员周汇总和津贴统计依据；愿景不再把缩短协同周期作为系统主要目标；当前先以减少每周人工整理耗时为改进方向，具体降幅待确认，试运行用于验证。
- 目标组织是整个青年传媒中心，老大是指导老师；系统角色统一为管理员、部长、普通成员。
- 2026 年 9 月访谈中的人工采编办公协同为：采编部成员发布任务和稿件材料，办公部成员完成挂网或同步并反馈，指导老师审核后结束。
- 访谈中从任务发布到指导老师审核完成平均约 2 天；每周人工整理工作量约 1 小时。这些是现状基线，不是系统必须承诺的周期改进值。
- 每项应计工作形成任务明细；再按成员和周次形成一条周汇总记录。
- 采编任务保存标题、作品名称、原创或转载类型、投稿平台、可选截止日期、成果说明和成果链接，便于归档和统计。
- 摄制预约提前不足 2 天时按 1.5 倍率标记加急；发生时间冲突时直接拒绝，不创建预约。
- 摄制流程为：预约人发起、摄制部部长派发（新增需求还包括已开放任务抢单）、摄制部成员完成、指定办公部成员归档；摄制和归档两类工作都应形成明细。
- 津贴和工时规则由会议决定，由开发者维护；这属于后续需求和设计的输入，不在本轮愿景表中展开。

## 当前阶段边界

当前已从愿景、业务建模和需求推进到分析模型与数据库设计，新增分析类图、分析序列图、分析状态机图及关系数据库总图。SRS、SDD、STD 框架保留为后续骨架，本轮不继续修缮。

- [SRS 框架](./SRS-framework.md)
- [SDD 框架](./SDD-framework.md)
- [STD 框架](./STD-framework.md)
- [OPMS 功能参考清单](./OPMS-reference-checklist.md)

## 维护规则

- 先稳定愿景和业务责任，再从业务序列图派生系统用例和用例规约。
- 业务用例图标明主要服务对象；具体业务由各环节唯一责任人处理，跨角色协作由序列图表达。
- 序列图实线消息命名为接收者执行的动作；虚线仅返回结果。自消息可表达参与者自身责任。
- 用例规约使用业务语言，不写页面、按钮、组件、数据库或接口调用。
- 参考项目只用于借鉴文档结构，不直接移植其业务。


## 2026-10-08 修订与待补充信息（不放入愿景作业）

- 愿景已压缩到减少周统计人工耗时，删除价值排序、范围清单和周期缩短承诺；原愿景中的业务决定与口径已归入本 README。
- 当前愿景改进值先写低于 60 分钟/周；具体降低比例尚未由用户确定，不能当作已达成效果或课程硬性验收要求。
- 2026-10-09 已补充确认办公部负责津贴统计、办公部部长生成／导出中心周报；不沿用旧图“指导老师亲自整理 Excel”的未经确认假设。
- 摄制预约还可进一步明确：2 天按 48 小时还是自然日、冲突检查对应的资源范围、1.5 倍率对各类贡献的适用范围。已有阈值、倍率与冲突拒绝决定保持有效。
- 业务用例图区分外部服务对象与内部业务工人；系统图按主要责任划分核心用例。辅助账号、部门维护等不再拼进一次协同的业务时序。
- 旧 UC-COL-001 拆为 UC-ED-001～004，旧 UC-COL-002 拆为 UC-PR-001～004；本轮不修缮 SRS/SDD/STD，其旧追踪编号暂不视为最新版。
- 全部图源使用 PlantUML；course-notation.iuml 用 sprite 重现课程第 87 页的人／非人图例。用本地 PlantUML 1.2024.6 生成 PNG 与 SVG。


## 2026-10-09 业务补充与修订

详细转录、来源对照及尚未确认的事实见[业务总结与审阅记录](./analysis/04-business-review.md)。本轮共 6 个业务用例、10 张图（1 张业务用例图、6 张序列图、3 张系统用例视图）、20 份系统用例规约（含公共登录）。

- 纳入办公、摄制、采编、运营、美编、原创六个部门；外部门是业务服务对象。现有常量中的“兄弟部门”不作为确认外部人员可登录的充分证据。
- 采编需求截止日期改为可选；采编原创贡献与办公同步贡献分开计量；转载不生成原创写作贡献。
- 摄制保留两天、1.5 倍率、冲突拒绝及指定办公人员归档；补充抢单和派发争用同一任务时的唯一承接约束。先记有效工时，周报结合部门时薪及规则计算津贴，倍率不得重复使用。
- 办公部部长生成并导出中心周报；指导老师是统计需求方与稿件二审责任人；小程序维护职责另行说明。
- 通用流转按阶段划分职责，以“美编设计 → 运营推文”作为具体拟开发实例。发起成员编排、部长确认阶段及通用任务最终归集时点均为建模方案，仍需业务评审；不是已确认会议制度或已上线事实。
- 运营推文的一审后送老师二审由手写图支持；图 6 中审核后发布是拟开发实例的安排，不反过来更改截图中采编协同“同步后老师审核”的已确认顺序。
- 手写图说明老师审查所有稿件；采编部与原创部的一审岗位和衔接尚未完整说明，不凭运营部情况类推。
- 尚未收到外部门登录方式和维护管理员审核权限的确认。文档暂按中心成员登记需求、指导老师执行审核描述主要路径，保留真实需求方；这些不是对现有系统权限作出的修改。
- 原创部名称从手写图辨读并与代码中的部门名称交叉核对；用户尚未单独回复名称确认。
- 现状图保留 2026 年 9 月访谈的人工流程基线；2026 年 10 月截图为现有小程序流程说明，未执行真实任务验证，不能据此认定所有组织业务已迁入系统。
- 只更新课程作业及其分文件、图源和渲染图，SRS／SDD／STD 框架待用户确认后再修缮。

## 2026-10-10 补充系统用例总图

- 新增[完整系统用例总图](./diagrams/system-use-case-overview.png)、[PlantUML 图源](./diagrams/system-use-case-overview.puml)和[SVG](./diagrams/system-use-case-overview.svg)，放在合并作业第 3.1 节；原三个分业务视图保留，图号顺延。
- 总图覆盖全部 20 份规约，包含公共登录及微信授权辅执行者；三个账号角色均可发起摄制预约，不以简化图形删去真实参与关系。
- 参照本次课件 PDF 第 138～141 页的边界、执行者和业务序列图映射，第 142 页的辅执行者含义及第 150 页的命名要求。主执行者指向用例；用例指向需提供帮助的辅执行者；不把自动核算内部步骤拆成孤立用例。
- 课件来源：`D:/xwechat_files/wxid_5dtr00kf6nc822_1671/temp/RWTemp/2026-09/9e20f478899dc29eb19741386f9343c8/系统分析与设计-精简2026-9(2).pdf`。页码为 PDF 物理页。
- 当前作业共有 11 张图；原 2026-10-09 的 10 张图数量为当日版本记录。

## 合并稿更新与校验

分析图源、PNG 与 SVG 位于 `docs/diagrams/analysis/`。分析部分共 34 张图：9 张类图、20 张序列图、5 张状态机图；合并稿图号为 12～45。类图包含四张领域视图、一个归档职责实例及四张覆盖全部用例的边界／控制职责视图。状态图分别描述采编协同、摄制预约、运营推文阶段、美编设计阶段和流转任务整体。模型中仍未确认的会议细则沿用原有待确认项，不视为新增制度。

2026-10-13 补齐全部控制类声明、当前送审版本及台账规则关联；归档状态图改为条件核验在迁移前、贡献归集在迁移动作中，拒绝成果分支不再继续计量。分析模型与章节的生成脚本已保存到 `docs/tools/`，可随文档维护。

分析图形语法和渲染命令：

    python docs/tools/build_analysis_models.py
    python docs/tools/write_analysis_chapter.py
    java -jar <工具目录>/plantuml.jar -charset UTF-8 -checkonly "docs/diagrams/analysis/*.puml"
    java -jar <工具目录>/plantuml.jar -charset UTF-8 -tpng "docs/diagrams/analysis/*.puml"
    java -jar <工具目录>/plantuml.jar -charset UTF-8 -tsvg "docs/diagrams/analysis/*.puml"
    python docs/tools/check_analysis_models.py

运行 `python docs/tools/build_course_assignment.py` 可同步合并稿并检查图源、规约编号与本地链接。修改图源后仍需运行下方 PlantUML 渲染命令并目视检查图片。

## 课程核对

数据库设计依据本次课件第 398～403 页，规范化说明见第 6.5 节；[设计评审记录](./design/02-database-review.md)保存未确认细则、计算口径与实现限制，不并入作业主文。

数据库附件：[数据字典](./database/data-dictionary.md)、[完整外键清单](./database/foreign-key-relations.md)、[本地参考 DDL](./database/schema.sqlite.sql)、[验证记录](./database/verification.txt)。SQLite 仅用于内存数据库校验；未访问或迁移现有云数据库。八张数据库分视图保留为辅助资料，作业中展示一张总图。

数据库工件再生成：

    python docs/tools/build_database_design.py
    java -DPLANTUML_LIMIT_SIZE=24000 -jar <工具目录>/plantuml.jar -charset UTF-8 -checkonly "docs/diagrams/database/*.puml"
    java -DPLANTUML_LIMIT_SIZE=24000 -jar <工具目录>/plantuml.jar -charset UTF-8 -tpng "docs/diagrams/database/*.puml"
    java -DPLANTUML_LIMIT_SIZE=24000 -jar <工具目录>/plantuml.jar -charset UTF-8 -tsvg "docs/diagrams/database/*.puml"
    python -X utf8 docs/tools/render_database_overview.py
    node docs/tools/rasterize_database_overview.cjs
    python docs/tools/check_database_design.py
    python docs/tools/build_course_assignment.py

总图已按两份 ERD 示范重排为三列分区：主键用黄色钥匙，外键用独立蓝色箭头，箭头后仅显示目标表名。主图去掉 Type、Null、R 编号及键组合表达式；表外保留 21 条关键关联，箭头指向被引用表。85 条完整外键及复合约束保存在模型、关系清单和数据字典。扩展空间集中在分区边缘。PlantUML 保留完整模型来源；最终 SVG／PNG 使用同一模型数据生成确定性紧凑版式，因此再生成时必须执行上面的总图布局与栅格化两步。栅格化依赖 `@resvg/resvg-js`，本机已安装在项目外的 `../tmp/database-layout-runtime/`；重装可执行 `npm install --prefix ../tmp/database-layout-runtime --no-audit --no-fund @resvg/resvg-js`。

课件：D:/xwechat_files/wxid_5dtr00kf6nc822_1671/msg/file/2026-09/系统分析与设计-精简2026-9(1).pdf。
重点核对第 33、86、87、89、108 页（PDF 物理页）；课程要求是本任务的写作依据，参考项目仅用于文档组织方法。

## 图形再生成

在项目根目录执行（本机已有 Java 和 PlantUML）：

    java -jar <工具目录>/plantuml.jar -charset UTF-8 -checkonly "docs/diagrams/*.puml"
    java -jar <工具目录>/plantuml.jar -charset UTF-8 -tpng "docs/diagrams/*.puml"
    java -jar <工具目录>/plantuml.jar -charset UTF-8 -tsvg "docs/diagrams/*.puml"
