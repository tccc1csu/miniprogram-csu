# 数据模型

- PublicationReview.teacher1_id 与 PublicationReview.teacher2_id 是不同的指导老师。PublicationReview.source_required 控制是否必须过采编。PublicationReview.source_version_id 与来源状态从来源版本和审校结果得出。
- Version.phase 增加 source，原稿及排版成果各自判断最新稿。Version.preview_html 是清理后的静态 HTML。Annotation.version_id 引用所属任务与不可变版本，Annotation.start_offset/Annotation.end_offset 引用原文，Annotation.stage 标注审校环节。
- FlowDefault.department_id 和 FlowDefault.kind 联合唯一，FlowDefault.assignee_id 必须为本部有效内部成员。Assignment.automatic 标识自动派发。
- PublicationDefaults 记录老师及可选运营审校组合。TeacherDelivery.teacher_id 对应可选群路由和 @ 标识。
