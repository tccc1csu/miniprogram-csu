# 青年传媒中心工作台

云端工作台：[打开网页](https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com)。关闭本机后仍可使用。云端已有 21 个验收账号、47 个任务和 28 份附件，涵盖六部门、审核阶段和工时报表；账号与操作路线见 [云端验收指引](deployment/acceptance-guide.md)。

本地开发地址为 [http://127.0.0.1:3001](http://127.0.0.1:3001)。以下命令只初始化本地演示数据：

```powershell
npm ci
npm run db:seed -- --examples
npm run build
npm start
```

本地登录页提供各角色的演示按钮。演示密码为 `Youth2026!`，账号见 `server/seed.js`。服务默认绑定本机，数据写入 `.data`。

- 从「新建需求」选择公众号排版、采编挂网、摄制预约、部门需求、美编设计或工作登记。登录身份决定可见入口。兄弟组织的新推文供稿先交采编审核，通过后派给运营排版。
- 排版交稿时可以粘贴公众号正文或导入文章 HTML。审核人可在「稿件与版本」中选中文字并保存批注，点击批注会定位原文。已有推文示例可从不同审核环节试用。
- 两位指导老师分别处理一审、二审，运营部长可在「流程设置」配置审校默认人员及老师的群路由和 @ 标识。派发时可保存本业务的默认承接人，并可在「流程设置」取消默认。
- 采编挂网按稿名与网站逐行录入。启用老师内容审校时，审校通过后办公部才交挂网成果。验收后可创建关联推文。
- 摄制部长可派发，摄制干事可抢单。新增轮值安排后会在派发时推荐有效成员。任务可设置提前提醒，「我的通知」显示站内提醒。
- 正常验收自动归档。原创无自动创作价目，美编复杂审核采用人工补登。强制归档保留理由和原有成果，并标识工时未自动核算。
- 「工时与报表」支持部门、周次、成员、日期和核定状态筛选，支持分组、调整列、保存视图与 Excel 导出。部长核定本部，办公部长查看全中心和封存快照。
- 测试命令为 `npm test`、`npm run build` 和 `npm run test:browser`。浏览器测试默认使用本机 Edge，也可通过 `BROWSER_EXECUTABLE` 指定 Chromium。截图见 `artifacts/`。
- 单仓库根目录的 `../miniprogram/` 可导入微信开发者工具；保留原蓝色卡片和三底栏，统一办理六类业务。当前通过旧关联环境的 `workbenchGateway` 调用同一 API，已完成模拟器和云端接口验证，真机与微信审核发布尚未完成。部署、页面去留、环境到期及回退见 [两端统一指引](deployment/mini-unification.md)。
- 本机开发使用 PGlite；云端已运行于 CloudBase 云托管，通过 HTTPS/RPC 使用云端 PostgreSQL 和私有对象存储，不需要原生 TCP 连接或本机在线。旧小程序生产库保留，当前验收样例不作为真实历史结算。
- 配置 `NOTIFICATION_ENDPOINT` 可把出站通知送到可信中继。中继收到 JSON 中的 `event`、`task_id`、`recipient_id`、`payload` 等字段，应支持 `Idempotency-Key` 并返回成功或失败回执。站内通知正常，当前实际微信群发送渠道未配置。

业务源见 [BIZ-RULES-FULL](背景文件/BIZ-RULES-FULL.md)、[确认及暂定口径](specs/decisions.md) 与 [业务覆盖表](specs/business-coverage.md)。验收见 [公众号排版](specs/001-publication-workflow/validation.md) 、[中心其他业务](specs/002-center-workflows/validation.md) 和 [公众号协同审校](specs/003-publication-review/validation.md)。
