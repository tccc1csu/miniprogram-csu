# 5 分析模型

## 5.1 分析对象与图的读法

分析模型从第 4 节用例规约出发，说明软件内部由哪些对象协作实现需求。分析类图描述类及其关系；分析序列图描述一个用例路径中的对象协作；分析状态机图约束一个核心对象在不同情形下可以接受的操作。

本章按课程第 287～306、313～338、339～357 页展开。边界类负责输入、输出及简单过滤；每个用例对应一个同名“控制”；实体类封装业务概念、数据和规则。边界类名称中的“接口”表示与外部人员或系统交互的分析边界，不指定页面组件或网络接口。

图中实线消息的接收对象执行所标操作，虚线返回结果；序列图中的“对象名:类名”说明该生命线是哪一类的实例。状态迁移采用“事件 [条件] / 动作”；状态名描述对象所处情形，而不是待办动作。类图的操作、序列消息及状态事件保持同名。

## 5.2 分析类图

类图按业务分视图展示；不同图中同名实体表示同一个分析类。属性只表达业务特征，不添加数据库主键、外键或单一“状态”字段；状态含义由责任关系、业务属性和审查结论共同决定。实线关联标明角色和多重性，实心菱形表示整体拥有部分，虚线箭头表示协作依赖。操作中的“业务信息”表示该责任所需的一组输入，具体内容在序列消息中展开；无参操作使用对象自身已掌握的关系和依据。

### 5.2.1 组织与稿件协同

![图 12 分析类图（一）— 组织与稿件协同](../diagrams/analysis/class-editorial.png)

[PlantUML 图源](../diagrams/analysis/class-editorial.puml) · [SVG 矢量图](../diagrams/analysis/class-editorial.svg)

成员与部门表达组织关系，采编协同关联发起人、当前办公承接人和作品。作品保留稿件版本，审查结论绑定对应版本与审核人；发布成果保留平台和链接。登录会话关联有效成员，承载登录结果。

### 5.2.2 摄制预约

![图 13 分析类图（二）— 摄制预约](../diagrams/analysis/class-production.png)

[PlantUML 图源](../diagrams/analysis/class-production.puml) · [SVG 矢量图](../diagrams/analysis/class-production.svg)

摄制日程负责预约受理，摄制约定封装冲突与加急判断。预约分别关联预约人、摄制承接人和办公归档人，避免把三种职责压成一个“负责人”。确定承接操作由派发与抢单共用。

### 5.2.3 部门与跨部门流转

![图 14 分析类图（三）— 部门与跨部门流转](../diagrams/analysis/class-workflow.png)

[PlantUML 图源](../diagrams/analysis/class-workflow.puml) · [SVG 矢量图](../diagrams/analysis/class-workflow.svg)

流转任务拥有有序阶段，阶段分别关联承办部门、当前承接成员及历次成果。调用阶段责任时先经过任务整体；相邻阶段关系用于验证流转条件，不用控制类拼接部门处理顺序。

### 5.2.4 工作贡献与津贴核算

![图 15 分析类图（四）— 工作贡献与津贴核算](../diagrams/analysis/class-accounting.png)

[PlantUML 图源](../diagrams/analysis/class-accounting.puml) · [SVG 矢量图](../diagrams/analysis/class-accounting.svg)

工作贡献对应需求中的任务明细，每项贡献保留实际来源、贡献人、计量部门和生效标准；同一成员、周次仅有一份周汇总。周汇总委托贡献核算津贴，周报汇编结果，导出不再计量。

### 5.2.5 归档摄制成果的边界、控制与实体职责

![图 16 分析类图（五）— 归档摄制成果的边界、控制与实体职责](../diagrams/analysis/class-responsibilities.png)

[PlantUML 图源](../diagrams/analysis/class-responsibilities.puml) · [SVG 矢量图](../diagrams/analysis/class-responsibilities.svg)

以 UC-PR-004 展示完整的边界—控制—实体协作。普通成员接口接收归档请求，控制对象委派责任，摄制预约验证归档资格和自身条件，台账与津贴标准完成贡献归集。

### 5.2.6 采编协同用例职责

![图 17 分析类图（六）— 采编协同用例职责](../diagrams/analysis/class-controls-editorial.png)

[PlantUML 图源](../diagrams/analysis/class-controls-editorial.puml) · [SVG 矢量图](../diagrams/analysis/class-controls-editorial.svg)

四个采编协同用例分别拥有同名控制类。普通成员接口承担需求提交与结果提交，部长接口承担派发，管理员接口承担老师审核请求；采编协同封装生命周期约束。

### 5.2.7 摄制预约用例职责

![图 18 分析类图（七）— 摄制预约用例职责](../diagrams/analysis/class-controls-production.png)

[PlantUML 图源](../diagrams/analysis/class-controls-production.puml) · [SVG 矢量图](../diagrams/analysis/class-controls-production.svg)

五个摄制用例分别由边界类转交其控制类。受理预约先交摄制日程，派发与抢单共用预约的确定承接责任；控制类不直接计算加急或改写负责人。

### 5.2.8 部门流转与稿件审核用例职责

![图 19 分析类图（八）— 部门流转与稿件审核用例职责](../diagrams/analysis/class-controls-workflow.png)

[PlantUML 图源](../diagrams/analysis/class-controls-workflow.puml) · [SVG 矢量图](../diagrams/analysis/class-controls-workflow.svg)

流转与稿件审核的六个控制类均先请求流转任务整体，再由整体委托阶段和稿件版本，避免外部控制类绕过任务整体改变内部阶段。

### 5.2.9 登录、统计与组织用例职责

![图 20 分析类图（九）— 登录、统计与组织用例职责](../diagrams/analysis/class-controls-support.png)

[PlantUML 图源](../diagrams/analysis/class-controls-support.puml) · [SVG 矢量图](../diagrams/analysis/class-controls-support.svg)

登录、个人查询、部门核对、中心周报与组织维护各有控制类。微信授权服务有独立边界；周报生成归办公部部长的部长接口，技术维护管理员不因此获得老师审稿职责。

同一成果只属于一种业务上下文：采编协同、摄制预约或任务阶段，三者满足互斥归属约束；三个视图中的 `0..1` 表示某一种可选归属，合起来恰有一个整体。稿件审核结论不必属于采编协同，通用流转稿件也可拥有相应审查结论。

跨视图协作中，采编协同、摄制预约和流转任务都可以委托工作量台账归集贡献。工作量台账是工作贡献的业务集合及其核对责任，不预设为某张数据库表。津贴标准和摄制约定代表已存在的会议规则及版本，不以其名称推定具体软件架构。

## 5.3 分析序列图

每个用例对应一张基本路径图，简单的退回、冲突或重复请求分支用 `alt`、`opt`、`break` 合并表达。图中成员等上下文对象由本次请求关联，未标创建消息的实体生命线表示本次责任协作对象，不能据此理解为修改前必须已经有持久化结果。涉及创建的关键例子在摄制预约图中特别画出，确保冲突分支不建立预约。

边界对象处理输入输出，控制对象仅组织路径。权限资格由成员及所属部门验证，任务的当前承接、成果和审查条件由相应实体自身验证；控制对象不通过读取一组属性来代替实体执行规则。所有异常返回均不得留下不符合后置条件的有效贡献或责任关系。

### 5.3.1 UC-AUTH-001：登录系统

![图 21 登录系统分析序列图](../diagrams/analysis/seq-uc-auth-001.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-auth-001.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-auth-001.svg)

微信授权边界封装外部身份服务，成员承担账号有效性与角色关系验证；图中的登录入口为三类角色共用。

### 5.3.2 UC-ED-001：提交采编协同需求

![图 22 提交采编协同需求分析序列图](../diagrams/analysis/seq-uc-ed-001.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-ed-001.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-ed-001.svg)

协同负责建立可追踪的需求，作品验证稿件来源；截止日期为空不作为拒绝理由。

### 5.3.3 UC-ED-002：派发采编同步任务

![图 23 派发采编同步任务分析序列图](../diagrams/analysis/seq-uc-ed-002.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-ed-002.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-ed-002.svg)

派发资格由成员和协同各自验证；协同保证待派发条件及唯一承接责任。

### 5.3.4 UC-ED-003：提交采编同步结果

![图 24 提交采编同步结果分析序列图](../diagrams/analysis/seq-uc-ed-003.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-ed-003.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-ed-003.svg)

协同接收当前承接人的成果，并保留退回重提历史；成果对象验证完整性，控制类不逐项读取属性判断。

### 5.3.5 UC-ED-004：审核并归档采编协同

![图 25 审核并归档采编协同分析序列图](../diagrams/analysis/seq-uc-ed-004.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-ed-004.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-ed-004.svg)

通过时分别归集原创采编和办公同步贡献；转载不产生原创写作贡献。退回不计量，重复合法归档返回原结果。归档与明细归集作为一致的业务结果完成；失败不留下半份有效结果。

### 5.3.6 UC-PR-001：发起摄制预约

![图 26 发起摄制预约分析序列图](../diagrams/analysis/seq-uc-pr-001.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-pr-001.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-pr-001.svg)

摄制日程负责受理并委托摄制约定判断冲突和加急；冲突分支没有预约对象。两天与 1.5 倍率作为约定依据保留，未明确的冲突资源范围不在分析中擅自定死。

### 5.3.7 UC-PR-002：派发摄制任务

![图 27 派发摄制任务分析序列图](../diagrams/analysis/seq-uc-pr-002.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-pr-002.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-pr-002.svg)

派发与抢单都请求摄制预约的确定承接操作，由同一对象保护唯一承接关系。

### 5.3.8 UC-PR-003：提交摄制成果

![图 28 提交摄制成果分析序列图](../diagrams/analysis/seq-uc-pr-003.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-pr-003.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-pr-003.svg)

预约核验当前承接人，成果与办公成员分别承担完整性及归属验证；沿用归档偏好不能替代本次责任确认。

### 5.3.9 UC-PR-004：归档摄制成果

![图 29 归档摄制成果分析序列图](../diagrams/analysis/seq-uc-pr-004.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-pr-004.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-pr-004.svg)

指定办公成员归档后形成摄制、归档两项贡献。加急是否适用于某类贡献由生效标准决定，不能直接把两类工时都乘 1.5；重复请求不再增加工时。

### 5.3.10 UC-PR-005：抢接摄制任务

![图 30 抢接摄制任务分析序列图](../diagrams/analysis/seq-uc-pr-005.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-pr-005.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-pr-005.svg)

抢单与派发冲突时只有一个当前承接结果；抢单成功本身不计工时。

### 5.3.11 UC-FL-001：登记部门与跨部门任务

![图 31 登记部门与跨部门任务分析序列图](../diagrams/analysis/seq-uc-fl-001.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-fl-001.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-fl-001.svg)

发起人登记的部门和阶段由任务整体组织；需求来源可以是外部门，登记人仍按当前规约描述为中心成员。

### 5.3.12 UC-FL-002：派发部门阶段任务

![图 32 派发部门阶段任务分析序列图](../diagrams/analysis/seq-uc-fl-002.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-fl-002.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-fl-002.svg)

控制类先请求流转任务整体，再由任务委托阶段。前序未完成时阶段拒绝派发，排班仅作为部长安排依据。

### 5.3.13 UC-FL-003：提交部门阶段成果

![图 33 提交部门阶段成果分析序列图](../diagrams/analysis/seq-uc-fl-003.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-fl-003.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-fl-003.svg)

阶段根据成果性质决定后续责任。稿件内容变更需重新审查；已审稿件仅补充发布链接时进入完成确认，不把链接补充误当新一版稿件。

### 5.3.14 UC-FL-004：确认部门阶段完成

![图 34 确认部门阶段完成分析序列图](../diagrams/analysis/seq-uc-fl-004.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-fl-004.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-fl-004.svg)

完成确认先由阶段验证稿件审核与成果条件。任务最后一阶段完成后归集贡献，依据不足的项标为待核对；专门流程已计入的相同实际贡献不能重复计量。

### 5.3.15 UC-RV-001：一审运营部推文

![图 35 一审运营部推文分析序列图](../diagrams/analysis/seq-uc-rv-001.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-rv-001.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-rv-001.svg)

运营部长一审通过后转老师二审；稿件版本持有该版审查依据，不能以旧版本通过结论处理修改后的稿件。采编专门流程由 UC-ED-004 处理。

### 5.3.16 UC-RV-002：二审稿件

![图 36 二审稿件分析序列图](../diagrams/analysis/seq-uc-rv-002.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-rv-002.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-rv-002.svg)

老师二审检查适用的前序结论；稿件版本持有该版审查依据，不能以旧版本通过结论处理修改后的稿件。采编专门流程由 UC-ED-004 处理。

### 5.3.17 UC-REC-001：核对部门任务明细与周汇总

![图 37 核对部门任务明细与周汇总分析序列图](../diagrams/analysis/seq-uc-rec-001.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-rec-001.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-rec-001.svg)

核对只比较有效明细及周汇总并标明差异，不能在查询期间悄悄补造贡献。

### 5.3.18 UC-STAT-001：生成并导出中心周报

![图 38 生成并导出中心周报分析序列图](../diagrams/analysis/seq-uc-stat-001.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-stat-001.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-stat-001.svg)

台账组织汇总，成员周汇总委托各项贡献核算，贡献按关联标准计算津贴。控制类不自行计算工时或时薪；周报生成不新增工作贡献。

### 5.3.19 UC-ORG-001：管理组织与人员

![图 39 管理组织与人员分析序列图](../diagrams/analysis/seq-uc-org-001.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-org-001.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-org-001.svg)

中心组织维护有效部门和成员关系；历史贡献保留计量时部门与规则依据，人员调整不改写既有统计。

### 5.3.20 UC-VIEW-001：查看个人工作记录

![图 40 查看个人工作记录分析序列图](../diagrams/analysis/seq-uc-view-001.png)

[PlantUML 图源](../diagrams/analysis/seq-uc-view-001.puml) · [SVG 矢量图](../diagrams/analysis/seq-uc-view-001.svg)

个人查询返回本人明细、周汇总及异常；系统内部的台账和汇总对象不是外部执行者。

上述图完整对应 20 个现有用例的主要责任协作。共用输入过滤和无效权限分支不重复细化为独立用例；具体扩展条件仍以对应规约为准。派发成功后的“交付任务”、成果提交后的“待审核责任”在本章表示责任结果，不额外承诺尚未确定的外部消息服务。

## 5.4 分析状态机图

为采编协同、摄制预约、任务阶段和流转任务建模；任务阶段分别展示运营推文与美编设计实例。初始节点表示对象建立后默认所处状态，不表示整个组织流程开始。已归档对象仍需支持查询及重复请求，因此保留为可响应对象，不以最终节点表示生命周期结束。

### 5.4.1 采编协同

![图 41 分析状态机图（一）— 采编协同](../diagrams/analysis/state-editorial.png)

[PlantUML 图源](../diagrams/analysis/state-editorial.puml) · [SVG 矢量图](../diagrams/analysis/state-editorial.svg)

状态属于一条采编协同。迁移前核验审核、材料和可用计量依据，迁移动作完成贡献归集与归档；已归档仍可查询，重复合法归档用内部响应表示。

### 5.4.2 摄制预约

![图 42 分析状态机图（二）— 摄制预约](../diagrams/analysis/state-production.png)

[PlantUML 图源](../diagrams/analysis/state-production.puml) · [SVG 矢量图](../diagrams/analysis/state-production.svg)

同一个确定承接事件按派发／抢单条件处理，未承接检查与建立承接关系作为一个对象责任。冲突拒绝发生在对象创建前。

### 5.4.3 任务阶段

![图 43 分析状态机图（三）— 任务阶段（运营推文实例）](../diagrams/analysis/state-stage.png)

[PlantUML 图源](../diagrams/analysis/state-stage.puml) · [SVG 矢量图](../diagrams/analysis/state-stage.svg)

以已明确审核岗位的运营推文阶段为例。状态由承接、稿件版本、审核结论、发布依据共同决定；退回后分清稿件修改与发布依据补正。

### 5.4.4 任务阶段

![图 44 分析状态机图（四）— 任务阶段（美编设计实例）](../diagrams/analysis/state-stage-design.png)

[PlantUML 图源](../diagrams/analysis/state-stage-design.puml) · [SVG 矢量图](../diagrams/analysis/state-stage-design.svg)

美编设计阶段直接交部长确认，不套用运营稿件的一审、二审；退回保留原责任人与历史成果。

### 5.4.5 流转任务

![图 45 分析状态机图（五）— 流转任务](../diagrams/analysis/state-workflow.png)

[PlantUML 图源](../diagrams/analysis/state-workflow.puml) · [SVG 矢量图](../diagrams/analysis/state-workflow.svg)

整体任务只在全部阶段完成后结束；规则或贡献依据缺失时保留待核对项，不把任务完成等同于津贴已核实。

运营推文实例不能直接套用于一审岗位尚未确定的其他部门；美编设计实例只适用于不涉及稿件内容审查的成果。阶段图描述局部责任，流转任务图描述整体完成条件。状态机图里的合法事件需要同时满足调用者资格与警戒条件；不满足时反馈拒绝并保留当前业务结果。

## 5.5 三类图的一致性

| 业务约束 | 承担责任的类与操作 | 序列图 | 状态约束 |
| --- | --- | --- | --- |
| 截止日期可选 | 采编协同.建立协同 | UC-ED-001 | 有效需求默认待派发 |
| 原创与同步贡献分别计量 | 采编协同.提取应计贡献；工作量台账.归集贡献 | UC-ED-004 | 通过且归集成功后已归档 |
| 冲突拒绝，不建立预约 | 摄制日程.受理预约；摄制约定.检查预约条件 | UC-PR-001 | 冲突不属于预约对象状态 |
| 派发和抢单唯一承接 | 摄制预约.确定承接 | UC-PR-002、005 | 未承接才接受首次承接 |
| 指定办公成员归档 | 摄制预约.归档摄制成果 | UC-PR-004 | 成果齐备待归档 → 已归档 |
| 修改稿件重新审核 | 任务阶段.提交成果；稿件版本.接受审查结论 | UC-FL-003、UC-RV-001／002 | 待修改／内容变更 → 待一审 |
| 前序完成才流转 | 流转任务.确认阶段完成；任务阶段.检查可开始 | UC-FL-004 | 待前序 → 可派发 |
| 一个成员每周一份汇总 | 工作量台账.归集贡献；成员周汇总.按明细汇总 | UC-ED-004、UC-PR-004、UC-FL-004 | 归档／完成确认后才提供有效计量依据 |
| 导出不重复加急计量 | 工作贡献.核算津贴；津贴标准.计算津贴 | UC-STAT-001 | 导出不改变任务完成状态 |

分析模型中的“归集成功”表示所需业务结果一致成立，不预设数据库事务、锁或接口实现。任务阶段可以完成但某项贡献因规则缺失而待核对；这种情况按 UC-FL-004 输出异常，不能填零冒充已核实工时。分析阶段继续保持“拟开发方案”的性质，实际软件是否实现由后续设计、实现与验证确认。
