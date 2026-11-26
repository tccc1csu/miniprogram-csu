# 历史云函数，不部署

此目录保留原仓库版本用于追溯与回退。新版小程序只调用 `workbenchGateway`，由它访问 `workbench/server` 对应的云托管 API。请勿部署此旧 `api`、运行旧初始化/重置程序，或用其旧角色/审核规则覆盖当前业务。

旧线上函数和文档数据库仍保留，本次未修改或删除。当前说明见仓库根 README 与 `workbench/deployment/mini-unification.md`。
