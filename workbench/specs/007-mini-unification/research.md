# Research

## 接入方式
Decision: 使用已关联环境 cloud1-d2gd4994t925d1435 的新增 workbenchGateway 云函数作为固定 API 适配器，转发现有 HTTPS 云托管。两端数据均在 tccc-qncmzx-d0gxalbv77f0dae9f 的 PG 与私有桶。
Rationale: 2026-11-26 开发者工具 cloud_env_list 实测 AppID 仅关联 cloud1；新环境无法直接 callContainer。薄适配无旧文档库写入，用户不需先改变环境关联；不存服务端密钥。
Alternatives: 直接 wx.request 需要正式合法域名；callContainer 需要关联/同主体共享。均保留集中配置，不冒充已关联。
Evidence: https://docs.cloudbase.net/run/develop/access/mini；本机官方 CloudBase miniprogram-development 技能、wechatide 0.3.11、CloudBase CLI 3.9.4。

## 文件
Decision: 网关上传使用 base64，移动端单文件最多 3 MB；网页仍为 12 MB。下载分段返回 192 KiB，手机重组后本地预览，不暴露私有桶链接。
Rationale: 避免大响应超过同步云函数限制，上传前显示限额；新接口不需要旧云存储。
Alternatives: 临时上传旧桶会引入两套存储及清理义务，因此不采用；正式新环境直连可再提升移动上传上限。

## 现有契约与布局
Decision: 沿用现有 /api/v1；权限以后端为准，移动按钮依据状态和角色显示；viewer.action 仅用于主待办。个人工时显式 member=id。
Rationale: 只读研究代理检查六类业务已具备；外部公开报名使用列表安全字段，不能打开完整详情。用户补充要求保留原蓝色卡片及三底栏，取代此前四入口设计。
Alternatives: 新建独立工作台入口会保留两套使用路径，已被用户明确否决。

## 环境与仓库
Decision: 旧环境/数据库零删除，新增函数独立命名；本地原内容先备份；从原仓库 main 建立干净集成分支，根目录为小程序，workbench/ 为 Web 和后端。
Rationale: 原 mini 工作树有大量未提交工作，不能直接批量提交或重置。GitHub 原历史保留。
Risk: cloud1 试用期到 2026-12-11，最终需续期或关联新环境并迁移网关；不会承诺试用环境永久可用。
