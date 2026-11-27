# Implementation Plan: 课程文档与模型统一

**Branch**: `feat/unified-cloud-workbench` | **Date**: 2026-11-27 | **Spec**: [spec.md](spec.md)

## Summary

将课程作业从历史口径更新为当前网页和原位小程序共用的 CloudBase PG HTTP/RPC 工作台。维护 A-D 课程分文件，重绘系统用例和数据库关系视图，生成合并稿，重写 SRS/SDD/STD，更新 README，并用脚本和现有测试验证。

## Technical Context

Language: Markdown、PlantUML、Python 生成脚本。Runtime: Node.js 24、PostgreSQL-compatible CloudBase HTTP/RPC、React Web、原生微信小程序。Source of truth: `workbench/server/migrations/001.sql`–`005.sql`、`workbench/server/*.js`、`workbench/背景文件/BIZ-RULES-FULL.md`、`workbench/specs/decisions.md`。Tests: Node test suite, Vite build, PlantUML audit, Markdown/link checks. Constraints: no credentials, `.data`, old production database mutation, or claims about unconfigured WeChat robot delivery.

## Constitution Check

- I 业务基准与决定留痕: PASS; current decisions are cited and historical conflicts are labeled.
- II Shared relational backend and server authorization: PASS; docs describe one API and current migrations.
- III Automatic archive and one-time contribution: PASS; normal completion and forced archive are distinct.
- IV Auditable internal work hours: PASS; teachers/external users excluded and adjustments/seals retained.
- V Spec workflow and honest validation: PASS; this feature has spec, plan, tasks, analysis and validation artifacts.

## Design Decisions

1. Use the current implementation model instead of preserving the old 55-table teaching schema as the runtime design.
2. Keep a small number of readable UML views. Shared responsibility is documented where real, while automatic internal actions are not promoted to actors.
3. Keep the old QR image unchanged and separate public test account names from private passwords.
4. Keep the course source files as the maintenance point; `course-assignment.md` is generated from them.

## File Map

- Course sources: `docs/analysis/`, `docs/requirements/`, `docs/design/`, `docs/diagrams/`.
- Database source and output: `workbench/server/migrations/`, `docs/database/`, `docs/diagrams/database/`.
- Engineering documents: `docs/SRS.md`, `docs/SDD.md`, `docs/STD.md`.
- Product entry point: `README.md`.
- Generation and audit: `docs/tools/export_runtime_schema.mjs`, `docs/tools/build_current_documents.py`, `docs/tools/build_document_narratives.py`, `docs/tools/build_course_assignment.py`, `docs/tools/check_current_documents.py`.

## Validation

Run the schema export and document builders, then `python -X utf8 docs/tools/render_course_diagrams.py --jar <local-jar> --scope all`, `python -X utf8 docs/tools/check_current_documents.py`, `npm --prefix workbench test`, and `npm --prefix workbench run build`.

## Revision plan

1. 复用并整理本地PlantUML业务符号库；图源明确业务实体与软件边界。
2. 以两张黑盒系统序列说明系统事件；33张分析序列保留BCE职责但统一激活、消息编号、返回和分支版式。
3. 从同一runtime-schema.json生成完整ERD，表卡含所有字段与实际FK，着色分区，复合外键保持整体；生成大幅单页矢量PDF并检查文字和细节。
4. 更新文档生成器和覆盖校验器，重建合并稿，逐类视检；本轮仅文档与工具变更，不重复运行未受影响的应用回归。
