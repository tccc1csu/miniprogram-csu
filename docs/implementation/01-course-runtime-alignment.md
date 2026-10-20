# 课程设计与小程序实现对照（2026-10-13）

本文件第 1～6 节保留 2026-10-13／14 当日对照结果，反映当时基线；2026-10-19 的现行功能口径和 A–D 追踪以[课程作业合并稿](../course-assignment.md)及[一键审核、业务附件与计量口径](./06-one-click-review-and-documents.md)当前修订为准。历史表中“未实现”仅表示对应审计日期的状态。

本轮以可用小程序为实现基线，以课程作业为规范目标，统一业务含义、命名与计量依据。关系设计中的 55 张基表、5 个视图不等于 CloudBase 必须新增 55 个集合。云文档可以聚合部分从属事实，但不能混淆任务明细与周总量，也不能将查询快照描述成已实现的版本审核或封存周报。

## 1. 核验范围与 Git 基线

- 已执行 `git fetch origin`。本轮开始时本地 `main` 与 GitHub `origin/main` 同为 `25ae44b`，工作区干净。
- 本轮在 `refactor/course-runtime-alignment` 上修改；不覆盖主分支，不直接合并 `origin/2.0`。
- `origin/2.0` 为 `c822343`。其字号适配、部长审核与指定退回功能部分已被主分支选择性整合，不能仅依据提交 SHA 判断功能缺失。
- 2026-10-14 收尾再次 fetch：`origin/main` 仍为 `25ae44b`，`origin/2.0` 已前进到 `d6286f4`（公众号排版排班、兄弟部门报名、加急提醒与排版自动计量）。已读取其云函数差异，但未将该独立功能合入本轮；下文实际实现对照仍以主分支基线为准。
- 实际数据路径为 `miniprogram/utils/db.js → cloudfunctions/api → 微信 CloudBase`；`server/` 的 SQLite 是历史实现，不能用它冒充真实云数据库。
- 已逐项检查云函数创建集合、业务写入、查询、角色判断与前端周报。基线代码声明 16 个集合，本轮本地版本声明 20 个集合。
- **尚未读取线上集合实例、真实记录分布、索引或集合权限；也未核验线上已部署云函数的版本。** 下文“现有实现”指 GitHub 基线代码，不保证线上已经部署该代码。`auditSchema` 与导出审计工具已创建，均未在真实云数据上运行。

## 2. 业务差距与本轮决定

| 业务 | 作业中的规范目标 | 基线实现 | 本轮处理与剩余差距 |
| --- | --- | --- | --- |
| 角色与部门 | 管理员、部长、普通成员；指导老师承担业务审核责任 | 角色代码已是 admin／minister／member，但部分标签为“成员”；有兄弟部门账号 | 统一角色标签；保留可用的兄弟部门协作入口。指导老师与维护管理员的权限分离仍待明确。 |
| 采编办公协同 | 采编发起、办公唯一承接、成果反馈、审核归档、贡献分开核算 | 支持同一流程；相关部长和管理员可审核；作品名、平台为文本，成果说明为 syncResult | 保留已可用的部长审核／指定退回；增加稳定承接、发起成员引用与独立计量依据。作业的老师审核是主要业务路径，不能据此宣称实现中只有老师可审。 |
| 作品与发布事实 | 每件作品、每个平台、每条链接独立关联 | articleNames／targetSites 可包含多项；syncResult 是自由文本 | **仍未一致**。后续应把作品、平台、发布成果结构化，再兼容旧文本；本轮不按分隔符猜造历史作品或链接。 |
| 稿件审核 | 审核引用稿件版本，运营二审引用同版通过一审 | 没有 manuscript_version 或同版双审记录；当前是同步结果审核 | **未实现**。必须补稿件版本与审核业务后才能称作同版审查；不能仅改字段名解决。 |
| 摄制预约 | 冲突拒绝，不创建预约；指定办公成员归档；可派发或抢单 | 只有 scheduledAt，无结束时间／资源标识／冲突检查；支持部长派发，不支持开放抢单 | 保留预约／派发／归档流程，加稳定成员引用与原子计量。冲突资源和时段尚不齐全，不新增武断的“同一时刻全中心只能一个任务”规则。 |
| 加急计量 | 不足 2 天，倍率 1.5，不重复乘倍率 | 按预约提前毫秒差判断；摄制和办公归档都乘倍率 | 保留现行计算，分别保存基础工时与倍率。两天计法与倍率适用贡献仍需会议确认，现行行为不当作已确认制度。 |
| 通用部门流转 | 有阶段责任、成果、部长确认、审查历史，整体结束后归集 | 管理员建立多阶段项目；部门成员直接标记完成；阶段推进覆盖当前部门任务状态；未自动计量 | **仅部分覆盖**。不把现有 deptTasks 数组冒充全部 task_stage／stage_confirmation 等表，也不擅自修改现行创建权限和阶段确认岗位。 |
| 任务明细与周汇总 | 每项贡献有明细，每成员每周一条汇总 | 自动任务工时直接累加进 weekly_records，只有来源 ID 列表 | 本轮新增贡献依据、计量与不可覆盖规则快照；旧周汇总继续兼容。手工周上报暂未拆成任务明细；旧历史缺少依据不反推。 |
| 周报责任与范围 | 办公部部长生成／导出中心周报 | 普通部长只能统计本部门，办公部长也一样 | 已改：办公部长周报请求使用中心范围；后端校验办公部长／管理员资格，其它部长与普通成员不能借 scope 越权。 |
| 周报历史 | 固定明细集合，封存后可重复导出 | 实时读取周汇总，金额按当前时薪计算 | 新贡献已有规则快照与明细金额读取接口，但**当前周报仍是实时周汇总，尚未封存，也未转为按明细金额汇总**。不能宣称历史导出已固定。 |
| 大数据量统计 | 应完整包含统计范围内的记录 | 单次 getAll 最多读 1000 条 | 本轮补分页与稳定排序。分页不是一致性快照，生成期间变化仍可能影响实时报表；封存时需要另做快照机制。 |
| 活动／投票／通讯录／文件库 | 部分不在课程核心分析范围 | 已有独立可用业务 | 保留；作业范围可以小于实际产品范围，不为凑模型删除这些功能。 |

## 3. 全部分析实体与真实存储的映射

| 分析实体 | 作业关系结构 | 实际实现位置 | 对齐结论 |
| --- | --- | --- | --- |
| 中心组织 | organization | 当前产品配置隐含单一中心 | 未建立组织实体；暂保留单中心，不能声称多组织隔离。 |
| 部门 | department | departments | 集合 ID 是稳定标识；旧业务仍常用部门名。 |
| 成员 | member、external_identity、archive_preference | members＋users；members 内含默认归档偏好 | 身份与成员资料分开合理；本轮补充任务级稳定成员引用，账号注销仍保留成员资料。 |
| 登录会话 | login_session | users 内的 token／到期字段 | 当前只保存当前会话，未独立建会话历史；不做批量令牌迁移。 |
| 采编协同 | editorial 及 work／target／assignment／archive 子表 | handoffs 的 editorialOfficeHandoff 文档 | 流程聚合可保留；唯一派发的并发保障、作品目标拆分和归档历史仍需后续实现。 |
| 作品 | work、platform | articleNames／articleType／targetSites | 未结构化，不等同规范作品表。 |
| 稿件版本 | manuscript_version | 无 | 待开发。 |
| 成果 | outcome、outcome_attachment、outcome_version | handoffs.syncResult；files 是通用文件库 | 通用文件库不等于成果附件与稿件版次关联。 |
| 发布成果 | publication | 成果说明里可能包含链接 | 未有结构化发布事实。 |
| 审核结论 | manuscript_review、editorial_review、editorial_review_item | handoffs 的末次 reviewComment／reviewerName／reviewedTime | 末次字段不是多轮审核历史；未绑定版本。 |
| 摄制日程 | production_schedule | 从摄制 handoffs 查询 | 是列表而非已实现的资源日程约束。 |
| 摄制约定 | booking_terms | allowance_rules 的当前设置；handoffs.urgentMultiplier | 预约倍率已有快照，完整约定版本与冲突口径未实现。 |
| 摄制预约 | production_booking 及 assignment／archive 结构 | handoffs 的 productionReservation 文档 | 已有主流程；本轮补稳定承接／归档成员引用。 |
| 流转任务 | workflow、workflow_completion、business_source | project_tasks | 结构聚合可保留；未建立跨专门流程的统一来源引用。 |
| 任务阶段 | task_stage 及七类从属事实 | project_tasks.phases／deptTasks／currentPhaseIndex | 只保存阶段名和当前部门进度；前阶段完成历史不充分。 |
| 工作量台账 | contribution_basis／measurement 和查询视图 | 新增的两个同名集合；原 weekly_records | 新自动贡献已可追溯，旧周记录为兼容数据，不能当完整台账。 |
| 工作贡献 | contribution_basis／measurement／type | 两个同名集合；type_id 用规则类型代码 | 来源＋类型＋成员稳定去重；类型字典尚未独立集合化。 |
| 成员周汇总 | v_member_weekly_summary | weekly_records | 暂存可调整兼容汇总，不是完全从明细计算的视图；本轮防止并发丢工时和重复新建。 |
| 津贴标准 | allowance_standard、contribution_policy | 新增同名快照集合＋allowance_rules 当前配置 | 新计量引用内容快照；会议版本号与真正生效时点未掌握，不能伪造 effective_from／version_no。 |
| 中心周报 | weekly_report／范围／贡献／待核对／封存表 | getStatistics 的 weeklyTable 查询＋前端导出 | 权限与范围已统一，批次与封存仍未实现。 |

## 4. 字段命名和参照完整性

新建规范集合使用作业的 snake_case 字段；已部署页面与旧文档的 camelCase 字段保留为兼容契约。一个语义只有一个规范名称；映射不表示自动删除旧字段。稳定标识使用 CloudBase 字符串 ID，不必改成参考 SQLite 的整数。

| 业务含义 | 作业规范名 | 旧存储／API | 新实现与注意事项 |
| --- | --- | --- | --- |
| 成员 | member_id | members._id／weekly_records.memberId | 新贡献 member_id 引用 members._id；姓名用于展示，不能充当 ID。 |
| 部门 | department_id | departments._id／department 文本 | 新贡献引用 departments._id，历史归属存入依据，不随当前资料变化自动改写。 |
| 业务来源 | source_id | sourceHandoffId／sourceHandoffIds | 新依据 source_id 表示业务来源；handoff_id 引用对应 handoffs。按学期计量的办公对接采用学期来源，不冒充单次稿件。 |
| 贡献类型 | type_id | workType／allowance_rules.key | type_id 使用具体贡献类型代码，workType 仅是四类展示分类，二者不能混为一谈。 |
| 贡献依据 | basis_id | 无 | 按 source_id＋type_id＋member_id 生成确定文档 ID，跨周重试仍是同一贡献。 |
| 基础工时 | base_hours_u | workload（已含倍率） | measurement 保存基础工时的万分之一小时；旧 workload 继续是有效工时。 |
| 倍率 | 约定与计量适用倍率 | urgentMultiplier | policy 快照 factor_u 保存万分位倍率；读取明细时只乘一次。 |
| 计量规则 | policy_id | 动态规则 key | 内容快照 ID；不可经通用 CRUD 改写。 |
| 时薪规则 | standard_id／hourly_rate_cents | standardHourlyRate／productionHourlyRate | 新 standard 保存部门引用与分／小时的时薪快照。 |
| 工作发生时刻 | occurred_at | createTime／archivedTime | **目前仍沿用归档计入周的实际实现**；新依据 occurred_at 使用本次归档时刻，不能当作已采集真实劳动时刻。未来需补发生时间输入及受理规则后再统一工作周。 |
| 核定时刻 | assessed_at | reviewedTime | 计量核定的当前归档时刻。 |
| 承接／归档成员 | assignment.member_id／archived_by | assigneeName／archiveMemberName | 旧 handoffs 新增 assigneeMemberId／archiveMemberId；显示文字保留。 |

本轮新贡献依据不存姓名、时薪或总额；计量引用规则，规则引用部门时薪快照，有效工时与金额按查询推导。逻辑事实拆分与课程依赖方向一致。但 CloudBase 不具有 SQLite 的外键、触发器和全部唯一索引，本轮以云函数资格核对、确定主键和事务实现相应保障；**不能声称全部云集合已经满足第三范式**。原 handoffs 多值文字、users 内会话和可编辑 weekly_records 仍是已知差距。

## 5. 本轮已实现的保障及限制

- 采编审核归档／摄制归档：归档状态、所有应计贡献、规则快照与周汇总在同一事务提交；第二位成员失败时整笔回滚。通知在事务外，发送失败不回滚已完成业务，通知重试机制仍需后续实现。
- 重复来源全局按贡献键去重；同一成员的不同贡献类型分别存明细。旧 sourceHandoffIds 已计过的工作保持跳过，不用零工时补造“已核实”历史。
- 基础工时为零的现行规则只形成待核对依据，不建立有效 measurement；后续需确认零工时是否为有效会议规则再处理。
- 新周汇总用成员 ID＋部门＋周标识确定文档 ID；旧汇总保留原 ID。发现重复旧汇总明确报错，不自动挑一条覆盖。
- 手工周上报、编辑与删除改用事务，防止与自动归档并发时覆盖刚写入的工时；含自动来源的周记录不能删除。手工调整仍可改变周总量，不覆盖新贡献明细，因此当前周报不能称为完全由明细推导。
- 成员 ID 与姓名／部门须一致，同名多人不猜选；发现成员资料缺失会拒绝归档，先核对资料。这是上线前必须检查的数据兼容条件。
- 现有成员／部门删除及岗位调动接口尚未全面实现历史引用保护；本轮发布期间应保留这些被引用的资料，后续统一停用机制。不能把云函数里的资格校验等同于数据库级删除限制。
- `getContributionDetails` 可读取规范明细、规则及其历史计算金额：普通成员看本人，部长看本部门，管理员看全中心。已有页面暂未新增明细浏览界面。
- `getAll` 已分页；实时分页期间数据变化没有冻结保证。索引建议和上线检查见[发布与回退](02-rollout-and-rollback.md)。

## 6. 下一批工作依据

先对线上数据做只读字段／引用审计和备份，再处理重复成员、重复周记录、缺失 ID 等历史问题。之后依次补成果结构化、预约资源与起止时间、版本审查、阶段历史、手工任务明细及封存周报。每批都要同步更新用例规约、类图与实际字段映射；未确认的岗位与会议规则先明确，再改真实流程。

本轮没有进行线上集合迁移、创建索引、部署、重置测试数据或推送提交。关系总图仍保持课程目标设计；它不会被标记成现有小程序数据库快照。
