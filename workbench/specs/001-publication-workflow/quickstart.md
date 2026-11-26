# Quickstart
前置Node24，npm install；无Docker/Postgres也可本地运行。npm run db:seed仅非生产创建开发账号。
npm run dev启动Web与API，访问 http://localhost:5173 。npm test执行真实本地PG引擎集成测试，
npm run build构建，npm start运行 http://localhost:3001 。npm run test:browser验证桌面/手机并保存截图。
本地数据.data/，上传.data/uploads/。设置DATABASE_URL切换标准PG；不要将开发账号用于生产。
验证顺序：external供稿→minister派member→member交稿→minister内审→teacher一审/二审→member回填链接→自动归档→office查明细/核定/导出/封存。
正式云运行前：独立schema迁移、HTTPS会话、PG真实并发、对象存储、微信登录与域名、通知渠道逐项验证。
