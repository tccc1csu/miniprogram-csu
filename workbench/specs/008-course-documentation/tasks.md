# Tasks: 课程文档与模型统一

## Phase 1: Specification

- [x] T001 Create course documentation specification in `workbench/specs/008-course-documentation/spec.md`.
- [x] T002 Create implementation plan in `workbench/specs/008-course-documentation/plan.md`.

## Phase 2: Current-model documentation

- [x] T003 [P] Replace historical implementation caveats in `docs/analysis/01-vision.md` and `docs/analysis/02-business-modeling.md` with current roles, six departments, and confirmed workflow decisions.
- [x] T004 [P] Rewrite `docs/requirements/system-use-case-specifications.md` so all use cases use current actors, current authorization, teacher routing, annotations, notes, defaults and automatic archive semantics.
- [x] T005 [P] Update `docs/analysis/05-analysis-models.md` and its generated references so analysis objects and states match the current task/version/review/worklog model.

## Phase 3: UML and database views

- [x] T006 Rework system use-case PlantUML sources under `docs/diagrams/system-use-case*.puml` to show clear actors, software boundary and 33 matching use cases.
- [x] T007 Generate current relational database dictionary and relationship views from `workbench/server/migrations/001.sql`–`005.sql` in `docs/database/` and `docs/diagrams/database/`.
- [x] T008 Render and audit all changed PlantUML diagrams as UTF-8 PNG/SVG.

## Phase 4: Course package and engineering documents

- [x] T009 Update `docs/tools/build_course_assignment.py` and regenerate `docs/course-assignment.md` without PPT page-number prose.
- [x] T010 Replace `docs/SRS-framework.md`, `docs/SDD-framework.md`, and `docs/STD-framework.md` with current SRS, SDD and STD documents and traceability tables.
- [x] T011 Add course-documentation validation and checklist output under `workbench/specs/008-course-documentation/`.

## Phase 5: README and delivery

- [x] T012 Put the cloud website, existing QR image and safe test-account index at the top of `README.md`.
- [x] T013 Run documentation checks, existing tests and build; inspect generated artifacts and remove secrets from the diff.
- [x] T014 Commit and push the documentation update to `feat/unified-cloud-workbench`.

## Dependencies

T001→T002→T003/T004/T005→T006/T007→T008→T009/T010/T011→T012→T013→T014.

## MVP

The minimum useful delivery is T003–T010: a coherent course package and current engineering documents. README and push are release completion tasks.
