# 文档统一验证记录

日期：2026-11-27。分支：`feat/unified-cloud-workbench`。本次仅更新文档、图件和文档生成/检查工具，不改动生产数据、后端行为或旧小程序生产库。

## 交付结构

- 隔离PGlite空库重放实际001–005迁移，导出38张业务表、214字段、79外键。导出仅含结构及迁移SHA256，不含业务数据或凭据。
- 33个系统用例、四张详图、33张分析序列、两张类图、三张状态机；连同业务图和八张数据库图共58张图源及116份PNG/SVG产物。
- 分析序列由领域聚合执行具体审核、领取、归档与核定动作；账号核验资格，控制协调路径。每条调用核对接收类的操作，关系库持久化在D章精化。
- 14项SRS需求与用例、实际模块、STD验证场景建立追踪；41个HTTP方法与路径直接读取当前路由声明。
- 课程A–D合并稿、SRS、SDD、STD及README统一当前口径，旧framework保留兼容入口。

## 本轮实际执行

以下命令均已执行，退出码均为0。测试期望及既有云端证据不冒充本轮实测。

| 命令或检查 | 结果 |
| --- | --- |
| `node docs/tools/export_runtime_schema.mjs` | 通过；38表、214字段、79外键及迁移哈希 |
| `python -X utf8 docs/tools/build_current_documents.py` | 通过；33用例与分析、当前数据设计 |
| `python -X utf8 docs/tools/build_document_narratives.py` | 通过；课程章节、SRS/SDD/STD、接口与追踪 |
| `python -X utf8 docs/tools/build_course_assignment.py` | 通过；完整A–D合并稿 |
| `python -X utf8 docs/tools/render_course_diagrams.py --jar <本机plantuml.jar> --scope all` | 通过；58图语法、UTF-8 PNG/SVG及可见标题标签检查 |
| `python -X utf8 docs/tools/check_current_documents.py` | 通过；33用例及序列、58图、38表、14需求、41路由、29份Markdown的382个本地链接 |
| `npm --prefix workbench test` | 通过；16项后端测试及mobile-unification协议测试 |
| `npm --prefix workbench run build` | 通过；Vite生产构建 |
| `git diff --check` | 通过；无空白错误 |
| 二维码字节比对 | 与HEAD中的原二维码SHA256完全一致 |
| 提交范围与凭据模式检查 | 变更限定文档、工具、Spec Kit与入口说明；无.env、.data、私有配置或密钥模式命中 |

## 图件目视检查

检查了业务图、系统功能导航和四张用例详图、两张类图、三张状态机及八张数据库图的PNG，未见文字截断或错误页。全部33张序列初版通过目视检查；领域职责细化后再次抽查登录、配置、教师一审、摄制领取、发布归档、工时核定和报表七张，具体动作、返回与分支可辨。其余细化序列通过统一渲染与接收者职责校验，不将抽查写成逐张人工验收。

数据库总览仅示主干，分区图展示本分区外键，完整79项（含跨区、复合键）在字典及关系清单中。图箭头表示外键依赖，不误当流程。详细SVG可放大阅读。

## 兼容与限制

本轮未重新执行云端身份与附件联调，原证据见[007验证记录](../007-mini-unification/validation.md)。真机完整闭环、微信正式版发布、外部机器人/订阅消息、云端大文件专项压力及生产故障恢复未在本次完成。本站测试数据为合成验收案例，不用于真实结算。

旧SQLite教学结构、原验证文本和分析PDF移入docs/history，旧生成工具移入docs/tools/history；其他旧图仍可从Git历史恢复。原二维码保持字节不变；云端测试密码只保留于私有交付资料。本次没有部署应用或修改任何云端数据。
