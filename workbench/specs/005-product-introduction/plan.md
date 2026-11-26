# Implementation Plan: 登录前产品介绍页

**Branch**: 005-product-introduction（文档标识，目录无 Git） | **Date**: 2026-11-26 | **Spec**: [spec.md](spec.md)

## Summary

在现有未登录分支渲染介绍页。首屏为左侧约 27% 登录列与右侧介绍/产品截图；以下为功能切换、工作流程、角色指引、FAQ 和返回登录。遵循现有品牌，以深绿、暖白、橙色形成清晰视觉层级。

## Technical Context

**Language/Version**: JavaScript / JSX，Node 24。
**Primary Dependencies**: 现有 React 19、Vite 7、lucide-react；不新增前端依赖。
**Storage**: 新功能无数据库迁移；截图来自内存 PGlite 的 seed / seedExamples。
**Testing**: Vite build；Playwright + 已安装 Edge；既有 browser.mjs 回归。
**Target Platform**: 桌面与移动浏览器。
**Project Type**: React + Express Web 应用。
**Performance Goals**: 静态截图随构建，后续展示图懒加载、固定比例避免跳动；无外部字体、视频或追踪脚本。
**Constraints**: 不改变服务端身份认证，不公开真实数据，不宣称微信已接入；介绍页导航不改变 hash。
**Scale/Scope**: 一个公开页面、三项截图展示、五组角色指引、常见问题。

## Constitution Check

设计前/后均通过：沿用业务基准；权限和事务未变；自动归档和核定说明准确；独立演示库生成资产，不读生产；仅本机交付，不假称云联调成功。无新增未知技术或需研究代理的未决问题。

## Project Structure

```text
specs/005-product-introduction/{spec,plan,research,data-model,quickstart,tasks,validation}.md
specs/005-product-introduction/contracts/ui.md
src/LandingPage.jsx
src/landing.css
src/assets/landing/{tasks,review,reports}.png
src/App.jsx
scripts/capture-product.mjs
tests/landing.mjs
tests/browser.mjs
```

**Structure Decision**: 用独立 LandingPage 接收现有 Login 表单作为插槽；样式均限于 .landing，避免工作台回归。PNG 用 ES 模块导入，让 Vite 将截图包含在现有 Docker 的 dist 中。

## Complexity Tracking

无章程例外；不新增路由或后端服务。
