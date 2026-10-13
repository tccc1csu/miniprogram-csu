# 交接说明（HANDOVER）

> 本文档面向**接手本项目的开发者及其 AI 助手**。
> 目标：读完本文 + `README.md`，AI 就能理解项目全貌并制定恢复/二次开发计划。

---

## 快速开始（给 AI 的指令模板）

如果你是接手方的 AI 助手，请按以下顺序执行：

```
1. 阅读本文件（HANDOVER.md）→ 理解公开版与真实版的差异
2. 阅读 README.md → 理解项目功能与部署方式
3. 请用户提供 SECRETS_INVENTORY.md → 补齐所有占位符
4. 按「恢复顺序」章节逐项执行
5. 恢复完成后再进行二次开发
```

**重要认知**：本仓库是**脱敏公开版**。所有 `YOUR_*` 形式的占位符都缺少真实值，必须先从 `SECRETS_INVENTORY.md` 获取。

---

## 一、项目是什么

一个**高校学生组织（青年传媒中心）的工作量与津贴统计小程序**，使用微信云开发（CloudBase）全栈实现。

| 维度 | 说明 |
| --- | --- |
| 形态 | 微信小程序 |
| 前端 | 原生小程序（WXML/WXSS/JS），21 个页面 |
| 后端 | 单个统一云函数 `cloudfunctions/api`（约 4200 行） |
| 数据库 | 微信云数据库，16 个集合 |
| 鉴权 | 微信 OpenID + 自建 Token 双轨，登录态 14 天 |
| 计费逻辑 | 按部门时薪 × 工时，含加急倍率 |

### 核心业务概念

1. **工时上报**：成员/部长上报每周工作内容与工时，按 4 种工作类型（稿件写作、视频制作、美编设计、日常办公）分类。
2. **津贴核算**：普通部门 10 元/小时，摄制部 12 元/小时，管理员可调。加急任务按倍率上浮。
3. **协作流程**：三套跨部门协同范式 ——
   - **采编办公协同**：采编部发起 → 办公部派发 → 干事反馈 → 管理员审核归档 → 自动核算工时
   - **摄制预约协作**：任意成员预约 → 摄制部派发 → 摄制干事完成 → 办公部归档 → 自动核算工时
   - **活动建议**：提交 → 审核 → 创建时间投票 → 投票 → 通知
4. **项目任务**（v2.0 新增）：项目按「阶段」推进，各部门标记本阶段完成，全部完成自动进入下一阶段，最后阶段完成则项目结束。
5. **文件库**（v2.0 新增）：云存储文件上传/下载/删除，按部门归档，含下载计数。

---

## 二、公开版与真实版的差异

公开版做了三类处理：

| 类型 | 处理方式 | 详见 |
| --- | --- | --- |
| **凭证类** | 替换为 `YOUR_*` 占位符 | SECRETS_INVENTORY.md A 组 |
| **业务配置** | 硬编码值移除 | SECRETS_INVENTORY.md B 组 |
| **标识信息** | 学校/组织名改为中性描述 | SECRETS_INVENTORY.md C 组 |

**未做处理（需注意）**：
- ⚠️ **Git 历史仍包含原始信息**（云环境 ID、AppID、作者邮箱）。若直接推送本仓库历史，等于没脱敏。见 SECRETS_INVENTORY.md C-2 的发布方式建议。
- 业务数据本就不在仓库（在云端），无需处理。

---

## 三、代码结构地图

```
miniprogram-1/
├── miniprogram/                    # 小程序前端
│   ├── app.js                      # ⚠️ CLOUD_ENV_ID 占位符在此
│   ├── app.json                    # 页面注册表（21 个页面）
│   ├── app.wxss                    # 全局样式
│   ├── envList.js                  # 云环境列表（空的）
│   ├── pages/
│   │   ├── login/ register/        # 登录注册
│   │   ├── index/                  # 首页（部门排名）
│   │   ├── records/ statistics/    # 记录、统计
│   │   ├── weeklyTable/            # 周报导出
│   │   ├── upload/                 # 工时上报
│   │   ├── manage/ memberDetail/   # 人员管理
│   │   ├── contacts/               # 通讯录
│   │   ├── collaboration/          # 协作广场（入口聚合）
│   │   ├── handoffs/               # 采编办公协同
│   │   ├── production/             # 摄制预约协作
│   │   ├── projectTasks/           # 项目任务（v2.0）
│   │   ├── fileLibrary/            # 文件库（v2.0）
│   │   ├── suggestions/            # 活动建议
│   │   ├── allowanceRules/         # 工时规则
│   │   ├── responsibilities/       # 部门职责
│   │   ├── taskNotifications/      # 任务提醒配置
│   │   └── profile/                # 个人中心（工具聚合）
│   └── utils/
│       ├── db.js                   # callFunction 封装（统一入口）
│       ├── util.js                 # 日期格式化等
│       ├── constants.js            # 常量
│       └── taskSubscription.js     # 订阅消息
├── cloudfunctions/
│   ├── api/                        # ⭐ 核心后端（单函数多 action）
│   │   ├── index.js                # ⚠️ ADMIN_INVITE_CODE 占位符在此
│   │   └── config.json             # 定时触发器 + 订阅消息权限
│   └── quickstartFunctions/        # 官方模板残留（可删）
├── server/                         # 旧版本地 Node+SQLite（历史遗留）
│   ├── server.js / db.js
│   └── data/app.db                 # 已 gitignore
├── docs/                           # 课程作业文档（199 个文件）
├── project.config.json             # ⚠️ appid 占位符在此
└── SECRETS_INVENTORY.md            # ⭐ 秘密清单（勿公开）
```

### 关键文件说明

**`cloudfunctions/api/index.js`** —— 整个后端。设计模式：

```js
exports.main = async (event) => {
  const functionName = event.functionName || event.name || event.type
  // 轻量鉴权函数快速返回，其余先确保集合齐全
  if (!isLightweightAuthFunction(functionName)) {
    await ensureCollections({ seed: shouldSeedForFunction(functionName) })
  }
  const user = await requireAuth(event, openid)
  // 按 functionName 路由到各个 handleXxx
}
```

前端统一通过 `miniprogram/utils/db.js` 的 `callFunction(name, data)` 调用，传 `functionName` 做路由。

### 已支持的云函数接口

`login` / `wechatLogin` / `bindWechat` / `checkSession` / `register` / `seedTestAccounts` / `initCloud` / `repairCollections`（后两个为维护用）/ `addRecord` / `getRecords` / `getStatistics` / `manageData` / `manageContacts` / `manageSuggestions` / `manageVotes` / `manageNotifications` / `manageHandoffs` / `manageAllowanceRules` / `manageResponsibilities` / `manageProjectTasks` / `manageFiles` / `manageTaskNotifications`

---

## 四、恢复顺序（接手方操作步骤）

### 阶段 1：环境准备

```bash
# 1. 获取代码
git clone <公开仓库地址>
cd miniprogram-1

# 2. 从秘密清单补齐占位符（手动）
#    - project.config.json  → appid
#    - miniprogram/app.js   → CLOUD_ENV_ID
#    - cloudfunctions/api/index.js → ADMIN_INVITE_CODE
```

### 阶段 2：微信侧配置

1. 在 [微信公众平台](https://mp.weixin.qq.com) 注册小程序，取得 **AppID**
2. 微信开发者工具导入项目，用 AppID 登录
3. 开通**云开发**，新建环境，取得**环境 ID**
4. 把环境 ID 填入 `miniprogram/app.js` 的 `CLOUD_ENV_ID`

### 阶段 3：部署后端

```
微信开发者工具 → 右键 cloudfunctions/api → 上传并部署：云端安装依赖
```

⚠️ **首次部署后必须触发一次业务操作**（如登录），让云函数冷启动执行 `ensureCollections()` 自动创建 16 个集合。

> 若集合仍缺失，可在管理员账号登录后点击「我的 → 修复数据表」，或调用 `repairCollections` 接口手动补齐。

### 阶段 4：初始化数据

1. 编译运行小程序
2. 注册管理员账号（选择「管理员」角色，输入自己设置的邀请码）
3. 「我的 → 人员与部门管理」维护部门与成员
4. 「我的 → 工时规则」配置时薪
5. 「我的 → 部门职责」配置协作流程关联部门

### 阶段 5：可选功能

- **任务提醒**：到公众平台配置订阅消息模板，在「我的 → 工具 → 任务提醒」填模板 ID
- **数据库索引**：到云开发控制台创建 README 列出的推荐索引（代码不自动建索引）

---

## 五、踩坑记录（重要）

这些都是实际遇到过的坑，能省下大量排查时间。

### ⚠️ 坑 1：老环境不会自动创建新集合

`cloudfunctions/api/index.js` 的 `ensureCollectionStructure()` 原本用「一次性标记」跳过初始化 —— 初始化完成后往 `notification_settings` 写标记，之后冷启动直接 return。

**后果**：给**已存在的老环境**升级版本时，新增的集合（如 v2.0 的 `project_tasks`、`files`）永远不会被创建，前端报 `-502005 database collection not exists`。

**已修复**：现在改成每次冷启动都执行 `createCollection` 遍历（幂等，开销极小），只有默认数据仍用标记跳过。并新增 `repairCollections` 接口与「修复数据表」入口。

> 接手方如果从更早版本迁移，注意检查这一处。

### ⚠️ 坑 2：`getDoc` 必须传集合名字符串

```js
async function getDoc(collection, id) {
  const res = await db.collection(collection).doc(id).get()
  //                          ^^^^^^^^^^ 必须是字符串，不能传 Collection 对象
}
```

传 `db.collection(...)` 的返回值会把对象当集合名，查询静默失败返回 `null`，前端表现为「项目不存在」「文件不存在」。

**注意**：同一个 handler 里 `collection.doc(id).update()` 传对象是**正确**的，只有 `getDoc` 这个 helper 需要字符串。不要无脑全局替换。

### ⚠️ 坑 3：函数重复声明会静默覆盖

曾出现同一文件里 `formatDateTime` 被声明两次，后者无空值保护，函数提升后覆盖了前者，导致 `formatDateTime(undefined)` 抛 `Cannot read properties of undefined (reading 'getFullYear')`。

**排查手法**：
```bash
grep -oE "^(async )?function [A-Za-z0-9_]+" file.js | sed -E 's/^(async )?function //' | sort | uniq -d
```

### ⚠️ 坑 4：前端 toast 报错可能来自云函数

云函数抛的错误会被前端 `.catch(err => showToast(err.message))` 原样显示。所以「前端报错」不等于「前端代码有问题」，先确认是哪个 `callFunction` 触发的。

### ⚠️ 坑 5：「重置测试数据」会清空整个云环境

该功能删除**全部**账号、业务数据和配置，再注入演示数据。只能在测试环境使用。

---

## 六、可选加固建议

接手后建议做的改进：

1. **邀请码改环境变量**
   ```js
   // 云函数环境变量中配置 ADMIN_INVITE_CODE
   const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE || ''
   ```
   避免再次硬编码进仓库。

2. **密码哈希算法确认**
   查看 `hashPassword()` 实现，确认是否使用了足够强的算法（如 SHA-256 + salt）。当前测试密码 `123456` 极弱，生产环境务必强制强密码。

3. **集合权限**
   云开发控制台把 16 个集合的权限设为「仅云函数可读写」，确保小程序端不能直接操作数据库。

4. **删除无用文件**
   - `cloudfunctions/quickstartFunctions/` 是官方模板残留
   - `server/` 是旧版本地实现，确认不再需要后可删
   - `miniprogram/pages/example/` 是官方示例页

5. **清理 Git 历史**
   见 SECRETS_INVENTORY.md C-2。

---

## 七、发布方式建议

⚠️ **重要**：当前仓库的 Git 历史**包含原始敏感信息**（云环境 ID、真实 AppID、作者邮箱）。即使当前文件已脱敏，直接 push 历史等于没脱敏。

**推荐做法（干净快照）**：

```bash
# 1. 在脱敏后的工作区里，删除 .git 重新初始化
cd miniprogram-1
rm -rf .git
git init
git add .
git commit -m "Initial commit: 高校学生组织工作量统计小程序"

# 2. 关联全新的空仓库
git remote add origin https://github.com/<你的账号>/<新仓库>.git
git branch -M main
git push -u origin main
```

这样历史里只有一个提交，不含任何旧信息。

**替代方案**：用 `git filter-repo` 重写历史（会改变所有 commit hash，协作者需重新克隆）。

**验证是否干净**（把 `<敏感值>` 换成你要检查的真实值，值从秘密清单取）：

```bash
# 确认敏感值不在任何历史提交中
git log --all -S '<云环境ID>' --oneline
git log --all -S '<小程序AppID>' --oneline
git log --all -S '<管理员邀请码>' --oneline
# 无输出 = 干净
```

**发布前自检清单**：

```bash
# 1. 工作区里不应残留真实值
grep -rn "cloud1-\|wx[0-9a-f]\{16\}" --include=*.js --include=*.json --include=*.md . \
  | grep -v node_modules | grep -v SECRETS_INVENTORY

# 2. 秘密清单不应被跟踪
git check-ignore -v SECRETS_INVENTORY.md   # 应有输出（表示已忽略）
git ls-files | grep SECRETS                # 应为空

# 3. 确认没有 .env 之类文件被提交
git ls-files | grep -iE "\.env|secret|credential"
```

> ⚠️ **关键**：`SECRETS_INVENTORY.md` 里记录了真实值，**必须**加入 `.gitignore`，绝不能推送到公开仓库。

---

*本文档与 `SECRETS_INVENTORY.md` 配套使用。公开版应只保留本文档，秘密清单由负责人单独保管。*
