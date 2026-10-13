# 数据库数据字典

由 `schema.sqlite.sql` 的实际声明生成。SQLite INTEGER 主键在本参考稿中使用 64 位整数；部署时可映射为 BIGINT／UUID。TEXT 时间列在部署 RDBMS 中映射为 DATE／TIMESTAMP 类型；本地稿以 Asia/Shanghai 的固定格式时间校验。只保存单一事实，不保存数组、逗号分隔外键或重复汇总值。

PK 是主键；FK 是外键；UQ 是候选键／唯一约束；NULL 可空；NN 非空。所有外键采用删除限制，历史业务与规则不可级联删除。复合主键所有组成列均显式非空。

## 1. 中心组织（organization）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| organization_id | INTEGER | NN | PK1 | 中心组织标识 |
| name | TEXT | NN | UQ | 业务名称／姓名，不充当稳定主键 |

唯一组合：name。

## 2. 部门（department）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| department_id | INTEGER | NN | PK1 | 部门标识；贡献表中表示计量时的历史归属 |
| organization_id | INTEGER | NN | FK → organization.organization_id | 中心组织标识 |
| name | TEXT | NN | — | 业务名称／姓名，不充当稳定主键 |
| enabled | INTEGER | NN | — | 0 停用，1 启用；停用不删除历史 |

唯一组合：organization_id, name。

## 3. 成员与账号（member）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| member_id | INTEGER | NN | PK1 | 成员标识 |
| name | TEXT | NN | — | 业务名称／姓名，不充当稳定主键 |
| login_name | TEXT | NN | UQ | 唯一登录账号；姓名允许重名 |
| password_hash | TEXT | NULL | — | 密码散列；仅外部身份登录时可空 |
| account_role | TEXT | NN | — | ADMIN 管理员／MINISTER 部长／MEMBER 普通成员 |
| department_id | INTEGER | NULL | FK → department.department_id | 部门标识；贡献表中表示计量时的历史归属 |
| enabled | INTEGER | NN | — | 0 停用，1 启用；停用不删除历史 |

唯一组合：login_name。

## 4. 外部身份绑定（external_identity）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| identity_id | INTEGER | NN | PK1 | 身份绑定标识 |
| member_id | INTEGER | NN | FK → member.member_id | 成员标识 |
| provider | TEXT | NN | — | 身份提供方 |
| app_scope | TEXT | NN | — | 身份发行应用范围 |
| subject | TEXT | NN | — | 该提供方和应用范围内的外部主体标识 |

唯一组合：member_id, provider, app_scope；provider, app_scope, subject。

## 5. 登录会话（login_session）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| session_id | INTEGER | NN | PK1 | 会话标识 |
| member_id | INTEGER | NN | FK → member.member_id | 成员标识 |
| token_hash | TEXT | NN | UQ | 会话令牌散列，不保存明文令牌 |
| issued_at | TEXT | NN | — | 会话建立时刻 |
| expires_at | TEXT | NN | — | 失效时刻，晚于建立时刻 |
| terminated_at | TEXT | NULL | — | 提前终止时刻；未终止为空 |

唯一组合：token_hash。

## 6. 归档人偏好（archive_preference）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| production_member_id | INTEGER | NN | PK1；FK → member.member_id | 摄制成员 |
| office_member_id | INTEGER | NN | FK → member.member_id | 指定或偏好的办公成员，使用时重新核验资格 |

唯一组合：除主键外无额外候选键。

## 7. 发布平台（platform）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| platform_id | INTEGER | NN | PK1 | 平台标识 |
| name | TEXT | NN | UQ | 业务名称／姓名，不充当稳定主键 |

唯一组合：name。

## 8. 作品（work）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| work_id | INTEGER | NN | PK1 | 作品标识 |
| name | TEXT | NN | — | 业务名称／姓名，不充当稳定主键 |
| origin_kind | TEXT | NN | — | ORIGINAL 原创／REPRINT 转载 |

唯一组合：除主键外无额外候选键。

## 9. 稿件版本（manuscript_version）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| version_id | INTEGER | NN | PK1 | 不可改写的稿件版本标识 |
| work_id | INTEGER | NN | FK → work.work_id | 作品标识 |
| revision_no | INTEGER | NN | — | 同一作品内从 1 起的版次 |
| content | TEXT | NN | — | 本版本的完整稿件内容 |
| submitted_by | INTEGER | NN | FK → member.member_id | 本次提交成员 |
| submitted_at | TEXT | NN | — | 提交时刻 |

唯一组合：work_id, revision_no。

## 10. 采编协同（editorial）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| editorial_id | INTEGER | NN | PK1 | 采编协同标识 |
| initiator_id | INTEGER | NN | FK → member.member_id | 中心登记／发起成员 |
| title | TEXT | NN | — | 业务标题 |
| submitted_at | TEXT | NN | — | 提交时刻 |
| deadline_at | TEXT | NULL | — | 可选期限；未提供为 NULL |

唯一组合：除主键外无额外候选键。

## 11. 协同作品（editorial_work）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| editorial_id | INTEGER | NN | PK1；FK → editorial.editorial_id | 采编协同标识 |
| work_id | INTEGER | NN | PK2；FK → work.work_id | 作品标识 |

唯一组合：editorial_id, work_id。

## 12. 作品目标平台（editorial_target）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| editorial_id | INTEGER | NN | PK1；FK → editorial_work.editorial_id | 采编协同标识 |
| work_id | INTEGER | NN | PK2；FK → editorial_work.editorial_id | 作品标识 |
| platform_id | INTEGER | NN | PK3；FK → platform.platform_id | 平台标识 |

唯一组合：editorial_id, work_id, platform_id。

## 13. 办公承接责任（editorial_assignment）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| editorial_id | INTEGER | NN | PK1；FK → editorial.editorial_id | 采编协同标识 |
| assignee_id | INTEGER | NN | FK → member.member_id | 唯一当前承接成员 |
| assigned_by | INTEGER | NN | FK → member.member_id | 派发或抢单申请成员 |
| assigned_at | TEXT | NN | — | 承接成立时刻 |

唯一组合：除主键外无额外候选键。

## 14. 摄制日程（production_schedule）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| schedule_id | INTEGER | NN | PK1 | 摄制日程标识 |
| department_id | INTEGER | NN | FK → department.department_id；UQ | 部门标识；贡献表中表示计量时的历史归属 |

唯一组合：department_id。

## 15. 摄制约定版本（booking_terms）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| terms_id | INTEGER | NN | PK1 | 摄制约定的不可变版本标识 |
| schedule_id | INTEGER | NN | FK → production_schedule.schedule_id | 摄制日程标识 |
| version_no | INTEGER | NN | — | 同一规则适用范围内的版本号 |
| effective_from | TEXT | NN | — | 规则版本生效起点；后续版本确定后继生效边界 |
| urgent_threshold_days | INTEGER | NN | — | 会议阈值天数；已知为 2 |
| day_basis | TEXT | NN | — | HOURS_24／CALENDAR_DAY／UNCONFIRMED；待确认不得用于自动判定 |
| urgent_factor_bp | INTEGER | NN | — | 倍率万分位整数；1.5 保存为 15000 |
| conflict_scope_note | TEXT | NN | — | 会议确定的冲突资源范围说明，未确定不得编造 |

唯一组合：schedule_id, effective_from；schedule_id, version_no。

## 16. 摄制预约（production_booking）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| booking_id | INTEGER | NN | PK1 | 摄制预约标识 |
| requester_id | INTEGER | NN | FK → member.member_id | 预约人 |
| terms_id | INTEGER | NN | FK → booking_terms.terms_id | 摄制约定的不可变版本标识 |
| title | TEXT | NN | — | 业务标题 |
| starts_at | TEXT | NN | — | 预约开始 |
| ends_at | TEXT | NN | — | 预约结束，区间采用 [开始,结束) |
| location | TEXT | NN | — | 地点 |
| contact | TEXT | NN | — | 业务联系信息 |
| submitted_at | TEXT | NN | — | 提交时刻 |
| urgent_decision | INTEGER | NN | — | 受理时实际加急判定事实 0／1；不复制倍率 |
| claim_open | INTEGER | NN | — | 是否允许抢单 0／1 |

唯一组合：除主键外无额外候选键。

## 17. 摄制承接责任（production_assignment）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| booking_id | INTEGER | NN | PK1；FK → production_booking.booking_id | 摄制预约标识 |
| assignee_id | INTEGER | NN | FK → member.member_id | 唯一当前承接成员 |
| assigned_by | INTEGER | NN | FK → member.member_id | 派发或抢单申请成员 |
| method | TEXT | NN | — | ASSIGN 部长派发／CLAIM 本人抢单 |
| assigned_at | TEXT | NN | — | 承接成立时刻 |

唯一组合：除主键外无额外候选键。

## 18. 指定办公归档责任（production_archive_responsibility）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| booking_id | INTEGER | NN | PK1；FK → production_booking.booking_id | 摄制预约标识 |
| office_member_id | INTEGER | NN | FK → member.member_id | 指定或偏好的办公成员，使用时重新核验资格 |
| specified_by | INTEGER | NN | FK → member.member_id | 确定归档责任的摄制承接成员 |
| specified_at | TEXT | NN | — | 归档责任确定时刻 |

唯一组合：除主键外无额外候选键。

## 19. 流转任务（workflow）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| workflow_id | INTEGER | NN | PK1 | 整体流转任务标识 |
| initiator_id | INTEGER | NN | FK → member.member_id | 中心登记／发起成员 |
| name | TEXT | NN | — | 业务名称／姓名，不充当稳定主键 |
| request_origin | TEXT | NN | — | 真实业务需求来源描述，区别于登录发起成员 |
| objective | TEXT | NN | — | 工作目标 |
| created_at | TEXT | NN | — | 建立时刻 |

唯一组合：除主键外无额外候选键。

## 20. 任务阶段（task_stage）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| stage_id | INTEGER | NN | PK1 | 阶段标识 |
| workflow_id | INTEGER | NN | FK → workflow.workflow_id | 整体流转任务标识 |
| department_id | INTEGER | NN | FK → department.department_id | 部门标识；贡献表中表示计量时的历史归属 |
| sequence_no | INTEGER | NN | — | 同一任务内唯一序号；前后序由排序推导 |
| result_requirement | TEXT | NN | — | 成果要求 |
| review_policy | TEXT | NN | — | NONE 非稿件审查／OPERATIONS_TWO_LEVEL 运营双审／OTHER_CONFIRMED 其他已确认规则 |
| deadline_at | TEXT | NULL | — | 可选期限；未提供为 NULL |

唯一组合：workflow_id, sequence_no。

## 21. 阶段承接责任（stage_assignment）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| stage_id | INTEGER | NN | PK1；FK → task_stage.stage_id | 阶段标识 |
| assignee_id | INTEGER | NN | FK → member.member_id | 唯一当前承接成员 |
| assigned_by | INTEGER | NN | FK → member.member_id | 派发或抢单申请成员 |
| assigned_at | TEXT | NN | — | 承接成立时刻 |
| roster_basis | TEXT | NULL | — | 可选人工排班依据，不存自动排班承诺 |

唯一组合：除主键外无额外候选键。

## 22. 唯一业务来源（business_source）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| source_id | INTEGER | NN | PK1 | 跨流程共同引用的实际业务来源标识 |
| editorial_id | INTEGER | NULL | FK → editorial.editorial_id；UQ | 采编协同标识 |
| booking_id | INTEGER | NULL | FK → production_booking.booking_id；UQ | 摄制预约标识 |
| stage_id | INTEGER | NULL | FK → task_stage.stage_id；UQ | 阶段标识 |

唯一组合：stage_id；booking_id；editorial_id。

## 23. 阶段来源映射（stage_source）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| stage_id | INTEGER | NN | PK1；FK → task_stage.stage_id | 阶段标识 |
| source_id | INTEGER | NN | FK → business_source.source_id | 跨流程共同引用的实际业务来源标识 |

唯一组合：除主键外无额外候选键。

## 24. 成果提交（outcome）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| outcome_id | INTEGER | NN | PK1 | 成果提交标识 |
| source_id | INTEGER | NN | FK → business_source.source_id | 跨流程共同引用的实际业务来源标识 |
| submission_no | INTEGER | NN | — | 同一来源内的提交次序，修改新增提交 |
| submitted_by | INTEGER | NN | FK → member.member_id | 本次提交成员 |
| completed_note | TEXT | NN | — | 完成说明 |
| submitted_at | TEXT | NN | — | 提交时刻 |

唯一组合：source_id, submission_no。

## 25. 成果附件（outcome_attachment）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| attachment_id | INTEGER | NN | PK1 | 附件标识 |
| outcome_id | INTEGER | NN | FK → outcome.outcome_id | 成果提交标识 |
| file_name | TEXT | NN | — | 附件展示名 |
| storage_ref | TEXT | NN | — | 文件存储引用；文件内容存对象存储 |

唯一组合：outcome_id, storage_ref。

## 26. 成果稿件版本（outcome_version）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| outcome_id | INTEGER | NN | PK1；FK → outcome.outcome_id | 成果提交标识 |
| version_id | INTEGER | NN | PK2；FK → manuscript_version.version_id | 不可改写的稿件版本标识 |

唯一组合：outcome_id, version_id。

## 27. 发布成果（publication）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| publication_id | INTEGER | NN | PK1 | 发布依据标识 |
| outcome_id | INTEGER | NN | FK → outcome_version.outcome_id；FK → outcome.outcome_id | 成果提交标识 |
| version_id | INTEGER | NULL | FK → outcome_version.outcome_id | 不可改写的稿件版本标识 |
| platform_id | INTEGER | NN | FK → platform.platform_id | 平台标识 |
| result_url | TEXT | NN | — | 实际成果链接；一列一条链接 |

唯一组合：outcome_id, platform_id, result_url（条件唯一，见 DDL 的 WHERE）；outcome_id, version_id, platform_id（条件唯一，见 DDL 的 WHERE）。

## 28. 阶段当前送审版（stage_current_draft）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| stage_id | INTEGER | NN | PK1；FK → task_stage.stage_id | 阶段标识 |
| outcome_id | INTEGER | NN | FK → outcome_version.outcome_id | 成果提交标识 |
| version_id | INTEGER | NN | FK → outcome_version.outcome_id | 不可改写的稿件版本标识 |

唯一组合：除主键外无额外候选键。

## 29. 稿件审查结论（manuscript_review）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| review_id | INTEGER | NN | PK1 | 稿件审核事件标识 |
| version_id | INTEGER | NN | FK → manuscript_version.version_id | 不可改写的稿件版本标识 |
| level | INTEGER | NN | — | 1 一审／2 二审 |
| round_no | INTEGER | NN | — | 同一版次和审查层次内的审核轮次 |
| reviewer_id | INTEGER | NN | FK → member.member_id | 实际审核成员 |
| decision | TEXT | NN | — | PASS 通过／RETURN 退回 |
| opinion | TEXT | NN | — | 审核／确认说明，退回需完整原因 |
| reviewed_at | TEXT | NN | — | 审核时刻 |
| prior_review_id | INTEGER | NULL | FK → manuscript_review.review_id | 该二审引用的同版通过一审；不适用前序审核时为空 |

唯一组合：version_id, level, round_no。

## 30. 同步审核结论（editorial_review）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| editorial_review_id | INTEGER | NN | PK1 | 整次采编同步审核标识 |
| outcome_id | INTEGER | NN | FK → outcome.outcome_id；UQ | 成果提交标识 |
| reviewer_id | INTEGER | NN | FK → member.member_id | 实际审核成员 |
| decision | TEXT | NN | — | PASS 通过／RETURN 退回 |
| opinion | TEXT | NN | — | 审核／确认说明，退回需完整原因 |
| reviewed_at | TEXT | NN | — | 审核时刻 |

唯一组合：outcome_id。

## 31. 同步审核稿件依据（editorial_review_item）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| editorial_review_id | INTEGER | NN | PK1；FK → editorial_review.editorial_review_id | 整次采编同步审核标识 |
| review_id | INTEGER | NN | PK2；FK → manuscript_review.review_id | 稿件审核事件标识 |

唯一组合：editorial_review_id, review_id。

## 32. 采编归档完成（editorial_archive）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| editorial_id | INTEGER | NN | PK1；FK → editorial.editorial_id | 采编协同标识 |
| editorial_review_id | INTEGER | NN | FK → editorial_review.editorial_review_id；UQ | 整次采编同步审核标识 |
| archived_at | TEXT | NN | — | 归档完成时刻 |

唯一组合：editorial_review_id。

## 33. 摄制归档完成（production_archive）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| booking_id | INTEGER | NN | PK1；FK → production_booking.booking_id | 摄制预约标识 |
| outcome_id | INTEGER | NN | FK → outcome.outcome_id；UQ | 成果提交标识 |
| archived_by | INTEGER | NN | FK → member.member_id | 实际办公归档成员 |
| archived_at | TEXT | NN | — | 归档完成时刻 |

唯一组合：outcome_id。

## 34. 阶段确认结论（stage_confirmation）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| confirmation_id | INTEGER | NN | PK1 | 阶段确认事件标识 |
| stage_id | INTEGER | NN | FK → task_stage.stage_id | 阶段标识 |
| outcome_id | INTEGER | NN | FK → outcome.outcome_id | 成果提交标识 |
| confirmed_by | INTEGER | NN | FK → member.member_id | 实际确认部长 |
| decision | TEXT | NN | — | PASS 通过／RETURN 退回 |
| opinion | TEXT | NN | — | 审核／确认说明，退回需完整原因 |
| confirmed_at | TEXT | NN | — | 确认时刻 |

唯一组合：除主键外无额外候选键。

## 35. 阶段完成（stage_completion）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| stage_id | INTEGER | NN | PK1；FK → task_stage.stage_id | 阶段标识 |
| confirmation_id | INTEGER | NN | FK → stage_confirmation.confirmation_id；UQ | 阶段确认事件标识 |
| second_review_id | INTEGER | NULL | FK → manuscript_review.review_id | 本次阶段完成实际采信的二审结论；运营稿件必填，非稿件阶段为空 |

唯一组合：confirmation_id。

## 36. 任务完成（workflow_completion）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| workflow_id | INTEGER | NN | PK1；FK → workflow.workflow_id | 整体流转任务标识 |
| completed_at | TEXT | NN | — | 整体业务完成时刻 |

唯一组合：除主键外无额外候选键。

## 37. 贡献类型（contribution_type）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| type_id | INTEGER | NN | PK1 | 贡献类型标识；类型集合依据会议规则维护 |
| code | TEXT | NN | UQ | 稳定贡献类型代码 |
| name | TEXT | NN | UQ | 业务名称／姓名，不充当稳定主键 |

唯一组合：name；code。

## 38. 部门津贴标准版本（allowance_standard）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| standard_id | INTEGER | NN | PK1 | 部门津贴标准不可变版本 |
| department_id | INTEGER | NN | FK → department.department_id | 部门标识；贡献表中表示计量时的历史归属 |
| version_no | INTEGER | NN | — | 同一规则适用范围内的版本号 |
| effective_from | TEXT | NN | — | 规则版本生效起点；后续版本确定后继生效边界 |
| hourly_rate_cents | INTEGER | NN | — | 部门时薪，单位分／小时 |

唯一组合：department_id, effective_from；department_id, version_no。

## 39. 贡献计量规则（contribution_policy）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| policy_id | INTEGER | NN | PK1 | 某规则版本下某贡献类型的计量规则 |
| standard_id | INTEGER | NN | FK → allowance_standard.standard_id | 部门津贴标准不可变版本 |
| type_id | INTEGER | NN | FK → contribution_type.type_id | 贡献类型标识；类型集合依据会议规则维护 |
| basis_rule | TEXT | NN | — | 基础工时核定规则说明 |
| urgent_applies | INTEGER | NN | — | 是否对该类摄制贡献应用受理倍率；由会议明确 |

唯一组合：standard_id, type_id。

## 40. 工作贡献依据（contribution_basis）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| basis_id | INTEGER | NN | PK1 | 实际贡献依据标识；同来源＋类型＋成员唯一 |
| source_id | INTEGER | NN | FK → business_source.source_id | 跨流程共同引用的实际业务来源标识 |
| type_id | INTEGER | NN | FK → contribution_type.type_id | 贡献类型标识；类型集合依据会议规则维护 |
| member_id | INTEGER | NN | FK → member.member_id | 成员标识 |
| department_id | INTEGER | NN | FK → department.department_id | 部门标识；贡献表中表示计量时的历史归属 |
| occurred_at | TEXT | NN | — | 实际工作发生时刻；归档晚到不改变所属工作周 |
| evidence | TEXT | NN | — | 可复核贡献依据 |

唯一组合：source_id, type_id, member_id。

## 41. 阶段贡献引用（stage_contribution）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| stage_id | INTEGER | NN | PK1；FK → task_stage.stage_id | 阶段标识 |
| basis_id | INTEGER | NN | PK2；FK → contribution_basis.basis_id | 实际贡献依据标识；同来源＋类型＋成员唯一 |

唯一组合：stage_id, basis_id。

## 42. 已核实贡献计量（contribution_measurement）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| basis_id | INTEGER | NN | PK1；FK → contribution_basis.basis_id | 实际贡献依据标识；同来源＋类型＋成员唯一 |
| policy_id | INTEGER | NN | FK → contribution_policy.policy_id | 某规则版本下某贡献类型的计量规则 |
| base_hours_u | INTEGER | NN | — | 核实基础工时，万分之一小时；不得为零冒充有效贡献 |
| assessed_at | TEXT | NN | — | 核定计量时刻；规则适用时点待会议口径明确 |

唯一组合：除主键外无额外候选键。

## 43. 中心周报批次（weekly_report）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| report_id | INTEGER | NN | PK1 | 一次中心周报批次；重复生成可新建批次，不增加工作量 |
| week_start | TEXT | NN | — | 该统计周周一日期；周定义为拟设计口径 |
| generated_by | INTEGER | NN | FK → member.member_id | 办公部部长 |
| generated_at | TEXT | NN | — | 生成时刻 |
| export_ref | TEXT | NULL | — | 可选导出文件引用 |

唯一组合：除主键外无额外候选键。

## 44. 周报部门范围（report_department）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| report_id | INTEGER | NN | PK1；FK → weekly_report.report_id | 一次中心周报批次；重复生成可新建批次，不增加工作量 |
| department_id | INTEGER | NN | PK2；FK → department.department_id | 部门标识；贡献表中表示计量时的历史归属 |

唯一组合：report_id, department_id。

## 45. 周报有效明细集合（report_contribution）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| report_id | INTEGER | NN | PK1；FK → weekly_report.report_id | 一次中心周报批次；重复生成可新建批次，不增加工作量 |
| basis_id | INTEGER | NN | PK2；FK → contribution_measurement.basis_id | 实际贡献依据标识；同来源＋类型＋成员唯一 |

唯一组合：report_id, basis_id。

## 46. 周报待核对项（report_pending）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| report_id | INTEGER | NN | PK1；FK → weekly_report.report_id | 一次中心周报批次；重复生成可新建批次，不增加工作量 |
| basis_id | INTEGER | NN | PK2；FK → contribution_basis.basis_id | 实际贡献依据标识；同来源＋类型＋成员唯一 |
| reason | TEXT | NN | — | 生成时的待核对原因 |

唯一组合：report_id, basis_id。

## 47. 周报封存（report_seal）

| 列 | 参考类型 | 可空 | 键 | 业务含义 |
| --- | --- | --- | --- | --- |
| report_id | INTEGER | NN | PK1；FK → weekly_report.report_id | 一次中心周报批次；重复生成可新建批次，不增加工作量 |

唯一组合：除主键外无额外候选键。

## 派生视图

| 视图 | 唯一粒度 | 用途 |
| --- | --- | --- |
| v_contribution_detail | basis_id | 基础工时、适用倍率、已计入工时与历史规则引用 |
| v_contribution_money | basis_id | 已计入工时乘版本时薪后的津贴（分） |
| v_member_weekly_summary | member_id＋week_start | 每成员每工作周一行，可逐条追溯明细 |
| v_pending_contribution | basis_id | 缺失已核实计量子行的待核对贡献 |
| v_report_member_summary | report_id＋member_id | 已封存周报按固定有效明细集合计算的历史结果 |

未发生有效贡献的成员默认无汇总行；若作业展示要求显示全体成员，可用成员与指定周次左连接汇总，明确标记“无有效明细”，不生成零工时贡献。任意数组输入均拆成关联表行。
