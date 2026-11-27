"""Maintain the readable course chapters and engineering documentation."""
from build_current_documents import write, diagram, table, CAT, ROOT, REPO
import re

write('analysis/01-vision.md','''
# A.1 项目愿景

青年传媒中心工作台将分散于微信群、稿件链接和人工表格中的协作沉淀到可追溯任务，通过网页管理与手机办理，让完成即归档、贡献可核验、结算有依据。

| 愿景要素 | 定义 |
| --- | --- |
| 系统 | 青年传媒中心工作台 |
| 目标组织 | 学校青年传媒中心及其办公、采编、运营、摄制、美编、原创六部门 |
| 组织负责人 | 指导老师与中心管理团队 |
| 业务目标 | 降低人工收集核对工时的耗时，并减少任务、版本、审核及附件的散失 |
| 度量指标 | 同等任务量下办公部每周收集、核对、汇总所用总人时；完成任务的可追溯归档比例 |
| 对比基线 | 历史访谈估计人工统计约60分钟/周，尚非实测；改造前群聊、材料和表格相互分离 |
| 改进目标 | 通过试运行对比统计耗时，正常完成任务均保留归档与贡献依据；实际下降幅度待同口径测量 |

目前实现覆盖任务办理和结算证据，不能把自动化测试通过等同于人工统计耗时已经下降。验收示例数据用于演示角色和流程，不是真实历史财务记录。
''')

write('analysis/02-business-modeling.md','''
# A.2 业务建模与 B 需求形成

## 组织边界、业务执行者与涉众

业务边界是整个青年传媒中心。校内其他组织或活动需求方从边界外提出宣传、拍摄或设计需求，结算核对方关注可信工作量结果。中心内部的部长、干事和指导老师作为业务工人在序列中协作；他们操作软件时，又是软件边界外的系统参与者。业务执行者与系统参与者不能混用。

| 部门 | 核心工作 | 跨部门联系 |
| --- | --- | --- |
| 办公部 | 稿件对接、活动工作、工时核对及封存 | 与采编逐稿逐站点对接，与全中心结算 |
| 采编部 | 稿件内容、原创作者、源稿内容审核 | 给办公交付；外部来稿排版前审核 |
| 运营部 | 排版、内部审校、协调教师两审与发布 | 消化已归档稿件及外部来稿 |
| 摄制部 | 预约、承接、交付、验收 | 为活动方及其他部门供素材 |
| 美编部 | 基础、复杂、大型设计及验收 | 处理内部、外部和教师需求 |
| 原创部 | 原创需求及例外工作记录 | 无明确默认费率部分走人工登记 |

![业务用例](../diagrams/business-use-case.svg)

## 现状业务

需求方在群里发信息，部长转述并私下安排，成员通过链接和文件交付，老师在不同群里提出修改。办公部周期性收集各部门表格，人工辨认参与人、重复行和不同工时口径。现状图用于说明改造前问题，不代表当前系统仍按此实现。

![现状推文协作](../diagrams/current-business-sequence-publication.svg)

![现状统计](../diagrams/current-business-sequence-accounting.svg)

主要问题是同一任务分散于多个群、意见与稿件版本难对应、完成后材料未集中归档、规则工时与人工核定缺乏解释。旧稿中“教师被简化”“部长承担老师二审”“办公按时段值班”等口径已由确认决定替代。

## 改进后的业务

推文以任务串起来源、采编内容审核、安排排版、运营内审、不同老师两审、发布和归档。两位指定运营部长均为审校岗位，任一确认即可送老师；老师审核记录保留但不计工时。退回后提交新排版版本，重新走完整排版审核链。

![改进推文业务](../diagrams/improved-business-sequence-publication.svg)

采编与办公共用稿件站点行。创作和对接以每行为单位，各自贡献分开；可选内容老师先审内容，最终交付再由管理人员验收。只有正常归档稿件可关联推文，不把不同频率的采编、排版和周期统计强塞进一个不可拆分业务。

![改进采编办公](../diagrams/improved-business-sequence-editorial.svg)

摄制按预约时间开放领取或由部长安排；美编与其他部门需求按目标部门承接、提交和验收。固定承接可选，取消后按部门队列轮转后续任务，手工安排可覆盖尚未交付的安排。轮转是任务顺序，不是某人负责某个时段。

![改进部门交付](../diagrams/improved-business-sequence-jobs.svg)

正常完成自动归档并按规则只生成一次贡献；强制关闭保留原因，不自动计时。人工登记补充无法由明确默认规则计算的工作。报表通过筛选、列配置和视图保存提升灵活性；核定差异有逐次审计，期末封存后保留当时快照。

![改进统计结算](../diagrams/improved-business-sequence-accounting.svg)

## 自动化与人工责任

系统自动推导状态、校验权限和阶段、归档、计时、生成提醒意图。部长负责安排、验收和合理例外；老师对内容与推文质量负责。尚未接入的群机器人与订阅消息保留为未来外部渠道，当前站内待办不能当作微信群送达证据。
''')

diagram('business-use-case',r'''
left to right direction
actor "校内需求组织／活动方" as demand
actor "结算核对方" as settlement
rectangle "青年传媒中心（组织业务边界）" {
usecase "完成宣传内容服务" as publication
usecase "完成影像与设计服务" as production
usecase "提供可核验工作量结算依据" as accounting
}
demand -- publication
demand -- production
settlement -- accounting
note bottom of publication
指导老师、部长、干事是组织内部业务工人，
在业务序列中展开；系统用例再展示软件交互身份。
end note
''','A 青年传媒中心业务用例')
diagram('current-business-sequence-publication',r'''
actor "需求方" as D
participant "部长" as M
participant "排版干事" as W
participant "一审老师" as T1
participant "二审老师" as T2
D -> M : 在群里说明需求并发送素材
M -> W : 转述需求并安排排版
W -> M : 发送排版链接与附件
M -> T1 : 向一审群转发稿件
T1 -> W : 在群聊中说明修改要求
W -> T2 : 修改后转二审群
T2 -> W : 在另一群确认或要求修改
W -> M : 发出发布结果
note over M,T2
意见散落多个群，难以定位具体版本；
完成材料与后续工时表需再次人工关联。
end note
''','A 现状业务序列：推文协作')
diagram('current-business-sequence-accounting',r'''
participant "各部门干事" as W
participant "部门部长" as M
participant "办公统计人员" as O
W -> M : 报送本周工作记录
M -> O : 汇总部门工作表
O -> M : 询问重复项、缺失项及工时差异
M -> W : 核实实际贡献
W --> O : 提供补充说明
O -> O : 人工合并表格并核算金额
O --> M : 提交结算汇总供核对
''','A 现状业务序列：周期统计')
diagram('improved-business-sequence-publication',r'''
actor "需求方" as D
participant "统一工作台" as S
participant "采编部长" as E
participant "运营部长" as M
participant "排版干事" as W
participant "一审老师" as T1
participant "二审老师" as T2
D -> S : 提交需求与源稿
opt 外部来稿
S -> E : 提供待内容审核稿件
E -> S : 审核源稿内容
end
M -> S : 安排承接
S -> W : 提供任务与材料
W -> S : 提交排版版本
M -> S : 两位指定部长任一确认内部审校
S -> T1 : 提供一审待办
T1 -> S : 提交一审结论
S -> T2 : 提供二审待办
T2 -> S : 提交二审结论
M -> S : 登记发布地址
S -> S : 原子保存发布、归档和合格内部贡献
S --> D : 提供可追溯发布结果
note over S,T2
退回由承接人新版本重走排版审核链。
群机器人尚未连接，现为站内待办。
end note
''','B 改进业务序列：推文闭环')
diagram('improved-business-sequence-editorial',r'''
participant "采编人员" as E
participant "办公承接人" as O
participant "指定内容老师" as T
participant "验收管理者" as M
participant "统一工作台" as S
E -> S : 提交稿件站点与原创作者清单
S -> O : 按默认承接或任务轮转分配
opt 配置了内容老师
O -> S : 提交内容版本
T -> S : 完成内容审核
end
O -> S : 提交最终交付版本
M -> S : 验收稿件交付
S -> S : 归档并按行记录创作和对接贡献
E -> S : 另行提出关联该归档稿件的推文任务
''','B 改进业务序列：采编办公对接')
diagram('improved-business-sequence-jobs',r'''
actor "需求方" as D
participant "目标部门部长" as M
participant "承接干事" as W
participant "统一工作台" as S
D -> S : 提交摄影预约、设计或部门需求
alt 摄影任务公开领取
W -> S : 领取未来且未分配任务
else 部门安排
M -> S : 安排或采用默认承接／轮转
end
W -> S : 提交完整交付物
M -> S : 验收或说明退回原因
alt 正常验收通过
S -> S : 同事务归档并生成一次工时
else 强制关闭
M -> S : 说明强制关闭原因
S -> S : 保留关闭事实且不自动计时
end
''','B 改进业务序列：部门协作')
diagram('improved-business-sequence-accounting',r'''
participant "内部成员" as W
participant "部门部长" as M
participant "办公部长" as O
participant "统一工作台" as S
S -> S : 正常任务完成后生成规则贡献
W -> S : 登记例外工作或查询个人明细
M -> S : 提交核定值及原因
S -> S : 保留原值、新值、操作者和时间
O -> S : 按日期与人员筛选结算明细
S --> O : 导出含任务备注和调整原因的Excel
O -> S : 确认结算范围并封存
S -> S : 保存不可变行快照
note over O,S
后续实时工时可调整，已封存快照不变。
教师与外部只保留业务记录，不进入计酬明细。
end note
''','B 改进业务序列：工时结算')

write('SRS.md','''
# 软件需求规格说明书（SRS）

版本2.0｜2026-11-27｜适用：统一网页、小程序、workbench/server。替代旧SRS-framework中的单端与文档数据库口径。

## 1 目的、范围与依据

本系统服务青年传媒中心六部门任务协作、审核、自动归档与期末工时结算。网页承担完整管理和报表，手机承担快速办理，两端共用关系型后端。长期业务依据为[BIZ-RULES-FULL](../workbench/背景文件/BIZ-RULES-FULL.md)，冲突处以[已确认决定](../workbench/specs/decisions.md)为准。

本文件规定可验收行为；[课程合并稿](course-assignment.md)给出业务与UML推导；[SDD](SDD.md)描述实现；[STD](STD.md)提供验证。机器人送群、小程序正式发布与支付系统不在当前已完成范围。

## 2 用户与授权

| 身份 | 权限和边界 |
| --- | --- |
| 内部成员 | 本人待办、可见任务、交付与个人工时；是否计酬仍检查payable和部门 |
| 部门部长 | 本部门安排、验收及工时管理；特定跨部门流程按专门规则 |
| 办公部长 | 额外拥有全中心报表和封存权限 |
| 指导老师 | 指定任务和阶段的审阅；不能互相替审；不计工时 |
| 外部组织 | 按业务提出需求、源稿和公开报名；只下载本人附件；不计工时 |
| 管理员 | 全局管理与政策配置；不能冒充指定教师；不自动为自己生成审校工时 |

客户端不决定身份，所有动作由服务端验证。隐藏按钮不能代替接口授权。

## 3 功能需求

| 编号 | 必须满足的行为 | 验收要点 |
| --- | --- | --- |
| REQ-01 | 账号登录、退出、失效会话处理，两端识别同一身份 | 错误凭据拒绝、注销后令牌失效 |
| REQ-02 | 统一任务列表、详情、版本、材料、审核和备注 | 权限范围一致，任务状态由事实推导 |
| REQ-03 | 外部推文先采编审内容，再排版、内部审校、两位不同老师顺序审核 | 指定运营审校任一确认可送一审，退回新版本重走 |
| REQ-04 | 在工作台清洗预览或正文中精确选区批注 | 版本、阶段、引文和UTF-16偏移吻合；旧坐标拒绝 |
| REQ-05 | 采编办公按稿件站点逐行处理，内容审核与最终验收独立 | 原创作者和办公承接贡献分开；仅正常归档稿件可关联推文 |
| REQ-06 | 摄影预约、有效摄制干事唯一领取、交付和部门验收 | 并发领取一人成功；未实现时间区间资源冲突检测 |
| REQ-07 | 六部门需求、三种复杂度设计和人工工作登记 | 原创未定规则及复杂设计未定审校规则走人工登记 |
| REQ-08 | 默认承接可选可撤销，否则按任务顺序轮转，允许手动调整 | 不使用时段值班；固定默认优先于轮转 |
| REQ-09 | 正常完成自动归档并只计一次；强制关闭需原因且零自动工时 | 完成、归档和工时同事务；失败无半成品 |
| REQ-10 | 规则版本、加急倍率、分摊、核定审计 | 教师外部不计时；原值新值原因操作者时间齐全 |
| REQ-11 | 权限内报表筛选、列配置、保存视图、Excel、封存 | 导出含任务备注和调整原因；封存保持当时快照 |
| REQ-12 | 站内通知、提醒去重、发送状态和重试 | 未配置外部渠道显示未配置，不宣称群消息已送达 |
| REQ-13 | 附件受保护，客户端不直写核心表 | 任务归属检查、12MiB限制、云端下载完整性验证 |
| REQ-14 | 本机关闭后云端仍独立提供网页/API和权威数据 | 云托管、PG HTTPS/RPC、私有存储；无需本机TCP数据库 |

## 4 计量与业务约束

基础政策为10元/小时，小时按万分之一小时整数、金额按分计算，任务绑定政策版本。加急倍率1.5仅用于创作者；摄影预约距创建不足48小时与外部推文征集截止不足48小时分别判定，不能混为同一窗口。

排版基础4小时、影像2小时、转载1小时。内部审校总额2小时由两位指定运营审校人员各分1小时；其中只有一位实际确认也不伪造另一人的审核事件。采编稿件原创作者每行5小时，办公对接每行4小时，适用部长审校总额按规则分摊。美编基础3、复杂6、大型9小时；基础和大型审校总额2小时。完整基准规则及版本调整以政策模块和规则记录为准，未确定规则不自动补值。

核定必须有原因，实时数据保留逐次调整历史。封存是结算时点快照，不禁止后续实时明细修正。普通自动工时可能没有人工登记周次，周期报表以日期为可靠条件。

## 5 外部接口与数据

HTTP接口统一前缀/api/v1。Web使用HttpOnly会话Cookie，小程序经固定上游workbenchGateway使用Bearer会话。服务端连接CloudBase PG HTTP/RPC；云端密钥不得出现在客户端。数据结构、约束及79项外键见[数据字典](database/data-dictionary.md)。

输入错误、未登录、无权、未找到和状态冲突分别返回可识别失败；客户端不能把失败当成功。群机器人及订阅消息是后续可接入的通知渠道，当前不属于可用外部接口。

## 6 非功能要求与验收边界

安全要求包括密码加盐哈希、令牌摘要存储、会话失效、部门隔离、来源检查和私有附件。可靠性要求完成事务原子、并发无重复贡献、请求冲突明确失败。可维护性要求业务基准、规格、用例、表结构和测试可追踪。可用性要求保留手机三底栏和适应角色的操作入口。

未开展生产容量、灾备恢复、真机全流程和大附件多段压力验收，不给出未经测量的可用率或响应时间承诺。旧生产文档数据库不迁移、不删除；本次验收数据为合成角色用例，不能用于真实结算。

## 7 需求追踪

详细用例见[用例规约](requirements/system-use-case-specifications.md)。测试映射和本轮结果见[STD](STD.md)，设计映射见[SDD](SDD.md)。需求变更先记录decisions与规格，再更新规约、模型、实现和验证。
''')

write('SDD.md','''
# 软件设计说明书（SDD）

版本2.0｜2026-11-27｜实现基线：workbench/server、workbench/src、miniprogram与workbenchGateway。

## 1 设计目标与结构

系统以共享后端保证手机与网页的任务、审核、工时和权限一致。原生小程序保留适合手机的蓝色卡片布局；网页提供集中管理与复杂报表。根server和cloudfunctions/api仅为历史代码，不是第二个运行后端。

~~~mermaid
flowchart LR
  W[React网页] -->|同源HTTPS与Cookie| A[云托管 Express API]
  M[原生小程序] --> G[固定上游薄网关]
  G -->|HTTPS与Bearer| A
  A --> D[领域服务与服务端授权]
  D --> C[快照与命令适配层]
  C -->|HTTPS PostgREST / RPC| P[(CloudBase PostgreSQL)]
  A --> F[私有对象存储]
~~~

## 2 模块职责及需求映射

| 模块 | 职责 | SRS需求 |
| --- | --- | --- |
| app.js / auth.js | HTTP路由、凭据、会话、来源检查和身份恢复 | REQ-01、13 |
| domain.js / approval.js | 推文源稿、安排、版本、分阶段审核与发布 | REQ-02、03、09 |
| annotations.js | 清洗预览、UTF-16选区和审核权限 | REQ-04 |
| jobs.js | 稿件逐行、预约、设计、部门需求及人工登记 | REQ-05、06、07 |
| rotation.js / flow-defaults.js | 默认人、部门队列和轮转指针 | REQ-08 |
| policy.js / reports.js | 规则版本、工时核定、视图、Excel与封存 | REQ-10、11 |
| notifications.js | 提醒、站内消息、outbox与重试 | REQ-12 |
| cloud-db.js / cloud-storage.js | 云端一致性、幂等、对象持久化 | REQ-09、13、14 |

完整分层、实体职责、状态机和数据库设计见[课程设计章](design/01-database-design.md)。分析对象是职责模型，实际代码使用函数模块，不假设存在同名类。

## 3 持久化设计

以迁移001–005为业务结构基准，38张业务表、214字段、79外键；[数据字典](database/data-dictionary.md)完整列出PK/FK/UNIQUE/CHECK及索引，[总览](diagrams/database/db-overview.svg)与分区ER图共同描述关系。生产schema为youth_workbench，额外_state、_requests、_uploads不计入业务表。

任务没有可随意改写的status列。当前状态从任务类型、承接、最新阶段版本、审核及归档推导。版本与审核不可混成单一“审核状态”；两位审校岗位和实际审核事件分别持久化。工时保存规则与费率快照，封存行保留当时JSON结果。

PGlite在本地用于测试和开发；云端作为一次性SQL计算工作区。wb_snapshot读取一致事实，wb_command以修订号CAS、请求ID和摘要在一个云端事务提交差异。生产数据不依赖实例磁盘，也不要求PG TCP端口。冲突不静默覆盖。

## 4 关键算法与事务

发布和验收先检查身份、当前版本、阶段及归档事实，再在事务中写完成事件、归档、合格贡献和通知意图。工时来源复合唯一键以及归档唯一约束阻止重复计时。强制关闭有原因但不走自动计酬分支。

自动承接先查目标部门和类型的默认人，若没有则按部门有序成员队列及last_user_id选择下一位；手工安排覆盖可改的既有安排，默认配置可清除。duty_slots未用于当前业务。

批注以清洗HTML得到的正文为基准，检查原文切片等于quote，再保存start_offset与end_offset；数字按JavaScript UTF-16代码单元解释。稿件新版本不复用旧坐标。

计时用整数单位避免浮点累计。政策追加版本，旧任务读取绑定版本。核定追加审计并更新实时有效值，封存复制当时的报表行。工作登记是独立记录来源，不套普通任务交付状态机。

## 5 接口契约

完整HTTP方法、路径、认证与上传约定见[接口契约清单](design/api-contracts.md)。该清单从app.js路由声明生成，避免将相对片段误写成独立接口。

实际输入校验以服务端schema为准。未登录401、无权403、未找到404、状态冲突409、字段错误422；内部错误不泄露密钥和堆栈。Web写请求有来源与X-Requested-With检查，小程序固定路径网关不接受任意上游地址。

## 6 安全与对象存储

密码使用加盐scrypt，服务端存令牌SHA256摘要，默认12小时会话；生产Cookie为HttpOnly、SameSite=Strict、Secure。PG业务schema禁止匿名及普通客户端直接访问，所有核心写入走可信业务服务。

附件元数据保留任务、所有者、长度与SHA256；云端字节在私有workbench-private中。下载先验权再检查哈希。外部只能下载本人材料。对象准备、完成与回收支持异常恢复，避免把实例临时磁盘当持久化。

## 7 部署、运行与演进

CloudBase云托管提供网页和API，云PG与私有对象存储提供独立持久化。小程序借旧环境的薄网关接入权威后端，需在2026-12-11试用到期前续期或迁移网关。配置与回退见[部署说明](../workbench/deployment/mini-unification.md)。

外部通知未配置时保留unconfigured状态。尚未验证的真实灾备恢复、容量扩展和真机大文件测试见STD，不将其作为已实现指标。旧文档库及旧api保持不动。
''')

write('STD.md','''
# 软件测试说明书（STD）

版本2.0｜2026-11-27｜区分可重复测试设计、本轮执行结果和既有证据。后端测试使用隔离关系库，不推进现有云端任务。

## 1 范围与环境

范围为统一身份、六部门任务、推文审核、正常与强制归档、工时、报表、附件、轮转默认值和两端协议。代码位于workbench/tests。可重复命令：

~~~powershell
cd workbench
npm ci
npm test
npm run build
~~~

Node测试使用PGlite内存库重放实际迁移，HTTP层由supertest调用；小程序统一测试验证原生页面服务协议和网关限制。构建使用Vite。云端与模拟器证据引用[007验证记录](../workbench/specs/007-mini-unification/validation.md)，不冒充本轮重新执行。

## 2 测试用例、期望与追踪

| 测试编号 | 输入或操作 | 期望 | 自动化来源 | 对应需求 |
| --- | --- | --- | --- | --- |
| T-01 | 错误身份、旧版本及非法阶段审核 | 拒绝且事实不变 | workflow.test.js | REQ-01、03 |
| T-02 | 完整推文链并发10次发布 | 一次归档；排版4h与两位审校各1h；教师外部零工时 | workflow.test.js | REQ-03、09、10 |
| T-03 | 报名重复、截止边界与加急 | 去重并按窗口计算 | workflow.test.js | REQ-02、10 |
| T-04 | 归档事务注入失败 | 发布归档及工时全部回滚 | workflow.test.js | REQ-09 |
| T-05 | 特殊核定、筛选、Excel与封存后再调整 | 审计完整、导出含备注、快照不变 | workflow.test.js | REQ-10、11 |
| T-06 | 外部用户引用或下载他人材料 | 拒绝跨所有者材料 | workflow.test.js | REQ-13 |
| T-07 | 外部源稿内容审核、批注与退回 | 先采编内容审核，版本坐标绑定 | workflow.test.js | REQ-03、04 |
| T-08 | 富文本精确引文及不同教师路由 | 错误偏移拒绝，一二审老师互异 | workflow.test.js | REQ-03、04 |
| T-09 | 生产启动校验、数据库附件持久化 | 缺必要配置不伪装正常；载荷可恢复 | center.test.js | REQ-13、14 |
| T-10 | 多稿多站点与内容老师、最终验收 | 每行贡献正确，两审核事实独立，关联条件正确 | center.test.js | REQ-05、09 |
| T-11 | 摄影48h边界、并发领取、退回 | 唯一承接，加急仅创作者 | center.test.js | REQ-06、10 |
| T-12 | 六部门需求、三类设计与原创人工记录 | 规则分流且不臆造原创费率 | center.test.js | REQ-07 |
| T-13 | 周次、管理范围、政策版本及封存 | 只管理授权人员，旧版本及快照保留 | center.test.js | REQ-07、10、11 |
| T-14 | 到期提醒、重试和强制关闭 | 去重、真实发送状态、强制关闭零自动工时 | center.test.js | REQ-09、12 |
| T-15 | 有序轮转与固定默认优先 | 按任务顺序轮转，默认覆盖并可清除 | center.test.js | REQ-08 |
| T-16 | 办公默认、手工改派和取消 | 默认可选、改派合法、撤销后回轮转 | center.test.js | REQ-08 |
| T-17 | 手机身份、六类创建、推文闭环、会话和附件协议 | 与Web同身份同状态，非法网关路径拒绝 | mobile-unification.mjs | REQ-01至13 |
| T-18 | 38表214字段79外键、用例及图链接检查 | 字典与实际迁移一致，课程引用无缺失 | docs/tools/check_current_documents.py | 文档FR-001至010 |
| T-19 | 既有云端身份与私有附件只读联调 | 两端同身份，下载字节一致；仅引用既有证据 | 007/validation.md | REQ-01、13、14 |

## 3 本轮执行记录

本轮最终命令、退出码、图渲染与人工检查结果统一保存在[008验证记录](../workbench/specs/008-course-documentation/validation.md)。只有记录明确通过的项目才视为本轮执行，不把上表的设计期望直接当实测结果。

## 4 已有集成证据

007阶段完成16项后端测试、小程序统一协议测试、20项WXML/WXSS编译检查和模拟器截图。真实云端以五种身份只读查询，手机与网页同令牌映射为同一人，100字节私有附件协议下载与网页字节一致。详细时间、范围、截图和限制见原验证记录。

## 5 待完成的专项验收

| 项目 | 状态与通过标准 |
| --- | --- |
| 真机完整闭环 | 未运行；在体验版以各身份完成创建、审核、附件预览与退出 |
| 微信正式发布 | 未提交；需主体管理员完成审核发布流程 |
| 群机器人与订阅消息 | 未接入；需配置后验证实际群送达、提及对象及失败重试 |
| 云端大文件多段 | 未运行专项压力；需验证接近12MiB的往返、断点失败及哈希 |
| 生产容量与故障恢复 | 未做负载和灾备演练；需明确定量指标、备份恢复与冲突重试表现 |
| 统计效率改善 | 未测量；需同任务量下人工耗时对比，不用单元测试代替 |

## 6 缺陷与放行

本次文档交付以模型可复现、链接有效、用例与图一致、既有测试及构建通过为放行依据。外部服务、真机和容量项作为明确限制保留。发现需求偏差时先修正规约和追踪，再修实现及回归；不能用旧课程图覆盖用户新决定。
''')

for name in ['SRS','SDD','STD']:
    write(name+'-framework.md','# '+name+' 文档入口\n\n旧框架已由完整的['+name+' 2.0]('+name+'.md)替代，请以该文件为准。当前采用统一网页、小程序和关系型后端；历史内容保留在Git历史，不代表线上行为。')

write('README.md','''
# 项目文档导航

当前文档基线：2026-11-27；适用于网页、小程序与唯一后端workbench/server。

| 阅读目的 | 文档 |
| --- | --- |
| 课程A→B→C→D完整稿 | [课程作业合并稿](course-assignment.md) |
| 软件需求和验收边界 | [SRS](SRS.md) |
| 架构、数据与接口设计 | [SDD](SDD.md) |
| 测试方案、追踪及结果入口 | [STD](STD.md) |
| 用例与路径 | [系统用例规约](requirements/system-use-case-specifications.md) |
| 实际数据库 | [字段字典](database/data-dictionary.md) · [79项外键](database/foreign-key-relations.md) |
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
python -X utf8 docs/tools/check_current_documents.py
~~~

图渲染需要Java与PlantUML，运行render_course_diagrams.py --jar 本机JAR路径 --scope all。输出含PNG和SVG，提交时同时更新图源和产物。首次生成后应先渲染，再执行完整校验；重建不连接生产数据库。
''')

write('analysis/03-course-checklist.md','''
# 课程要求核对

| 阶段 | 交付 | 核对结论 |
| --- | --- | --- |
| A | 七要素愿景、组织边界、业务用例与现状序列 | 完整；访谈估计不伪装实测 |
| B | 改进业务序列、软件边界、系统用例规约 | 六部门、角色、前后置和扩展路径已覆盖 |
| C | 边界控制实体、类职责、逐用例序列、状态机 | 状态由事实推导；区分岗位安排与审核事件 |
| D | 当前数据层、业务层与表示层精化 | 来自真实迁移，包含HTTP/RPC与私有存储边界 |

图源、用例编号与链接由自动检查验证。多参与者关联同一用例合法，分图用于改善可读性，不作为UML语法纠错。
''')
write('analysis/04-business-review.md','''
# 业务与软件差异审查

| 旧稿问题 | 修订 |
| --- | --- |
| 仅小程序与文档库口径 | 改为网页、原生手机与共享关系后端 |
| 指导老师二审与部长审校混淆 | 运营内部审校后由不同老师一二审 |
| 外部来稿直接排版 | 补采编内容审核前置 |
| 时段值班与资源区间冲突 | 改任务顺序轮转；不宣称实现摄影资源冲突检测 |
| 普通流程阶段表、办公手动归档等旧模型 | 改现有任务、版本、审核、自动归档和工时事实 |
| 教师和外部计时风险 | 明确仅留业务记录、零计酬工时 |
| 未确定费率被默认补齐 | 原创及复杂设计审校采用人工工作登记 |
| 机器人路由被写成已送群 | 当前仅站内与发送状态；外部渠道未接通 |
| 数据库55表教学目标 | 用实际38表214字段79外键替换 |
| 引用课件页码与过程提示 | 改为独立完整叙述，合并稿可脱离课件阅读 |
''')
write('analysis/06-analysis-review.md','''
# 分析模型审查

边界、控制、实体职责已区分；逐用例序列具有成功与失败路径。类模型和状态机不把运行时派生状态误当数据库status列。稿件版本保留历史，退回新版本重走适用审核链。

正常完成同时归档计时，强制关闭不自动计时，工作登记单独建模；结算快照与可变实时工时分开。模型编号、图源可渲染性和本地引用由文档检查器核对；验证结果见008/validation.md。
''')
write('design/02-database-review.md','''
# 数据设计审查

从实际001–005迁移构建隔离空库，读取pg_catalog并生成38表214字段79外键字典。所有业务表至少出现于一个分区ER图；复合外键、唯一约束、检查及索引保留在机器结构与字典中。

没有把旧SQLite教学模型、旧文档库或云支持表混入业务表计数。duty_slots兼容保留但不用作当前轮值；file_payloads兼容载荷与云私有对象区分。JSONB快照有明确历史目的，不替代实体关系。
''')
write('history/README.md','''
# 历史资料

本目录保留被当前模型替代的SQLite教学建表稿和旧分析PDF。旧55表目标不等于当前PostgreSQL生产结构，请使用上级目录的课程合并稿、SRS/SDD/STD和迁移生成字典。

更多旧图和旧文本可从Git历史恢复；旧实现审计与参考笔记仍按其原始时间阅读。本次文档更新不删除或重置任何生产数据库、云函数或附件。
''')
route_source=(REPO/'workbench/server/app.js').read_text(encoding='utf-8')
routes=re.findall(r"api\.(get|post|put|patch|delete)\('([^']+)'",route_source)
api_intro='''# HTTP接口契约

基线：workbench/server/app.js；所有路径含统一前缀/api/v1。下表从当前路由声明生成，动态参数以冒号表示。

## 认证、载荷及失败

- POST登录接收JSON：username与password。Web返回user并设置HttpOnly会话Cookie；请求头X-Client: miniprogram时返回token与user。
- 除健康检查和登录外，业务请求携带有效会话。Web写请求带X-Requested-With: workbench且通过来源检查；手机通过固定上游网关传递Authorization: Bearer令牌。/internal/jobs使用独立调度密钥，不接受普通用户会话替代。
- 常规业务载荷为JSON，由对应领域模块的schema校验；单次JSON上限1MiB。动作、版本、阶段和可见范围以服务端事实为准。
- 上传为multipart/form-data，字段file，单文件非空且不超过12MiB；成功返回id、name、size、sha256。下载返回授权附件字节。Excel返回OpenXML工作簿。
- 创建通常返回201，其他成功通常200。失败返回JSON的error与code；常见401未登录、403无权限、404不存在、409状态或唯一性冲突、422字段错误、429登录限流、503依赖不可用。失败不能在客户端显示为业务完成。
- 会话默认12小时，退出后令牌失效。接口没有统一响应data包装；调用方须按具体端点读取对象、列表或字节。

## 完整方法与路径

'''
write('design/api-contracts.md',api_intro+table(['方法','完整路径'],[(m.upper(),'/api/v1'+p) for m,p in routes])+'''

## 领域字段与示例依据

创建、交付、审校、批注、核定和封存的字段语义见[用例规约](../requirements/system-use-case-specifications.md)。精确schema和返回结构以[路由](../../workbench/server/app.js)及其调用模块为准；可重复输入示例见[推文测试](../../workbench/tests/workflow.test.js)、[部门测试](../../workbench/tests/center.test.js)与[手机协议测试](../../workbench/tests/mobile-unification.mjs)。本清单是当前实现接口索引，不把未来机器人API列作可用端点。
''')

mapping=[
 ('REQ-01','AUTH-001 AUTH-002 TASK-001','auth.js app.js','T-01 T-17 T-19'),
 ('REQ-02','TASK-001 OL-001 OL-002 OL-010 VIEW-001 NOTE-001','domain.js','T-03 T-05 T-17'),
 ('REQ-03','OL-003 OL-004 OL-005 OL-006 OL-007 OL-008 OL-009 CFG-001','domain.js approval.js','T-01 T-02 T-07 T-08'),
 ('REQ-04','RV-001','annotations.js','T-07 T-08'),
 ('REQ-05','ED-001 JOB-003 JOB-004 JOB-005','jobs.js','T-10'),
 ('REQ-06','PR-001 JOB-002 JOB-003 JOB-005','jobs.js','T-11'),
 ('REQ-07','ER-001 DS-001 REC-001 JOB-001 JOB-003 JOB-005','jobs.js','T-12 T-13'),
 ('REQ-08','OL-004 JOB-001 CFG-001','rotation.js flow-defaults.js','T-15 T-16'),
 ('REQ-09','OL-009 JOB-005 JOB-006','domain.js jobs.js','T-02 T-04 T-10 T-14'),
 ('REQ-10','REC-001 REC-002 CFG-002','reports.js policy.js','T-02 T-03 T-05 T-11 T-13'),
 ('REQ-11','STAT-001 STAT-002 VIEW-001 NOTE-001','reports.js','T-05 T-13'),
 ('REQ-12','MSG-001','notifications.js','T-14'),
 ('REQ-13','TASK-001 OL-002 OL-005 OL-010 RV-001','app.js cloud-storage.js','T-06 T-09 T-17 T-19'),
 ('REQ-14','AUTH-001 TASK-001','cloud-db.js cloud-storage.js index.js','T-09 T-19'),
]
rows=[]
for req,cases,modules,tests in mapping:
    case_links='、'.join('[UC-'+c+'](system-use-case-specifications.md)' for c in cases.split())
    module_links='、'.join('['+m+'](../../workbench/server/'+m+')' for m in modules.split())
    rows.append((req,case_links,module_links,'、'.join('['+t+'](../STD.md)' for t in tests.split())))
write('requirements/traceability.md','''# 需求、设计与验证追踪矩阵

SRS的14项需求映射到33个系统用例、实际模块与STD中的验证设计。一个用例可满足多项需求；映射不等于已执行，实测结果以008验证记录为准。

'''+table(['SRS需求','系统用例','设计实现','验证编号'],rows)+'''

模型对应关系：每个UC均对应同名分析序列；状态机与领域类图表达跨用例规则；实际表及约束见[数据字典](../database/data-dictionary.md)。[接口契约](../design/api-contracts.md)关联调用入口。

T-01至T-08：[workflow.test.js](../../workbench/tests/workflow.test.js)；T-09至T-16：[center.test.js](../../workbench/tests/center.test.js)；T-17：[mobile-unification.mjs](../../workbench/tests/mobile-unification.mjs)；T-18：[文档检查器](../tools/check_current_documents.py)；T-19：[007既有云端验证](../../workbench/specs/007-mini-unification/validation.md)。

本轮执行及未验证项见[008验证](../../workbench/specs/008-course-documentation/validation.md)。文档FR-001至010由T-18与本轮人工审查共同核对。
''')
print('Generated course narratives, API index, traceability and SRS/SDD/STD.')
