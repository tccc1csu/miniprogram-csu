# 数据设计

- Task.kind 为 publication、web_article、photo、request、design 或 work_entry。Task.deadline 在挂网及通用流程可空。Task.linked_task_id 指向关联挂网任务。Task.config_version 引用价目快照。
- ArticleLine.position 在任务内唯一，ArticleLine.site 选填时由默认站点补齐。ArticleLine.author_id 在原创稿指向作者。
- Booking.location、Booking.contact 为摄制必填；任务截止时间即预约时间。
- Job.review_mode 决定是否需教师内容审核；Job.rule_id 指向本部可用创作规则。Assignment.task_id 唯一且摄制抢单与派发共享同一任务锁。
- Version.phase 区分内容审校稿与交付成果。已通过的内容稿保留历史，验收绑定后续交付版本。
- Archive.version_id 对普通归档必填，强制归档可以为空且 Archive.reason 必填。
- Worklog.source_key 区分逐稿与逐件。Worklog.base_units、Worklog.effective_units、Worklog.rate_cents 为正整数。Worklog.rule_version 标记费率快照。
- WorkEntry.week 为 1 至 53。WorkEntry.person_id 是有效内部成员，人工来源须填写正数工时。
- Rule.id 对应 24 条原编号，Rule.units 为整数，审核类固定。Policy.version 追加不覆盖，Policy.rate_cents、Policy.urgent_factor 为正。
- DutySlot.department_id 定义轮值归属，DutySlot.start_at 早于 DutySlot.end_at。Reminder.task_id 与 Reminder.kind 共同唯一。
