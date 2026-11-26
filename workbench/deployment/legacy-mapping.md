# 旧小程序文档库与新版关系库

新小程序页和 Web 共用 Express API 及关系库。旧数据库用于历史留档和迁移核对。旧公开接口、账号会话及生产数据未进行写入切换。

| 原数据 | 对应对象 | 核对办法 |
| --- | --- | --- |
| departments、users、members | departments、users | 用旧成员 ID 和账号 ID 建连。核验部门及角色再开通账号，旧密码和会话不导入。 |
| handoffs | tasks、jobs、bookings、article_lines、assignments | 根据 workflowType 分流。保留原状态和时间，供稿、审校及发布缺项单独核对。 |
| files 和任务附件引用 | files、私有 PG 存储、version_files | 按文件 ID 存来源，校验所有者与附件内容后再关联；生产附件字节不再写 file_payloads。 |
| work_item、contribution_basis、contribution_measurement | worklogs、adjustments 和旧值快照 | 对照任务与成员和原工时单位，保留原规则及核定结果，按来源去重。 |
| weekly_records | 旧周账目与明细的对账记录 | 周汇总只用于对账，能证明拆分关系的明细才进新版台账。 |

只读审计实测查到 33 个用户、32 个成员、25 个协作单、15 条工作明细、16 条周记录和 1 个独立文件记录。2 个成员未匹配账号，2 条周记录的成员未匹配。脚本仅在内存处理字段并输出汇总。原始记录未导入新版。

下一步按旧集合名和文档 ID 保存来源映射，先试导到独立环境，对照同一周期人数、任务数、附件内容、工时和金额。旧归档通过经核对的历史导入入口写入，不能靠重放新工作流重算工时。
