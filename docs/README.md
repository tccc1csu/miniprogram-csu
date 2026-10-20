# 系统分析与设计课程文档

本目录维护青年传媒中心工作统计与协作系统的课程案例。课程 PPT 是建模标准，KADA 的 SRS／SDD／STD 仅作为文档组织参考。当前小程序是可用实现基线，课程目标与实现差异必须明示，不能以图或参考 DDL 代替实际部署。

更新日期：2026-10-19。产品功能与运行步骤见 [项目 README](../README.md)。

## 完整作业与 A–D 导航

首先阅读 [课程作业合并稿](./course-assignment.md)。合并稿由下列分文件生成，修订分文件后须重新生成。

| 阶段 | 作业内容与入口 | 当前工件 |
| --- | --- | --- |
| A 业务建模 | [愿景](./analysis/01-vision.md)、[业务建模](./analysis/02-business-modeling.md) | 一句话愿景及七项要素；7 个业务用例；现状人工协同与周统计；6 张改进业务序列图 |
| B 需求 | [系统用例图说明](./diagrams/system-use-case-notes.md)、[系统用例规约](./requirements/system-use-case-specifications.md) | 1 张总图、3 张分业务视图；28 份规约，包含公共登录、外部需求及公众号排版 |
| C 分析 | [分析模型](./analysis/05-analysis-models.md) | 9 张分析类图、28 张分析序列图、7 张状态机图，共 44 张 |
| D 设计 | [数据库与三层设计](./design/01-database-design.md) | 建立数据层、精化业务层、精化表示层；分析实体与表、业务操作、代码入口追踪 |

合并稿图号连续为 1～58：业务图 1～9，系统用例图 10～13，分析图 14～57，数据库总图 58。数据库另有 9 张辅助分视图，不替代一张完整总图。

常用图形入口：

- [业务用例图](./diagrams/business-use-case.png) · [PlantUML 图源](./diagrams/business-use-case.puml)
- [系统用例总图](./diagrams/system-use-case-overview.png) · [SVG](./diagrams/system-use-case-overview.svg) · [PlantUML 图源](./diagrams/system-use-case-overview.puml)
- [外部需求改进图](./diagrams/improved-business-sequence-external-request.png)
- [公众号排版改进图](./diagrams/improved-business-sequence-operations-layout.png)
- [数据库总图 SVG（可放大）](./diagrams/database/db-overview.svg) · [高清 PNG](./diagrams/database/db-overview.png) · [完整关系 PlantUML](./diagrams/database/db-overview.puml)

## 当前业务口径

- 愿景是减少每周津贴统计的人工整理耗时。访谈基线约 60 分钟／周；人工协同从发布到老师审核约 2 天。两项均为现状估计，不作为已取得的改进效果或课程硬性验收值。
- 组织为整个青年传媒中心，业务负责人为指导老师；账号角色统一为管理员、部长、普通成员。办公部部长生成和导出中心周报。
- 兄弟部门可发布外部需求，选择六个承接部门；目标部长接单派发，承接人交付成果，部长／管理员审核归档。归档时承接干事按承接部门规则计工时，审核部长固定 2 小时，外部发起人不计稿费。
- 公众号排版派发时指定干事、一审、二审。不同审核人按一审、二审依次通过后归档；两岗同人时一审通过即归档。管理员按实际权限参与，旧任务保留兼容路径。
- 审核通过不要求另填信息，由服务端记录操作事实；退回修改另行处理。岗位安排与实际审核事件必须区分，不补造没有发生的审核。
- 已配置的审核贡献按规则合计 2 小时、按不重复成员分摊。摄制制作加急阈值与倍率以保存的规则为依据；公众号加急提醒不自动增加工时倍率。
- 每项有效自动贡献保存来源、成员和规则依据，事务归档防止重复计量；兼容周汇总仍可按现行权限调整，封存周报尚属课程目标。

## 数据层与实现对照

课程关系模型包含 **55 张基表、5 个派生视图**，以第三范式为设计目标；当前 CloudBase 代码声明 **20 个集合**。`handoffs` 聚合采编协同、摄制预约、外部需求和排版，`workflowType` 区分上下文。规范关系模型的拆表不等于直接增建同名云集合。

总图按业务分区，使用直线和正交折线、一对多基数、黄色主键钥匙及独立蓝色外键箭头；卡片不展示 Type／Null 列。跨区公共成员／部门引用在字段旁标明目标，完整约束以外键清单和 DDL 为准。

- [数据字典](./database/data-dictionary.md)
- [完整外键关系清单](./database/foreign-key-relations.md)
- [参考 SQLite DDL](./database/schema.sqlite.sql)（仅本地约束验证）
- [数据库验证记录](./database/verification.txt)
- [现行审核、附件与计量说明](./implementation/06-one-click-review-and-documents.md)
- [课程与实现对照历史](./implementation/01-course-runtime-alignment.md)（第 1～6 节是 2026-10-13／14 基线）
- [发布与回退](./implementation/02-rollout-and-rollback.md)（按日期理解历史检查点）

摄制冲突资源、开放抢单、稿件版本审核、阶段确认和周报封存等设计与实现差距，保留对应说明，不为了消除文字差异而改坏可用流程。新计量字段使用 `snake_case`，旧 API 字段通过映射继续兼容。

## 建模与同步规则

1. 业务变化同时检查 A 的职责／业务路径、B 的用例与规约、C 的对象操作／状态、D 的数据关系及业务／表示层，再核对实现与测试。
2. 业务执行者是人群或机构；业务工人与业务实体按课程图例区分。序列图消息写成“接收者执行的动作”，结果使用返回消息。
3. 系统用例具有明确目标和主要责任角色；内部自动核算步骤保留在规约中，不为连线数量机械添加 `include`／`extend`。
4. 用例规约表达完整业务输入、验证、处理与结果，不写按钮、组件、数据库或接口调用。
5. 图源、PNG、SVG 和合并稿一起维护。生命线别名不得重复；审核岗位安排不能与执行者共用生命线。
6. 课程模型是拟开发设计，已实现内容以代码核对为依据；线上可用性仍需目标环境验证。业务假设、历史决定和待确认项不混入愿景正文。

## 重新生成图片

所有图源使用 **UTF-8**。Windows 的 Java 默认编码可能与图源不同，即使源文件中文正常，直接渲染也可能产生乱码。统一脚本通过参数列表显式传入 UTF-8，先在临时目录渲染，再核对可见 SVG 中文标签后写回 PNG／SVG。

在项目根目录执行（Java、PlantUML JAR 及 Microsoft YaHei 等中文字体需可用）：

```powershell
# 业务、系统用例和分析图，共 57 张
python -X utf8 docs/tools/render_course_diagrams.py --jar ../tmp/plantuml.jar

# 9 张数据库辅助分视图
python -X utf8 docs/tools/render_course_diagrams.py --scope database --jar ../tmp/plantuml.jar

# 一张数据库总图：保留用户确认的紧凑布局
python -X utf8 docs/tools/render_database_overview.py
node docs/tools/rasterize_database_overview.cjs

# 核对全部标准渲染图的可见中文标签
python -X utf8 docs/tools/render_course_diagrams.py --audit-only --scope all
```

`--jar` 替换为本机 JAR 路径，或设置 `PLANTUML_JAR`。总图 SVG／PNG 由同一模型元数据生成，不能用默认 PlantUML 排版覆盖；其结构、外键和直线布局由数据库检查脚本校验。栅格化脚本使用项目外 `../tmp/database-layout-runtime/` 中的 `@resvg/resvg-js`。

仅在模型本身发生变化时，先运行对应生成器；普通重渲染无需重建模型：

```powershell
python -X utf8 docs/tools/build_analysis_models.py
python -X utf8 docs/tools/write_analysis_chapter.py
# 数据库模型发生变化时才运行；随后重新生成分视图和紧凑总图
python -X utf8 docs/tools/build_database_design.py
```

## 合并与验证

```powershell
python -X utf8 docs/tools/build_course_assignment.py
python -X utf8 docs/tools/check_analysis_models.py
python -X utf8 docs/tools/check_database_design.py
npm --prefix cloudfunctions/api test
git diff --check
```

合并工具检查本地链接、规约必备项和用例编号；分析检查验证覆盖、实体接收操作、状态事件和生命线别名；数据库检查验证参考约束和总图。它们不代替逐图目视检查或真实云环境验收。

## 来源与审阅记录

课程依据为用户提供的《系统分析与设计-精简2026-9》PDF：愿景第 33 页；业务图与消息责任第 86～108 页；系统用例第 138～150 页；分析第 280～357 页；数据层第 398～403 页（均为 PDF 物理页）。

- [课程工件评审清单](./analysis/03-course-checklist.md)
- [访谈、手写图与原型业务审阅](./analysis/04-business-review.md)
- [分析评审记录](./analysis/06-analysis-review.md)
- [数据库评审记录](./design/02-database-review.md)
- [历次 README 建模记录](./README-history.md)（历史内容不作为现行功能说明）

SRS、SDD、STD 的后续框架修缮沿用用户此前确定的范围；当前交付入口为 A–D 合并稿，不将框架中的旧用例编号当作现行版本。
