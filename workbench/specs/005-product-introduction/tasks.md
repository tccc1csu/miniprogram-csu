# Tasks: 登录前介绍页

## Phase 1 / 2: 基础

- [x] T001 完成 specs/005-product-introduction 的规格、规划、设计和一致性审查。
- [x] T002 用 scripts/capture-product.mjs 生成 src/assets/landing 的三张隔离示例图。

## Phase 3: US1 了解与登录

- [x] T003 [US1] 在 src/LandingPage.jsx、src/landing.css 实现品牌首屏和左上登录布局，在 src/App.jsx 复用现有登录状态。
- [x] T004 [US1] 保留深链接和本地演示条件；演示入口折叠并适配 tests/browser.mjs。

## Phase 4: US2 真实功能展示

- [x] T005 [US2] 在 src/LandingPage.jsx 实现三项截图切换、可关闭的图片预览、六部门与归档功能介绍，标明示例与未接入能力。

## Phase 5: US3 首次指引

- [x] T006 [US3] 在 src/LandingPage.jsx 实现流程、五种角色指引、FAQ、回到登录和无 hash 污染的导航。

## Phase 6: 完善与验证

- [x] T007 在 src/landing.css 验证响应式、焦点、减少动态效果，并用 tests/landing.mjs 验证登录/深链接、交互和尺寸。
- [x] T008 构建并运行 tests/browser.mjs，保存截图和 specs/005-product-introduction/validation.md，启动本机供访问。

## Dependencies / Strategy

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008。先独立验收登录，再展示和指引，最后全链路回归。功能共用单个组件，顺序实施；截图核验与文案核验可独立进行，但本轮无需代理并行。
