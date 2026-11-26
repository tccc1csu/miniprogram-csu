# CloudBase 云托管运行与交付

环境 `tccc-qncmzx-d0gxalbv77f0dae9f`，服务 `youth-media-workbench`，版本 **004，100% 流量**。

访问：https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com

2026-11-26 实测公开首页、`/api/v1/health`、登录、任务派发、附件上传下载、完成归档、工时和 Excel 均成功。真实浏览器完成登录并进入报表，无 localhost 请求。首次访问腾讯测试域名会有平台提示，点击“确定访问”。正式长期使用建议绑定学校已有且满足备案条件的域名。

## 运行位置

- React 与 Express：CloudBase 云托管，HOST=0.0.0.0，PORT=8080，min=0/max=1。
- 权威关系数据：CloudBase PG 的私有 `youth_workbench` schema，38 张业务表，通过官方 HTTPS/RPC；不需要 DATABASE_URL、5432、VPC 或额外服务器。
- 账号会话和工时：同一云库；临时内存 SQL 工作副本仅执行原服务端业务校验，所有提交必须云库确认，容器磁盘无唯一生产数据。
- 附件：PG 模式私有 bucket `workbench-private`，后端鉴权下载，大小/SHA256 校验。
- 提醒：云事件函数 `workbench-scheduler`（Active），每分钟平台 timer 调用 `/api/v1/internal/jobs`；独立随机令牌鉴权，提醒去重，消息领取租约与失败重试。容器内计时器仅补充调度。已多次真实云函数调用成功；尚未人为强制缩到 0 做唤醒计时演练。
- 自动备份：云端任务每天将一致业务快照写入私有 `backups/YYYY-MM-DD.json`，已真实创建、重复检查；数据恢复演练检查 38 张表、79 条外键、封存逐行内容和附件散列。对象文件继续持久保留，本地完整导出可额外保存字节。

## 重复发布

1. 安装依赖，运行 `npm test` 和 `npm run build`。
2. 对结构修改创建新的 `cloudbase/migrations/<14位UTC版本>_<名称>.sql`；已应用版本不可改写。用 `tcb db pg migration up --dry-run` 后正常执行。
3. 首次 `node deployment/prepare-runtime.mjs` 签发专用正式服务端 Key，保存在忽略的 `.data/cloud-runtime.json`，不输出值。
4. `node deployment/deploy-cloudbase.mjs` 发布容器，合并已有环境变量，移除旧 TCP 配置。`--package-only` 仅打包。
5. `node deployment/deploy-scheduler.mjs` 部署事件函数；首次再创建名为 workbench-minute 的每分钟 timer。不要重复创建触发器。
6. `npm run db:check` 实际检查网关和公开健康接口。

Key 责任人：中心系统管理员。控制台/API Key 管理找到名称 `workbench-cloudrun-runtime` 与 `.data/cloud-runtime.json` 中 keyId，签发替代 Key 后更新本机受限文件并重发云托管，确认健康再撤销旧 Key。CLI 登录凭据不复制到容器。调度令牌改动时须同步重发事件函数。

## 账号和数据

正式管理员及其密码保持独立，仍在本机 `.data/cloud-admin-bootstrap.json`。按用户最新授权，已额外加入 21 个验收账号、47 个任务、38 条工时和 28 份私有附件；任务标题带“【验收】”，不作为真实结算。验收账号密码单独随机生成，保存在忽略的 `.data/cloud-acceptance-accounts.json`，与本地 `Youth2026!` 无关。角色表和操作路线见 acceptance-guide.md。

运行 `npm run db:seed:acceptance` 会先备份，在临时 SQL 副本调用原业务函数构建数据，再以一个云事务提交 903 条新增记录及空路由初始化。数据集 marker 已存在时直接退出，保留用户验收进度；实测重复执行仍为 21 个账号、47 个任务。已有账号或流程配置碰撞会拒绝，不覆盖正式人员。附件用私有上传/确认协议，异常时由补偿回收不被引用的对象。

正式成员需按实际名单开通。设置 `WORKBENCH_NEW_ACCOUNT_PASSWORD` 后运行 `node deployment/create-account.mjs <账号> <姓名> <角色> [部门]`；成员/部长必须指定部门。脚本走云端 HTTPS。

`node deployment/cloud-backup.mjs` 在受限 `.data/backups` 导出一致关系数据和全部附件，并执行独立 SQL 恢复核对。备份含成员和工时信息，不对外分享。

旧小程序生产集合**未修改**：当前按用户要求优先提供代表性验收场景，不追求精确历史迁移。正式历史数据已知存在成员映射缺口，核对见 legacy-mapping.md；若后续用于结算，须另行核对原值、来源、附件与快照。

## 尚未完成的外部接入

- 微信机器人 endpoint/token 未提供，健康接口真实显示 `groupNotifications: unconfigured`；站内通知和提醒已运行，群内 @ 发送尚未接通。
- 小程序已保留原三底栏并原位替换，删除独立“新版工作台”。当前经已关联旧环境的 `workbenchGateway` 调用唯一云托管 API，无旧库双写；无需在此网关链路配置手机 HTTP 合法域名。旧环境 2026-12-11 到期前需续期或迁移网关。真机、微信审核和发布尚未完成，详见 [两端统一部署](mini-unification.md)。

## 实测记录

- `npm test`：16 项原业务测试通过。
- `node tests/cloud-http.mjs`：11 项真实云验收通过，包括六部门、两实例并发、归档回滚、仅一次计时、顺序轮值、权限、附件、备份恢复；临时用户和任务均清理。
- `node tests/cloud-release.mjs`：5 项公开域名与真实浏览器验收通过；不启动本地 HTTP 服务。
- `node tests/mobile-unification.mjs`：四类身份、六类业务、分角色推文两审归档、任务备注、附件往返、工时排除与网关拒绝规则通过；不能代替真机验收。
- `npm run test:cloud:acceptance`：8 项持久验收数据检查通过，含 21 个角色公开登录与权限、47 个任务/14 种状态、38 条内部工时、备注 Excel、封存不变、28 份附件及真实浏览器。仅删除验证会话，保留任务。该检查针对初始场景状态，用户推进验收任务后不应再要求状态仍与初始一致。

证据：`artifacts/cloudbase/business-http.json`、`public-release.json`、`public-workbench.png`。原始平台探针保留在 http-probe.json，不得清理后直接重跑。

验收数据证据：`acceptance-import.json`、`acceptance-rerun.json`、`acceptance-public.json`、`acceptance-workbench.png`、`acceptance-reports.png` 和 `acceptance-report.xlsx`（均位于 artifacts/cloudbase）。导入前后完整备份位于忽略的 `.data/backups`，恢复检查覆盖 38 张表、79 条外键和全部附件散列。旧的 cloud-http.mjs 会重置测试路由，不应在有保留验收数据的环境直接重跑。

本次集中日志查询入口返回 `LOG_SERVICE_NOT_ENABLED`（The log service is not enabled）。未把集中日志审计记为通过；运行健康及事件函数直接调用已验收，后续可在控制台开通日志服务后增加告警。
