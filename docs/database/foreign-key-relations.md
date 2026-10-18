# 数据库外键关系清单

本清单列出全部真实外键，R 编号对应完整 PlantUML 模型及模型索引。主图按八个分区绘制业务关系；跨区共享成员／部门引用仍在字段旁显示蓝色箭头与目标表名。复合外键是一条整体关系，完整组成列及基数见下表。

| 编号 | 子表（外键列） | 父表（被引用列） | 每条子记录对应父记录 | 一个父记录对应子记录 |
| --- | --- | --- | --- | --- |
| R001 | department（organization_id） | organization（organization_id） | 1 | 0..* |
| R002 | member（department_id） | department（department_id） | 0..1 | 0..* |
| R003 | external_identity（member_id） | member（member_id） | 1 | 0..* |
| R004 | login_session（member_id） | member（member_id） | 1 | 0..* |
| R005 | archive_preference（office_member_id） | member（member_id） | 1 | 0..* |
| R006 | archive_preference（production_member_id） | member（member_id） | 1 | 0..1 |
| R007 | manuscript_version（submitted_by） | member（member_id） | 1 | 0..* |
| R008 | manuscript_version（work_id） | work（work_id） | 1 | 0..* |
| R009 | editorial（initiator_id） | member（member_id） | 1 | 0..* |
| R010 | editorial_work（work_id） | work（work_id） | 1 | 0..* |
| R011 | editorial_work（editorial_id） | editorial（editorial_id） | 1 | 0..* |
| R012 | editorial_target（editorial_id, work_id） | editorial_work（editorial_id, work_id） | 1 | 0..* |
| R013 | editorial_target（platform_id） | platform（platform_id） | 1 | 0..* |
| R014 | editorial_assignment（assigned_by） | member（member_id） | 1 | 0..* |
| R015 | editorial_assignment（assignee_id） | member（member_id） | 1 | 0..* |
| R016 | editorial_assignment（editorial_id） | editorial（editorial_id） | 1 | 0..1 |
| R017 | production_schedule（department_id） | department（department_id） | 1 | 0..1 |
| R018 | booking_terms（schedule_id） | production_schedule（schedule_id） | 1 | 0..* |
| R019 | production_booking（terms_id） | booking_terms（terms_id） | 1 | 0..* |
| R020 | production_booking（requester_id） | member（member_id） | 1 | 0..* |
| R021 | production_assignment（assigned_by） | member（member_id） | 1 | 0..* |
| R022 | production_assignment（assignee_id） | member（member_id） | 1 | 0..* |
| R023 | production_assignment（booking_id） | production_booking（booking_id） | 1 | 0..1 |
| R024 | production_archive_responsibility（specified_by） | member（member_id） | 1 | 0..* |
| R025 | production_archive_responsibility（office_member_id） | member（member_id） | 1 | 0..* |
| R026 | production_archive_responsibility（booking_id） | production_booking（booking_id） | 1 | 0..1 |
| R027 | workflow（initiator_id） | member（member_id） | 1 | 0..* |
| R028 | external_request（target_department_id） | department（department_id） | 1 | 0..* |
| R029 | external_request（requester_id） | member（member_id） | 1 | 0..* |
| R030 | external_request_assignment（assigned_by） | member（member_id） | 1 | 0..* |
| R031 | external_request_assignment（assignee_id） | member（member_id） | 1 | 0..* |
| R032 | external_request_assignment（request_id） | external_request（request_id） | 1 | 0..1 |
| R033 | operations_layout_task（created_by） | member（member_id） | 1 | 0..* |
| R034 | operations_layout_assignment（assigned_by） | member（member_id） | 1 | 0..* |
| R035 | operations_layout_assignment（assignee_id） | member（member_id） | 1 | 0..* |
| R036 | operations_layout_assignment（layout_task_id） | operations_layout_task（layout_task_id） | 1 | 0..1 |
| R037 | task_stage（department_id） | department（department_id） | 1 | 0..* |
| R038 | task_stage（workflow_id） | workflow（workflow_id） | 1 | 0..* |
| R039 | stage_assignment（assigned_by） | member（member_id） | 1 | 0..* |
| R040 | stage_assignment（assignee_id） | member（member_id） | 1 | 0..* |
| R041 | stage_assignment（stage_id） | task_stage（stage_id） | 1 | 0..1 |
| R042 | business_source（operations_layout_task_id） | operations_layout_task（layout_task_id） | 0..1 | 0..1 |
| R043 | business_source（external_request_id） | external_request（request_id） | 0..1 | 0..1 |
| R044 | business_source（stage_id） | task_stage（stage_id） | 0..1 | 0..1 |
| R045 | business_source（booking_id） | production_booking（booking_id） | 0..1 | 0..1 |
| R046 | business_source（editorial_id） | editorial（editorial_id） | 0..1 | 0..1 |
| R047 | source_attachment（uploaded_by） | member（member_id） | 1 | 0..* |
| R048 | source_attachment（source_id） | business_source（source_id） | 1 | 0..* |
| R049 | stage_source（source_id） | business_source（source_id） | 1 | 0..* |
| R050 | stage_source（stage_id） | task_stage（stage_id） | 1 | 0..1 |
| R051 | outcome（submitted_by） | member（member_id） | 1 | 0..* |
| R052 | outcome（source_id） | business_source（source_id） | 1 | 0..* |
| R053 | outcome_attachment（outcome_id） | outcome（outcome_id） | 1 | 0..* |
| R054 | outcome_version（version_id） | manuscript_version（version_id） | 1 | 0..* |
| R055 | outcome_version（outcome_id） | outcome（outcome_id） | 1 | 0..* |
| R056 | publication（outcome_id, version_id） | outcome_version（outcome_id, version_id） | 0..1 | 0..* |
| R057 | publication（platform_id） | platform（platform_id） | 1 | 0..* |
| R058 | publication（outcome_id） | outcome（outcome_id） | 1 | 0..* |
| R059 | stage_current_draft（outcome_id, version_id） | outcome_version（outcome_id, version_id） | 1 | 0..* |
| R060 | stage_current_draft（stage_id） | task_stage（stage_id） | 1 | 0..1 |
| R061 | manuscript_review（prior_review_id） | manuscript_review（review_id） | 0..1 | 0..* |
| R062 | manuscript_review（reviewer_id） | member（member_id） | 1 | 0..* |
| R063 | manuscript_review（version_id） | manuscript_version（version_id） | 1 | 0..* |
| R064 | editorial_review（reviewer_id） | member（member_id） | 1 | 0..* |
| R065 | editorial_review（outcome_id） | outcome（outcome_id） | 1 | 0..1 |
| R066 | editorial_review_item（review_id） | manuscript_review（review_id） | 1 | 0..* |
| R067 | editorial_review_item（editorial_review_id） | editorial_review（editorial_review_id） | 1 | 0..* |
| R068 | source_review_assignment（assigned_by） | member（member_id） | 1 | 0..* |
| R069 | source_review_assignment（reviewer_id） | member（member_id） | 1 | 0..* |
| R070 | source_review_assignment（source_id） | business_source（source_id） | 1 | 0..* |
| R071 | source_review（outcome_id, source_id） | outcome（outcome_id, source_id） | 1 | 0..* |
| R072 | source_review（prior_review_id） | source_review（review_id） | 0..1 | 0..* |
| R073 | source_review（reviewer_id） | member（member_id） | 1 | 0..* |
| R074 | source_review（outcome_id） | outcome（outcome_id） | 1 | 0..* |
| R075 | source_review（source_id） | business_source（source_id） | 1 | 0..* |
| R076 | source_archive（final_review_id, source_id, outcome_id） | source_review（review_id, source_id, outcome_id） | 1 | 0..* |
| R077 | source_archive（archived_by） | member（member_id） | 1 | 0..* |
| R078 | source_archive（outcome_id） | outcome（outcome_id） | 1 | 0..1 |
| R079 | source_archive（source_id） | business_source（source_id） | 1 | 0..1 |
| R080 | editorial_archive（editorial_review_id） | editorial_review（editorial_review_id） | 1 | 0..1 |
| R081 | editorial_archive（editorial_id） | editorial（editorial_id） | 1 | 0..1 |
| R082 | production_archive（archived_by） | member（member_id） | 1 | 0..* |
| R083 | production_archive（outcome_id） | outcome（outcome_id） | 1 | 0..1 |
| R084 | production_archive（booking_id） | production_booking（booking_id） | 1 | 0..1 |
| R085 | stage_confirmation（confirmed_by） | member（member_id） | 1 | 0..* |
| R086 | stage_confirmation（outcome_id） | outcome（outcome_id） | 1 | 0..* |
| R087 | stage_confirmation（stage_id） | task_stage（stage_id） | 1 | 0..* |
| R088 | stage_completion（second_review_id） | manuscript_review（review_id） | 0..1 | 0..* |
| R089 | stage_completion（confirmation_id） | stage_confirmation（confirmation_id） | 1 | 0..1 |
| R090 | stage_completion（stage_id） | task_stage（stage_id） | 1 | 0..1 |
| R091 | workflow_completion（workflow_id） | workflow（workflow_id） | 1 | 0..1 |
| R092 | allowance_standard（department_id） | department（department_id） | 1 | 0..* |
| R093 | contribution_policy（type_id） | contribution_type（type_id） | 1 | 0..* |
| R094 | contribution_policy（standard_id） | allowance_standard（standard_id） | 1 | 0..* |
| R095 | contribution_basis（department_id） | department（department_id） | 1 | 0..* |
| R096 | contribution_basis（member_id） | member（member_id） | 1 | 0..* |
| R097 | contribution_basis（type_id） | contribution_type（type_id） | 1 | 0..* |
| R098 | contribution_basis（source_id） | business_source（source_id） | 1 | 0..* |
| R099 | stage_contribution（basis_id） | contribution_basis（basis_id） | 1 | 0..* |
| R100 | stage_contribution（stage_id） | task_stage（stage_id） | 1 | 0..* |
| R101 | contribution_measurement（policy_id） | contribution_policy（policy_id） | 1 | 0..* |
| R102 | contribution_measurement（basis_id） | contribution_basis（basis_id） | 1 | 0..1 |
| R103 | weekly_report（generated_by） | member（member_id） | 1 | 0..* |
| R104 | report_department（department_id） | department（department_id） | 1 | 0..* |
| R105 | report_department（report_id） | weekly_report（report_id） | 1 | 0..* |
| R106 | report_contribution（basis_id） | contribution_measurement（basis_id） | 1 | 0..* |
| R107 | report_contribution（report_id） | weekly_report（report_id） | 1 | 0..* |
| R108 | report_pending（basis_id） | contribution_basis（basis_id） | 1 | 0..* |
| R109 | report_pending（report_id） | weekly_report（report_id） | 1 | 0..* |
| R110 | report_seal（report_id） | weekly_report（report_id） | 1 | 0..1 |

`business_source` 的五条可空外键受“恰好一列非空”的 CHECK 联合限制。`publication` 的复合外键允许非稿件成果的 version_id 为空，但 outcome_id 仍由单独外键保证存在。父记录至少拥有一个子记录等跨行完整性，在发布／归档事务中检查。
