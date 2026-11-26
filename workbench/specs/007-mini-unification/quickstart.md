# Quickstart

1. 仓库根目录在微信开发者工具导入，AppID wx4972972007bb6a4e。开发者工具授权后打开首页。
2. Web：进入 workbench/，npm ci，npm test，npm run build；本地可 npm run dev，云端不依赖此进程。
3. 小程序：按 deployment/mini-unification.md 部署新增 workbenchGateway（不部署旧 api），使用网页账号登录。
4. 运行 node tests/mobile-unification.mjs（Web 根目录；仓库统一布局下自动寻找 ../miniprogram）。覆盖会话、六类入口、跨端任务、材料、权限和个人工时。
5. 开发者工具编译及截图，检查原三底栏与蓝色卡片、无新版工作台入口。验收账号密码从本机私有验收资料获取，不写入仓库。
6. 云端验收使用独立命名的测试任务，不清理/推进既有 47 个验收场景。微信正式发布单独执行，不把模拟器成功当审核发布成功。

继续本次 Spec Kit 工件时，在 `workbench/` 运行。当前 feature 指针是每台电脑的忽略文件，首次克隆可显式定位：

```powershell
$env:SPECIFY_FEATURE_DIRECTORY = 'specs/007-mini-unification'
.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks
```
