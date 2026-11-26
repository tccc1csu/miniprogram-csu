# 数据模型

- tasks.report_note 保存后补任务备注，初始需求说明继续用 tasks.notes。
- worklogs 与 adjustments 保存核算和历次核定。报表读出源于系统乘数或人工核定的原因，封存存储完整行。
- duty_rotation 保存部门和最后选中成员、配置人。duty_rotation_members 保存部门、成员和唯一顺序。任务实际派发保存在 assignments，轮值动作保存在 events。

云端新增私有 `_state`（全局提交版本）、`_requests`（一次命令的摘要、结果和版本）、`_uploads`（可补偿附件登记）。这些运维表不对客户端公开。38 张业务表仍独立建模，附件字节不放入事务快照。内存事务工作副本只捕获行增删改；权威数据由云端 `wb_command` 的单次事务持久化，契约见 contracts/cloud-http.md。
