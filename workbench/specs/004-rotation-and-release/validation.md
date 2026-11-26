# 验证记录

- 本机 Web 备份后升级，GET /api/v1/health 返回 ok。
- npm test 16 项通过，其中包含实际 XLSX 单元格、封存备注、并发轮值及数据库附件。
- npm run build 和 npm run test:browser 通过，浏览器验证任务备注提交、轮值名单配置及既有业务。
- node tests/miniprogram.mjs 通过。使用小程序 JS 页面和真实本地 HTTP，验证登录、附件、网页采编审核及小程序查看进度。
- CloudBase CLI 登录及 PostgreSQL 管理 SQL 查询成功。2026-11-23 已读取本机 DATABASE_URL_POOL，创建 CloudBase 云托管容器服务 youth-media-workbench，并提交版本 001；云端镜像构建成功。
- 版本 001 部署失败，部署记录状态 deploy_failed。运行流程日志原文：`Readiness probe failed: dial tcp 10.34.12.236:8080: connect: connection refused`；CLI 原文：`Deployment failed: 创建版本失败：任务失败`。启动日志为空，尚未获得应用异常栈。
- 本机 pg 连接测试原文：`Connection terminated due to connection timeout`。当前连接串主机与管理 SQL 查询 inet_server_addr() 相同，不能视为已验证的客户端接入地址；需核实正式端点及网络要求。管理 SQL 可用不等于 pg 协议可达。
- 已分配默认域名 https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com，但 `/api/v1/health` 实测 HTTP 404、`SERVICE_VERSION_NOT_FOUND`，不能作为可用网站交付。T004 保持未完成。
- 2026-11-23 恢复本地服务使用 `node server/index.js --local`，避免新配置使本地试用切换到未连通的云库。
- 微信开发者工具 islogin 返回 wait IDE port timeout。未执行真机验证或发布。
- 已执行旧文档库只读审计，尚未导入。
