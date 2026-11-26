# 验证指南

1. npm run build，node tests/landing.mjs：隔离演示库验证公共页、登录错误、深链接、角色切换、截图预览、退出和 390/768/1440px 布局。
2. npm run test:browser：既有任务到归档报表链路回归。需要本机 Edge；不触碰真实云数据。
3. 若需重做截图：先 npm run build，再 node scripts/capture-product.mjs，再 npm run build。截图自动进入 src/assets/landing。
4. node server/index.js --local 启动本机 3001；退出登录后查看介绍页。截图含演示标签。云端尚未部署，微信不宣称接通。
