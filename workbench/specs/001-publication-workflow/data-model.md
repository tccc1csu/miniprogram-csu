# Data Model
部门departments；用户users(role,department_id,payable,active)，会话sessions(token_hash,expires_at)。
任务tasks(creator_id,title,layout_type,deadline,notes,open_registration,urgent,created_at)；
固定部长task_reviewers(task_id,user_id UNIQUE pair)；
指派assignments(task_id UNIQUE,assignee_id,actor_id,created_at)。
版本versions(task_id,number,body,preview_url,author_id UNIQUE task/number)，
文件files(task_id,owner_id,storage_name,name,size,sha256)，version_files(version_id,file_id)；
审核reviews(task_id,version_id,stage,decision,reason,actor_id)，同版同环节只允许一个有效决策。
报名registrations(task_id,user_id UNIQUE pair)，文件关联registration_files。
发布publications(task_id UNIQUE,version_id,url,actor_id)；
归档archives(task_id UNIQUE,version_id,created_at)；任务状态查询版本+当前版审查+发布/归档派生，不存状态字段。
工时worklogs(task_id,user_id,kind,department_id,base_units,effective_units,rate_cents,confirmed)，唯一 task/user/kind；
调整adjustments(log_id,old_units,new_units,reason,actor_id,created_at)；
视图saved_views(user_id,name,config)，封存report_seals(created_by,start_date,end_date)，封存行seal_rows(seal_id,source_id,data JSONB)；
通知outbox(task_id,event,recipient_id,payload,status UNIQUE task/event/recipient)。
事件events记录派发等操作；迁移有schema_migrations。
FK禁止悬空，正数/角色/check约束；退休仅停用账号不删历史。
状态：待接单→待交稿→部长内审→老师一审→老师二审→待发布→已归档；退回→新版本→部长内审。
