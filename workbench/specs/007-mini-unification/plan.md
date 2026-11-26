# Implementation Plan: 两端统一与小程序原位重构

**Branch**: feat/unified-cloud-workbench | **Date**: 2026-11-27 | **Spec**: [spec.md](spec.md)

## Summary
保留原小程序蓝色卡片及三个底栏，原位替换为共享关系型业务。新增旧环境薄网关，复用云托管 API，不修改旧数据库。根目录为小程序，workbench/ 为 Web/后端。

## Technical Context
Language: 原生小程序 JavaScript/WXML/WXSS；Node.js 24、React19、Express5。Storage: CloudBase PG17 HTTPS/RPC 与现有私有存储；手机只缓存短期会话。Testing: node:test、真实本地 API 集成、DevTools 编译与云端请求。Target: 微信小程序与现有云托管。Scale: 六部门、21验收账号、六业务类型、三底栏及共享详情。
Performance: 列表一次请求、本地筛选；云端冷启动允许等待并显示加载状态。Constraints: 不自动重试写入；文件手机3MB/网页12MB；不碰旧生产库；不在客户端放云管理密钥。

## Constitution Check
I PASS: 长期基准与新决定入 specs/decisions.md。
II PASS: 同一 API、服务端权限，旧文档库不再参与新版。
III PASS: 沿用事务自动归档及一次计时。
IV PASS: 本人工时、例外备注、老师与外部无工时，封存不改。
V PASS: 规格→研究/规划→任务→只读分析→实施→实测；真机和发布未做时明确。
Phase 1复核：五项仍通过；无原则豁免。

## Project Structure
miniprogram/app.*、utils/api.js 与 model.js；pages/index、collaboration、profile、login、records、create、taskDetail、taskNotifications、statistics、allowanceRules；cloudfunctions/workbenchGateway/index.js；workbench/{server,src,tests,specs,deployment,.specify}。

## Phases
0 已完成：官方方法、环境实测、API只读研究（研究代理）、原布局检查。
1 已完成：research、data-model、contracts、quickstart，规格质量通过。
2 生成任务和跨文档一致性分析后实施；先备份/接入，再原位页面，最后集成测试、云验证及Git提交。

## Design specification
目的：在熟悉的手机版布局中完成真实工作。方向：保留原蓝色校内工具视觉。主蓝 #4A90D9/深蓝 #357ABD，背景 #F5F6FA，白卡片，正文 #263445，次字 #667085；绿色完成、橙色待办、红色退回。系统字体 PingFang SC / sans-serif，标题34–38rpx，正文28–30rpx，说明24–26rpx。左右32rpx留白、12rpx圆角、至少88rpx触控行高。协作广场纵向业务卡片和全部/本部门切换不变；底栏首页/协作广场/我的。详情分任务概况、版本材料、办理、时间线；不塞桌面报表到手机。

## Complexity Tracking
无章程偏离。薄网关是当前环境未关联时的过渡适配；后续同环境直连通过配置切换。
