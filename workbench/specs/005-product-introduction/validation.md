# 验证记录

日期：2026-11-26。

- 实际打开并截图查看 https://uuyc.163.com/，借鉴大标题、留白和分段产品展示节奏；未复用其商标和图片。
- scripts/capture-product.mjs 使用独立内存数据库，生成三张真实工作台 PNG。稿件示例通过真实批注接口保存意见后截图，未访问实际工作台任务或旧小程序库。
- npm run build 通过，三张图片合计约 223 KB，随 Vite dist 构建，无新增运行依赖。
- node tests/landing.mjs 通过：320/390/768/1024/1440px 均无横向溢出；桌面登录列约占布局 26%，首屏登录按钮可见；三项功能、五类身份指引、FAQ、截图预览、键盘焦点约束与恢复通过。
- 同一浏览器验证错误密码后重试、显示/隐藏密码、正确登录、任务深链接保持、已有会话直接进入、退出回到介绍页和本地折叠演示入口。
- npm run test:browser 通过：原有采编前审、文章预览批注、不同老师两审、默认承接和其他业务回归正常。本轮只适配测试打开折叠演示入口的动作。
- 已查看 artifacts/landing/hero.png、desktop.png、mobile.png 及公开产品截图，桌面和移动布局无裁切错位。
- 小程序正式入口和微信机器人在 FAQ 如实标注未启用/未接通。本轮未重新部署云端。
- 最终在 http://127.0.0.1:3001/#home 验证介绍页，健康检查 HTTP 200、浏览器无 pageerror；已保存最终桌面和移动截图。

产物：src/LandingPage.jsx、src/landing.css、src/assets/landing，及 artifacts/landing 的验收截图。本机以 node server/index.js --local 运行，避免未接通云配置影响预览。
