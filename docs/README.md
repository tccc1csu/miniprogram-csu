# 项目文档导航

当前文档基线：2026-11-27；适用于网页、小程序与唯一后端workbench/server。

| 阅读目的 | 文档 |
| --- | --- |
| 课程A→B→C→D完整稿 | [课程作业合并稿](course-assignment.md) |
| 软件需求和验收边界 | [SRS](SRS.md) |
| 架构、数据与接口设计 | [SDD](SDD.md) |
| 测试方案、追踪及结果入口 | [STD](STD.md) |
| 用例与路径 | [系统用例规约](requirements/system-use-case-specifications.md) |
| 实际数据库 | [完整ERD大图与索引](database/full-erd.md) · [单页PDF](diagrams/database/db-full.pdf) · [字段字典](database/data-dictionary.md) · [79项外键](database/foreign-key-relations.md) |
| UML图源与可读图 | [diagrams](diagrams/) |
| 本次审查与验证 | [008规格与验证](../workbench/specs/008-course-documentation/) |
| 部署及两端接入 | [部署说明](../workbench/deployment/mini-unification.md) |

SRS-framework、SDD-framework、STD-framework保留兼容入口。旧数据库设计与分析PDF移至[历史资料](history/README.md)，旧实现审计和reference仅供历史追溯，不作为当前线上规范。业务冲突以长期基准及会话确认决定为准。

## 重建文档

先在workbench安装依赖，再从仓库根目录运行：

~~~powershell
node docs/tools/export_runtime_schema.mjs
python -X utf8 docs/tools/build_current_documents.py
python -X utf8 docs/tools/build_document_narratives.py
python -X utf8 docs/tools/build_course_assignment.py
python -X utf8 docs/tools/render_course_diagrams.py --jar <PlantUML-JAR路径> --graphviz-dot <完整Graphviz的dot路径> --scope all
python -X utf8 docs/tools/export_erd_pdf.py
python -X utf8 docs/tools/check_current_documents.py
~~~

图渲染需要Java、PlantUML和完整Graphviz；大图使用PlantUML的DOT模式，内置的精简dot不包含neato布局插件。PDF导出需要Python的reportlab与svglib，检查需要PyMuPDF；可用pip安装reportlab<5、svglib、pymupdf。Windows默认嵌入微软雅黑；其他平台向export_erd_pdf.py传入--font及--bold-font中文TrueType字体。输出含PNG、SVG及单页矢量PDF，提交时同时更新图源和产物。首次生成后应先渲染并导出PDF，再执行完整校验；重建不连接生产数据库。
