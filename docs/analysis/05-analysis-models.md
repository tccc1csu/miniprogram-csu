# C 分析模型

## 分析边界与职责

边界对象接收完整业务信息，控制对象协调请求路径，账号实体验证访问资格，各业务聚合核验自身条件并承载事实与规则。消息名描述接收者执行的动作；返回箭头传递结果。分析类不是对数据库表或实际JavaScript类的机械复制。

![分析职责](../diagrams/analysis/class-responsibilities.svg)

![领域分析类](../diagrams/analysis/class-domain.svg)

## 状态与事件

任务状态由承接、当前版本、审核和归档事实推导，实际tasks表没有status列。推文源稿与排版是不同phase；新排版版本重走内部、一审、二审。内容老师和最终验收各有独立事件。

![推文状态机](../diagrams/analysis/state-publication.svg)

![部门任务状态机](../diagrams/analysis/state-jobs.svg)

![工时生命周期](../diagrams/analysis/state-accounting.svg)

## 用例实现序列

下面每个系统用例均有独立序列视图。推文协作簿、部门任务簿、工时台账等是领域聚合，不是数据库表；创建请求先交集合实体受理。序列中的具体动作与职责类图对应，控制不通过读取属性替代实体核验规则。条件失败不改变既有事实；发布和验收整体生效，D章再说明SQL事务与HTTP持久化方式。

### UC-AUTH-001 登录工作台

![用例实现](../diagrams/analysis/seq-uc-auth-001.svg)

### UC-AUTH-002 退出工作台

![用例实现](../diagrams/analysis/seq-uc-auth-002.svg)

### UC-TASK-001 查看任务与办理进度

![用例实现](../diagrams/analysis/seq-uc-task-001.svg)

### UC-OL-001 提出推文任务

![用例实现](../diagrams/analysis/seq-uc-ol-001.svg)

### UC-OL-002 提交或修订源稿

![用例实现](../diagrams/analysis/seq-uc-ol-002.svg)

### UC-OL-003 审阅外部源稿内容

![用例实现](../diagrams/analysis/seq-uc-ol-003.svg)

### UC-OL-004 安排推文承接

![用例实现](../diagrams/analysis/seq-uc-ol-004.svg)

### UC-OL-005 提交排版版本

![用例实现](../diagrams/analysis/seq-uc-ol-005.svg)

### UC-OL-006 确认运营内部审校

![用例实现](../diagrams/analysis/seq-uc-ol-006.svg)

### UC-OL-007 完成教师一审

![用例实现](../diagrams/analysis/seq-uc-ol-007.svg)

### UC-OL-008 完成教师二审

![用例实现](../diagrams/analysis/seq-uc-ol-008.svg)

### UC-OL-009 登记推文发布

![用例实现](../diagrams/analysis/seq-uc-ol-009.svg)

### UC-OL-010 报名公开征集

![用例实现](../diagrams/analysis/seq-uc-ol-010.svg)

### UC-RV-001 标注稿件意见

![用例实现](../diagrams/analysis/seq-uc-rv-001.svg)

### UC-ED-001 建立采编办公稿件任务

![用例实现](../diagrams/analysis/seq-uc-ed-001.svg)

### UC-PR-001 提出摄制预约

![用例实现](../diagrams/analysis/seq-uc-pr-001.svg)

### UC-ER-001 提出部门需求

![用例实现](../diagrams/analysis/seq-uc-er-001.svg)

### UC-DS-001 提出设计任务

![用例实现](../diagrams/analysis/seq-uc-ds-001.svg)

### UC-JOB-001 安排部门任务

![用例实现](../diagrams/analysis/seq-uc-job-001.svg)

### UC-JOB-002 领取摄制任务

![用例实现](../diagrams/analysis/seq-uc-job-002.svg)

### UC-JOB-003 提交部门交付物

![用例实现](../diagrams/analysis/seq-uc-job-003.svg)

### UC-JOB-004 审阅采编内容

![用例实现](../diagrams/analysis/seq-uc-job-004.svg)

### UC-JOB-005 验收并归档部门任务

![用例实现](../diagrams/analysis/seq-uc-job-005.svg)

### UC-JOB-006 强制关闭异常任务

![用例实现](../diagrams/analysis/seq-uc-job-006.svg)

### UC-REC-001 登记例外工作量

![用例实现](../diagrams/analysis/seq-uc-rec-001.svg)

### UC-REC-002 核定特殊工时

![用例实现](../diagrams/analysis/seq-uc-rec-002.svg)

### UC-STAT-001 筛选并导出工时报表

![用例实现](../diagrams/analysis/seq-uc-stat-001.svg)

### UC-STAT-002 封存结算报表

![用例实现](../diagrams/analysis/seq-uc-stat-002.svg)

### UC-CFG-001 配置教师与承接规则

![用例实现](../diagrams/analysis/seq-uc-cfg-001.svg)

### UC-CFG-002 维护工时规则版本

![用例实现](../diagrams/analysis/seq-uc-cfg-002.svg)

### UC-VIEW-001 查看个人工作与工时

![用例实现](../diagrams/analysis/seq-uc-view-001.svg)

### UC-MSG-001 查看任务通知

![用例实现](../diagrams/analysis/seq-uc-msg-001.svg)

### UC-NOTE-001 维护任务报表备注

![用例实现](../diagrams/analysis/seq-uc-note-001.svg)
