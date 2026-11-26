# 小程序与网页统一部署、页面去留和回退

更新日期：2026-11-27。根目录是原生小程序，`workbench/` 是网页、唯一业务 API、关系数据库迁移、测试与 Spec Kit 文档。根目录 `cloudfunctions/api` 与课程 `docs/` 保留为历史参考，不是新版后端，也不应随新版部署。

## 当前云端拓扑

```text
网页 ─────────────────────────────────────┐
小程序 → cloud1 的 workbenchGateway ──────┤
                                        ↓
CloudBase 云托管 /api/v1 → 新环境 PG HTTPS/RPC + 私有对象存储
```

- 网页/API：`https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com`。
- 权威数据环境：`tccc-qncmzx-d0gxalbv77f0dae9f`，生产使用 `DATABASE_PROVIDER=cloudbase-http`，不需要 PG TCP 端口。
- 小程序当前关联环境：`cloud1-d2gd4994t925d1435`。仅新增 `workbenchGateway`，它不调用旧文档数据库、不包含云管理密钥、不复制状态机。
- 小程序通过云函数调用，无需在手机请求链路直接访问云托管域名；网页链接通过复制后在浏览器打开。直接 `wx.request` 模式仅作为将来完成合法域名配置后的选项。
- 旧环境试用期为 **2026-12-11** 到期。到期前需续期，或将小程序关联到新环境并迁移这个薄网关；当前方案不能越过旧环境到期限制。

## 页面去留

| 原入口 | 新版处理 |
| --- | --- |
| 首页、协作广场、我的 | 原位替换，保留蓝色卡片、三底栏、全部/本部门筛选 |
| 排版、采编办公、摄制、外部需求、设计、工作记录 | 统一到业务列表 `records`、发起 `create` 和详情 `taskDetail`，共用 API |
| 登录 | 原位替换为网页同账号登录；不使用旧身份缓存或旧角色 |
| 个人统计、工时规则、任务提醒 | 原位替换为本人工时、当前规则、本人站内消息 |
| 独立“新版工作台” | 删除，不注册、不提供第二套入口 |
| 自助注册、数据修复、测试重置、旧管理/成员页 | 移除手机入口；账号与规则在网页统一管理 |
| 周报、自由报表、封存、轮值/默认配置、精细选区批注 | 网页办理；手机详情保留进度、批注、材料和轻量操作 |
| 通讯录、建议/投票、独立公共文件库、模板示例、旧职责页 | 移除旧页面；任务材料归到各任务，避免继续读写旧库 |
| 旧 `api` 云函数、旧文档数据库与旧附件 | 线上保留且不改；源码与课程文档标识为历史，不参与新版 |

## 小程序部署

1. 在微信开发者工具导入**仓库根目录**，核对 `project.config.json` 的 AppID 和 `miniprogram/config.js` 的环境及固定上游。
2. 仅部署 `cloudfunctions/workbenchGateway`。配置在根 `cloudbaserc.json`：Nodejs24.11、`index.main`、256 MB、超时 60 秒，无第三方依赖。使用已登录的 CloudBase CLI：

   ```powershell
   tcb fn deploy workbenchGateway -e cloud1-d2gd4994t925d1435
   ```

3. 编译后使用既有网页账号登录。旧账号不会被自动迁移或根据姓名合并。不要上传旧 `api`、运行旧初始化/重置脚本，或调用旧 `uploadCloudFunction.sh`。
4. 检查首页/协作广场/我的、六类业务、权限、附件与工时。手机单文件上限 3 MiB；网页上限 12 MiB。附件从任务详情提交，失败保留补交入口。写操作超时先刷新核对，不自动重试。
5. 微信体验版上传、真机验证、审核和正式发布需在微信平台单独完成。本次未提交微信正式版审核。

## 网页部署与验证

```powershell
cd workbench
npm ci
npm test
npm run build
node deployment/deploy-cloudbase.mjs --package-only
```

`--package-only` 只生成不含凭据的构建包。生产部署使用已有受控的 `.data/cloud-runtime.json`、云端环境变量和 CloudBase CLI 登录态；这些资料不会进 Git。新电脑先按 `deployment/README.md` 与 `cloudbase-plan.md` 配置，不能把本地演示库当生产数据库。现有云端部署不依赖本机在线。

只读云端小程序验收：在 `workbench/.data/cloud-acceptance-accounts.json` 放本机私有验收资料后运行 `node tests/cloud-mobile.mjs`。它只创建/注销登录会话、读取任务和私有附件，不修改现有验收任务。勿用会修改轮值/默认配置的旧冒烟脚本替代。

## 迁移接入环境

在控制台确认 AppID 与目标环境已关联/同主体可用后，先把**相同**的 `workbenchGateway` 部署到目标环境，独立验证健康、登录、任务与附件，再修改 `miniprogram/config.js` 的 `env` 和 `cloudbaserc.json` 的环境。固定上游不变，因此无需搬迁业务表或合并旧文档库。配置指纹变化会使手机旧会话失效，用户重新登录。

后续若改为同环境 `callContainer` 或合法域名直连，先完成关联/域名验证再切换传输配置。旧环境数据删除属于另一次明确的数据处置，需先向用户说明并获得授权。

## 回退

- 代码：回到此大版本之前的提交 `6551d197`，重新上传对应小程序版本。旧库和旧 `api` 仍在，所以能恢复旧端；但**不会**自动看到新版 PG 中新产生的任务，不能同时让成员在两套库办理。
- 网关：回退到此前网关代码或切回先前接入环境；只回退传输，不清空 PG、不反向同步旧库。
- 网页：使用 CloudBase 云托管版本流量回退，保留 PG 与私有对象。涉及 schema 回退前先备份，不能仅靠 Git 还原数据。
- 本机原小程序改动已备份于原工作区 `.data/backups/mini-before-unification-20261127`；原始开发目录没有被 reset。

微信机器人/订阅消息尚未接通。站内通知可用，不能将站内事件当微信群已送达。
