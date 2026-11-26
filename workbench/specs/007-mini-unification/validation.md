# 两端统一验证记录

日期：2026-11-27。交付分支：`feat/unified-cloud-workbench`，基线：`6551d197`。微信正式审核发布和真机验收不在本次完成范围。

## 布局与页面

- 保留蓝色卡片、首页/协作广场/我的三底栏、全部/本部门筛选。独立“新版工作台”和旧数据库调用入口已移除。
- 注册 10 个页面；开发者工具 0.3.11 实际完成全部 **20 项 WXML/WXSS 编译检查**。原始工作目录 16 个 JS 与 13 个 JSON 语法检查通过。
- 模拟器实际使用云端验收管理员登录，查看首页、协作广场与既有只读任务详情；退出后返回统一登录页，最新按钮全宽显示。
- 截图：[首页](evidence/mobile-home-final.png)、[协作广场](evidence/mobile-collaboration-final.png)、[详情](evidence/mobile-detail-final.png)、[登录](evidence/mobile-login-final.png)。截图为模拟器证据，不代表真机或微信正式发布。
- Windows 直接截图入口曾返回 `FrameArrived timed out: timed out waiting on channel`，重新定位后返回 `window capture timed out: timed out waiting on channel`；改用官方 `wechatide simulator_screenshot` 成功。登录页有会话时自动回首页，退出后成功补拍登录页。

## 本地与整合仓库验证

- 原 Web 工作目录 `npm test`、`npm run build` 成功；整合后的 `workbench/` 另行执行 `npm ci`、`npm test`、`npm run build` 均成功，不借用原目录依赖。
- 16 项后端测试通过：权限与版本、两位老师分工、源稿采编审核、并发幂等、事务回滚、自动归档、工时排除、轮值/默认承接、附件保护、核定/导出与封存。
- `tests/mobile-unification.mjs` 通过：四类身份、六业务创建、推文各角色完整两审归档、备注、私有附件上传及分段协议往返、公开报名去重、会话失效与非法网关请求。完整写入闭环在隔离的本地内存关系库完成，不推进现有云端任务。
- 整合仓库的 Spec Kit 前置检查成功定位 `workbench/specs/007-mini-unification`；需求质量清单 7/7 通过。未注册扩展 hooks。
- `node deployment/deploy-cloudbase.mjs --package-only` 在整合仓库成功生成部署包，未重新发布网页或修改生产数据。

## 真实云端联调

`tests/cloud-mobile.mjs` 于本轮执行成功，私有结果保存在原工作区 `.data/mobile-cloud-validation.json`，没有密码/令牌输出。仅写入并注销测试登录会话，未创建、推进或删除业务任务。

| 身份 | 手机可见任务数 | 同 token 在网页解析为同一身份 |
| --- | ---: | --- |
| 验收管理员 | 47 | 通过 |
| 运营部长 | 16 | 通过 |
| 运营干事 | 15 | 通过 |
| 指导老师 | 40 | 通过 |
| 外部组织 | 32 | 通过 |

私有附件 100 字节经真实云函数分段协议下载，与网页 API 下载字节一致；本人 member 工时过滤和非法路径拒绝成功。大文件多段及真机文件预览未作真实云端验证。

新增 `workbenchGateway` 为 Active、Nodejs24.11、256 MB、60 秒；云端修改时间 `2026-11-27 01:42:20`。旧 `api` 仍 Active，修改时间 `2026-11-04 22:48:50`，本次未部署。新版代码无旧文档库接口，本次不读写、不迁移、不删除旧生产库。

## 交付与限制

白名单包含小程序活动页面、固定网关、网页/API、迁移、规格、测试及部署文档。原小程序未提交的课程/个人资料没有整体带入；旧历史代码以明确标识保留用于追溯。`.env`、`.data`、验收密码、密钥、运行库、私有开发者配置和 node_modules 不交付；本机临时登录参数文件已移除。

暂存差异与本机已知生产凭据逐值扫描通过：私有文件未入暂存，凭据未出现在新增/修改内容，活动手机页面与已编译源文件一致，旧运行代码无改动。GitHub 推送待本次交付提交完成后更新。旧接入环境试用期 2026-12-11 到期，需续期或迁移网关。微信机器人/订阅消息未配置，站内消息可用。部署、页面去留与回退详见 [mini-unification.md](../../deployment/mini-unification.md)。
