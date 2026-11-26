# 统一仓库执行约定

- 执行命令、读写和验证只通过 exec。
- 唯一业务后端为 `workbench/server`；网页在 `workbench/src`，原生小程序在 `miniprogram`，网关在 `cloudfunctions/workbenchGateway`。
- 长期基准为 `workbench/背景文件/BIZ-RULES-FULL.md`；用户新决定优先，记录到 `workbench/specs/decisions.md`。
- 继续使用 Spec Kit，相关命令在 `workbench/` 执行。根 `docs`、`server` 和 `cloudfunctions/api` 是历史参考，不据旧口径改回当前业务，不部署旧 `api`。
- 保留蓝色手机卡片和首页/协作广场/我的三底栏；不新增独立工作台、不恢复双套逻辑。
- 两端共用关系型后端和服务端权限。正常完成自动归档、一次计时；强制关闭零自动工时；教师/外部不计工时；工时例外审计和封存快照保留。
- 旧小程序生产库不读写、不重置、不删除。删除旧数据前必须先说明并取得用户授权。
- 不提交 `.env`、`.data`、验收密码、私有开发者配置、密钥、运行库或个人资料。微信未接入功能如实说明。
